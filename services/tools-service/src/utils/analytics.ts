import { createServiceLogger } from '@opencode/shared-utils';
import { connectionPool } from './connection-pool';
import caching, { CacheLevel, CacheStrategy } from './caching';
import { v4 as uuidv4 } from 'uuid';

const logger = createServiceLogger('analytics');

/**
 * Event types for analytics
 */
export enum AnalyticsEventType {
  // User events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_REGISTER = 'user_register',
  USER_SETTINGS_CHANGED = 'user_settings_changed',
  
  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_JOINED = 'session_joined',
  SESSION_LEFT = 'session_left',
  SESSION_ENDED = 'session_ended',
  
  // Collaboration events
  CHAT_MESSAGE_SENT = 'chat_message_sent',
  CODE_EDITED = 'code_edited',
  COMMENT_ADDED = 'comment_added',
  THREAD_CREATED = 'thread_created',
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_COMPLETED = 'review_completed',
  
  // Tool events
  TOOL_EXECUTED = 'tool_executed',
  TOOL_CREATED = 'tool_created',
  TOOL_EDITED = 'tool_edited',
  TOOL_DELETED = 'tool_deleted',
  
  // Extension events
  EXTENSION_INSTALLED = 'extension_installed',
  EXTENSION_UNINSTALLED = 'extension_uninstalled',
  EXTENSION_PUBLISHED = 'extension_published',
  
  // Performance events
  API_REQUEST = 'api_request',
  API_RESPONSE = 'api_response',
  ERROR_OCCURRED = 'error_occurred',
  RESOURCE_USAGE = 'resource_usage'
}

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  userId?: string;
  teamId?: string;
  sessionId?: string;
  timestamp: Date;
  properties: Record<string, any>;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    platform?: string;
    version?: string;
  };
}

/**
 * Analytics time period
 */
export enum AnalyticsTimePeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year'
}

/**
 * Analytics aggregation type
 */
export enum AnalyticsAggregation {
  COUNT = 'count',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  UNIQUE = 'unique'
}

/**
 * Analytics query filter
 */
export interface AnalyticsFilter {
  type?: AnalyticsEventType | AnalyticsEventType[];
  userId?: string;
  teamId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  properties?: Record<string, any>;
}

/**
 * Analytics service for collecting and analyzing usage data
 */
export class AnalyticsService {
  private readonly collectionName = 'analytics_events';
  private readonly batchSize = 100;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isFlushingQueue = false;
  
  /**
   * Create a new analytics service
   */
  constructor() {
    // Start flush interval
    this.flushInterval = setInterval(() => this.flushQueue(), 10000);
    
    logger.info('Analytics service initialized');
  }
  
  /**
   * Track an analytics event
   */
  async trackEvent(
    type: AnalyticsEventType,
    properties: Record<string, any> = {},
    context: {
      userId?: string;
      teamId?: string;
      sessionId?: string;
      clientInfo?: {
        ip?: string;
        userAgent?: string;
        platform?: string;
        version?: string;
      };
    } = {}
  ): Promise<void> {
    // Create event
    const event: AnalyticsEvent = {
      id: uuidv4(),
      type,
      userId: context.userId,
      teamId: context.teamId,
      sessionId: context.sessionId,
      timestamp: new Date(),
      properties,
      clientInfo: context.clientInfo
    };
    
    // Add to queue
    this.eventQueue.push(event);
    
    // Flush queue if it's getting too large
    if (this.eventQueue.length >= this.batchSize) {
      setImmediate(() => this.flushQueue());
    }
    
    // Log for debugging
    logger.debug('Tracked analytics event', {
      type,
      userId: context.userId,
      sessionId: context.sessionId
    });
  }
  
