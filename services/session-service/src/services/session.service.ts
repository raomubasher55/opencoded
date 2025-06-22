import { Message, Session } from '@opencode/shared-types';
import { createServiceLogger, TokenCounter } from '@opencode/shared-utils';
import { v4 as uuidv4 } from 'uuid';
import { SessionModel, documentToSession } from '../models/session.model';
import { ApiError } from '../middleware/error.middleware';
import config from '../config/config';

const logger = createServiceLogger('session-service');
const tokenCounter = new TokenCounter();

export class SessionService {
  /**
   * Create a new session
   */
  async createSession(userId: string, title: string): Promise<Session> {
    try {
      // Check if the user has reached their session limit
      const sessionCount = await SessionModel.countDocuments({ userId });
      
      if (sessionCount >= config.defaultMaxSessions) {
        throw new ApiError(`Maximum session limit (${config.defaultMaxSessions}) reached`, 400);
      }
      
      const sessionId = uuidv4();
      const session = new SessionModel({
        _id: sessionId,
        userId,
        title,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date()
      });
      
      await session.save();
      
      logger.info(`Created new session for user ${userId}`, { sessionId });
      
      return documentToSession(session);
    } catch (error) {
      logger.error('Error creating session', error);
      throw error;
    }
  }
  
  /**
   * Get a session by ID
   */
  async getSession(sessionId: string, userId: string): Promise<Session> {
    try {
      const session = await SessionModel.findOne({ _id: sessionId, userId });
      
      if (!session) {
        throw new ApiError('Session not found', 404);
      }
      
      // Update last accessed timestamp
      session.lastAccessedAt = new Date();
      await session.save();
      
      return documentToSession(session);
    } catch (error) {
      logger.error(`Error getting session ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Get all sessions for a user
   */
  async getAllSessions(userId: string, limit = 20, offset = 0): Promise<{ sessions: Session[], total: number }> {
    try {
      const total = await SessionModel.countDocuments({ userId });
      
      const sessions = await SessionModel.find({ userId })
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit);
      
      return {
        sessions: sessions.map(documentToSession),
        total
      };
    } catch (error) {
      logger.error(`Error getting sessions for user ${userId}`, error);
      throw error;
    }
  }
  
  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string, 
    userId: string, 
    updates: { title?: string; tags?: string[]; metadata?: Record<string, any> }
  ): Promise<Session> {
    try {
      const session = await SessionModel.findOne({ _id: sessionId, userId });
      
      if (!session) {
        throw new ApiError('Session not found', 404);
      }
      
      if (updates.title !== undefined) {
        session.title = updates.title;
      }
      
      if (updates.tags !== undefined) {
        session.tags = updates.tags.map(tag => ({ name: tag }));
      }
      
      if (updates.metadata !== undefined) {
        session.metadata = {
          ...(session.metadata || {}),
          ...updates.metadata
        };
      }
      
      session.updatedAt = new Date();
      await session.save();
      
      logger.info(`Updated session ${sessionId}`);
      
      return documentToSession(session);
    } catch (error) {
      logger.error(`Error updating session ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Add a message to a session
   */
  async addMessage(sessionId: string, userId: string, message: Omit<Message, 'id' | 'sessionId' | 'timestamp'>): Promise<Message> {
    try {
      const session = await SessionModel.findOne({ _id: sessionId, userId });
      
      if (!session) {
        throw new ApiError('Session not found', 404);
      }
      
      // Check if the session has reached the message limit
      if (session.messages.length >= config.defaultMaxMessagesPerSession) {
        throw new ApiError(`Maximum messages per session limit (${config.defaultMaxMessagesPerSession}) reached`, 400);
      }
      
      // Validate token count
      const tokenCount = tokenCounter.countTokensInString(message.content);
      if (tokenCount > config.defaultMaxTokensPerMessage) {
        throw new ApiError(`Message exceeds maximum token limit (${config.defaultMaxTokensPerMessage})`, 400);
      }
      
      // Create a new message
      const newMessage: Message = {
        id: uuidv4(),
        sessionId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        timestamp: new Date()
      };
      
      // Add the message to the session
      session.messages.push(newMessage);
      session.updatedAt = new Date();
      session.lastAccessedAt = new Date();
      
      await session.save();
      
      logger.info(`Added message to session ${sessionId}`, { messageId: newMessage.id });
      
      return newMessage;
    } catch (error) {
      logger.error(`Error adding message to session ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Get messages from a session with pagination
   */
  async getMessages(sessionId: string, userId: string, limit = 50, before?: string): Promise<Message[]> {
    try {
      const session = await SessionModel.findOne({ _id: sessionId, userId });
      
      if (!session) {
        throw new ApiError('Session not found', 404);
      }
      
      // Update last accessed timestamp
      session.lastAccessedAt = new Date();
      await session.save();
      
      let messages = session.messages;
      
      // Filter messages before a certain ID if specified
      if (before) {
        const messageIndex = messages.findIndex(m => m.id === before);
        if (messageIndex !== -1) {
          messages = messages.slice(0, messageIndex);
        }
      }
      
      // Apply limit and return most recent messages first
      return messages.slice(-limit).reverse();
    } catch (error) {
      logger.error(`Error getting messages for session ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Delete a message from a session
   */
  async deleteMessage(sessionId: string, userId: string, messageId: string): Promise<void> {
    try {
      const session = await SessionModel.findOne({ _id: sessionId, userId });
      
      if (!session) {
        throw new ApiError('Session not found', 404);
      }
      
      const messageIndex = session.messages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) {
        throw new ApiError('Message not found', 404);
      }
      
      // Remove the message
      session.messages.splice(messageIndex, 1);
      session.updatedAt = new Date();
      
      await session.save();
      
      logger.info(`Deleted message ${messageId} from session ${sessionId}`);
    } catch (error) {
      logger.error(`Error deleting message ${messageId} from session ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      const result = await SessionModel.deleteOne({ _id: sessionId, userId });
      
      if (result.deletedCount === 0) {
        throw new ApiError('Session not found', 404);
      }
      
      logger.info(`Deleted session ${sessionId}`);
    } catch (error) {
      logger.error(`Error deleting session ${sessionId}`, error);
      throw error;
    }
  }
  
  /**
   * Clear old sessions based on TTL configuration
   */
  async clearOldSessions(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.sessionTtlDays);
      
      const result = await SessionModel.deleteMany({
        lastAccessedAt: { $lt: cutoffDate }
      });
      
      logger.info(`Cleared ${result.deletedCount} old sessions`);
      return result.deletedCount || 0;
    } catch (error) {
      logger.error('Error clearing old sessions', error);
      throw error;
    }
  }
}