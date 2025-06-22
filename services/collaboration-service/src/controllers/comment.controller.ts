import { Request, Response } from 'express';
import { CommentService } from '../services/comment.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('comment-controller');
const commentService = new CommentService();

export class CommentController {
  /**
   * Create a new comment
   */
  async createComment(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, fileId, content, lineNumber, charStart, charEnd, codeSnippet, parentId, threadId } = req.body;
      const userId = req.user?.id;
      const username = req.user?.username;
      
      if (!userId || !username) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      // Process mentions in the content
      const mentions = await commentService.processMentions(content, sessionId);
      
      const comment = await commentService.createComment({
        sessionId,
        fileId,
        userId,
        username,
        content,
        lineNumber,
        charStart,
        charEnd,
        codeSnippet,
        parentId,
        threadId,
        mentions
      });
      
      res.status(201).json(comment);
    } catch (error: any) {
      logger.error('Error creating comment', error);
      res.status(500).json({ error: error.message || 'Error creating comment' });
    }
  }
  
  /**
   * Get comments for a file
   */
  async getFileComments(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, fileId } = req.params;
      
      const comments = await commentService.getFileComments(sessionId, fileId);
      
      res.json({ comments });
    } catch (error: any) {
      logger.error('Error getting file comments', error);
      res.status(500).json({ error: error.message || 'Error getting file comments' });
    }
  }
  
  /**
   * Get comments in a thread
   */
  async getThreadComments(req: Request, res: Response): Promise<void> {
    try {
      const { threadId } = req.params;
      
      const comments = await commentService.getThreadComments(threadId);
      
      res.json({ comments });
    } catch (error: any) {
      logger.error('Error getting thread comments', error);
      res.status(500).json({ error: error.message || 'Error getting thread comments' });
    }
  }
  
  /**
   * Update a comment
   */
  async updateComment(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      const { content, status } = req.body;
      
      const comment = await commentService.updateComment({
        commentId,
        content,
        status
      });
      
      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
      
      res.json(comment);
    } catch (error: any) {
      logger.error('Error updating comment', error);
      res.status(500).json({ error: error.message || 'Error updating comment' });
    }
  }
  
  /**
   * Delete a comment
   */
  async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      
      const success = await commentService.deleteComment(commentId);
      
      if (!success) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
      
      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting comment', error);
      res.status(500).json({ error: error.message || 'Error deleting comment' });
    }
  }
}