import { Request, Response } from 'express';
import { ThreadService } from '../services/thread.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('thread-controller');
const threadService = new ThreadService();

export class ThreadController {
  /**
   * Create a new thread
   */
  async createThread(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, fileId, title, lineNumber, codeSnippet, reviewRequestId } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      const thread = await threadService.createThread({
        sessionId,
        fileId,
        title,
        createdBy: userId,
        lineNumber,
        codeSnippet,
        reviewRequestId
      });
      
      res.status(201).json(thread);
    } catch (error: any) {
      logger.error('Error creating thread', error);
      res.status(500).json({ error: error.message || 'Error creating thread' });
    }
  }
  
  /**
   * Get threads for a session
   */
  async getSessionThreads(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { status } = req.query;
      
      const threads = await threadService.getSessionThreads(
        sessionId, 
        status as string | undefined
      );
      
      res.json({ threads });
    } catch (error: any) {
      logger.error('Error getting session threads', error);
      res.status(500).json({ error: error.message || 'Error getting session threads' });
    }
  }
  
  /**
   * Get threads for a file
   */
  async getFileThreads(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, fileId } = req.params;
      const { status } = req.query;
      
      const threads = await threadService.getFileThreads(
        sessionId, 
        fileId, 
        status as string | undefined
      );
      
      res.json({ threads });
    } catch (error: any) {
      logger.error('Error getting file threads', error);
      res.status(500).json({ error: error.message || 'Error getting file threads' });
    }
  }
  
  /**
   * Get a thread with its comments
   */
  async getThreadWithComments(req: Request, res: Response): Promise<void> {
    try {
      const { threadId } = req.params;
      
      const { thread, comments } = await threadService.getThreadWithComments(threadId);
      
      if (!thread) {
        res.status(404).json({ error: 'Thread not found' });
        return;
      }
      
      res.json({ thread, comments });
    } catch (error: any) {
      logger.error('Error getting thread with comments', error);
      res.status(500).json({ error: error.message || 'Error getting thread with comments' });
    }
  }
  
  /**
   * Update a thread
   */
  async updateThread(req: Request, res: Response): Promise<void> {
    try {
      const { threadId } = req.params;
      const { title, status } = req.body;
      
      const thread = await threadService.updateThread({
        threadId,
        title,
        status
      });
      
      if (!thread) {
        res.status(404).json({ error: 'Thread not found' });
        return;
      }
      
      res.json(thread);
    } catch (error: any) {
      logger.error('Error updating thread', error);
      res.status(500).json({ error: error.message || 'Error updating thread' });
    }
  }
  
  /**
   * Delete a thread and its comments
   */
  async deleteThread(req: Request, res: Response): Promise<void> {
    try {
      const { threadId } = req.params;
      
      const success = await threadService.deleteThread(threadId);
      
      if (!success) {
        res.status(404).json({ error: 'Thread not found' });
        return;
      }
      
      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting thread', error);
      res.status(500).json({ error: error.message || 'Error deleting thread' });
    }
  }
}