  /**
   * Flush the event queue
   */
  private async flushQueue(): Promise<void> {
    // Skip if already flushing or queue is empty
    if (this.isFlushingQueue || this.eventQueue.length === 0) {
      return;
    }
    
    this.isFlushingQueue = true;
    
    try {
      // Get events to flush
      const events = [...this.eventQueue];
      this.eventQueue = [];
      
      // Insert events into database
      const collection = await connectionPool.getCollection(this.collectionName);
      await collection.insertMany(events);
      
      logger.info(`Flushed ${events.length} analytics events`);
    } catch (error) {
      // Put events back in queue if insertion fails
      this.eventQueue = [...this.eventQueue, ...this.eventQueue];
      
      logger.error('Error flushing analytics events', error);
    } finally {
      this.isFlushingQueue = false;
    }
  }
  
  /**
   * Get events matching a filter
   */
  async getEvents(filter: AnalyticsFilter = {}, limit = 100, skip = 0): Promise<AnalyticsEvent[]> {
    try {
      // Build query
      const query: any = {};
      
      if (filter.type) {
        query.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
      }
      
      if (filter.userId) {
        query.userId = filter.userId;
      }
      
      if (filter.teamId) {
        query.teamId = filter.teamId;
      }
      
      if (filter.sessionId) {
        query.sessionId = filter.sessionId;
      }
      
      if (filter.startDate || filter.endDate) {
        query.timestamp = {};
        
        if (filter.startDate) {
          query.timestamp.$gte = filter.startDate;
        }
        
        if (filter.endDate) {
          query.timestamp.$lte = filter.endDate;
        }
      }
      
      // Add property filters
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          query[`properties.${key}`] = value;
        }
      }
      
      // Execute query
      const collection = await connectionPool.getCollection<AnalyticsEvent>(this.collectionName);
      
