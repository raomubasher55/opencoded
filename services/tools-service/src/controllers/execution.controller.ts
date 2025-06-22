import { Request, Response } from 'express';
import { 
  ToolExecution, 
  getTool, 
  createExecution,
  getExecution,
  getAllExecutions,
  getExecutionsByUser,
  updateExecution
} from '../models/tool.model';
import { SandboxService } from '../services/sandbox.service';

// Initialize sandbox service
const sandboxService = new SandboxService();

/**
 * Execution controller handles tool executions
 */
export class ExecutionController {
  /**
   * Execute a tool with the provided parameters
   */
  async executeTool(req: Request, res: Response): Promise<void> {
    try {
      const { toolId } = req.params;
      const { parameters } = req.body;
      const userId = req.user?.id;

      // Validate user ID
      if (!userId) {
        res.status(401).json({ success: false, message: 'User authentication required' });
        return;
      }

      // Get the requested tool
      const tool = getTool(toolId);
      if (!tool) {
        res.status(404).json({ success: false, message: 'Tool not found' });
        return;
      }

      // Validate required parameters
      if (tool.parameters) {
        const requiredParams = tool.parameters.filter(param => param.required);
        for (const param of requiredParams) {
          if (parameters[param.name] === undefined) {
            res.status(400).json({ 
              success: false, 
              message: `Missing required parameter: ${param.name}` 
            });
            return;
          }
        }
      }

      // Create execution record
      const execution = createExecution({
        toolId,
        userId,
        parameters
      });

      // Start the execution process
      this.processExecution(execution, tool);

      // Return the execution ID to allow client to poll for results
      res.status(202).json({ 
        success: true, 
        message: 'Execution started', 
        data: { 
          executionId: execution.id,
          status: execution.status
        } 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get the status and result of an execution
   */
  async getExecutionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const userId = req.user?.id;

      // Validate user ID
      if (!userId) {
        res.status(401).json({ success: false, message: 'User authentication required' });
        return;
      }

      // Get the execution record
      const execution = getExecution(executionId);
      if (!execution) {
        res.status(404).json({ success: false, message: 'Execution not found' });
        return;
      }

      // Check if user has permission to view this execution
      if (execution.userId !== userId) {
        res.status(403).json({ success: false, message: 'Not authorized to view this execution' });
        return;
      }

      res.status(200).json({ success: true, data: execution });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all executions for the current user
   */
  async getUserExecutions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      // Validate user ID
      if (!userId) {
        res.status(401).json({ success: false, message: 'User authentication required' });
        return;
      }

      const executions = getExecutionsByUser(userId);
      res.status(200).json({ success: true, data: executions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const userId = req.user?.id;

      // Validate user ID
      if (!userId) {
        res.status(401).json({ success: false, message: 'User authentication required' });
        return;
      }

      // Get the execution record
      const execution = getExecution(executionId);
      if (!execution) {
        res.status(404).json({ success: false, message: 'Execution not found' });
        return;
      }

      // Check if user has permission to cancel this execution
      if (execution.userId !== userId) {
        res.status(403).json({ success: false, message: 'Not authorized to cancel this execution' });
        return;
      }

      // Check if execution can be cancelled
      if (execution.status !== 'pending' && execution.status !== 'running') {
        res.status(400).json({ 
          success: false, 
          message: `Cannot cancel execution with status: ${execution.status}` 
        });
        return;
      }

      // Update execution status
      const updatedExecution = updateExecution(executionId, {
        status: 'failed',
        error: 'Execution cancelled by user',
        endTime: new Date()
      });

      res.status(200).json({ 
        success: true, 
        message: 'Execution cancelled', 
        data: updatedExecution 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Process a tool execution asynchronously
   * @param execution The execution record
   * @param tool The tool to execute
   */
  private async processExecution(execution: ToolExecution, tool: any): Promise<void> {
    try {
      // Update status to running
      updateExecution(execution.id, { status: 'running' });

      // Execute the tool based on its type
      switch (tool.type) {
        case 'execution':
          await this.executeCodeTool(execution, tool);
          break;
        case 'analysis':
          await this.executeAnalysisTool(execution, tool);
          break;
        case 'vcs':
          await this.executeVcsTool(execution, tool);
          break;
        case 'lsp':
          await this.executeLspTool(execution, tool);
          break;
        default:
          throw new Error(`Unsupported tool type: ${tool.type}`);
      }
    } catch (error: any) {
      // Update execution with error
      updateExecution(execution.id, {
        status: 'failed',
        error: error.message || 'Unknown error during execution',
        endTime: new Date()
      });
    }
  }

  /**
   * Execute a code execution tool
   */
  private async executeCodeTool(execution: ToolExecution, tool: any): Promise<void> {
    const code = execution.parameters.code;
    if (!code) {
      throw new Error('Code parameter is required');
    }

    // Determine execution environment based on tool configuration
    const useContainer = tool.containerExecution === true;
    
    if (useContainer) {
      // Get language from parameters or default to JavaScript
      const language = execution.parameters.language || 'javascript';
      
      // Execute in container
      await sandboxService.executeInContainer(
        code,
        language,
        tool.resourceLimits,
        execution.id
      );
    } else {
      // Execute in VM2
      await sandboxService.executeInVM2(
        code,
        tool.resourceLimits,
        execution.id
      );
    }
  }

  /**
   * Execute a code analysis tool
   */
  private async executeAnalysisTool(execution: ToolExecution, tool: any): Promise<void> {
    // This would implement specific code analysis functionality
    // For now, we'll just simulate it with VM2 execution
    const code = execution.parameters.code;
    if (!code) {
      throw new Error('Code parameter is required');
    }

    // For analysis tools, we'd typically use a specialized library
    // Here we're just executing it in VM2 for simplicity
    await sandboxService.executeInVM2(
      `
      // Simple analysis simulation
      const result = { 
        analyzed: true,
        type: 'analysis',
        metrics: {
          lines: (${JSON.stringify(code)}).split('\\n').length,
          complexity: Math.floor(Math.random() * 10) + 1
        }
      };
      result;
      `,
      tool.resourceLimits,
      execution.id
    );
  }

  /**
   * Execute a version control tool
   */
  private async executeVcsTool(execution: ToolExecution, tool: any): Promise<void> {
    // This would implement specific version control functionality
    // For now, we'll just simulate it
    const operation = execution.parameters.operation;
    const path = execution.parameters.path;

    if (!operation || !path) {
      throw new Error('Operation and path parameters are required');
    }

    // Update execution with a simulated result
    updateExecution(execution.id, {
      status: 'completed',
      result: {
        operation,
        path,
        success: true,
        message: `VCS operation ${operation} simulated successfully`,
        timestamp: new Date().toISOString()
      },
      endTime: new Date()
    });
  }

  /**
   * Execute a language server protocol tool
   */
  private async executeLspTool(execution: ToolExecution, tool: any): Promise<void> {
    // This would implement specific LSP functionality
    // For now, we'll just simulate it
    const method = execution.parameters.method;
    const document = execution.parameters.document;

    if (!method || !document) {
      throw new Error('Method and document parameters are required');
    }

    // Update execution with a simulated result
    updateExecution(execution.id, {
      status: 'completed',
      result: {
        method,
        document,
        success: true,
        message: `LSP method ${method} simulated successfully`,
        timestamp: new Date().toISOString()
      },
      endTime: new Date()
    });
  }
}