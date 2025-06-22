import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@opencode/shared-utils';
import { SessionService } from '../services/session.service';
import { ApiError } from '../middleware/error.middleware';

const logger = createServiceLogger('session-controller');
const sessionService = new SessionService();

export const SessionController = {
  /**
   * Create a new session
   */
  async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title = 'New Session' } = req.body;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      const session = await sessionService.createSession(req.user.id, title);
      
      res.status(201).json({
        success: true,
        message: 'Session created',
        data: session
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get a session by ID
   */
  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      const session = await sessionService.getSession(sessionId, req.user.id);
      
      res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all sessions for a user
   */
  async getAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      
      const { sessions, total } = await sessionService.getAllSessions(req.user.id, limit, offset);
      
      res.status(200).json({
        success: true,
        data: {
          sessions,
          total,
          limit,
          offset
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update a session
   */
  async updateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { title, tags, metadata } = req.body;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      const session = await sessionService.updateSession(
        sessionId, 
        req.user.id,
        { title, tags, metadata }
      );
      
      res.status(200).json({
        success: true,
        message: 'Session updated',
        data: session
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a session
   */
  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      await sessionService.deleteSession(sessionId, req.user.id);
      
      res.status(200).json({
        success: true,
        message: 'Session deleted'
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Add a message to a session
   */
  async addMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { role, content, toolCalls } = req.body;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      if (!role || !content) {
        throw new ApiError('Role and content are required', 400);
      }
      
      const message = await sessionService.addMessage(
        sessionId,
        req.user.id,
        { role, content, toolCalls }
      );
      
      res.status(201).json({
        success: true,
        message: 'Message added',
        data: message
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get messages from a session
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const before = req.query.before as string | undefined;
      
      const messages = await sessionService.getMessages(sessionId, req.user.id, limit, before);
      
      res.status(200).json({
        success: true,
        data: messages
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete a message
   */
  async deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, messageId } = req.params;
      
      if (!req.user?.id) {
        throw new ApiError('User ID is required', 400);
      }
      
      await sessionService.deleteMessage(sessionId, req.user.id, messageId);
      
      res.status(200).json({
        success: true,
        message: 'Message deleted'
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Clear old sessions (admin only)
   */
  async clearOldSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deletedCount = await sessionService.clearOldSessions();
      
      res.status(200).json({
        success: true,
        message: `${deletedCount} old sessions cleared`
      });
    } catch (error) {
      next(error);
    }
  }
};