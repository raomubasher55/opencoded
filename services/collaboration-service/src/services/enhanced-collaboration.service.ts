import { Server as SocketServer } from 'socket.io';
import { createServiceLogger } from '@opencode/shared-utils';
import { SessionModel } from '../models/session.model';
import { FileChangeModel } from '../models/file-change.model';
import { ChatMessageModel } from '../models/chat-message.model';

const logger = createServiceLogger('enhanced-collaboration-service');

export interface CollaborationEvent {
  id: string;
  type: 'join' | 'leave' | 'edit' | 'cursor' | 'selection';
  userId: string;
  sessionId: string;
  timestamp: Date;
  data: any;
}

export interface Participant {
  id: string;
  username: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'active' | 'idle' | 'away' | 'offline';
  lastActivity: Date;
  cursor?: {
    fileId: string;
    line: number;
    column: number;
  };
  selection?: {
    fileId: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface SessionState {
  id: string;
  participants: Map<string, Participant>;
  files: Map<string, FileState>;
  activeEditors: Map<string, string>; // fileId -> userId
  events: CollaborationEvent[];
}

export interface FileState {
  id: string;
  name: string;
  content: string;
  version: number;
  lastModified: Date;
  lastModifiedBy: string;
  conflicts: ConflictMarker[];
  locks: FileLock[];
}

export interface ConflictMarker {
  id: string;
  line: number;
  type: 'merge' | 'overwrite' | 'manual';
  conflictingUsers: string[];
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface FileLock {
  userId: string;
  startLine: number;
  endLine: number;
  timestamp: Date;
  duration: number; // in seconds
}

export class EnhancedCollaborationService {
  private sessions: Map<string, SessionState> = new Map();
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
    this.setupAdvancedHandlers();
    this.startPeriodicTasks();
  }

  /**
   * Setup advanced real-time collaboration handlers
   */
  private setupAdvancedHandlers(): void {
    this.io.on('connection', (socket) => {
      const userId = socket.data.user?.id;
      const username = socket.data.user?.username;

      // Enhanced session join with conflict resolution
      socket.on('join-session-enhanced', async (data: { 
        sessionId: string; 
        preferences: any 
      }) => {
        try {
          const { sessionId, preferences } = data;
          
          // Initialize session state if not exists
          if (!this.sessions.has(sessionId)) {
            await this.initializeSessionState(sessionId);
          }

          const sessionState = this.sessions.get(sessionId)!;
          
          // Add participant
          const participant: Participant = {
            id: userId,
            username,
            role: this.determineUserRole(userId, sessionId),
            status: 'active',
            lastActivity: new Date(),
          };

          sessionState.participants.set(userId, participant);
          socket.join(sessionId);

          // Send comprehensive session state
          socket.emit('session-state', {
            sessionId,
            participants: Array.from(sessionState.participants.values()),
            files: Array.from(sessionState.files.values()),
            activeEditors: Object.fromEntries(sessionState.activeEditors),
          });

          // Notify others
          socket.to(sessionId).emit('participant-joined', participant);

          // Log event
          await this.logCollaborationEvent(sessionId, 'join', userId, { preferences });

          logger.info(`User ${userId} joined enhanced session ${sessionId}`);

        } catch (error) {
          logger.error('Failed to join enhanced session', error);
          socket.emit('error', { message: 'Failed to join session' });
        }
      });

      // Real-time code editing with operational transforms
      socket.on('code-edit', async (data: {
        sessionId: string;
        fileId: string;
        operations: any[];
        baseVersion: number;
      }) => {
        try {
          const { sessionId, fileId, operations, baseVersion } = data;
          const sessionState = this.sessions.get(sessionId);

          if (!sessionState) {
            throw new Error('Session not found');
          }

          const fileState = sessionState.files.get(fileId);
          if (!fileState) {
            throw new Error('File not found');
          }

          // Check for conflicts
          if (baseVersion !== fileState.version) {
            const conflicts = await this.detectConflicts(fileId, operations, fileState);
            
            if (conflicts.length > 0) {
              socket.emit('conflict-detected', {
                fileId,
                conflicts,
                currentVersion: fileState.version
              });
              return;
            }
          }

          // Apply operational transforms
          const transformedOps = this.applyOperationalTransform(operations, fileState);

          // Update file state
          fileState.content = this.applyOperations(fileState.content, transformedOps);
          fileState.version++;
          fileState.lastModified = new Date();
          fileState.lastModifiedBy = userId;

          // Store in database
          await FileChangeModel.create({
            sessionId,
            fileId,
            userId,
            content: fileState.content,
            version: fileState.version,
            operations: transformedOps,
            timestamp: new Date()
          });

          // Broadcast to other participants
          socket.to(sessionId).emit('code-updated', {
            fileId,
            operations: transformedOps,
            version: fileState.version,
            userId,
            username
          });

          // Update participant activity
          const participant = sessionState.participants.get(userId);
          if (participant) {
            participant.lastActivity = new Date();
            participant.status = 'active';
          }

          // Log event
          await this.logCollaborationEvent(sessionId, 'edit', userId, {
            fileId,
            operationsCount: transformedOps.length,
            version: fileState.version
          });

        } catch (error) {
          logger.error('Failed to process code edit', error);
          socket.emit('error', { message: 'Failed to process edit' });
        }
      });

      // Enhanced cursor tracking with selection
      socket.on('cursor-selection-update', (data: {
        sessionId: string;
        fileId: string;
        cursor: { line: number; column: number };
        selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
      }) => {
        const { sessionId, fileId, cursor, selection } = data;
        const sessionState = this.sessions.get(sessionId);

        if (sessionState) {
          const participant = sessionState.participants.get(userId);
          if (participant) {
            participant.cursor = { fileId, ...cursor };
            participant.selection = selection ? { fileId, ...selection } : undefined;
            participant.lastActivity = new Date();

            // Broadcast to others
            socket.to(sessionId).emit('participant-cursor-updated', {
              userId,
              username,
              cursor: participant.cursor,
              selection: participant.selection
            });
          }
        }
      });

      // File locking mechanism
      socket.on('request-file-lock', async (data: {
        sessionId: string;
        fileId: string;
        startLine: number;
        endLine: number;
        duration: number;
      }) => {
        try {
          const { sessionId, fileId, startLine, endLine, duration } = data;
          const sessionState = this.sessions.get(sessionId);

          if (!sessionState) {
            throw new Error('Session not found');
          }

          const fileState = sessionState.files.get(fileId);
          if (!fileState) {
            throw new Error('File not found');
          }

          // Check for existing locks in the range
          const conflictingLocks = fileState.locks.filter(lock => 
            this.rangesOverlap(startLine, endLine, lock.startLine, lock.endLine)
          );

          if (conflictingLocks.length > 0) {
            socket.emit('lock-denied', {
              fileId,
              reason: 'Range already locked',
              conflictingLocks
            });
            return;
          }

          // Create lock
          const lock: FileLock = {
            userId,
            startLine,
            endLine,
            timestamp: new Date(),
            duration
          };

          fileState.locks.push(lock);

          // Set lock expiration
          setTimeout(() => {
            this.releaseLock(sessionId, fileId, userId, startLine, endLine);
          }, duration * 1000);

          // Notify all participants
          this.io.to(sessionId).emit('file-locked', {
            fileId,
            lock,
            lockedBy: username
          });

          logger.info(`User ${userId} locked file ${fileId} lines ${startLine}-${endLine}`);

        } catch (error) {
          logger.error('Failed to process lock request', error);
          socket.emit('error', { message: 'Failed to acquire lock' });
        }
      });


      // Enhanced chat with reactions and threading
      socket.on('chat-message-enhanced', async (data: {
        sessionId: string;
        content: string;
        type: 'text' | 'code' | 'file' | 'emoji';
        threadId?: string;
        mentions?: string[];
        attachments?: any[];
      }) => {
        try {
          const { sessionId, content, type, threadId, mentions, attachments } = data;

          // Create enhanced message
          const message = await ChatMessageModel.create({
            sessionId,
            userId,
            username,
            text: content,
            type,
            threadId,
            mentions,
            attachments,
            timestamp: new Date()
          });

          // Broadcast to session
          this.io.to(sessionId).emit('chat-message-enhanced', {
            id: message._id,
            userId,
            username,
            content,
            type,
            threadId,
            mentions,
            attachments,
            reactions: [],
            timestamp: message.timestamp
          });

          // Send notifications to mentioned users
          if (mentions && mentions.length > 0) {
            this.sendMentionNotifications(sessionId, mentions, message);
          }

        } catch (error) {
          logger.error('Failed to send enhanced chat message', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // AI-powered collaboration suggestions
      socket.on('request-collaboration-suggestions', async (data: {
        sessionId: string;
        context: 'conflict' | 'merge' | 'review' | 'optimization';
      }) => {
        try {
          const { sessionId, context } = data;
          const suggestions = await this.generateCollaborationSuggestions(sessionId, context);

          socket.emit('collaboration-suggestions', {
            context,
            suggestions
          });

        } catch (error) {
          logger.error('Failed to generate collaboration suggestions', error);
        }
      });

      // Advanced conflict resolution
      socket.on('resolve-conflict', async (data: {
        sessionId: string;
        fileId: string;
        conflictId: string;
        resolution: 'accept_mine' | 'accept_theirs' | 'merge_manual' | 'merge_auto';
        mergedContent?: string;
      }) => {
        try {
          const { sessionId, fileId, conflictId, resolution, mergedContent } = data;
          const result = await this.resolveConflict(sessionId, fileId, conflictId, resolution, mergedContent, userId);

          // Broadcast resolution to all participants
          this.io.to(sessionId).emit('conflict-resolved', {
            fileId,
            conflictId,
            resolution,
            resolvedBy: {
              id: userId,
              username
            },
            newContent: result.content,
            timestamp: new Date()
          });

        } catch (error) {
          logger.error('Failed to resolve conflict', error);
          socket.emit('error', { message: 'Failed to resolve conflict' });
        }
      });

      // Three-way merge request
      socket.on('request-three-way-merge', async (data: {
        sessionId: string;
        fileId: string;
        baseVersion: string;
        theirChanges: any[];
        myChanges: any[];
      }) => {
        try {
          const result = await this.performThreeWayMerge(data);
          
          socket.emit('three-way-merge-result', {
            fileId: data.fileId,
            mergedContent: result.content,
            conflicts: result.conflicts,
            success: result.success
          });

        } catch (error) {
          logger.error('Failed to perform three-way merge', error);
          socket.emit('error', { message: 'Failed to perform merge' });
        }
      });

      // Session presence updates
      socket.on('presence-update', (data: { 
        sessionId: string; 
        status: 'active' | 'idle' | 'away' 
      }) => {
        const { sessionId, status } = data;
        const sessionState = this.sessions.get(sessionId);

        if (sessionState) {
          const participant = sessionState.participants.get(userId);
          if (participant) {
            participant.status = status;
            participant.lastActivity = new Date();

            socket.to(sessionId).emit('participant-presence-updated', {
              userId,
              username,
              status
            });
          }
        }
      });

      // Enhanced disconnect handling
      socket.on('disconnect', async () => {
        try {
          // Clean up user from all sessions
          for (const [sessionId, sessionState] of this.sessions.entries()) {
            if (sessionState.participants.has(userId)) {
              await this.cleanupUserFromSession(sessionId, userId);
              
              socket.to(sessionId).emit('participant-left', {
                userId,
                username,
                timestamp: new Date()
              });
            }
          }

          logger.info(`User ${userId} disconnected from enhanced collaboration`);

        } catch (error) {
          logger.error('Error during enhanced disconnect cleanup', error);
        }
      });
    });
  }

  /**
   * Initialize session state
   */
  private async initializeSessionState(sessionId: string): Promise<void> {
    try {
      const session = await SessionModel.findById(sessionId).populate('files');
      
      const sessionState: SessionState = {
        id: sessionId,
        participants: new Map(),
        files: new Map(),
        activeEditors: new Map(),
        events: []
      };

      // Initialize files
      if (session?.files) {
        for (const file of session.files) {
          const fileState: FileState = {
            id: file._id.toString(),
            name: file.name,
            content: file.content || '',
            version: file.version || 1,
            lastModified: file.lastModified || new Date(),
            lastModifiedBy: file.lastModifiedBy || '',
            conflicts: [],
            locks: []
          };
          sessionState.files.set(file._id.toString(), fileState);
        }
      }

      this.sessions.set(sessionId, sessionState);

    } catch (error) {
      logger.error(`Failed to initialize session state for ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * Detect conflicts in file operations
   */
  private async detectConflicts(
    fileId: string, 
    operations: any[], 
    fileState: FileState
  ): Promise<ConflictMarker[]> {
    const conflicts: ConflictMarker[] = [];
    
    // Check for overlapping operations
    for (let i = 0; i < operations.length; i++) {
      const op1 = operations[i];
      
      // Check against existing conflicts
      for (const existingConflict of fileState.conflicts) {
        if (!existingConflict.resolved && this.operationsOverlap(op1, existingConflict)) {
          conflicts.push({
            id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            line: op1.line || this.getLineFromPosition(fileState.content, op1.position),
            type: 'merge',
            conflictingUsers: [op1.userId, ...existingConflict.conflictingUsers],
            resolved: false
          });
        }
      }
      
      // Check against concurrent operations from other users
      for (let j = i + 1; j < operations.length; j++) {
        const op2 = operations[j];
        
        if (op1.userId !== op2.userId && this.operationsOverlap(op1, op2)) {
          conflicts.push({
            id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            line: Math.min(
              this.getLineFromPosition(fileState.content, op1.position),
              this.getLineFromPosition(fileState.content, op2.position)
            ),
            type: 'merge',
            conflictingUsers: [op1.userId, op2.userId],
            resolved: false
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Apply operational transform to operations
   */
  private applyOperationalTransform(operations: any[], fileState: FileState): any[] {
    // Sort operations by position to ensure consistent ordering
    const sortedOps = [...operations].sort((a, b) => a.position - b.position);
    const transformedOps: any[] = [];
    
    for (const op of sortedOps) {
      let transformedOp = { ...op };
      
      // Transform against all previously applied operations
      for (const appliedOp of transformedOps) {
        transformedOp = this.transformOperation(transformedOp, appliedOp);
      }
      
      // Transform against concurrent operations from file state
      const concurrentOps = this.getConcurrentOperations(fileState, op.timestamp);
      for (const concurrentOp of concurrentOps) {
        transformedOp = this.transformOperation(transformedOp, concurrentOp);
      }
      
      transformedOps.push(transformedOp);
    }
    
    return transformedOps;
  }

  /**
   * Apply operations to file content
   */
  private applyOperations(content: string, operations: any[]): string {
    let result = content;
    
    // Apply each operation in sequence
    for (const op of operations) {
      switch (op.type) {
        case 'insert':
          result = this.insertText(result, op.position, op.text);
          break;
        case 'delete':
          result = this.deleteText(result, op.position, op.length);
          break;
        case 'replace':
          result = this.replaceText(result, op.position, op.length, op.text);
          break;
      }
    }
    
    return result;
  }

  /**
   * Helper methods for text operations
   */
  private insertText(content: string, position: number, text: string): string {
    return content.slice(0, position) + text + content.slice(position);
  }

  private deleteText(content: string, position: number, length: number): string {
    return content.slice(0, position) + content.slice(position + length);
  }

  private replaceText(content: string, position: number, length: number, text: string): string {
    return content.slice(0, position) + text + content.slice(position + length);
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  /**
   * Release a file lock
   */
  private releaseLock(sessionId: string, fileId: string, userId: string, startLine: number, endLine: number): void {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) return;

    const fileState = sessionState.files.get(fileId);
    if (!fileState) return;

    fileState.locks = fileState.locks.filter(lock => 
      !(lock.userId === userId && lock.startLine === startLine && lock.endLine === endLine)
    );

    this.io.to(sessionId).emit('file-unlocked', {
      fileId,
      userId,
      startLine,
      endLine
    });
  }

  /**
   * Determine user role in session
   */
  private determineUserRole(userId: string, sessionId: string): 'owner' | 'editor' | 'viewer' {
    // Implementation would check user permissions for the session
    return 'editor'; // Default for now
  }

  /**
   * Send mention notifications
   */
  private async sendMentionNotifications(sessionId: string, mentions: string[], message: any): Promise<void> {
    for (const mentionedUserId of mentions) {
      // Implementation would send notifications to mentioned users
      this.io.to(mentionedUserId).emit('mention-notification', {
        sessionId,
        message,
        mentionedBy: message.username
      });
    }
  }

  /**
   * Transform one operation against another
   */
  private transformOperation(op1: any, op2: any): any {
    // If operations don't overlap, no transformation needed
    if (!this.operationsOverlap(op1, op2)) {
      return op1;
    }
    
    const transformed = { ...op1 };
    
    // Transform based on operation types
    if (op1.type === 'insert' && op2.type === 'insert') {
      // Both insertions at same position - prioritize by user ID or timestamp
      if (op1.position === op2.position) {
        if (op1.userId > op2.userId || op1.timestamp > op2.timestamp) {
          transformed.position += op2.text?.length || 0;
        }
      } else if (op1.position > op2.position) {
        transformed.position += op2.text?.length || 0;
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position > op2.position) {
        transformed.position -= Math.min(op2.length || 0, op1.position - op2.position);
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position >= op2.position) {
        transformed.position += op2.text?.length || 0;
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position > op2.position) {
        const overlap = Math.min(op2.length || 0, op1.position - op2.position);
        transformed.position -= overlap;
        transformed.length = Math.max(0, (transformed.length || 0) - overlap);
      } else if (op1.position === op2.position) {
        // Same position deletion - merge the operations
        transformed.length = Math.max(op1.length || 0, op2.length || 0);
      }
    }
    
    return transformed;
  }
  
  /**
   * Check if two operations overlap
   */
  private operationsOverlap(op1: any, op2: any): boolean {
    const pos1 = op1.position || 0;
    const pos2 = op2.position || 0;
    const len1 = op1.length || op1.text?.length || 0;
    const len2 = op2.length || op2.text?.length || 0;
    
    return pos1 < pos2 + len2 && pos2 < pos1 + len1;
  }
  
  /**
   * Get line number from character position
   */
  private getLineFromPosition(content: string, position: number): number {
    const beforePosition = content.substring(0, position);
    return beforePosition.split('\n').length;
  }
  
  /**
   * Get concurrent operations from file state
   */
  private getConcurrentOperations(fileState: FileState, timestamp: Date): any[] {
    // In a real implementation, this would fetch operations from the same time window
    // For now, return empty array as we're processing operations in real-time
    return [];
  }
  
  /**
   * Generate AI-powered collaboration suggestions
   */
  private async generateCollaborationSuggestions(sessionId: string, context: string): Promise<any[]> {
    try {
      const sessionState = this.sessions.get(sessionId);
      if (!sessionState) return [];
      
      const suggestions: any[] = [];
      
      switch (context) {
        case 'conflict':
          suggestions.push({
            type: 'conflict_resolution',
            title: 'Merge Conflicting Changes',
            description: 'Automatically merge non-overlapping changes and highlight conflicts',
            action: 'auto_merge',
            confidence: 0.8
          });
          break;
          
        case 'merge':
          suggestions.push({
            type: 'merge_strategy',
            title: 'Use Three-Way Merge',
            description: 'Compare changes against common base version',
            action: 'three_way_merge',
            confidence: 0.9
          });
          break;
          
        case 'review':
          suggestions.push({
            type: 'code_review',
            title: 'Request Code Review',
            description: 'Get feedback from team members before merging',
            action: 'request_review',
            confidence: 0.7
          });
          break;
          
        case 'optimization':
          suggestions.push({
            type: 'performance',
            title: 'Optimize Collaboration',
            description: 'Reduce file conflicts by splitting into smaller modules',
            action: 'suggest_refactor',
            confidence: 0.6
          });
          break;
      }
      
      return suggestions;
    } catch (error) {
      logger.error('Failed to generate collaboration suggestions', error);
      return [];
    }
  }

  /**
   * Clean up user from session
   */
  private async cleanupUserFromSession(sessionId: string, userId: string): Promise<void> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) return;

    // Remove participant
    sessionState.participants.delete(userId);

    // Release all locks
    for (const fileState of sessionState.files.values()) {
      fileState.locks = fileState.locks.filter(lock => lock.userId !== userId);
    }

    // Remove from active editors
    for (const [fileId, editorId] of sessionState.activeEditors.entries()) {
      if (editorId === userId) {
        sessionState.activeEditors.delete(fileId);
      }
    }


    // Log event
    await this.logCollaborationEvent(sessionId, 'leave', userId, {});
  }

  /**
   * Log collaboration event
   */
  private async logCollaborationEvent(
    sessionId: string, 
    type: string, 
    userId: string, 
    data: any
  ): Promise<void> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) return;

    const event: CollaborationEvent = {
      id: `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type as any,
      userId,
      sessionId,
      timestamp: new Date(),
      data
    };

    sessionState.events.push(event);

    // Keep only last 1000 events per session
    if (sessionState.events.length > 1000) {
      sessionState.events = sessionState.events.slice(-1000);
    }
  }

  /**
   * Start periodic cleanup and maintenance tasks
   */
  private startPeriodicTasks(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    // Update participant status every minute
    setInterval(() => {
      this.updateParticipantStatus();
    }, 60 * 1000);

    // Persist session states every 10 minutes
    setInterval(() => {
      this.persistSessionStates();
    }, 10 * 60 * 1000);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, sessionState] of this.sessions.entries()) {
      // Check if session has been inactive for more than 2 hours
      const lastActivity = Math.max(
        ...Array.from(sessionState.participants.values()).map(p => p.lastActivity.getTime())
      );

      if (now.getTime() - lastActivity > 2 * 60 * 60 * 1000) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
      logger.info(`Cleaned up expired session: ${sessionId}`);
    }
  }

  /**
   * Update participant status based on activity
   */
  private updateParticipantStatus(): void {
    const now = new Date();

    for (const sessionState of this.sessions.values()) {
      for (const participant of sessionState.participants.values()) {
        const inactiveTime = now.getTime() - participant.lastActivity.getTime();

        if (inactiveTime > 5 * 60 * 1000) { // 5 minutes
          participant.status = 'away';
        } else if (inactiveTime > 2 * 60 * 1000) { // 2 minutes
          participant.status = 'idle';
        }
      }
    }
  }

  /**
   * Persist session states to database
   */
  private async persistSessionStates(): Promise<void> {
    try {
      for (const [sessionId, sessionState] of this.sessions.entries()) {
        // Persist file states
        for (const fileState of sessionState.files.values()) {
          await FileChangeModel.findOneAndUpdate(
            { sessionId, fileId: fileState.id },
            {
              content: fileState.content,
              version: fileState.version,
              lastModified: fileState.lastModified,
              lastModifiedBy: fileState.lastModifiedBy
            },
            { upsert: true }
          );
        }
      }

      logger.debug('Session states persisted successfully');

    } catch (error) {
      logger.error('Failed to persist session states', error);
    }
  }

  /**
   * Resolve a conflict between users
   */
  private async resolveConflict(
    sessionId: string,
    fileId: string,
    conflictId: string,
    resolution: string,
    mergedContent: string | undefined,
    userId: string
  ): Promise<{ content: string; success: boolean }> {
    try {
      const sessionState = this.sessions.get(sessionId);
      if (!sessionState) {
        throw new Error('Session not found');
      }

      const fileState = sessionState.files.get(fileId);
      if (!fileState) {
        throw new Error('File not found');
      }

      // Find the conflict
      const conflictIndex = fileState.conflicts.findIndex(c => c.id === conflictId);
      if (conflictIndex === -1) {
        throw new Error('Conflict not found');
      }

      const conflict = fileState.conflicts[conflictIndex];
      let newContent = fileState.content;

      switch (resolution) {
        case 'accept_mine':
          // Keep current content, mark conflict as resolved
          break;
        case 'accept_theirs':
          // This would require the other user's version - simplified for now
          newContent = fileState.content;
          break;
        case 'merge_manual':
          if (!mergedContent) {
            throw new Error('Merged content required for manual merge');
          }
          newContent = mergedContent;
          break;
        case 'merge_auto':
          newContent = await this.performAutoMerge(fileState, conflict);
          break;
        default:
          throw new Error('Invalid resolution type');
      }

      // Update file state
      fileState.content = newContent;
      fileState.version++;
      fileState.lastModified = new Date();
      fileState.lastModifiedBy = userId;

      // Mark conflict as resolved
      conflict.resolved = true;
      conflict.resolvedBy = userId;
      conflict.resolvedAt = new Date();

      // Store resolution in database
      await FileChangeModel.create({
        sessionId,
        fileId,
        userId,
        content: newContent,
        version: fileState.version,
        operations: [{
          type: 'conflict_resolution',
          conflictId,
          resolution,
          timestamp: new Date()
        }],
        timestamp: new Date()
      });

      return { content: newContent, success: true };
    } catch (error) {
      logger.error('Failed to resolve conflict', error);
      throw error;
    }
  }

  /**
   * Perform automatic merge of conflicting changes
   */
  private async performAutoMerge(fileState: FileState, conflict: ConflictMarker): Promise<string> {
    const lines = fileState.content.split('\n');
    const conflictLine = conflict.line - 1;

    // Simple auto-merge strategy: try to merge non-overlapping changes
    // In a real implementation, this would be more sophisticated
    
    if (conflictLine >= 0 && conflictLine < lines.length) {
      // Add conflict markers for manual resolution
      lines.splice(conflictLine, 0, '<<<<<<< HEAD');
      lines.splice(conflictLine + 2, 0, '=======');
      lines.splice(conflictLine + 4, 0, '>>>>>>> INCOMING');
    }

    return lines.join('\n');
  }

  /**
   * Perform three-way merge
   */
  private async performThreeWayMerge(data: {
    sessionId: string;
    fileId: string;
    baseVersion: string;
    theirChanges: any[];
    myChanges: any[];
  }): Promise<{ content: string; conflicts: any[]; success: boolean }> {
    try {
      const { baseVersion, theirChanges, myChanges } = data;
      
      let mergedContent = baseVersion;
      const conflicts: any[] = [];
      
      // Apply my changes first
      for (const change of myChanges) {
        mergedContent = this.applyOperations(mergedContent, [change]);
      }
      
      // Try to apply their changes, detecting conflicts
      for (const theirChange of theirChanges) {
        const hasConflict = myChanges.some(myChange => 
          this.operationsOverlap(theirChange, myChange)
        );
        
        if (hasConflict) {
          conflicts.push({
            operation: theirChange,
            line: this.getLineFromPosition(mergedContent, theirChange.position),
            type: 'merge_conflict'
          });
        } else {
          // Apply non-conflicting changes
          mergedContent = this.applyOperations(mergedContent, [theirChange]);
        }
      }
      
      return {
        content: mergedContent,
        conflicts,
        success: conflicts.length === 0
      };
    } catch (error) {
      logger.error('Failed to perform three-way merge', error);
      return {
        content: data.baseVersion,
        conflicts: [],
        success: false
      };
    }
  }
}