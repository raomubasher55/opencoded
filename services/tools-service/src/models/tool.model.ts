import { v4 as uuidv4 } from 'uuid';

// Tool type definitions
export enum ToolType {
  EXECUTION = 'execution',   // For executing code
  ANALYSIS = 'analysis',     // For code analysis
  VERSION_CONTROL = 'vcs',   // For git operations
  LANGUAGE_SERVER = 'lsp'    // For language server protocol
}

// Permission levels for tools
export enum PermissionLevel {
  USER = 'user',   // Regular user permissions
  ADMIN = 'admin'  // Admin permissions
}

// Resource limits for tool execution
export interface ResourceLimits {
  maxExecutionTimeMs: number;  // Maximum execution time in milliseconds
  maxMemoryMB: number;         // Maximum memory usage in MB
  maxCpuPercent?: number;      // Maximum CPU percentage (0-100)
  networkAccess: boolean;      // Whether network access is allowed
  fileSystemAccess: string[];  // Paths that are accessible
}

// Definition of a tool
export interface Tool {
  id: string;                 // Unique identifier
  name: string;               // Human-readable name
  description: string;        // Description of what the tool does
  type: ToolType;             // Type of tool
  version: string;            // Tool version
  permissionLevel: PermissionLevel; // Required permission level
  command: string;            // Command to execute (for EXECUTION type)
  execPath?: string;          // Path to executable (if applicable)
  parameters?: ToolParameter[]; // Parameters the tool accepts
  resourceLimits: ResourceLimits; // Resource limits for this tool
  createdAt: Date;            // When the tool was created
  updatedAt: Date;            // When the tool was last updated
}

// Parameter definition for a tool
export interface ToolParameter {
  name: string;               // Parameter name
  description: string;        // Parameter description
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'; // Parameter type
  required: boolean;          // Whether the parameter is required
  default?: any;              // Default value if not provided
}

// Execution record of a tool
export interface ToolExecution {
  id: string;                 // Unique identifier
  toolId: string;             // ID of the tool that was executed
  userId: string;             // ID of the user who executed the tool
  parameters: Record<string, any>; // Parameters used for execution
  status: 'pending' | 'running' | 'completed' | 'failed'; // Execution status
  result?: any;               // Result of the execution
  error?: string;             // Error message if execution failed
  startTime: Date;            // When execution started
  endTime?: Date;             // When execution ended
  resourceUsage?: {           // Resource usage metrics
    executionTimeMs: number;  // Time taken for execution
    maxMemoryMB: number;      // Maximum memory used
    cpuPercent?: number;      // CPU usage percentage
  };
}

// In-memory storage for tools and executions (would be replaced with a database in production)
const tools: Tool[] = [];
const executions: ToolExecution[] = [];

// Tool CRUD operations
export const createTool = (toolData: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>): Tool => {
  const now = new Date();
  const tool: Tool = {
    ...toolData,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now
  };
  tools.push(tool);
  return tool;
};

export const getTool = (id: string): Tool | undefined => {
  return tools.find(tool => tool.id === id);
};

export const getAllTools = (): Tool[] => {
  return [...tools];
};

export const updateTool = (id: string, updates: Partial<Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>>): Tool | undefined => {
  const index = tools.findIndex(tool => tool.id === id);
  if (index === -1) return undefined;

  const updatedTool = {
    ...tools[index],
    ...updates,
    updatedAt: new Date()
  };
  tools[index] = updatedTool;
  return updatedTool;
};

export const deleteTool = (id: string): boolean => {
  const index = tools.findIndex(tool => tool.id === id);
  if (index === -1) return false;

  tools.splice(index, 1);
  return true;
};

// Execution CRUD operations
export const createExecution = (executionData: Omit<ToolExecution, 'id' | 'status' | 'startTime'>): ToolExecution => {
  const now = new Date();
  const execution: ToolExecution = {
    ...executionData,
    id: uuidv4(),
    status: 'pending',
    startTime: now
  };
  executions.push(execution);
  return execution;
};

export const getExecution = (id: string): ToolExecution | undefined => {
  return executions.find(execution => execution.id === id);
};

export const getAllExecutions = (): ToolExecution[] => {
  return [...executions];
};

export const updateExecution = (id: string, updates: Partial<Omit<ToolExecution, 'id' | 'toolId' | 'userId' | 'startTime'>>): ToolExecution | undefined => {
  const index = executions.findIndex(execution => execution.id === id);
  if (index === -1) return undefined;

  const updatedExecution = {
    ...executions[index],
    ...updates
  };
  executions[index] = updatedExecution;
  return updatedExecution;
};

export const getExecutionsByUser = (userId: string): ToolExecution[] => {
  return executions.filter(execution => execution.userId === userId);
};

// Initialize with some default tools
export const initializeDefaultTools = () => {
  if (tools.length === 0) {
    createTool({
      name: 'JavaScript Sandbox',
      description: 'Executes JavaScript code in a secure sandbox environment',
      type: ToolType.EXECUTION,
      version: '1.0.0',
      permissionLevel: PermissionLevel.USER,
      command: 'node',
      parameters: [
        {
          name: 'code',
          description: 'JavaScript code to execute',
          type: 'string',
          required: true
        },
        {
          name: 'timeout',
          description: 'Execution timeout in milliseconds',
          type: 'number',
          required: false,
          default: 3000
        }
      ],
      resourceLimits: {
        maxExecutionTimeMs: 5000,
        maxMemoryMB: 100,
        networkAccess: false,
        fileSystemAccess: []
      }
    });

    createTool({
      name: 'TypeScript AST Analyzer',
      description: 'Analyzes TypeScript code and returns AST information',
      type: ToolType.ANALYSIS,
      version: '1.0.0',
      permissionLevel: PermissionLevel.USER,
      command: 'ts-ast-analyze',
      parameters: [
        {
          name: 'code',
          description: 'TypeScript code to analyze',
          type: 'string',
          required: true
        }
      ],
      resourceLimits: {
        maxExecutionTimeMs: 3000,
        maxMemoryMB: 200,
        networkAccess: false,
        fileSystemAccess: []
      }
    });

    createTool({
      name: 'Git Operations',
      description: 'Performs Git operations like diff, status, and log',
      type: ToolType.VERSION_CONTROL,
      version: '1.0.0',
      permissionLevel: PermissionLevel.USER,
      command: 'git',
      parameters: [
        {
          name: 'operation',
          description: 'Git operation to perform (diff, status, log)',
          type: 'string',
          required: true
        },
        {
          name: 'path',
          description: 'Path to repository',
          type: 'string',
          required: true
        }
      ],
      resourceLimits: {
        maxExecutionTimeMs: 10000,
        maxMemoryMB: 150,
        networkAccess: false,
        fileSystemAccess: ['./']
      }
    });
  }
};