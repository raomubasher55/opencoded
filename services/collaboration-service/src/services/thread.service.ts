import { ThreadModel, IThread } from '../models/thread.model';
import { CommentModel } from '../models/comment.model';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('thread-service');

export interface CreateThreadParams {
  sessionId: string;
  fileId: string;
  title: string;
  createdBy: string;
  lineNumber?: number;
  codeSnippet?: string;
  reviewRequestId?: string;
}

export interface UpdateThreadParams {
  threadId: string;
  title?: string;
  status?: 'open' | 'resolved' | 'won\'t fix' | 'closed';
}

export class ThreadService {
  /**
   * Create a new thread
   */
  async createThread(params: CreateThreadParams): Promise<IThread> {
    try {
      const thread = await ThreadModel.create({
        ...params,
        participants: [params.createdBy],
        status: 'open',
        lastActivity: new Date()
      });
      
      return thread;
    } catch (error) {
      logger.error('Error creating thread', error);
      throw error;
    }
  }
  
  /**
   * Get threads for a session
   */
  async getSessionThreads(sessionId: string, status?: string): Promise<IThread[]> {
    try {
      const query: any = { sessionId };
      
      if (status) {
        query.status = status;
      }
      
      return await ThreadModel.find(query)
        .sort({ lastActivity: -1 })
        .lean();
    } catch (error) {
      logger.error('Error getting session threads', error);
      throw error;
    }
  }
  
  /**
   * Get threads for a file
   */
  async getFileThreads(sessionId: string, fileId: string, status?: string): Promise<IThread[]> {
    try {
      const query: any = { sessionId, fileId };
      
      if (status) {
        query.status = status;
      }
      
      return await ThreadModel.find(query)
        .sort({ lastActivity: -1 })
        .lean();
    } catch (error) {
      logger.error('Error getting file threads', error);
      throw error;
    }
  }
  
  /**
   * Get a thread with its comments
   */
  async getThreadWithComments(threadId: string): Promise<{ thread: IThread | null; comments: any[] }> {
    try {
      const [thread, comments] = await Promise.all([
        ThreadModel.findById(threadId).lean(),
        CommentModel.find({ threadId }).sort({ createdAt: 1 }).lean()
      ]);
      
      return { thread, comments };
    } catch (error) {
      logger.error('Error getting thread with comments', error);
      throw error;
    }
  }
  
  /**
   * Update a thread
   */
  async updateThread(params: UpdateThreadParams): Promise<IThread | null> {
    try {
      const { threadId, ...updateData } = params;
      
      const thread = await ThreadModel.findByIdAndUpdate(
        threadId,
        {
          ...updateData,
          lastActivity: new Date()
        },
        { new: true }
      );
      
      return thread;
    } catch (error) {
      logger.error('Error updating thread', error);
      throw error;
    }
  }
  
  /**
   * Delete a thread and its comments
   */
  async deleteThread(threadId: string): Promise<boolean> {
    try {
      await Promise.all([
        ThreadModel.findByIdAndDelete(threadId),
        CommentModel.deleteMany({ threadId })
      ]);
      
      return true;
    } catch (error) {
      logger.error('Error deleting thread', error);
      throw error;
    }
  }
}