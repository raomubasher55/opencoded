import { Server as SocketServer, Socket } from 'socket.io';
import { createServiceLogger } from '@opencode/shared-utils';
import jwt from 'jsonwebtoken';
import { SessionModel } from '../models/session.model';
import { FileChangeModel } from '../models/file-change.model';
import { ChatMessageModel } from '../models/chat-message.model';
import { CommentModel } from '../models/comment.model';
import { ThreadModel } from '../models/thread.model';
import { ReviewRequestModel } from '../models/review-request.model';

const logger = createServiceLogger('socket-service');

/**
 * Active user sessions
 */
const activeSessions: Record<string, Set<string>> = {};

/**
 * Initialize Socket.IO server
 */
export function initSocketServer(io: SocketServer): void {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.query.token as string;
      
      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as jwt.JwtPayload;
      
      // Attach user info to socket
      socket.data.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      logger.error('Socket authentication error', error);
      next(new Error('Authentication error'));
    }
  });
  
  // Handle connections
  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    
    logger.info(`User connected: ${userId}`);
    
    // Handle session join
    socket.on('join-session', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        
        // Join room
        socket.join(sessionId);
        
        // Add user to active sessions
        if (!activeSessions[sessionId]) {
          activeSessions[sessionId] = new Set();
        }
        activeSessions[sessionId].add(userId);
        
        // Get session details
        const session = await SessionModel.findById(sessionId).populate('participants');
        
        // Notify other participants
        socket.to(sessionId).emit('user-joined', {
          userId,
          username: socket.data.user?.username,
          timestamp: new Date()
        });
        
        // Send session details to the user
        socket.emit('session-details', {
          session,
          activeParticipants: Array.from(activeSessions[sessionId])
        });
        
        logger.info(`User ${userId} joined session ${sessionId}`);
      } catch (error) {
        logger.error(`Error joining session`, error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });
    
    // Handle cursor position updates
    socket.on('cursor-update', (data: { 
      sessionId: string;
      fileId: string;
      position: { line: number; column: number }
    }) => {
      const { sessionId, fileId, position } = data;
      
      socket.to(sessionId).emit('cursor-update', {
        userId,
        username: socket.data.user?.username,
        fileId,
        position,
        timestamp: Date.now()
      });
    });
    
    // Handle file changes
    socket.on('file-change', async (data: {
      sessionId: string;
      fileId: string;
      content: string;
      version: number;
      operations?: any[];
    }) => {
      try {
        const { sessionId, fileId, content, version, operations } = data;
        
        // Store file change in database
        await FileChangeModel.create({
          sessionId,
          fileId,
          userId,
          content,
          version,
          operations,
          timestamp: new Date()
        });
        
        // Broadcast to other participants
        socket.to(sessionId).emit('file-change', {
          userId,
          username: socket.data.user?.username,
          fileId,
          content,
          version,
          operations,
          timestamp: Date.now()
        });
        
        logger.debug(`User ${userId} updated file ${fileId} in session ${sessionId}`);
      } catch (error) {
        logger.error(`Error handling file change`, error);
        socket.emit('error', { message: 'Failed to process file change' });
      }
    });
    
    // Handle chat messages
    socket.on('chat-message', async (data: {
      sessionId: string;
      text: string;
      replyToId?: string;
    }) => {
      try {
        const { sessionId, text, replyToId } = data;
        
        // Store message in database
        const message = await ChatMessageModel.create({
          sessionId,
          userId,
          username: socket.data.user?.username,
          text,
          replyToId,
          timestamp: new Date()
        });
        
        // Broadcast to session participants
        io.to(sessionId).emit('chat-message', {
          id: message._id,
          userId,
          username: socket.data.user?.username,
          text,
          replyToId,
          timestamp: Date.now()
        });
        
        logger.debug(`User ${userId} sent message in session ${sessionId}`);
      } catch (error) {
        logger.error(`Error sending chat message`, error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle user typing indicator
    socket.on('user-typing', (data: { sessionId: string }) => {
      const { sessionId } = data;
      
      socket.to(sessionId).emit('user-typing', {
        userId,
        username: socket.data.user?.username,
        timestamp: Date.now()
      });
    });
    
    // Handle user stopped typing indicator
    socket.on('user-stopped-typing', (data: { sessionId: string }) => {
      const { sessionId } = data;
      
      socket.to(sessionId).emit('user-stopped-typing', {
        userId,
        username: socket.data.user?.username,
        timestamp: Date.now()
      });
    });
    
    // Handle comment creation
    socket.on('comment-created', async (data: {
      sessionId: string;
      fileId: string;
      commentId: string;
      content: string;
      lineNumber?: number;
      threadId?: string;
    }) => {
      try {
        const { sessionId, fileId, commentId, content, lineNumber, threadId } = data;
        
        // Fetch the full comment details
        const comment = await CommentModel.findById(commentId).lean();
        
        if (comment) {
          // Broadcast to session participants
          socket.to(sessionId).emit('comment-created', {
            ...comment,
            userId,
            username: socket.data.user?.username,
            timestamp: Date.now()
          });
          
          logger.debug(`User ${userId} created comment in session ${sessionId}`);
        }
      } catch (error) {
        logger.error(`Error handling comment creation`, error);
        socket.emit('error', { message: 'Failed to process comment' });
      }
    });
    
    // Handle comment update
    socket.on('comment-updated', async (data: {
      sessionId: string;
      commentId: string;
      content?: string;
      status?: string;
    }) => {
      try {
        const { sessionId, commentId, content, status } = data;
        
        // Fetch the updated comment
        const comment = await CommentModel.findById(commentId).lean();
        
        if (comment) {
          // Broadcast to session participants
          socket.to(sessionId).emit('comment-updated', {
            commentId,
            content,
            status,
            updatedBy: userId,
            username: socket.data.user?.username,
            timestamp: Date.now()
          });
          
          logger.debug(`User ${userId} updated comment ${commentId} in session ${sessionId}`);
        }
      } catch (error) {
        logger.error(`Error handling comment update`, error);
        socket.emit('error', { message: 'Failed to process comment update' });
      }
    });
    
    // Handle thread status update
    socket.on('thread-updated', async (data: {
      sessionId: string;
      threadId: string;
      title?: string;
      status?: string;
    }) => {
      try {
        const { sessionId, threadId, title, status } = data;
        
        // Broadcast to session participants
        socket.to(sessionId).emit('thread-updated', {
          threadId,
          title,
          status,
          updatedBy: userId,
          username: socket.data.user?.username,
          timestamp: Date.now()
        });
        
        logger.debug(`User ${userId} updated thread ${threadId} in session ${sessionId}`);
      } catch (error) {
        logger.error(`Error handling thread update`, error);
        socket.emit('error', { message: 'Failed to process thread update' });
      }
    });
    
    // Handle review request updates
    socket.on('review-request-updated', async (data: {
      sessionId: string;
      reviewId: string;
      status?: string;
      reviewerStatus?: string;
    }) => {
      try {
        const { sessionId, reviewId, status, reviewerStatus } = data;
        
        // Fetch the updated review request
        const review = await ReviewRequestModel.findById(reviewId).lean();
        
        if (review) {
          // Broadcast to session participants
          socket.to(sessionId).emit('review-request-updated', {
            reviewId,
            status,
            reviewerStatus,
            updatedBy: userId,
            username: socket.data.user?.username,
            timestamp: Date.now()
          });
          
          logger.debug(`User ${userId} updated review request ${reviewId} in session ${sessionId}`);
        }
      } catch (error) {
        logger.error(`Error handling review request update`, error);
        socket.emit('error', { message: 'Failed to process review request update' });
      }
    });
    
    // Handle session leave
    socket.on('leave-session', (data: { sessionId: string }) => {
      const { sessionId } = data;
      
      // Leave room
      socket.leave(sessionId);
      
      // Remove user from active sessions
      if (activeSessions[sessionId]) {
        activeSessions[sessionId].delete(userId);
        
        if (activeSessions[sessionId].size === 0) {
          delete activeSessions[sessionId];
        }
      }
      
      // Notify other participants
      socket.to(sessionId).emit('user-left', {
        userId,
        username: socket.data.user?.username,
        timestamp: Date.now()
      });
      
      logger.info(`User ${userId} left session ${sessionId}`);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userId}`);
      
      // Remove user from all active sessions
      for (const sessionId in activeSessions) {
        if (activeSessions[sessionId].has(userId)) {
          activeSessions[sessionId].delete(userId);
          
          if (activeSessions[sessionId].size === 0) {
            delete activeSessions[sessionId];
          }
          
          // Notify other participants
          socket.to(sessionId).emit('user-left', {
            userId,
            username: socket.data.user?.username,
            timestamp: Date.now()
          });
          
          logger.info(`User ${userId} left session ${sessionId} due to disconnect`);
        }
      }
    });
  });
}

/**
 * Get active sessions for a user
 */
export function getActiveSessionsForUser(userId: string): string[] {
  const sessions: string[] = [];
  
  for (const sessionId in activeSessions) {
    if (activeSessions[sessionId].has(userId)) {
      sessions.push(sessionId);
    }
  }
  
  return sessions;
}

/**
 * Get active participants in a session
 */
export function getActiveParticipants(sessionId: string): string[] {
  if (!activeSessions[sessionId]) {
    return [];
  }
  
  return Array.from(activeSessions[sessionId]);
}