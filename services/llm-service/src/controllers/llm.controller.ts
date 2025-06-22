import { Request, Response, NextFunction } from 'express';
import { LlmConfig, LlmRequest } from '@opencode/shared-types';
import { createServiceLogger } from '@opencode/shared-utils';
import { LlmService } from '../services/llm.service';
import { PromptTemplateService, TemplateVariables } from '../services/prompt-template.service';
import { TeamContextService } from '../services/team-context.service';
import { ApiError } from '../middleware/error.middleware';

const logger = createServiceLogger('llm-controller');
const llmService = new LlmService();
const templateService = new PromptTemplateService();

// Create team context service
const apiUrl = process.env.API_URL || 'http://localhost:8080';
const apiKey = process.env.API_KEY || '';
const teamContextService = new TeamContextService(apiUrl, apiKey);

// Initialize template service
(async () => {
  try {
    await templateService.loadAllTemplates();
  } catch (error) {
    logger.error('Failed to load prompt templates', error);
  }
})();

export const LlmController = {
  /**
   * Configure the LLM provider
   */
  async configureProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config: LlmConfig = req.body;
      
      if (!config.provider) {
        throw new ApiError('Provider name is required', 400);
      }
      
      await llmService.configure(config);
      
      res.status(200).json({
        success: true,
        message: `LLM provider configured: ${config.provider}`,
        data: {
          provider: config.provider,
          model: config.model
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get available providers
   */
  async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const providers = llmService.getAvailableProviders();
      
      res.status(200).json({
        success: true,
        data: providers
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get available models for current provider
   */
  async getModels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = await llmService.getAvailableModels();
      
      res.status(200).json({
        success: true,
        data: models
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get current configuration
   */
  async getConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = llmService.getActiveConfig();
      
      if (!config) {
        throw new ApiError('No LLM provider configured', 400);
      }
      
      // Remove API key from response
      const safeConfig = {
        provider: config.provider,
        model: config.model,
        options: config.options
      };
      
      res.status(200).json({
        success: true,
        data: safeConfig
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a completion
   */
  async createCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: LlmRequest = req.body;
      
      if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
        throw new ApiError('Messages array is required', 400);
      }
      
      // Check if this is a team collaboration session
      const isCollaborationSession = request.messages[0]?.sessionId && 
        request.options?.useTeamContext === true;
      
      // Enhance with team context if this is a collaboration session
      if (isCollaborationSession) {
        logger.debug('Enhancing request with team context');
        request.messages = await teamContextService.enhanceWithTeamContext(request.messages);
      }
      
      const completion = await llmService.createCompletion(request);
      
      res.status(200).json({
        success: true,
        data: completion
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a streaming completion
   */
  async createStreamingCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request: LlmRequest = req.body;
      
      if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
        throw new ApiError('Messages array is required', 400);
      }
      
      // Check if this is a team collaboration session
      const isCollaborationSession = request.messages[0]?.sessionId && 
        request.options?.useTeamContext === true;
      
      // Enhance with team context if this is a collaboration session
      if (isCollaborationSession) {
        logger.debug('Enhancing streaming request with team context');
        request.messages = await teamContextService.enhanceWithTeamContext(request.messages);
      }
      
      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      const onContent = (content: string) => {
        res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
      };
      
      const onToolCall = (toolCall: any) => {
        res.write(`data: ${JSON.stringify({ type: 'toolCall', toolCall })}\n\n`);
      };
      
      const onFinish = (response: any) => {
        res.write(`data: ${JSON.stringify({ type: 'finish', response })}\n\n`);
        res.end();
      };
      
      // Start streaming
      await llmService.createStreamingCompletion(
        request,
        onContent,
        onToolCall,
        onFinish
      );
    } catch (error) {
      // If headers haven't been sent yet, use the error middleware
      if (!res.headersSent) {
        return next(error);
      }
      
      // Otherwise, send error in SSE format and close the connection
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    }
  },

  /**
   * Count tokens in messages
   */
  async countTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        throw new ApiError('Messages array is required', 400);
      }
      
      const tokenCount = llmService.countTokens(messages);
      
      res.status(200).json({
        success: true,
        data: { tokenCount }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get available templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templateNames = templateService.getTemplateNames();
      
      res.status(200).json({
        success: true,
        data: templateNames
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get a specific template
   */
  async getTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const template = templateService.getTemplate(name);
      
      if (!template) {
        throw new ApiError(`Template not found: ${name}`, 404);
      }
      
      res.status(200).json({
        success: true,
        data: {
          name: template.getName(),
          content: template.getRawTemplate()
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create or update a template
   */
  async saveTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const { content } = req.body;
      
      if (!content) {
        throw new ApiError('Template content is required', 400);
      }
      
      const template = await templateService.saveTemplate(name, content);
      
      res.status(200).json({
        success: true,
        message: `Template saved: ${name}`,
        data: {
          name: template.getName(),
          content: template.getRawTemplate()
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a template
   */
  async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const deleted = templateService.removeTemplate(name);
      
      if (!deleted) {
        throw new ApiError(`Template not found: ${name}`, 404);
      }
      
      res.status(200).json({
        success: true,
        message: `Template deleted: ${name}`
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Render a template with variables
   */
  async renderTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const variables: TemplateVariables = req.body;
      
      const rendered = templateService.renderTemplate(name, variables);
      
      res.status(200).json({
        success: true,
        data: { 
          name,
          rendered
        }
      });
    } catch (error) {
      next(error);
    }
  }
};