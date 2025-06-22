import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createServiceLogger } from '@opencode/shared-utils';
import mongoose from 'mongoose';
import { WorkspaceModel } from '../models/workspace.model';

const logger = createServiceLogger('workspace-controller');

/**
 * Create a new workspace
 */
export async function createWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, basePath, teamId, visibility, settings } = req.body;
    
    // Validate required fields
    if (!name || !basePath) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation Error',
        message: 'Workspace name and base path are required'
      });
      return;
    }
    
    // Create workspace
    const workspace = new WorkspaceModel({
      name,
      description,
      basePath,
      visibility: visibility || 'private',
      teamId,
      settings,
      createdBy: req.user!.id,
      members: [{
        userId: req.user!.id,
        username: req.user!.username,
        role: 'owner',
        addedAt: new Date()
      }]
    });
    
    // Save to database
    await workspace.save();
    
    res.status(StatusCodes.CREATED).json(workspace);
  } catch (error) {
    logger.error('Error creating workspace', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to create workspace'
    });
  }
}

/**
 * Get all workspaces
 */
export async function getWorkspaces(req: Request, res: Response): Promise<void> {
  try {
    const { visibility, teamId, limit = 10, offset = 0 } = req.query;
    
    // Build query
    const query: any = {};
    
    // Filter by user's membership or public/team workspaces
    query.$or = [
      { 'members.userId': req.user!.id },
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
    
    // Execute query with pagination
    const workspaces = await WorkspaceModel.find(query)
      .sort({ updatedAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .select('-__v');
    
    // Count total matching workspaces
    const total = await WorkspaceModel.countDocuments(query);
    
    // Format response
    const formattedWorkspaces = workspaces.map(workspace => ({
      id: workspace._id,
      name: workspace.name,
      description: workspace.description,
      basePath: workspace.basePath,
      visibility: workspace.visibility,
      teamId: workspace.teamId,
      membersCount: workspace.members.length,
      createdBy: workspace.createdBy,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    }));
    
    res.status(StatusCodes.OK).json({
      workspaces: formattedWorkspaces,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    logger.error('Error getting workspaces', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get workspaces'
    });
  }
}

/**
 * Get workspace by ID
 */
export async function getWorkspaceById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get workspace from database
    const workspace = await WorkspaceModel.findById(id).select('-__v');
    
    if (!workspace) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
      return;
    }
    
    // Check if user has access to this workspace
    const hasAccess = 
      workspace.createdBy === req.user!.id ||
      workspace.members.some(m => m.userId === req.user!.id) ||
      workspace.visibility === 'public' ||
      (workspace.visibility === 'team' && workspace.teamId && req.user!.role === 'admin');
    
    if (!hasAccess) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'You do not have access to this workspace'
      });
      return;
    }
    
    // Return workspace details
    res.status(StatusCodes.OK).json(workspace);
  } catch (error) {
    logger.error('Error getting workspace', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to get workspace'
    });
  }
}

/**
 * Update workspace
 */
export async function updateWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, visibility, settings } = req.body;
    
    // Get workspace from database
    const workspace = await WorkspaceModel.findById(id);
    
    if (!workspace) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
      return;
    }
    
    // Check if user is owner or admin
    const member = workspace.members.find(m => m.userId === req.user!.id);
    const isAdmin = req.user!.role === 'admin';
    
    if (!member || (member.role !== 'owner' && !isAdmin)) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only workspace owner or admin can update the workspace'
      });
      return;
    }
    
    // Update fields
    if (name) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (visibility) workspace.visibility = visibility;
    if (settings) workspace.settings = { ...workspace.settings, ...settings };
    
    // Save changes
    await workspace.save();
    
    res.status(StatusCodes.OK).json({
      id: workspace._id,
      name: workspace.name,
      description: workspace.description,
      visibility: workspace.visibility,
      settings: workspace.settings,
      updatedAt: workspace.updatedAt
    });
  } catch (error) {
    logger.error('Error updating workspace', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to update workspace'
    });
  }
}

/**
 * Delete workspace
 */
export async function deleteWorkspace(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get workspace from database
    const workspace = await WorkspaceModel.findById(id);
    
    if (!workspace) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
      return;
    }
    
    // Check if user is owner or admin
    const member = workspace.members.find(m => m.userId === req.user!.id);
    const isAdmin = req.user!.role === 'admin';
    
    if (!member || (member.role !== 'owner' && !isAdmin)) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only workspace owner or admin can delete the workspace'
      });
      return;
    }
    
    // Delete workspace
    await WorkspaceModel.deleteOne({ _id: id });
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting workspace', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to delete workspace'
    });
  }
}

/**
 * Add workspace member
 */
