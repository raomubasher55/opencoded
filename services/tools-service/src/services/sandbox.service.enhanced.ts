import { VM, VMScript } from 'vm2';
import Dockerode from 'dockerode';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ResourceLimits } from '../models/tool.model';
import toolRepository from '../models/tool.model.mongodb';
import { createTempExecutionDir, cleanupTempDir } from '../utils/execution.utils';
import { EventEmitter } from 'events';

// Docker client for container-based isolation
const docker = new Dockerode();

// Environment configuration
const SANDBOX_ENABLED = process.env.SANDBOX_ENABLED === 'true';
const DEFAULT_MAX_EXECUTION_TIME = parseInt(process.env.MAX_EXECUTION_TIME_MS || '5000', 10);
const DEFAULT_MAX_MEMORY = parseInt(process.env.MAX_MEMORY_MB || '512', 10);

// Supported languages configuration
interface LanguageConfig {
  image: string;
  extension: string;
  command: string;
  setupCommands?: string[];
  fileNames?: Record<string, string>;
  testFramework?: {
    command: string;
    configFile: string;
  };
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  javascript: { 
    image: 'node:18-alpine', 
    extension: 'js', 
    command: 'node',
    setupCommands: ['npm init -y'],
    fileNames: {
      main: 'index.js',
      test: 'test.js'
    },
    testFramework: {
      command: 'npx jest',
      configFile: 'jest.config.js'
    }
  },
  typescript: { 
    image: 'node:18-alpine', 
    extension: 'ts', 
    command: 'npx ts-node',
    setupCommands: [
      'npm init -y', 
      'npm install typescript ts-node @types/node --no-save',
      'npx tsc --init'
    ],
    fileNames: {
      main: 'index.ts',
      test: 'test.ts'
    },
    testFramework: {
      command: 'npx jest',
      configFile: 'jest.config.js'
    }
  },
  python: { 
    image: 'python:3.9-alpine', 
    extension: 'py', 
    command: 'python',
    fileNames: {
      main: 'main.py',
      test: 'test_main.py'
    },
    testFramework: {
      command: 'python -m pytest',
      configFile: 'pytest.ini'
    }
  },
  java: {
    image: 'openjdk:17-alpine',
    extension: 'java',
    command: 'java',
    setupCommands: ['mkdir -p src/main/java src/test/java'],
    fileNames: {
      main: 'Main.java',
      test: 'MainTest.java'
    },
    testFramework: {
      command: './gradlew test',
      configFile: 'build.gradle'
    }
  },
  go: {
    image: 'golang:1.18-alpine',
    extension: 'go',
    command: 'go run',
    setupCommands: ['go mod init temp'],
    fileNames: {
      main: 'main.go',
      test: 'main_test.go'
    },
    testFramework: {
      command: 'go test',
      configFile: 'go.mod'
    }
  },
  rust: {
    image: 'rust:1.60-alpine',
    extension: 'rs',
    command: 'rustc -o main',
    setupCommands: ['cargo init --name temp'],
    fileNames: {
      main: 'main.rs',
      test: 'main_test.rs'
    },
    testFramework: {
      command: 'cargo test',
      configFile: 'Cargo.toml'
    }
  }
};

// Execution result interface
export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTimeMs: number;
  maxMemoryMB: number;
  artifacts?: Record<string, string>; // Paths to output files
}

/**
 * Enhanced SandboxService with support for more languages and execution modes
 */
