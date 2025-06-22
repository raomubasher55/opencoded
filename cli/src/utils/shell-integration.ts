import { spawn, SpawnOptions } from 'child_process';
import { createServiceLogger } from '@opencode/shared-utils';
import { terminal as term } from 'terminal-kit';
import path from 'path';
import fs from 'fs';
import os from 'os';

const logger = createServiceLogger('shell-integration');

/**
 * Options for shell command execution
 */
export interface ShellCommandOptions extends SpawnOptions {
  captureOutput?: boolean;
  showOutput?: boolean;
  timeout?: number;
  onData?: (data: string) => void;
  onError?: (data: string) => void;
}

/**
 * Result of a shell command execution
 */
export interface ShellCommandResult {
  success: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

/**
 * Shell integration utility
 */
export class ShellIntegration {
  /**
   * Execute a shell command
   */
  static async executeCommand(
    command: string,
    args: string[] = [],
    options: ShellCommandOptions = {}
  ): Promise<ShellCommandResult> {
    const {
      captureOutput = true,
      showOutput = false,
      timeout,
      onData,
      onError,
      ...spawnOptions
    } = options;

    return new Promise((resolve) => {
      // Determine shell to use based on platform
      let shell: string;
      let shellArgs: string[];
      
      if (process.platform === 'win32') {
        shell = 'cmd.exe';
        shellArgs = ['/C', [command, ...args].join(' ')];
      } else {
        shell = 'bash';
        shellArgs = ['-c', [command, ...args].join(' ')];
      }
      
      logger.debug(`Executing command: ${command} ${args.join(' ')}`);
      
      // Spawn the process
      const childProcess = spawn(shell, shellArgs, {
        stdio: captureOutput ? 'pipe' : 'inherit',
        ...spawnOptions
      });
      
      // Capture output if needed
      let stdout = '';
      let stderr = '';
      
      if (captureOutput) {
        childProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          if (showOutput) {
            term(output);
          }
          
          if (onData) {
            onData(output);
          }
        });
        
        childProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          
          if (showOutput) {
            term.red(output);
          }
          
          if (onError) {
            onError(output);
          }
        });
      }
      
      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          childProcess.kill();
          resolve({
            success: false,
            code: null,
            stdout,
            stderr,
            error: new Error(`Command timed out after ${timeout}ms`)
          });
        }, timeout);
      }
      
      // Handle process completion
      childProcess.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        logger.debug(`Command exited with code ${code}`);
        
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr
        });
      });
      
      // Handle process error
      childProcess.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        logger.error('Command execution error', error);
        
        resolve({
          success: false,
          code: null,
          stdout,
          stderr,
          error
        });
      });
    });
  }

  /**
   * Find installed development tools
   */
  static async detectDevTools(projectPath: string): Promise<Record<string, boolean>> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const hasNodeProject = fs.existsSync(packageJsonPath);
    
    const tools: Record<string, boolean> = {
      npm: false,
      yarn: false,
      pnpm: false,
      git: false,
      node: false,
      python: false,
      pip: false,
      docker: false
    };
    
    // Check for Git
    const gitResult = await this.executeCommand('git', ['--version'], { 
      captureOutput: true, 
      showOutput: false 
    });
    tools.git = gitResult.success;
    
    // Check for Node.js
    const nodeResult = await this.executeCommand('node', ['--version'], { 
      captureOutput: true, 
      showOutput: false 
    });
    tools.node = nodeResult.success;
    
    // Check for package managers
    if (hasNodeProject) {
      // Check for npm
      const npmResult = await this.executeCommand('npm', ['--version'], { 
        captureOutput: true, 
        showOutput: false 
      });
      tools.npm = npmResult.success;
      
      // Check for yarn
      const yarnResult = await this.executeCommand('yarn', ['--version'], { 
        captureOutput: true, 
        showOutput: false,
        shell: true
      });
      tools.yarn = yarnResult.success;
      
      // Check for pnpm
      const pnpmResult = await this.executeCommand('pnpm', ['--version'], { 
        captureOutput: true, 
        showOutput: false 
      });
      tools.pnpm = pnpmResult.success;
    }
    
    // Check for Python
    const pythonResult = await this.executeCommand('python', ['--version'], { 
      captureOutput: true, 
      showOutput: false 
    });
    tools.python = pythonResult.success;
    
    // If python failed, try python3
    if (!tools.python) {
      const python3Result = await this.executeCommand('python3', ['--version'], { 
        captureOutput: true, 
        showOutput: false 
      });
      tools.python = python3Result.success;
    }
    
    // Check for pip
    const pipResult = await this.executeCommand('pip', ['--version'], { 
      captureOutput: true, 
      showOutput: false 
    });
    tools.pip = pipResult.success;
    
    // If pip failed, try pip3
    if (!tools.pip) {
      const pip3Result = await this.executeCommand('pip3', ['--version'], { 
        captureOutput: true, 
        showOutput: false 
      });
      tools.pip = pip3Result.success;
    }
    
    // Check for Docker
    const dockerResult = await this.executeCommand('docker', ['--version'], { 
      captureOutput: true, 
      showOutput: false 
    });
    tools.docker = dockerResult.success;
    
    return tools;
  }

  /**
   * Get information about the user's shell
   */
  static async getShellInfo(): Promise<{ name: string; version: string }> {
    const defaultInfo = { name: 'unknown', version: 'unknown' };
    
    try {
      let shellPath = process.env.SHELL;
      
      if (!shellPath && process.platform === 'win32') {
        // On Windows, try to detect PowerShell or CMD
        const comspecPath = process.env.COMSPEC;
        
        if (comspecPath) {
          if (comspecPath.toLowerCase().includes('powershell')) {
            shellPath = 'powershell.exe';
          } else {
            shellPath = 'cmd.exe';
          }
        }
      }
      
      if (!shellPath) {
        return defaultInfo;
      }
      
      // Get shell name from path
      const shellName = path.basename(shellPath).replace(/\.exe$/i, '');
      
      // Get shell version
      let version = 'unknown';
      
      if (['bash', 'sh', 'zsh', 'fish'].includes(shellName)) {
        const result = await this.executeCommand(shellName, ['--version']);
        version = result.stdout.split('\n')[0].trim();
      } else if (shellName === 'powershell' || shellName === 'pwsh') {
        const result = await this.executeCommand(shellName, ['-Command', '$PSVersionTable.PSVersion.ToString()']);
        version = result.stdout.trim();
      } else if (shellName === 'cmd') {
        version = 'Windows Command Processor';
      }
      
      return { name: shellName, version };
    } catch (error) {
      logger.error('Error getting shell info', error);
      return defaultInfo;
    }
  }

  /**
   * Run a script in the user's shell
   */
  static async runScript(
    scriptName: string, 
    projectPath: string,
    options: ShellCommandOptions = {}
  ): Promise<ShellCommandResult> {
    try {
      // Read package.json to find the script
      const packageJsonPath = path.join(projectPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found in project path');
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
        throw new Error(`Script "${scriptName}" not found in package.json`);
      }
      
      // Detect package manager
      const hasYarnLock = fs.existsSync(path.join(projectPath, 'yarn.lock'));
      const hasPnpmLock = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
      
      let packageManager = 'npm';
      if (hasYarnLock) packageManager = 'yarn';
      if (hasPnpmLock) packageManager = 'pnpm';
      
      // Prepare command based on package manager
      let command: string;
      let args: string[] = [];
      
      switch (packageManager) {
        case 'yarn':
          command = 'yarn';
          args = [scriptName];
          break;
        case 'pnpm':
          command = 'pnpm';
          args = ['run', scriptName];
          break;
        default: // npm
          command = 'npm';
          args = ['run', scriptName];
          break;
      }
      
      // Run the script
      return await this.executeCommand(command, args, {
        cwd: projectPath,
        ...options,
        showOutput: options.showOutput !== undefined ? options.showOutput : true
      });
    } catch (error) {
      logger.error(`Error running script "${scriptName}"`, error);
      
      return {
        success: false,
        code: null,
        stdout: '',
        stderr: (error as Error).message,
        error: error as Error
      };
    }
  }

  /**
   * Get system information
   */
  static getSystemInfo(): Record<string, string> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      hostname: os.hostname(),
      userInfo: JSON.stringify(os.userInfo()),
      homeDir: os.homedir(),
      tmpDir: os.tmpdir()
    };
  }
}