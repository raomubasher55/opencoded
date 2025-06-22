import { CommentModel, IComment } from '../models/comment.model';
import { ThreadModel } from '../models/thread.model';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('comment-service');

export interface CreateCommentParams {
  sessionId: string;
  fileId: string;
  userId: string;
  username: string;
  content: string;
  lineNumber?: number;
  charStart?: number;
  charEnd?: number;
  codeSnippet?: string;
  parentId?: string;
  threadId?: string;
  mentions?: { userId: string; username: string }[];
}

export interface UpdateCommentParams {
  commentId: string;
  content?: string;
  status?: 'open' | 'resolved' | 'won\'t fix';
}

export class CommentService {
  /**
   * Create a new comment
   */
  async createComment(params: CreateCommentParams): Promise<IComment> {
    try {
      let { threadId } = params;
      
      // If no threadId is provided but parentId exists, find the parent's threadId
      if (!threadId && params.parentId) {
        const parentComment = await CommentModel.findById(params.parentId);
        if (parentComment) {
          threadId = parentComment.threadId;
        }
      }
      
      // If no parentId and no threadId, create a new thread
      if (!params.parentId && !threadId) {
        const newThread = await ThreadModel.create({
          sessionId: params.sessionId,
          fileId: params.fileId,
          title: params.content.slice(0, 50) + (params.content.length > 50 ? '...' : ''),
          createdBy: params.userId,
          status: 'open',
          participants: [params.userId],
          lineNumber: params.lineNumber,
          codeSnippet: params.codeSnippet,
          lastActivity: new Date()
        });
        threadId = newThread._id.toString();
      }
      
      // Process mentions
      const mentions = params.mentions || [];
      
      // Create the comment
      const comment = await CommentModel.create({
        ...params,
        threadId,
        mentions
      });
      
      // Update thread's lastActivity timestamp and add participant if new
      if (threadId) {
        await ThreadModel.findByIdAndUpdate(
          threadId,
          {
            lastActivity: new Date(),
            $addToSet: { participants: params.userId }
          }
        );
      }
      
      return comment;
    } catch (error) {
      logger.error('Error creating comment', error);
      throw error;
    }
  }
  
  /**
   * Get comments for a file in a session
   */
  async getFileComments(sessionId: string, fileId: string): Promise<IComment[]> {
    try {
      return await CommentModel.find({ sessionId, fileId })
        .sort({ createdAt: 1 })
        .lean();
    } catch (error) {
      logger.error('Error getting file comments', error);
      throw error;
    }
  }
  
  /**
   * Get comments in a thread
   */
  async getThreadComments(threadId: string): Promise<IComment[]> {
    try {
      return await CommentModel.find({ threadId })
        .sort({ createdAt: 1 })
        .lean();
    } catch (error) {
      logger.error('Error getting thread comments', error);
      throw error;
    }
  }
  
  /**
   * Update a comment
   */
  async updateComment(params: UpdateCommentParams): Promise<IComment | null> {
    try {
      const { commentId, ...updateData } = params;
      
      const comment = await CommentModel.findByIdAndUpdate(
        commentId,
        updateData,
        { new: true }
      );
      
      // If the comment status is updated and it's a root comment (no parentId),
      // update the thread status as well
      if (comment && updateData.status && !comment.parentId) {
        await ThreadModel.findByIdAndUpdate(
          comment.threadId,
          { status: updateData.status }
        );
      }
      
      return comment;
    } catch (error) {
      logger.error('Error updating comment', error);
      throw error;
    }
  }
  
  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<boolean> {
    try {
      const comment = await CommentModel.findById(commentId);
      
      if (!comment) {
        return false;
      }
      
      // If this is a root comment with a thread, check if it has replies
      if (comment.threadId && !comment.parentId) {
        const replies = await CommentModel.countDocuments({
          threadId: comment.threadId,
          _id: { $ne: commentId }
        });
        
        if (replies > 0) {
          // If there are replies, just mark content as deleted instead of removing
          await CommentModel.findByIdAndUpdate(commentId, {
            content: '[Comment deleted]',
            mentions: []
          });
        } else {
          // If no replies, delete the comment and the thread
          await Promise.all([
            CommentModel.findByIdAndDelete(commentId),
            ThreadModel.findByIdAndDelete(comment.threadId)
          ]);
        }
      } else {
        // For non-root comments, just delete them
        await CommentModel.findByIdAndDelete(commentId);
      }
      
      return true;
    } catch (error) {
      logger.error('Error deleting comment', error);
      throw error;
    }
  }
  
  /**
   * Process @mentions in comment content
   * Returns array of user mentions extracted from the content
   */
  async processMentions(content: string, sessionId: string): Promise<{ userId: string; username: string }[]> {
    try {
      const mentionRegex = /@(\w+)/g;
      const matches = content.match(mentionRegex) || [];
      const mentions: { userId: string; username: string }[] = [];
      
      // Get all participants in the session to validate mentions
      const session = await ThreadModel.findOne({ sessionId });
      
      if (session && matches.length > 0) {
        // For now, we'll just store the username as both userId and username
        // In a real implementation, you'd look up user IDs from usernames
        for (const match of matches) {
          const username = match.substring(1); // Remove the @ symbol
          mentions.push({
            userId: username,
            username
          });
        }
      }
      
      return mentions;
    } catch (error) {
      logger.error('Error processing mentions', error);
      return [];
    }
  }
}