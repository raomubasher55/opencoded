import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createServiceLogger } from '@opencode/shared-utils';
import { SessionModel, ISession } from '../models/session.model';
import { getActiveParticipants as getActiveSessionUsers } from '../services/socket.service';

const logger = createServiceLogger('session-controller');

/**
 * Create a new collaboration session
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, visibility, teamId, workspaceId } = req.body;
    
    // Validate required fields
    if (!name) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation Error',
        message: 'Session name is required'
      });
      return;
    }
    
    // Create new session
    const session = new SessionModel({
      name,
      description,
      visibility: visibility || 'private',
      teamId,
      workspaceId,
      createdBy: req.user!.id,
      participants: [{
        userId: req.user!.id,
        username: req.user!.username,
        role: 'owner',
        joinedAt: new Date()
      }]
    });
    
    // Save to database
    await session.save();
    
    res.status(StatusCodes.CREATED).json(session);
  } catch (error) {
    logger.error('Error creating session', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to create session'
    });
  }
}

/**
 * Get all sessions
 */
export async function getSessions(req: Request, res: Response): Promise<void> {
  try {
    const { visibility, teamId, active, limit = 10, offset = 0 } = req.query;
    
    // Build query
    const query: any = {};
    
    // Filter by user's participation or public/team sessions
    query.$or = [
      { 'participants.userId': req.user!.id },
      { visibility: 'public' }
    ];
    
    // Add team visibility if user is part of a team
    if (req.user!.role === 'admin' || teamId) {
      query.$or.push({ 
        visibility: 'team',
        teamId: teamId as string || { $exists: true }
      });
    }
    
    // Filter by visibility if specified
    if (visibility) {
      query.visibility = visibility;
    }
    
    // Filter by active status if specified
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    // Execute query with pagination
    const sessions = await SessionModel.find(query)
      .sort({ updatedAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .select('-__v');
    
    // Count total matching sessions
    const total = await SessionModel.countDocuments(query);
    
    // Format response
    const formattedSessions = sessions.map(session => ({
      id: session._id,
      name: session.name,
      description: session.description,
      visibility: session.visibility,
      teamId: session.teamId,
      participantsCount: session.participants.length,
      createdBy: session.createdBy,
      createdAt: session.createdAt
    }));
    
    res.status(StatusCodes.OK).json({
      sessions: formattedSessions,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    logger.error('Error getting sessions', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get sessions'
    });
  }
}

/**
 * Get session by ID
 */
export async function getSessionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get session from database
    const session = await SessionModel.findById(id).select('-__v');
    
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
    
    // Get active participants
    const activeParticipantIds = getActiveSessionUsers(id);
    
    // Format response
    const response = {
      id: session._id,
      name: session.name,
      description: session.description,
      visibility: session.visibility,
      teamId: session.teamId,
      workspaceId: session.workspaceId,
      participants: session.participants,
      activeParticipants: activeParticipantIds,
      createdBy: session.createdBy,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
    
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    logger.error('Error getting session', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get session'
    });
  }
}

/**
 * Update session
 */
export async function updateSession(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, visibility, isActive } = req.body;
    
    // Get session from database
    const session = await SessionModel.findById(id);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if user is owner or admin
    const isOwner = session.createdBy === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isOwnerOrAdmin = isOwner || isAdmin;
    
    if (!isOwnerOrAdmin) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only session owner or admin can update the session'
      });
      return;
    }
    
    // Update fields
    if (name) session.name = name;
    if (description !== undefined) session.description = description;
    if (visibility) session.visibility = visibility as ISession['visibility'];
    if (isActive !== undefined) session.isActive = isActive;
    
    // Save changes
    await session.save();
    
    res.status(StatusCodes.OK).json({
      id: session._id,
      name: session.name,
      description: session.description,
      visibility: session.visibility,
      isActive: session.isActive,
      updatedAt: session.updatedAt
    });
  } catch (error) {
    logger.error('Error updating session', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to update session'
    });
  }
}

/**
 * Delete session
 */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get session from database
    const session = await SessionModel.findById(id);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if user is owner or admin
    const isOwner = session.createdBy === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only session owner or admin can delete the session'
      });
      return;
    }
    
    // Delete session
    await SessionModel.deleteOne({ _id: id });
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting session', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to delete session'
    });
  }
}

/**
 * Join session
 */
export async function joinSession(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role = 'viewer' } = req.body;
    
    // Get session from database
    const session = await SessionModel.findById(id);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if user can join the session
    const canJoin = 
      session.visibility === 'public' ||
      session.participants.some(p => p.userId === req.user!.id) ||
      (session.visibility === 'team' && session.teamId) ||
      req.user!.role === 'admin';
    
    if (!canJoin) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You do not have permission to join this session'
      });
      return;
    }
    
    // Check if user is already a participant
    const existingParticipant = session.participants.find(p => p.userId === req.user!.id);
    
    if (existingParticipant) {
      // Update role if different and not owner
      if (existingParticipant.role !== 'owner' && existingParticipant.role !== role) {
        existingParticipant.role = role as 'editor' | 'viewer';
        await session.save();
      }
      
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Already a participant of this session',
        role: existingParticipant.role
      });
      return;
    }
    
    // Add user as participant
    session.participants.push({
      userId: req.user!.id,
      username: req.user!.username,
      role: role as 'editor' | 'viewer',
      joinedAt: new Date()
    });
    
    await session.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Successfully joined session',
      role
    });
  } catch (error) {
    logger.error('Error joining session', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to join session'
    });
  }
}

/**
 * Leave session
 */
export async function leaveSession(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get session from database
    const session = await SessionModel.findById(id);
    
    if (!session) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if user is a participant
    const participantIndex = session.participants.findIndex(p => p.userId === req.user!.id);
    
    if (participantIndex === -1) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Not a Participant',
        message: 'You are not a participant of this session'
      });
      return;
    }
    
    // Check if user is the owner
    const isOwner = session.participants[participantIndex].role === 'owner';
    
    if (isOwner) {
      // If owner is leaving and there are other participants, transfer ownership
      const otherParticipants = session.participants.filter(p => p.userId !== req.user!.id);
      
      if (otherParticipants.length > 0) {
        // Find another participant to become owner
        const newOwnerIndex = otherParticipants.findIndex(p => p.role === 'editor');
        
        if (newOwnerIndex !== -1) {
          // Make an editor the new owner
          otherParticipants[newOwnerIndex].role = 'owner';
        } else {
          // Make any participant the owner
          otherParticipants[0].role = 'owner';
        }
      }
    }
    
    // Remove user from participants
    session.participants = session.participants.filter(p => p.userId !== req.user!.id);
    
    // If no participants left, mark session as inactive
    if (session.participants.length === 0) {
      session.isActive = false;
    }
    
    await session.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Successfully left session'
    });
  } catch (error) {
    logger.error('Error leaving session', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to leave session'
    });
  }
}

/**
 * Get active participants
 */
export async function getActiveParticipants(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get session from database
    const session = await SessionModel.findById(id);
    
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
    
    // Get active participants from socket service
    const activeParticipantIds = getActiveSessionUsers(id);
    
    // Match with participant details
    const activeParticipants = session.participants
      .filter(p => Array.isArray(activeParticipantIds) && activeParticipantIds.includes(p.userId))
      .map(p => ({
        userId: p.userId,
        username: p.username,
        role: p.role
      }));
    
    res.status(StatusCodes.OK).json({
      activeParticipants,
      count: activeParticipants.length
    });
  } catch (error) {
    logger.error('Error getting active participants', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get active participants'
    });
  }
}