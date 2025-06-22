import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { OpenCodedConfig } from '../types/config';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('realtime-socket');

/**
 * Events emitted by RealtimeSocket
 */
export enum RealtimeEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  MESSAGE_RECEIVED = 'message_received',
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_PROGRESS = 'execution_progress',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  TOOL_OUTPUT = 'tool_output',
  SESSION_UPDATE = 'session_update',
  ERROR = 'error'
}

/**
 * RealtimeSocket manages real-time communication with the backend services
 */
export class RealtimeSocket extends EventEmitter {
  private socket: Socket | null = null;
  private config: OpenCodedConfig;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  constructor(config: OpenCodedConfig) {
    super();
    this.config = config;
  }
  
  /**
   * Connect to the real-time server
   * @param userId User ID for authentication
   * @param sessionId Optional session ID to join
   */
  connect(userId: string, sessionId?: string): Promise<void> {
    this.userId = userId;
    this.sessionId = sessionId || null;
    
    return new Promise((resolve, reject) => {
      try {
        // Construct the socket.io URL from the API URL
        const apiUrl = this.config.api?.url || this.config.apiUrl || 'http://localhost:8080';
        const socketUrl = apiUrl.replace(/^http/, 'ws');
        
        // Connect to the server
        this.socket = io(socketUrl, {
          transports: ['websocket'],
          auth: {
            userId,
            token: this.config.api?.key || this.config.apiKey,
            sessionId: this.sessionId
          },
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000
        });
        
        // Set up event handlers
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info('Connected to real-time server');
          this.emit(RealtimeEvent.CONNECTED);
          resolve();
        });
        
        this.socket.on('disconnect', (reason: string) => {
          this.isConnected = false;
          logger.info(`Disconnected from real-time server: ${reason}`);
          this.emit(RealtimeEvent.DISCONNECTED, reason);
        });
        
        this.socket.on('connect_error', (error: Error) => {
          logger.error('Connection error:', error);
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit(RealtimeEvent.ERROR, new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
          }
        });
        
        // Message events
        this.socket.on('message', (data: any) => {
          this.emit(RealtimeEvent.MESSAGE_RECEIVED, data);
        });
        
        // Execution events
        this.socket.on('execution:started', (data: any) => {
          this.emit(RealtimeEvent.EXECUTION_STARTED, data);
        });
        
        this.socket.on('execution:progress', (data: any) => {
          this.emit(RealtimeEvent.EXECUTION_PROGRESS, data);
        });
        
        this.socket.on('execution:completed', (data: any) => {
          this.emit(RealtimeEvent.EXECUTION_COMPLETED, data);
        });
        
        this.socket.on('execution:failed', (data: any) => {
          this.emit(RealtimeEvent.EXECUTION_FAILED, data);
        });
        
        // Tool output events
        this.socket.on('tool:output', (data: any) => {
          this.emit(RealtimeEvent.TOOL_OUTPUT, data);
        });
        
        // Session events
        this.socket.on('session:update', (data: any) => {
          this.emit(RealtimeEvent.SESSION_UPDATE, data);
        });
        
      } catch (error) {
        logger.error('Error creating socket connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from the real-time server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
  
  /**
   * Send a message to the server
   * @param event Event name
   * @param data Event data
   */
  send(event: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to server');
    }
    
    this.socket.emit(event, data);
  }
  
  /**
   * Join a specific session
   * @param sessionId Session ID to join
   */
  joinSession(sessionId: string): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to server');
    }
    
    this.sessionId = sessionId;
    this.socket.emit('session:join', { sessionId });
  }
  
  /**
   * Leave the current session
   */
  leaveSession(): void {
    if (!this.socket || !this.isConnected || !this.sessionId) {
      return;
    }
    
    this.socket.emit('session:leave', { sessionId: this.sessionId });
    this.sessionId = null;
  }
  
  /**
   * Check if connected to the server
   */
  isConnectedToServer(): boolean {
    return this.isConnected;
  }
  
  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId;
  }
}