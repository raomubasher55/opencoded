import { Request, Response } from 'express';
import { 
  Tool, 
  ToolType, 
  PermissionLevel, 
  createTool, 
  getTool, 
  getAllTools, 
  updateTool, 
  deleteTool 
} from '../models/tool.model';

/**
 * Tool controller handles CRUD operations for tools
 */
export class ToolController {
  /**
   * Get all available tools
   */
  async getAllTools(req: Request, res: Response): Promise<void> {
    try {
      const tools = getAllTools();
      res.status(200).json({ success: true, data: tools });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get a specific tool by ID
   */
  async getToolById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tool = getTool(id);

      if (!tool) {
        res.status(404).json({ success: false, message: 'Tool not found' });
        return;
      }

      res.status(200).json({ success: true, data: tool });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Create a new tool
   */
  async createTool(req: Request, res: Response): Promise<void> {
    try {
      const toolData = req.body;

      // Validate the required fields
      if (!toolData.name || !toolData.description || !toolData.type || !toolData.permissionLevel) {
        res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: name, description, type, permissionLevel' 
        });
        return;
      }

      // Validate the tool type
      if (!Object.values(ToolType).includes(toolData.type)) {
        res.status(400).json({ 
          success: false, 
          message: `Invalid tool type. Must be one of: ${Object.values(ToolType).join(', ')}` 
        });
        return;
      }

      // Validate the permission level
      if (!Object.values(PermissionLevel).includes(toolData.permissionLevel)) {
        res.status(400).json({ 
          success: false, 
          message: `Invalid permission level. Must be one of: ${Object.values(PermissionLevel).join(', ')}` 
        });
        return;
      }

      // Validate resource limits
      if (!toolData.resourceLimits) {
        res.status(400).json({ 
          success: false, 
          message: 'Resource limits are required' 
        });
        return;
      }

      const newTool = createTool(toolData);
      res.status(201).json({ success: true, data: newTool });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Update an existing tool
   */
  async updateTool(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if the tool exists
      const existingTool = getTool(id);
      if (!existingTool) {
        res.status(404).json({ success: false, message: 'Tool not found' });
        return;
      }

      // Validate the tool type if provided
      if (updates.type && !Object.values(ToolType).includes(updates.type)) {
        res.status(400).json({ 
          success: false, 
          message: `Invalid tool type. Must be one of: ${Object.values(ToolType).join(', ')}` 
        });
        return;
      }

      // Validate the permission level if provided
      if (updates.permissionLevel && !Object.values(PermissionLevel).includes(updates.permissionLevel)) {
        res.status(400).json({ 
          success: false, 
          message: `Invalid permission level. Must be one of: ${Object.values(PermissionLevel).join(', ')}` 
        });
        return;
      }

      const updatedTool = updateTool(id, updates);
      res.status(200).json({ success: true, data: updatedTool });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete a tool
   */
  async deleteTool(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if the tool exists
      const existingTool = getTool(id);
      if (!existingTool) {
        res.status(404).json({ success: false, message: 'Tool not found' });
        return;
      }

      const result = deleteTool(id);
      res.status(200).json({ success: result, message: result ? 'Tool deleted successfully' : 'Failed to delete tool' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}