      return await collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      logger.error('Error getting analytics events', error);
      return [];
    }
  }
  
  /**
   * Count events matching a filter
   */
  async countEvents(filter: AnalyticsFilter = {}): Promise<number> {
    try {
      // Build query
      const query: any = {};
      
      if (filter.type) {
        query.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
      }
      
      if (filter.userId) {
        query.userId = filter.userId;
      }
      
      if (filter.teamId) {
        query.teamId = filter.teamId;
      }
      
      if (filter.sessionId) {
        query.sessionId = filter.sessionId;
      }
      
      if (filter.startDate || filter.endDate) {
        query.timestamp = {};
        
        if (filter.startDate) {
          query.timestamp.$gte = filter.startDate;
        }
        
        if (filter.endDate) {
          query.timestamp.$lte = filter.endDate;
        }
      }
      
      // Add property filters
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          query[`properties.${key}`] = value;
        }
      }
      
      // Execute query
      const collection = await connectionPool.getCollection(this.collectionName);
      
      return await collection.countDocuments(query);
    } catch (error) {
      logger.error('Error counting analytics events', error);
      return 0;
    }
  }
  
  /**
   * Get event time series
   */
  async getTimeSeries(
    filter: AnalyticsFilter = {},
    period: AnalyticsTimePeriod = AnalyticsTimePeriod.DAY,
    aggregate: AnalyticsAggregation = AnalyticsAggregation.COUNT,
    property?: string
  ): Promise<{ date: Date; value: number }[]> {
    try {
      // Build match stage
      const match: any = {};
      
      if (filter.type) {
        match.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
      }
      
      if (filter.userId) {
        match.userId = filter.userId;
      }
      
      if (filter.teamId) {
        match.teamId = filter.teamId;
      }
      
      if (filter.sessionId) {
        match.sessionId = filter.sessionId;
      }
      
      if (filter.startDate || filter.endDate) {
        match.timestamp = {};
        
        if (filter.startDate) {
          match.timestamp.$gte = filter.startDate;
        }
        
        if (filter.endDate) {
          match.timestamp.$lte = filter.endDate;
        }
      }
      
      // Add property filters
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          match[`properties.${key}`] = value;
        }
      }
      
      // Determine date grouping format
      let dateFormat;
      
      switch (period) {
        case AnalyticsTimePeriod.HOUR:
          dateFormat = '%Y-%m-%d %H:00';
          break;
        case AnalyticsTimePeriod.DAY:
          dateFormat = '%Y-%m-%d';
          break;
        case AnalyticsTimePeriod.WEEK:
          dateFormat = '%Y-%U';
          break;
        case AnalyticsTimePeriod.MONTH:
          dateFormat = '%Y-%m';
          break;
        case AnalyticsTimePeriod.QUARTER:
          dateFormat = '%Y-%q';
          break;
        case AnalyticsTimePeriod.YEAR:
          dateFormat = '%Y';
          break;
      }
      
      // Determine aggregation
      let aggregation;
      
      switch (aggregate) {
        case AnalyticsAggregation.COUNT:
          aggregation = { $sum: 1 };
          break;
        case AnalyticsAggregation.SUM:
          if (!property) {
            throw new Error('Property is required for SUM aggregation');
          }
          aggregation = { $sum: `$properties.${property}` };
          break;
        case AnalyticsAggregation.AVG:
          if (!property) {
            throw new Error('Property is required for AVG aggregation');
          }
          aggregation = { $avg: `$properties.${property}` };
          break;
        case AnalyticsAggregation.MIN:
          if (!property) {
            throw new Error('Property is required for MIN aggregation');
          }
          aggregation = { $min: `$properties.${property}` };
          break;
        case AnalyticsAggregation.MAX:
          if (!property) {
            throw new Error('Property is required for MAX aggregation');
          }
          aggregation = { $max: `$properties.${property}` };
          break;
        case AnalyticsAggregation.UNIQUE:
          if (!property) {
            throw new Error('Property is required for UNIQUE aggregation');
          }
          aggregation = { $addToSet: `$properties.${property}` };
          break;
      }
      
      // Build pipeline
      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$timestamp' } }
            },
            value: aggregation
          }
        },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            value: 1
          }
        },
        { $sort: { date: 1 } }
      ];
      
      // Use addToSet, then count the size of the array
      if (aggregate === AnalyticsAggregation.UNIQUE) {
        pipeline.push({
          $project: {
            date: 1,
            value: { $size: '$value' }
          }
        });
      }
      
      // Execute aggregation
      const collection = await connectionPool.getCollection(this.collectionName);
      const result = await collection.aggregate(pipeline).toArray() as any[];
      
      // Convert date strings to Date objects
      return result.map(item => ({
        date: new Date(item.date),
        value: item.value
      }));
    } catch (error) {
      logger.error('Error getting analytics time series', error);
      return [];
    }
  }
  
  /**
   * Get top values for a property
   */
  async getTopValues(
    property: string,
    filter: AnalyticsFilter = {},
    limit = 10
  ): Promise<{ value: any; count: number }[]> {
    try {
      // Build match stage
      const match: any = {};
      
      if (filter.type) {
        match.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
      }
      
      if (filter.userId) {
        match.userId = filter.userId;
      }
      
      if (filter.teamId) {
        match.teamId = filter.teamId;
      }
      
      if (filter.sessionId) {
        match.sessionId = filter.sessionId;
      }
      
      if (filter.startDate || filter.endDate) {
        match.timestamp = {};
        
        if (filter.startDate) {
          match.timestamp.$gte = filter.startDate;
        }
        
        if (filter.endDate) {
          match.timestamp.$lte = filter.endDate;
        }
      }
      
      // Add property filters
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          match[`properties.${key}`] = value;
        }
      }
      
      // Build pipeline
      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: `$properties.${property}`,
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            value: '$_id',
            count: 1
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
      ];
      
      // Execute aggregation
      const collection = await connectionPool.getCollection(this.collectionName);
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting top values', error);
      return [];
    }
  }
  
  /**
   * Get collaboration metrics for a team
   */
  async getTeamCollaborationMetrics(
    teamId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    activeUsers: number;
    sessions: number;
    messages: number;
    codeEdits: number;
    comments: number;
    threads: number;
    reviews: number;
    toolExecutions: number;
    mostActiveUser?: { userId: string; activity: number };
    mostDiscussedFile?: { fileId: string; discussions: number };
  }> {
    // Use cache for performance
    const cacheKey = `team_metrics:${teamId}:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'now'}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Build filter
          const filter: AnalyticsFilter = {
            teamId,
            startDate,
            endDate
          };
          
          // Active users count
          const activeUsers = await this.countUniqueUsers(filter);
          
          // Sessions count
          const sessions = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.SESSION_CREATED
          });
          
          // Messages count
          const messages = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.CHAT_MESSAGE_SENT
          });
          
          // Code edits count
          const codeEdits = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.CODE_EDITED
          });
          
          // Comments count
          const comments = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.COMMENT_ADDED
          });
          
          // Threads count
          const threads = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.THREAD_CREATED
          });
          
          // Reviews count
          const reviews = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.REVIEW_REQUESTED
          });
          
          // Tool executions count
          const toolExecutions = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.TOOL_EXECUTED
          });
          
          // Most active user
          const activeUserPipeline = [
            {
              $match: {
                teamId,
                userId: { $ne: null },
                ...(startDate || endDate ? {
                  timestamp: {
                    ...(startDate ? { $gte: startDate } : {}),
                    ...(endDate ? { $lte: endDate } : {})
                  }
                } : {})
              }
            },
            {
              $group: {
                _id: '$userId',
                activity: { $sum: 1 }
              }
            },
            { $sort: { activity: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                userId: '$_id',
                activity: 1
              }
            }
          ];
          
          const collection = await connectionPool.getCollection(this.collectionName);
          const mostActiveUserResult = await collection.aggregate(activeUserPipeline).toArray() as any[];
          const mostActiveUser = mostActiveUserResult[0];
          
          // Most discussed file
          const discussedFilePipeline = [
            {
              $match: {
                teamId,
                type: {
                  $in: [
                    AnalyticsEventType.COMMENT_ADDED,
                    AnalyticsEventType.THREAD_CREATED
                  ]
                },
                'properties.fileId': { $exists: true },
                ...(startDate || endDate ? {
                  timestamp: {
                    ...(startDate ? { $gte: startDate } : {}),
                    ...(endDate ? { $lte: endDate } : {})
                  }
                } : {})
              }
            },
            {
              $group: {
                _id: '$properties.fileId',
                discussions: { $sum: 1 }
              }
            },
            { $sort: { discussions: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                fileId: '$_id',
                discussions: 1
              }
            }
          ];
          
          const mostDiscussedFileResult = await collection.aggregate(discussedFilePipeline).toArray() as any[];
          const mostDiscussedFile = mostDiscussedFileResult[0];
          
          return {
            activeUsers,
            sessions,
            messages,
            codeEdits,
            comments,
            threads,
            reviews,
            toolExecutions,
            mostActiveUser,
            mostDiscussedFile
          };
        } catch (error) {
          logger.error('Error getting team collaboration metrics', error);
          return {
            activeUsers: 0,
            sessions: 0,
            messages: 0,
            codeEdits: 0,
            comments: 0,
            threads: 0,
            reviews: 0,
            toolExecutions: 0
          };
        }
      },
      3600, // 1 hour
      CacheLevel.PERSISTENT,
      CacheStrategy.TEAM_SCOPED,
      undefined,
      teamId
    );
  }
  
  /**
   * Count unique users
   */
  private async countUniqueUsers(filter: AnalyticsFilter = {}): Promise<number> {
    try {
      // Build match stage
      const match: any = {
        userId: { $ne: null }
      };
      
      if (filter.type) {
        match.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
      }
      
      if (filter.userId) {
        match.userId = filter.userId;
      }
      
      if (filter.teamId) {
        match.teamId = filter.teamId;
      }
      
      if (filter.sessionId) {
        match.sessionId = filter.sessionId;
      }
      
      if (filter.startDate || filter.endDate) {
        match.timestamp = {};
        
        if (filter.startDate) {
          match.timestamp.$gte = filter.startDate;
        }
        
        if (filter.endDate) {
          match.timestamp.$lte = filter.endDate;
        }
      }
      
      // Add property filters
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          match[`properties.${key}`] = value;
        }
      }
      
      // Build pipeline
      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: '$userId'
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ];
      
      // Execute aggregation
      const collection = await connectionPool.getCollection(this.collectionName);
      const result = await collection.aggregate(pipeline).toArray() as any[];
      
      return result.length > 0 ? result[0].count : 0;
    } catch (error) {
      logger.error('Error counting unique users', error);
      return 0;
    }
  }
  
  /**
   * Get user activity summary
   */
  async getUserActivitySummary(
    userId: string,
    days = 30
  ): Promise<{
    sessionsJoined: number;
    messagesCount: number;
    codeEdits: number;
    commentsAdded: number;
    threadsCreated: number;
    reviewsRequested: number;
    reviewsCompleted: number;
    toolsExecuted: number;
    activityByDay: { date: string; count: number }[];
  }> {
    // Use cache for performance
    const cacheKey = `user_activity:${userId}:${days}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Calculate start date
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          
          // Build filter
          const filter: AnalyticsFilter = {
            userId,
            startDate
          };
          
          // Sessions joined
          const sessionsJoined = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.SESSION_JOINED
          });
          
          // Messages count
          const messagesCount = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.CHAT_MESSAGE_SENT
          });
          
          // Code edits
          const codeEdits = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.CODE_EDITED
          });
          
          // Comments added
          const commentsAdded = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.COMMENT_ADDED
          });
          
          // Threads created
          const threadsCreated = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.THREAD_CREATED
          });
          
          // Reviews requested
          const reviewsRequested = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.REVIEW_REQUESTED
          });
          
          // Reviews completed
          const reviewsCompleted = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.REVIEW_COMPLETED
          });
          
          // Tools executed
          const toolsExecuted = await this.countEvents({
            ...filter,
            type: AnalyticsEventType.TOOL_EXECUTED
          });
          
          // Activity by day
          const timeSeries = await this.getTimeSeries(filter, AnalyticsTimePeriod.DAY);
          const activityByDay = timeSeries.map(item => ({
            date: item.date.toISOString().split('T')[0],
            count: item.value
          }));
          
          return {
            sessionsJoined,
            messagesCount,
            codeEdits,
            commentsAdded,
            threadsCreated,
            reviewsRequested,
            reviewsCompleted,
            toolsExecuted,
            activityByDay
          };
        } catch (error) {
          logger.error('Error getting user activity summary', error);
          return {
            sessionsJoined: 0,
            messagesCount: 0,
            codeEdits: 0,
            commentsAdded: 0,
            threadsCreated: 0,
            reviewsRequested: 0,
            reviewsCompleted: 0,
            toolsExecuted: 0,
            activityByDay: []
          };
        }
      },
      1800, // 30 minutes
      CacheLevel.MEMORY,
      CacheStrategy.USER_SCOPED,
      userId
    );
  }
  
  /**
   * Cleanup analytics data older than specified days
   */
  async cleanupOldData(days = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const collection = await connectionPool.getCollection(this.collectionName);
      const result = await collection.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old analytics events`);
      
      return result.deletedCount || 0;
    } catch (error) {
      logger.error('Error cleaning up old analytics data', error);
      return 0;
    }
  }
  
  /**
   * Stop the analytics service
   */
  stop(): void {
    // Flush remaining events
    this.flushQueue();
    
    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    logger.info('Analytics service stopped');
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
export default analytics;