export class SandboxService extends EventEmitter {
  /**
   * Execute code in a VM2 sandbox with strict resource limits
   * @param code The code to execute
   * @param resourceLimits Resource limits for the execution
   * @param executionId Optional execution ID for tracking
   */
  async executeInVM2(code: string, resourceLimits: ResourceLimits, executionId?: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    let result;
    let error: string | undefined;
    let success = false;

    // Set default timeout if not specified
    const timeout = resourceLimits.maxExecutionTimeMs || DEFAULT_MAX_EXECUTION_TIME;

    // Create a new VM with strict limitations
    const vm = new VM({
      timeout, // Maximum execution time
      sandbox: {
        console: {
          log: (...args: any[]) => {
            this.emit('log', { executionId, type: 'stdout', message: args.join(' ') });
          },
          error: (...args: any[]) => {
            this.emit('log', { executionId, type: 'stderr', message: args.join(' ') });
          }
        }
      },
      eval: false, // Disable eval
      wasm: false, // Disable WebAssembly
      fixAsync: true, // Properly handle async code
      allowAsync: true // Allow asynchronous code
    });

    try {
      // Wrap code to capture stdout and return last expression
      const wrappedCode = `
        let __output = [];
        let __result;
        const __originalLog = console.log;
        console.log = function(...args) {
          __output.push(args.join(' '));
          __originalLog.apply(console, args);
        };
        
        try {
          __result = (function() {
            ${code}
          })();
        } catch (e) {
          __result = { error: e.toString() };
        }
        
        ({ output: __output.join("\\n"), result: __result });
      `;

      // Create and run the script
      const script = new VMScript(wrappedCode);
      const vmResult = await vm.run(script);
      success = !vmResult.error;
      
      result = vmResult.result;
      const output = vmResult.output;

      // Update execution record if ID was provided
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: success ? 'completed' : 'failed',
          result: { result, output },
          error: vmResult.error,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: process.memoryUsage().heapUsed / 1024 / 1024
          }
        });
      }

      return {
        success,
        output,
        error: vmResult.error,
        executionTimeMs: Date.now() - startTime,
        maxMemoryMB: process.memoryUsage().heapUsed / 1024 / 1024
      };
    } catch (err: any) {
      error = err.message || 'Unknown error during VM execution';
      
      // Update execution record with failure details
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: 'failed',
          error,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: process.memoryUsage().heapUsed / 1024 / 1024
          }
        });
      }

      return {
        success: false,
        error,
        executionTimeMs: Date.now() - startTime,
        maxMemoryMB: process.memoryUsage().heapUsed / 1024 / 1024
      };
    }
  }

  /**
   * Execute code in a Docker container for stronger isolation
   * @param code The code to execute
   * @param language The programming language (e.g., 'javascript', 'python')
   * @param resourceLimits Resource limits for the execution
   * @param executionId Optional execution ID for tracking
   * @param options Additional execution options
   */
  async executeInContainer(
    code: string, 
    language: string, 
    resourceLimits: ResourceLimits, 
    executionId?: string,
    options: {
      testCode?: string;
      runTests?: boolean;
      dependencies?: string[];
      entrypoint?: string;
    } = {}
  ): Promise<ExecutionResult> {
    if (!SANDBOX_ENABLED) {
      throw new Error('Container-based sandbox is disabled');
    }

    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const startTime = Date.now();
    const containerName = `opencode-sandbox-${uuidv4()}`;
    const tempDir = await createTempExecutionDir();
    
    // Determine main file name
    const mainFileName = options.entrypoint || config.fileNames?.main || `main.${config.extension}`;
    const mainFilePath = path.join(tempDir, mainFileName);
    
    // Test file if provided
    let testFilePath: string | undefined;
    if (options.testCode && options.runTests) {
      const testFileName = config.fileNames?.test || `test.${config.extension}`;
      testFilePath = path.join(tempDir, testFileName);
    }
    
    // Result file to capture output
    const resultFilePath = path.join(tempDir, 'result.json');
    
    // Track artifacts created during execution
    const artifacts: Record<string, string> = {};
    
    try {
      // Write code to a temporary file
      await fs.writeFile(mainFilePath, code);
      artifacts['main'] = mainFilePath;
      
      // Write test code if provided
      if (testFilePath && options.testCode) {
        await fs.writeFile(testFilePath, options.testCode);
        artifacts['test'] = testFilePath;
      }
      
      // Create dependencies file if needed (e.g., package.json, requirements.txt)
      if (options.dependencies && options.dependencies.length > 0) {
        switch (language) {
          case 'javascript':
          case 'typescript':
            // For JS/TS, add to package.json
            const packageJsonPath = path.join(tempDir, 'package.json');
            await fs.writeFile(packageJsonPath, JSON.stringify({
              name: 'temp-project',
              version: '1.0.0',
              private: true,
              dependencies: options.dependencies.reduce((deps, dep) => {
                // Parse dependencies like "lodash@4.17.21" or just "lodash"
                const [name, version] = dep.split('@');
                deps[name] = version || 'latest';
                return deps;
              }, {} as Record<string, string>)
            }, null, 2));
            artifacts['package.json'] = packageJsonPath;
            break;
            
          case 'python':
            // For Python, create requirements.txt
            const requirementsPath = path.join(tempDir, 'requirements.txt');
            await fs.writeFile(requirementsPath, options.dependencies.join('\n'));
            artifacts['requirements.txt'] = requirementsPath;
            break;
            
          case 'java':
            // For Java, dependencies would be handled differently (Maven/Gradle)
            // This is a simplified implementation
            break;
            
          case 'go':
            // For Go, dependencies would be in go.mod
            break;
            
          case 'rust':
            // For Rust, dependencies would be in Cargo.toml
            break;
        }
      }
      
      // Prepare command for execution
      let executionCommand: string;
      
      if (options.runTests && config.testFramework) {
        // Run tests
        executionCommand = config.testFramework.command;
      } else {
        // Run main code
        executionCommand = `${config.command} ${mainFileName}`;
      }
      
      // Create command with setup and execution
      const fullCommand = [
        ...(config.setupCommands || []),
        ...(options.dependencies && options.dependencies.length > 0 
          ? language === 'javascript' || language === 'typescript' 
            ? ['npm install'] 
            : language === 'python' 
              ? ['pip install -r requirements.txt'] 
              : []
          : []),
        `${executionCommand} > /code/result.json 2>&1 || echo "{\\"error\\": \\"Execution failed with exit code $?.\\"}" > /code/result.json`
      ].join(' && ');
      
      // Update execution status if ID was provided
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: 'running'
        });
      }
      
      // Create and run Docker container
      const container = await docker.createContainer({
        Image: config.image,
        name: containerName,
        Cmd: ['sh', '-c', fullCommand],
        WorkingDir: '/code',
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

      // Monitor container logs
      container.attach({ stream: true, stdout: true, stderr: true }, (err, stream) => {
        if (err || !stream) return;
        
        stream.on('data', (chunk: Buffer) => {
          const logMessage = chunk.toString('utf8');
          this.emit('log', { executionId, type: 'container', message: logMessage });
        });
      });

      // Start container
      await container.start();
      
      // Setup an interval to check container stats
      const statsInterval = setInterval(async () => {
        try {
          const stats = await container.stats({ stream: false });
          const memoryUsage = stats.memory_stats.usage / (1024 * 1024); // Convert to MB
          const cpuPercent = this.calculateCPUPercentage(stats);
          
          this.emit('stats', { 
            executionId, 
            stats: {
              memoryUsageMB: memoryUsage,
              cpuPercent
            } 
          });
        } catch (e) {
          // Container might have exited
          clearInterval(statsInterval);
        }
      }, 1000);

      // Wait for container to finish (with timeout)
      const timeout = resourceLimits.maxExecutionTimeMs || DEFAULT_MAX_EXECUTION_TIME;
      const timeoutPromise = new Promise<{ StatusCode: number }>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timed out')), timeout);
      });

      const waitResult = await Promise.race([
        container.wait(),
        timeoutPromise
      ]);
      
      // Clear the stats interval
      clearInterval(statsInterval);

      // Read result
      let resultStr: string;
      try {
        resultStr = await fs.readFile(resultFilePath, 'utf8');
      } catch (e) {
        resultStr = JSON.stringify({ error: 'Failed to read execution result' });
      }
      
      let result: any;
      let success = false;
      let output: string | undefined;
      let errorMsg: string | undefined;
      
      try {
        result = JSON.parse(resultStr);
        success = !result.error;
        output = result.output || resultStr;
        errorMsg = result.error;
      } catch (e) {
        // If not valid JSON, treat as plain output
        success = waitResult.StatusCode === 0;
        output = resultStr;
        errorMsg = success ? undefined : `Execution failed with exit code ${waitResult.StatusCode}`;
      }

      // Create additional artifacts if they were generated
      try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          // Skip already tracked files
          if (Object.values(artifacts).includes(path.join(tempDir, file))) {
            continue;
          }
          
          const filePath = path.join(tempDir, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile() && file !== 'result.json') {
            artifacts[file] = filePath;
          }
        }
      } catch (e) {
        // Ignore errors when reading artifacts
      }

      // Update execution record if ID was provided
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: success ? 'completed' : 'failed',
          result: { output, artifacts: Object.keys(artifacts) },
          error: errorMsg,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
          }
        });
      }

      return {
        success,
        output,
        error: errorMsg,
        executionTimeMs: Date.now() - startTime,
        maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY,
        artifacts
      };
    } catch (err: any) {
      const error = err.message || 'Unknown error during container execution';
      
      // Update execution record with failure details
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: 'failed',
          error,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
          }
        });
      }

      return {
        success: false,
        error,
        executionTimeMs: Date.now() - startTime,
        maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY,
        artifacts
      };
    } finally {
      // Clean up temporary files
      try {
        await cleanupTempDir(tempDir);
        
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
   * Calculate CPU percentage from Docker stats
   */
  private calculateCPUPercentage(stats: any): number {
    try {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      
      if (systemDelta > 0 && cpuDelta > 0) {
        return (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0;
      }
    } catch (e) {
      // Ignore errors when calculating CPU percentage
    }
    
    return 0;
  }
  
  /**
   * Run a specific language tool (like linter, formatter, etc.)
   */
  async runLanguageTool(
    code: string,
    language: string,
    toolName: string,
    options: Record<string, any>,
    resourceLimits: ResourceLimits,
    executionId?: string
  ): Promise<ExecutionResult> {
    // Only container execution is supported for language tools
    if (!SANDBOX_ENABLED) {
      throw new Error('Container-based sandbox is required for language tools');
    }
    
    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    const startTime = Date.now();
    const containerName = `opencode-langtool-${uuidv4()}`;
    const tempDir = await createTempExecutionDir();
    
    // Main file for the code
    const mainFileName = config.fileNames?.main || `main.${config.extension}`;
    const mainFilePath = path.join(tempDir, mainFileName);
    
    // Config file for the tool
    const configFilePath = path.join(tempDir, `.${toolName}rc.json`);
    
    // Result file
    const resultFilePath = path.join(tempDir, 'result.json');
    
    try {
      // Write code to a temporary file
      await fs.writeFile(mainFilePath, code);
      
      // Write tool configuration if provided
      if (options.config) {
        await fs.writeFile(configFilePath, JSON.stringify(options.config, null, 2));
      }
      
      // Determine the tool command based on language and tool name
      let toolCommand: string;
      
      // Configure common language tools
      switch (toolName) {
        case 'lint':
          if (language === 'javascript' || language === 'typescript') {
            toolCommand = 'npx eslint';
          } else if (language === 'python') {
            toolCommand = 'pylint';
          } else {
            throw new Error(`Linting not supported for language: ${language}`);
          }
          break;
          
        case 'format':
          if (language === 'javascript' || language === 'typescript') {
            toolCommand = 'npx prettier';
          } else if (language === 'python') {
            toolCommand = 'black';
          } else if (language === 'go') {
            toolCommand = 'go fmt';
          } else {
            throw new Error(`Formatting not supported for language: ${language}`);
          }
          break;
          
        case 'typecheck':
          if (language === 'typescript') {
            toolCommand = 'npx tsc --noEmit';
          } else if (language === 'python') {
            toolCommand = 'mypy';
          } else {
            throw new Error(`Type checking not supported for language: ${language}`);
          }
          break;
          
        default:
          throw new Error(`Unknown language tool: ${toolName}`);
      }
      
      // Create setup commands
      const setupCommands = [
        ...(config.setupCommands || [])
      ];
      
      // Add tool-specific setup
      if (language === 'javascript' || language === 'typescript') {
        if (toolName === 'lint') {
          setupCommands.push('npm init -y', 'npm install eslint --no-save');
        } else if (toolName === 'format') {
          setupCommands.push('npm init -y', 'npm install prettier --no-save');
        }
      } else if (language === 'python') {
        if (toolName === 'lint') {
          setupCommands.push('pip install pylint');
        } else if (toolName === 'format') {
          setupCommands.push('pip install black');
        } else if (toolName === 'typecheck') {
          setupCommands.push('pip install mypy');
        }
      }
      
      // Create full command
      const fullCommand = [
        ...setupCommands,
        `${toolCommand} ${mainFileName} > /code/result.json 2>&1 || echo "{\\"error\\": \\"Tool execution failed with exit code $?.\\"}" > /code/result.json`
      ].join(' && ');
      
      // Update execution status if ID was provided
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: 'running'
        });
      }
      
      // Create and run Docker container
      const container = await docker.createContainer({
        Image: config.image,
        name: containerName,
        Cmd: ['sh', '-c', fullCommand],
        WorkingDir: '/code',
        HostConfig: {
          Binds: [`${tempDir}:/code`],
          Memory: (resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY) * 1024 * 1024,
          MemorySwap: (resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY) * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: resourceLimits.maxCpuPercent ? resourceLimits.maxCpuPercent * 1000 : 50000,
          NetworkMode: 'none', // No network access for language tools
          AutoRemove: true,
        },
        StopTimeout: Math.ceil(resourceLimits.maxExecutionTimeMs / 1000) || 5,
      });
      
      // Start container
      await container.start();
      
      // Wait for container to finish (with timeout)
      const timeout = resourceLimits.maxExecutionTimeMs || DEFAULT_MAX_EXECUTION_TIME;
      const timeoutPromise = new Promise<{ StatusCode: number }>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timed out')), timeout);
      });
      
      const waitResult = await Promise.race([
        container.wait(),
        timeoutPromise
      ]);
      
      // Read result
      let resultStr: string;
      try {
        resultStr = await fs.readFile(resultFilePath, 'utf8');
      } catch (e) {
        resultStr = JSON.stringify({ error: 'Failed to read tool execution result' });
      }
      
      let result: any;
      let success = false;
      let output: string | undefined;
      let errorMsg: string | undefined;
      
      try {
        result = JSON.parse(resultStr);
        success = !result.error;
        output = result.output || resultStr;
        errorMsg = result.error;
      } catch (e) {
        // If not valid JSON, treat as plain output
        success = waitResult.StatusCode === 0;
        output = resultStr;
        errorMsg = success ? undefined : `Tool execution failed with exit code ${waitResult.StatusCode}`;
      }
      
      // Read the formatted/modified file if applicable
      if (toolName === 'format' && success) {
        try {
          const formattedCode = await fs.readFile(mainFilePath, 'utf8');
          result.formattedCode = formattedCode;
        } catch (e) {
          // Ignore errors when reading formatted code
        }
      }
      
      // Update execution record if ID was provided
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: success ? 'completed' : 'failed',
          result,
          error: errorMsg,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
          }
        });
      }
      
      return {
        success,
        output,
        error: errorMsg,
        executionTimeMs: Date.now() - startTime,
        maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
      };
    } catch (err: any) {
      const error = err.message || 'Unknown error during tool execution';
      
      // Update execution record with failure details
      if (executionId) {
        await toolRepository.updateExecution(executionId, {
          status: 'failed',
          error,
          endTime: new Date(),
          resourceUsage: {
            executionTimeMs: Date.now() - startTime,
            maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
          }
        });
      }
      
      return {
        success: false,
        error,
        executionTimeMs: Date.now() - startTime,
        maxMemoryMB: resourceLimits.maxMemoryMB || DEFAULT_MAX_MEMORY
      };
    } finally {
      // Clean up
      await cleanupTempDir(tempDir);
      
      // Stop and remove container if needed
      try {
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
      }
    }
  }
}

export default new SandboxService();