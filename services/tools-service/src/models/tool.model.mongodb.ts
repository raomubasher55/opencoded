import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ToolType, PermissionLevel, ResourceLimits, ToolParameter } from './tool.model';

// Tool Document Interface
export interface ToolDocument extends Document {
  id: string;
  name: string;
  description: string;
  type: string;
  version: string;
  permissionLevel: string;
  command: string;
  execPath?: string;
  parameters?: ToolParameter[];
  resourceLimits: ResourceLimits;
  createdAt: Date;
  updatedAt: Date;
}

// Tool Execution Document Interface
export interface ToolExecutionDocument extends Document {
  id: string;
  toolId: string;
  userId: string;
  parameters: Record<string, any>;
  status: string;
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  resourceUsage?: {
    executionTimeMs: number;
    maxMemoryMB: number;
    cpuPercent?: number;
  };
}

// Tool Schema
const ToolSchema = new Schema<ToolDocument>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true, enum: Object.values(ToolType) },
  version: { type: String, required: true },
  permissionLevel: { type: String, required: true, enum: Object.values(PermissionLevel) },
  command: { type: String, required: true },
  execPath: { type: String },
  parameters: [{
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true },
    required: { type: Boolean, required: true },
    default: { type: Schema.Types.Mixed }
  }],
  resourceLimits: {
    maxExecutionTimeMs: { type: Number, required: true },
    maxMemoryMB: { type: Number, required: true },
    maxCpuPercent: { type: Number },
    networkAccess: { type: Boolean, required: true },
    fileSystemAccess: { type: [String], required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Tool Execution Schema
const ToolExecutionSchema = new Schema<ToolExecutionDocument>({
  id: { type: String, required: true, unique: true },
  toolId: { type: String, required: true },
  userId: { type: String, required: true },
  parameters: { type: Schema.Types.Mixed, required: true },
  status: { 
    type: String, 
    required: true,
    enum: ['pending', 'running', 'completed', 'failed']
  },
  result: { type: Schema.Types.Mixed },
  error: { type: String },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  resourceUsage: {
    executionTimeMs: { type: Number },
    maxMemoryMB: { type: Number },
    cpuPercent: { type: Number }
  }
});

// Create models
const ToolModel = mongoose.model<ToolDocument>('Tool', ToolSchema);
const ToolExecutionModel = mongoose.model<ToolExecutionDocument>('ToolExecution', ToolExecutionSchema);

// MongoDB-based implementation of tool operations
export class ToolRepository {
  // Tool CRUD operations
  async createTool(toolData: Omit<ToolDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolDocument> {
    const now = new Date();
    const tool = new ToolModel({
      ...toolData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    });
    
    await tool.save();
    return tool;
  }

  async getTool(id: string): Promise<ToolDocument | null> {
    return ToolModel.findOne({ id }).exec();
  }

  async getAllTools(): Promise<ToolDocument[]> {
    return ToolModel.find().exec();
  }

  async updateTool(id: string, updates: Partial<Omit<ToolDocument, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ToolDocument | null> {
    const tool = await ToolModel.findOne({ id }).exec();
    if (!tool) return null;

    Object.assign(tool, updates, { updatedAt: new Date() });
    await tool.save();
    return tool;
  }

  async deleteTool(id: string): Promise<boolean> {
    const result = await ToolModel.deleteOne({ id }).exec();
    return result.deletedCount === 1;
  }

  // Execution CRUD operations
  async createExecution(executionData: Omit<ToolExecutionDocument, 'id' | 'status' | 'startTime'>): Promise<ToolExecutionDocument> {
    const now = new Date();
    const execution = new ToolExecutionModel({
      ...executionData,
      id: uuidv4(),
      status: 'pending',
      startTime: now
    });
    
    await execution.save();
    return execution;
  }

  async getExecution(id: string): Promise<ToolExecutionDocument | null> {
    return ToolExecutionModel.findOne({ id }).exec();
  }

  async getAllExecutions(): Promise<ToolExecutionDocument[]> {
    return ToolExecutionModel.find().exec();
  }

  async updateExecution(id: string, updates: Partial<Omit<ToolExecutionDocument, 'id' | 'toolId' | 'userId' | 'startTime'>>): Promise<ToolExecutionDocument | null> {
    const execution = await ToolExecutionModel.findOne({ id }).exec();
    if (!execution) return null;

    Object.assign(execution, updates);
    await execution.save();
    return execution;
  }

  async getExecutionsByUser(userId: string): Promise<ToolExecutionDocument[]> {
    return ToolExecutionModel.find({ userId }).exec();
  }

  // Initialize with default tools if none exist
  async initializeDefaultTools(defaultTools: Omit<ToolDocument, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const count = await ToolModel.countDocuments().exec();
    if (count === 0) {
      for (const toolData of defaultTools) {
        await this.createTool(toolData);
      }
    }
  }
}

export default new ToolRepository();