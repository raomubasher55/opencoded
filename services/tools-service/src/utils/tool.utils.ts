import { Tool, ToolType, PermissionLevel, ResourceLimits } from '../models/tool.model';
import { createError } from '../middleware/error.middleware';

/**
 * Default resource limits for different tool types
 */
const defaultResourceLimits: Record<ToolType, ResourceLimits> = {
  [ToolType.EXECUTION]: {
    maxExecutionTimeMs: 5000,  // 5 seconds
    maxMemoryMB: 200,          // 200 MB
    maxCpuPercent: 50,         // 50% CPU
    networkAccess: false,      // No network access by default
    fileSystemAccess: []       // No file system access by default
  },
  [ToolType.ANALYSIS]: {
    maxExecutionTimeMs: 10000, // 10 seconds
    maxMemoryMB: 500,          // 500 MB
    maxCpuPercent: 70,         // 70% CPU
    networkAccess: false,      // No network access by default
    fileSystemAccess: []       // No file system access by default
  },
  [ToolType.VERSION_CONTROL]: {
    maxExecutionTimeMs: 15000, // 15 seconds
    maxMemoryMB: 300,          // 300 MB
    maxCpuPercent: 40,         // 40% CPU
    networkAccess: false,      // No network access by default
    fileSystemAccess: ['./']   // Access to current directory
  },
  [ToolType.LANGUAGE_SERVER]: {
    maxExecutionTimeMs: 8000,  // 8 seconds
    maxMemoryMB: 400,          // 400 MB
    maxCpuPercent: 60,         // 60% CPU
    networkAccess: false,      // No network access by default
    fileSystemAccess: []       // No file system access by default
  }
};

/**
 * Get default resource limits for a tool type
 * @param toolType The type of tool
 * @returns Default resource limits for the tool type
 */
export const getDefaultResourceLimits = (toolType: ToolType): ResourceLimits => {
  return defaultResourceLimits[toolType] || defaultResourceLimits[ToolType.EXECUTION];
};

/**
 * Get required permission level for a tool type
 * @param toolType The type of tool
 * @returns Required permission level
 */
export const getRequiredPermissionLevel = (toolType: ToolType): PermissionLevel => {
  // By default, all tools are accessible to regular users
  return PermissionLevel.USER;
};

/**
 * Check if a user has permission to use a tool
 * @param userPermissionLevel User's permission level
 * @param toolPermissionLevel Tool's required permission level
 */
export const hasToolPermission = (
  userPermissionLevel: PermissionLevel,
  toolPermissionLevel: PermissionLevel
): boolean => {
  // Admin has access to everything
  if (userPermissionLevel === PermissionLevel.ADMIN) {
    return true;
  }
  
  // User can only access tools with USER permission level
  return toolPermissionLevel === PermissionLevel.USER;
};

/**
 * Validate a tool configuration
 * @param tool Tool configuration to validate
 */
export const validateToolConfig = (tool: Partial<Tool>): void => {
  // Check required fields
  if (!tool.name) {
    throw createError('Tool name is required', 400);
  }

  if (!tool.description) {
    throw createError('Tool description is required', 400);
  }

  if (!tool.type) {
    throw createError('Tool type is required', 400);
  }

  if (!Object.values(ToolType).includes(tool.type as ToolType)) {
    throw createError(`Invalid tool type: ${tool.type}`, 400);
  }

  if (!tool.version) {
    throw createError('Tool version is required', 400);
  }

  if (!tool.permissionLevel) {
    throw createError('Tool permission level is required', 400);
  }

  if (!Object.values(PermissionLevel).includes(tool.permissionLevel as PermissionLevel)) {
    throw createError(`Invalid permission level: ${tool.permissionLevel}. Must be either 'user' or 'admin'`, 400);
  }

  // For execution tools, command is required
  if (tool.type === ToolType.EXECUTION && !tool.command) {
    throw createError('Command is required for execution tools', 400);
  }

  // Validate resource limits if provided
  if (tool.resourceLimits) {
    validateResourceLimits(tool.resourceLimits);
  }
};

/**
 * Validate resource limits
 * @param limits Resource limits to validate
 */
export const validateResourceLimits = (limits: Partial<ResourceLimits>): void => {
  if (limits.maxExecutionTimeMs !== undefined && (
    typeof limits.maxExecutionTimeMs !== 'number' || 
    limits.maxExecutionTimeMs <= 0
  )) {
    throw createError('maxExecutionTimeMs must be a positive number', 400);
  }

  if (limits.maxMemoryMB !== undefined && (
    typeof limits.maxMemoryMB !== 'number' || 
    limits.maxMemoryMB <= 0
  )) {
    throw createError('maxMemoryMB must be a positive number', 400);
  }

  if (limits.maxCpuPercent !== undefined && (
    typeof limits.maxCpuPercent !== 'number' || 
    limits.maxCpuPercent <= 0 || 
    limits.maxCpuPercent > 100
  )) {
    throw createError('maxCpuPercent must be a number between 1 and 100', 400);
  }

  if (limits.networkAccess !== undefined && typeof limits.networkAccess !== 'boolean') {
    throw createError('networkAccess must be a boolean', 400);
  }

  if (limits.fileSystemAccess !== undefined && !Array.isArray(limits.fileSystemAccess)) {
    throw createError('fileSystemAccess must be an array of paths', 400);
  }
};

/**
 * Create a tool builder for fluent API
 */
export class ToolBuilder {
  private tool: Partial<Tool> = {
    resourceLimits: getDefaultResourceLimits(ToolType.EXECUTION)
  };

  /**
   * Set tool name
   */
  withName(name: string): ToolBuilder {
    this.tool.name = name;
    return this;
  }

  /**
   * Set tool description
   */
  withDescription(description: string): ToolBuilder {
    this.tool.description = description;
    return this;
  }

  /**
   * Set tool type
   */
  withType(type: ToolType): ToolBuilder {
    this.tool.type = type;
    this.tool.resourceLimits = getDefaultResourceLimits(type);
    return this;
  }

  /**
   * Set tool version
   */
  withVersion(version: string): ToolBuilder {
    this.tool.version = version;
    return this;
  }

  /**
   * Set tool permission level
   */
  withPermissionLevel(permissionLevel: PermissionLevel): ToolBuilder {
    this.tool.permissionLevel = permissionLevel;
    return this;
  }

  /**
   * Set tool command
   */
  withCommand(command: string): ToolBuilder {
    this.tool.command = command;
    return this;
  }

  /**
   * Set tool executable path
   */
  withExecPath(execPath: string): ToolBuilder {
    this.tool.execPath = execPath;
    return this;
  }

  /**
   * Set tool parameters
   */
  withParameters(parameters: any[]): ToolBuilder {
    this.tool.parameters = parameters;
    return this;
  }

  /**
   * Set resource limits
   */
  withResourceLimits(limits: ResourceLimits): ToolBuilder {
    this.tool.resourceLimits = limits;
    return this;
  }

  /**
   * Build the tool configuration
   */
  build(): Partial<Tool> {
    validateToolConfig(this.tool);
    return this.tool;
  }
}