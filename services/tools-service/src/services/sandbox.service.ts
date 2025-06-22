import { VM, VMScript } from 'vm2';
import Dockerode from 'dockerode';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ResourceLimits, ToolExecution, updateExecution } from '../models/tool.model';

// Docker client for container-based isolation
const docker = new Dockerode();

// Environment configuration
const SANDBOX_ENABLED = process.env.SANDBOX_ENABLED === 'true';
const DEFAULT_MAX_EXECUTION_TIME = parseInt(process.env.MAX_EXECUTION_TIME_MS || '5000', 10);
const DEFAULT_MAX_MEMORY = parseInt(process.env.MAX_MEMORY_MB || '512', 10);

/**
 * SandboxService handles secure code execution in isolated environments
 */
export class SandboxService {
  /**
   * Execute code in a VM2 sandbox with strict resource limits
   * @param code The code to execute
   * @param resourceLimits Resource limits for the execution
   * @param executionId Optional execution ID for tracking
   */
  async executeInVM2(code: string, resourceLimits: ResourceLimits, executionId?: string): Promise<any> {
    const startTime = Date.now();
    let result;
    let error = null;

    // Set default timeout if not specified
    const timeout = resourceLimits.maxExecutionTimeMs || DEFAULT_MAX_EXECUTION_TIME;

    // Create a new VM with strict limitations
    const vm = new VM({
      timeout, // Maximum execution time
      sandbox: {}, // Empty sandbox environment
      eval: false, // Disable eval
      wasm: false, // Disable WebAssembly
      fixAsync: true, // Properly handle async code
      allowAsync: true // Allow asynchronous code
    });

    try {
      // Create and run the script
      const script = new VMScript(code);
      result = await vm.run(script);

      // Update execution record if ID was provided
      if (executionId) {
        updateExecution(executionId, {
          status: 'completed',
          result,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: process.memoryUsage().heapUsed / 1024 / 1024
          }
        });
      }

      return result;
    } catch (err: any) {
      error = err.message || 'Unknown error during VM execution';
      
      // Update execution record with failure details
      if (executionId) {
        updateExecution(executionId, {
          status: 'failed',
          error,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: process.memoryUsage().heapUsed / 1024 / 1024
          }
        });
      }

      throw new Error(`Execution failed: ${error}`);
    }
  }

  /**
   * Execute code in a Docker container for stronger isolation
   * @param code The code to execute
   * @param language The programming language (e.g., 'javascript', 'python')
   * @param resourceLimits Resource limits for the execution
   * @param executionId Optional execution ID for tracking
   */
  async executeInContainer(code: string, language: string, resourceLimits: ResourceLimits, executionId?: string): Promise<any> {
    if (!SANDBOX_ENABLED) {
      throw new Error('Container-based sandbox is disabled');
    }

    // Language configurations
    const langConfigs: Record<string, { image: string, extension: string, command: string }> = {
      javascript: { image: 'node:18-alpine', extension: 'js', command: 'node' },
      typescript: { image: 'node:18-alpine', extension: 'ts', command: 'npx ts-node' },
      python: { image: 'python:3.9-alpine', extension: 'py', command: 'python' },
    };

    const config = langConfigs[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const startTime = Date.now();
    const containerName = `opencode-sandbox-${uuidv4()}`;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-'));
    const codeFilePath = path.join(tempDir, `code.${config.extension}`);
    const resultFilePath = path.join(tempDir, 'result.json');
    
    try {
      // Write code to a temporary file
      await fs.writeFile(codeFilePath, code);
      
      // Create and run Docker container
      const container = await docker.createContainer({
        Image: config.image,
        name: containerName,
        Cmd: ['sh', '-c', `${config.command} /code/code.${config.extension} > /code/result.json 2>&1 || echo "Execution failed: $?" > /code/result.json`],
        HostConfig: {
          Binds: [`${tempDir}:/code`],
          Memory: (resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY) * 1024 * 1024, // Convert MB to bytes
          MemorySwap: (resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY) * 1024 * 1024, // Disable swap
          CpuPeriod: 100000,
          CpuQuota: resourceLimits.maxCpuPercent ? resourceLimits.maxCpuPercent * 1000 : 50000, // Limit CPU usage
          NetworkMode: resourceLimits.networkAccess ? 'bridge' : 'none', // Control network access
          AutoRemove: true, // Automatically remove container when it exits
        },
        StopTimeout: Math.ceil(resourceLimits.maxExecutionTimeMs / 1000) || 5, // Convert ms to seconds
      });

      // Start container
      await container.start();

      // Wait for container to finish (with timeout)
      const timeout = resourceLimits.maxExecutionTimeMs || DEFAULT_MAX_EXECUTION_TIME;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timed out')), timeout);
      });

      await Promise.race([
        container.wait(),
        timeoutPromise
      ]);

      // Read result
      const resultStr = await fs.readFile(resultFilePath, 'utf8');
      let result;
      try {
        result = JSON.parse(resultStr);
      } catch (e) {
        result = resultStr;
      }

      // Update execution record if ID was provided
      if (executionId) {
        updateExecution(executionId, {
          status: 'completed',
          result,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
          }
        });
      }

      return result;
    } catch (err: any) {
      const error = err.message || 'Unknown error during container execution';
      
      // Update execution record with failure details
      if (executionId) {
        updateExecution(executionId, {
          status: 'failed',
          error,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
          }
        });
      }

      throw new Error(`Container execution failed: ${error}`);
    } finally {
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        
        // Try to stop and remove container if it's still running
        const containerList = await docker.listContainers({ 
          all: true,
          filters: { name: [containerName] } 
        });
        
        if (containerList.length > 0) {
          const container = docker.getContainer(containerList[0].Id);
          await container.stop().catch(() => {});
          await container.remove().catch(() => {});
        }
      } catch (e) {
        // Ignore cleanup errors
        console.error('Error during sandbox cleanup:', e);
      }
    }
  }

  /**
   * Monitor resource usage of a process
   * @param pid Process ID to monitor
   * @param resourceLimits Resource limits
   * @returns Promise that resolves when monitoring is complete
   */
  async monitorResourceUsage(pid: number, resourceLimits: ResourceLimits): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          // This is a simplified implementation that would need to be expanded
          // in a real-world scenario with proper process monitoring
          const memoryUsage = process.memoryUsage().rss / 1024 / 1024; // Convert to MB
          
          if (memoryUsage > (resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY)) {
            // Memory limit exceeded, kill process
            process.kill(pid, 'SIGTERM');
            clearInterval(interval);
            resolve();
          }
        } catch (e) {
          // Process no longer exists
          clearInterval(interval);
          resolve();
        }
      }, 100); // Check every 100ms
      
      // Set timeout for maximum execution time
      setTimeout(() => {
        clearInterval(interval);
        try {
          process.kill(pid, 'SIGTERM');
        } catch (e) {
          // Process already gone
        }
        resolve();
      }, resourceLimits.maxExecutionTimeMs || DEFAULT_MAX_EXECUTION_TIME);
    });
  }
}