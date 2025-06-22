import { Server as SocketServer } from 'socket.io';
import http from 'http';
import { AnalyticsService } from '../utils/analytics';
import { InsightsService } from './insights.service';
import { CachingService } from '../utils/caching';

/**
 * RealTimeAnalyticsService
 * 
 * Provides real-time analytics updates via WebSockets
 * Broadcasts metrics updates to connected clients
 */
export class RealTimeAnalyticsService {
  private io: SocketServer;
  private analyticsService: AnalyticsService;
  private insightsService: InsightsService;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_UPDATE_INTERVAL = 5000; // 5 seconds
  
  constructor(server: http.Server) {
    this.io = new SocketServer(server, {
      path: '/socket/analytics',
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.analyticsService = new AnalyticsService();
    const cachingService = new CachingService();
    this.insightsService = new InsightsService(this.analyticsService, cachingService);
    
    this.initialize();
  }
  
  /**
   * Initialize socket server and event handlers
   */
  private initialize(): void {
    this.io.use(this.authenticateSocket);
    
    this.io.on('connection', (socket) => {
      console.log(`Client connected to analytics: ${socket.id}`);
      
      // Join rooms based on user role and permissions
      this.setupUserRooms(socket);
      
      // Handle subscription requests
      socket.on('subscribe', (data: { channel: string, entityId?: string }) => {
        this.handleSubscription(socket, data);
      });
      
      // Handle unsubscription requests
      socket.on('unsubscribe', (data: { channel: string, entityId?: string }) => {
        this.handleUnsubscription(socket, data);
      });
      
      // Cleanup on disconnect
      socket.on('disconnect', () => {
        console.log(`Client disconnected from analytics: ${socket.id}`);
      });
    });
    
    // Start broadcasting updates
    this.startPeriodicUpdates();
  }
  
  /**
   * Socket authentication middleware
   */
  private authenticateSocket = (socket: any, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    // Verify token and attach user to socket
    try {
      // This would be replaced with actual JWT verification
      const user = { id: 'user-id', role: 'user' }; // Mock user
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  };
  
  /**
   * Set up rooms for the user based on permissions
   */
  private setupUserRooms(socket: any): void {
    const user = socket.user;
    
    // Add user to their personal room
    socket.join(`user:${user.id}`);
    
    // Add admin users to admin room
    if (user.role === 'admin') {
      socket.join('admin');
    }
    
    // Add users to their team rooms
    if (user.teams) {
      for (const team of user.teams) {
        socket.join(`team:${team.id}`);
      }
    }
  }
  
  /**
   * Handle subscription requests
   */
  private handleSubscription(socket: any, data: { channel: string, entityId?: string }): void {
    const { channel, entityId } = data;
    const user = socket.user;
    
    switch (channel) {
      case 'team':
        if (entityId && this.userCanAccessTeam(user, entityId)) {
          socket.join(`team:${entityId}`);
        }
        break;
      case 'tool':
        socket.join(`tool:${entityId || 'all'}`);
        break;
      case 'organization':
        if (user.role === 'admin') {
          socket.join('organization');
        }
        break;
      case 'active-sessions':
        if (user.role === 'admin') {
          socket.join('active-sessions');
        }
        break;
    }
  }
  
  /**
   * Handle unsubscription requests
   */
  private handleUnsubscription(socket: any, data: { channel: string, entityId?: string }): void {
    const { channel, entityId } = data;
    
    switch (channel) {
      case 'team':
        socket.leave(`team:${entityId}`);
        break;
      case 'tool':
        socket.leave(`tool:${entityId || 'all'}`);
        break;
      case 'organization':
        socket.leave('organization');
        break;
      case 'active-sessions':
        socket.leave('active-sessions');
        break;
    }
  }
  
  /**
   * Check if user can access team data
   */
  private userCanAccessTeam(user: any, teamId: string): boolean {
    if (user.role === 'admin') return true;
    return user.teams?.some((team: any) => team.id === teamId) || false;
  }
  
  /**
   * Start periodic updates to connected clients
   */
  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(async () => {
      await this.broadcastMetricsUpdates();
    }, this.METRICS_UPDATE_INTERVAL);
  }
  
  /**
   * Broadcast metrics updates to all relevant channels
   */
  private async broadcastMetricsUpdates(): Promise<void> {
    try {
      // Get active sessions
      const activeSessions = await this.analyticsService.getActiveSessions();
      this.io.to('active-sessions').emit('metrics-update', {
        type: 'active-sessions',
        data: activeSessions
      });
      
      // Get organization insights
      const orgInsights = await this.insightsService.getOrganizationInsights('1h');
      this.io.to('organization').emit('metrics-update', {
        type: 'organization',
        data: orgInsights
      });
      
      // Get tool insights
      const toolsInsights = await this.insightsService.getAllToolsInsights('1h');
      this.io.to('tool:all').emit('metrics-update', {
        type: 'tools',
        data: toolsInsights
      });
      
      // Get team insights (broadcast to each team separately)
      const teams = await this.getActiveTeams();
      for (const team of teams) {
        const teamInsights = await this.insightsService.getTeamInsights(team.id, '1h');
        this.io.to(`team:${team.id}`).emit('metrics-update', {
          type: 'team',
          data: teamInsights
        });
      }
    } catch (error) {
      console.error('Error broadcasting metrics updates:', error);
    }
  }
  
  /**
   * Get list of active teams
   */
  private async getActiveTeams(): Promise<{ id: string }[]> {
    // This would be replaced with an actual database query
    return [
      { id: 'team1' },
      { id: 'team2' }
    ];
  }
  
  /**
   * Stop the service
   */
  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.io.close();
  }
}

export default RealTimeAnalyticsService;