export async function addWorkspaceMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId, username, role = 'viewer' } = req.body;
    
    // Validate required fields
    if (!userId || !username) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation Error',
        message: 'User ID and username are required'
      });
      return;
    }
    
    // Get workspace from database
    const workspace = await WorkspaceModel.findById(id);
    
    if (!workspace) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
      return;
    }
    
    // Check if user is owner or admin
    const currentMember = workspace.members.find(m => m.userId === req.user!.id);
    const isAdmin = req.user!.role === 'admin';
    
    if (!currentMember || (currentMember.role !== 'owner' && !isAdmin)) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only workspace owner or admin can add members'
      });
      return;
    }
    
    // Check if user is already a member
    const existingMember = workspace.members.find(m => m.userId === userId);
    
    if (existingMember) {
      res.status(StatusCodes.CONFLICT).json({
        error: 'Conflict',
        message: 'User is already a member of this workspace'
      });
      return;
    }
    
    // Add member
    workspace.members.push({
      userId,
      username,
      role: role as 'owner' | 'editor' | 'viewer',
      addedAt: new Date()
    });
    
    await workspace.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Member added successfully',
      member: {
        userId,
        username,
        role,
        addedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Error adding workspace member', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to add workspace member'
    });
  }
}

/**
 * Remove workspace member
 */
export async function removeWorkspaceMember(req: Request, res: Response): Promise<void> {
  try {
    const { id, userId } = req.params;
    
    // Get workspace from database
    const workspace = await WorkspaceModel.findById(id);
    
    if (!workspace) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
      return;
    }
    
    // Check if user is owner, admin, or removing themself
    const currentMember = workspace.members.find(m => m.userId === req.user!.id);
    const isAdmin = req.user!.role === 'admin';
    const isRemovingSelf = req.user!.id === userId;
    
    if (!isRemovingSelf && (!currentMember || (currentMember.role !== 'owner' && !isAdmin))) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only workspace owner or admin can remove members'
      });
      return;
    }
    
    // Check if user is a member
    const memberIndex = workspace.members.findIndex(m => m.userId === userId);
    
    if (memberIndex === -1) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'User is not a member of this workspace'
      });
      return;
    }
    
    // Check if trying to remove owner
    const isOwner = workspace.members[memberIndex].role === 'owner';
    
    if (isOwner && !isRemovingSelf && !isAdmin) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Cannot remove workspace owner'
      });
      return;
    }
    
    // If removing owner, check if there's another owner
    if (isOwner) {
      const otherOwners = workspace.members.filter(m => m.role === 'owner' && m.userId !== userId);
      
      if (otherOwners.length === 0) {
        // Find another member to promote to owner
        const editors = workspace.members.filter(m => m.role === 'editor' && m.userId !== userId);
        
        if (editors.length > 0) {
          // Promote first editor to owner
          editors[0].role = 'owner';
        } else if (workspace.members.length > 1) {
          // Promote any member to owner
          const nonOwnerMembers = workspace.members.filter(m => m.userId !== userId);
          nonOwnerMembers[0].role = 'owner';
        }
      }
    }
    
    // Remove member
    workspace.members = workspace.members.filter(m => m.userId !== userId);
    
    await workspace.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    logger.error('Error removing workspace member', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to remove workspace member'
    });
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(req: Request, res: Response): Promise<void> {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    
    // Validate role
    if (!role || !['owner', 'editor', 'viewer'].includes(role)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Validation Error',
        message: 'Valid role (owner, editor, viewer) is required'
      });
      return;
    }
    
    // Get workspace from database
    const workspace = await WorkspaceModel.findById(id);
    
    if (!workspace) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Workspace not found'
      });
      return;
    }
    
    // Check if user is owner or admin
    const currentMember = workspace.members.find(m => m.userId === req.user!.id);
    const isAdmin = req.user!.role === 'admin';
    
    if (!currentMember || (currentMember.role !== 'owner' && !isAdmin)) {
      res.status(StatusCodes.FORBIDDEN).json({
        error: 'Access Denied',
        message: 'Only workspace owner or admin can update member roles'
      });
      return;
    }
    
    // Find member to update
    const memberIndex = workspace.members.findIndex(m => m.userId === userId);
    
    if (memberIndex === -1) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Member not found'
      });
      return;
    }
    
    // Check if changing owner role
    const isChangingOwner = workspace.members[memberIndex].role === 'owner' || role === 'owner';
    
    if (isChangingOwner) {
      // Count number of owners
      const ownerCount = workspace.members.filter(m => m.role === 'owner').length;
      
      // If removing last owner, make sure there will be another owner
      if (ownerCount === 1 && workspace.members[memberIndex].role === 'owner' && role !== 'owner') {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Validation Error',
          message: 'Workspace must have at least one owner'
        });
        return;
      }
    }
    
    // Update role
    workspace.members[memberIndex].role = role as 'owner' | 'editor' | 'viewer';
    
    await workspace.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Member role updated successfully',
      member: {
        userId,
        username: workspace.members[memberIndex].username,
        role: workspace.members[memberIndex].role
      }
    });
  } catch (error) {
    logger.error('Error updating member role', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Server Error',
      message: 'Failed to update member role'
    });
  }
}