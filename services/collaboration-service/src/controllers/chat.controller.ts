import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createServiceLogger } from '@opencode/shared-utils';
import { ChatMessageModel } from '../models/chat-message.model';
import { SessionModel } from '../models/session.model';

const logger = createServiceLogger('chat-controller');

/**
 * Get messages for a session
 */
export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    const { limit = 50, before, after } = req.query;
    
    // Check if session exists and user has access
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if user has access to this session
    const hasAccess = 
      session.createdBy === req.user!.id ||
      session.participants.some(p => p.userId === req.user!.id) ||
      session.visibility === 'public' ||
      (session.visibility === 'team' && session.teamId && req.user!.role === 'admin');
    
    if (!hasAccess) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You do not have access to this session'
      });
      return;
    }
    
    // Build query
    const query: any = { sessionId };
    
    // Add timestamp filters
    if (before) {
      query.timestamp = { ...query.timestamp, $lt: new Date(before as string) };
    }
    
    if (after) {
      query.timestamp = { ...query.timestamp, $gt: new Date(after as string) };
    }
    
    // Get messages
    const messages = await ChatMessageModel.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .select('-__v');
    
    // Check if there are more messages
    const hasMore = await ChatMessageModel.countDocuments({
      ...query,
      timestamp: { $lt: messages[messages.length - 1]?.timestamp }
    }) > 0;
    
    res.status(StatusCodes.OK).json({
      messages: messages.reverse(),
      hasMore
    });
  } catch (error) {
    logger.error('Error getting messages', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get messages'
    });
  }
}

/**
 * Get message by ID
 */
export async function getMessageById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get message
    const message = await ChatMessageModel.findById(id).select('-__v');
    
    if (!message) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Message not found'
      });
      return;
    }
    
    // Check if user has access to the session
    const session = await SessionModel.findById(message.sessionId);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Associated session not found'
      });
      return;
    }
    
    // Check if user has access to this session
    const hasAccess = 
      session.createdBy === req.user!.id ||
      session.participants.some(p => p.userId === req.user!.id) ||
      session.visibility === 'public' ||
      (session.visibility === 'team' && session.teamId && req.user!.role === 'admin');
    
    if (!hasAccess) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You do not have access to this message'
      });
      return;
    }
    
    res.status(StatusCodes.OK).json(message);
  } catch (error) {
    logger.error('Error getting message', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get message'
    });
  }
}

/**
 * Create a new message
 */
export async function createMessage(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    const { text, replyToId, codeSnippet, attachments } = req.body;
    
    // Validate required fields
    if (!text && !codeSnippet) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation Error',
        message: 'Message text or code snippet is required'
      });
      return;
    }
    
    // Check if session exists and user has access
    const session = await SessionModel.findById(sessionId);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if user is a participant
    const isParticipant = session.participants.some(p => p.userId === req.user!.id);
    
    if (!isParticipant) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You must be a participant to send messages'
      });
      return;
    }
    
    // Create message
    const message = new ChatMessageModel({
      sessionId,
      userId: req.user!.id,
      username: req.user!.username,
      text,
      replyToId,
      codeSnippet,
      attachments,
      timestamp: new Date()
    });
    
    await message.save();
    
    res.status(StatusCodes.CREATED).json(message);
  } catch (error) {
    logger.error('Error creating message', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to create message'
    });
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get message
    const message = await ChatMessageModel.findById(id);
    
    if (!message) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Message not found'
      });
      return;
    }
    
    // Check if user is the message sender or an admin
    const isOwner = message.userId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You can only delete your own messages'
      });
      return;
    }
    
    // Delete message
    await ChatMessageModel.deleteOne({ _id: id });
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting message', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to delete message'
    });
  }
}

/**
 * Get messages in a thread
 */
export async function getThreadMessages(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get parent message
    const parentMessage = await ChatMessageModel.findById(id);
    
    if (!parentMessage) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Parent message not found'
      });
      return;
    }
    
    // Check if user has access to the session
    const session = await SessionModel.findById(parentMessage.sessionId);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Associated session not found'
      });
      return;
    }
    
    // Check if user has access to this session
    const hasAccess = 
      session.createdBy === req.user!.id ||
      session.participants.some(p => p.userId === req.user!.id) ||
      session.visibility === 'public' ||
      (session.visibility === 'team' && session.teamId && req.user!.role === 'admin');
    
    if (!hasAccess) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You do not have access to this thread'
      });
      return;
    }
    
    // Get replies
    const replies = await ChatMessageModel.find({ 
      replyToId: id 
    }).sort({ timestamp: 1 }).select('-__v');
    
    // Combine parent and replies
    const thread = [parentMessage, ...replies];
    
    res.status(StatusCodes.OK).json({
      thread,
      count: thread.length
    });
  } catch (error) {
    logger.error('Error getting thread messages', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get thread messages'
    });
  }
}