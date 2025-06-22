import { createServiceLogger } from '@opencode/shared-utils';
import analytics, { 
  AnalyticsEventType, 
  AnalyticsFilter, 
  AnalyticsTimePeriod, 
  AnalyticsAggregation 
} from '../utils/analytics';
import caching, { CacheLevel, CacheStrategy } from '../utils/caching';
import connectionPool from '../utils/connection-pool';

const logger = createServiceLogger('insights-service');

/**
 * Dashboard time range
 */
export enum DashboardTimeRange {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year'
}

/**
 * Dashboard metrics
 */
export interface DashboardMetrics {
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    teamDistribution: { teamId: string; userCount: number }[];
  };
  collaborationMetrics: {
    sessions: number;
    messages: number;
    codeEdits: number;
    comments: number;
    threads: number;
    reviews: number;
    toolExecutions: number;
  };
  activityTrends: {
    byDay: { date: string; count: number }[];
    byHour: { hour: number; count: number }[];
    byTeam: { teamId: string; count: number }[];
  };
  topInsights: {
    mostActiveUsers: { userId: string; activity: number }[];
    mostDiscussedFiles: { fileId: string; discussions: number }[];
    mostUsedTools: { toolId: string; uses: number }[];
    mostActiveTeams: { teamId: string; activity: number }[];
  };
  performanceMetrics: {
    apiResponseTimes: { endpoint: string; avgTime: number }[];
    resourceUsage: { date: string; cpu: number; memory: number }[];
    errors: { type: string; count: number }[];
  };
}

/**
 * Team insights data
 */
export interface TeamInsights {
  teamId: string;
  activeUsers: number;
  sessionsCount: number;
  messageCount: number;
  codeEditCount: number;
  commentCount: number;
  threadCount: number;
  reviewCount: number;
  toolExecutionCount: number;
  activityByDay: { date: string; count: number }[];
  userActivity: { userId: string; activity: number }[];
  discussedFiles: { fileId: string; discussions: number }[];
  popularTools: { toolId: string; uses: number }[];
}

/**
 * User insights data
 */
export interface UserInsights {
  userId: string;
  sessionCount: number;
  messageCount: number;
  codeEditCount: number;
  commentCount: number;
  threadCount: number;
  reviewsRequested: number;
  reviewsCompleted: number;
  toolExecutionCount: number;
  activityByDay: { date: string; count: number }[];
  mostActiveTeams: { teamId: string; activity: number }[];
  mostEditedFiles: { fileId: string; edits: number }[];
  mostUsedTools: { toolId: string; uses: number }[];
  collaborators: { userId: string; interactions: number }[];
}

/**
 * Tool usage insights
 */
export interface ToolInsights {
  toolId: string;
  totalExecutions: number;
  uniqueUsers: number;
  averageDuration: number;
  successRate: number;
  usageByDay: { date: string; count: number }[];
  usageByTeam: { teamId: string; count: number }[];
  errorTypes: { type: string; count: number }[];
  popularConfigurations: { config: string; count: number }[];
}

/**
 * Session insights
 */
export interface SessionInsights {
  sessionId: string;
  createdAt: Date;
  duration: number;
  participantCount: number;
  messageCount: number;
  codeEditCount: number;
  commentCount: number;
  threadCount: number;
  toolExecutionCount: number;
  participants: { userId: string; activity: number }[];
  editedFiles: { fileId: string; edits: number }[];
  executedTools: { toolId: string; executions: number }[];
  activityTimeline: { timestamp: Date; type: string; userId: string }[];
}

/**
 * Insights service for providing collaboration analytics and insights
 */
export class InsightsService {
  /**
   * Create a new insights service
   */
  constructor() {
    logger.info('Insights service initialized');
  }
  
  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(
    timeRange: DashboardTimeRange,
    teamId?: string
  ): Promise<DashboardMetrics> {
    // Calculate date range
    const endDate = new Date();
    const startDate = this.calculateStartDate(timeRange);
    
    // Use cache for performance
    const cacheKey = `dashboard:${timeRange}:${teamId || 'all'}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Base filter
          const filter: AnalyticsFilter = {
            startDate,
            endDate
          };
          
          // Add team filter if specified
          if (teamId) {
            filter.teamId = teamId;
          }
          
          // Get user metrics
          const userMetrics = await this.getUserMetrics(filter);
          
          // Get collaboration metrics
          const collaborationMetrics = await this.getCollaborationMetrics(filter);
          
          // Get activity trends
          const activityTrends = await this.getActivityTrends(filter, timeRange);
          
          // Get top insights
          const topInsights = await this.getTopInsights(filter);
          
          // Get performance metrics
          const performanceMetrics = await this.getPerformanceMetrics(filter);
          
          return {
            userMetrics,
            collaborationMetrics,
            activityTrends,
            topInsights,
            performanceMetrics
          };
        } catch (error) {
          logger.error('Error getting dashboard metrics', error);
          throw error;
        }
      },
      1800, // 30 minutes
      CacheLevel.PERSISTENT,
      CacheStrategy.TEAM_SCOPED,
      undefined,
      teamId
    );
  }
  
  /**
   * Calculate start date based on time range
   */
  private calculateStartDate(timeRange: DashboardTimeRange): Date {
    const startDate = new Date();
    
    switch (timeRange) {
      case DashboardTimeRange.DAY:
        startDate.setDate(startDate.getDate() - 1);
        break;
      case DashboardTimeRange.WEEK:
        startDate.setDate(startDate.getDate() - 7);
        break;
      case DashboardTimeRange.MONTH:
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case DashboardTimeRange.QUARTER:
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case DashboardTimeRange.YEAR:
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }
    
    return startDate;
  }
  
  /**
   * Get user metrics
   */
  private async getUserMetrics(filter: AnalyticsFilter): Promise<DashboardMetrics['userMetrics']> {
    try {
      // Total users query (all users in the system)
      const collection = await connectionPool.getCollection('users');
      const totalUsers = await collection.countDocuments();
      
      // Active users (users with at least one event in the time period)
      const activeUsers = await analytics.countUniqueUsers(filter);
      
      // New users
      const newUserFilter: AnalyticsFilter = {
        ...filter,
        type: AnalyticsEventType.USER_REGISTER
      };
      const newUsers = await analytics.countEvents(newUserFilter);
      
      // Team distribution
      const teamDistribution = await analytics.getTopValues('teamId', {
        ...filter,
        properties: { active: true }
      }, 10);
      
      return {
        totalUsers,
        activeUsers,
        newUsers,
        teamDistribution: teamDistribution.map(team => ({
          teamId: team.value,
          userCount: team.count
        }))
      };
    } catch (error) {
      logger.error('Error getting user metrics', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        teamDistribution: []
      };
    }
  }
  
  /**
   * Get collaboration metrics
   */
  private async getCollaborationMetrics(filter: AnalyticsFilter): Promise<DashboardMetrics['collaborationMetrics']> {
    try {
      // Sessions created
      const sessions = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.SESSION_CREATED
      });
      
      // Messages sent
      const messages = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.CHAT_MESSAGE_SENT
      });
      
      // Code edits
      const codeEdits = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.CODE_EDITED
      });
      
      // Comments added
      const comments = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.COMMENT_ADDED
      });
      
      // Threads created
      const threads = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.THREAD_CREATED
      });
      
      // Reviews requested
      const reviews = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.REVIEW_REQUESTED
      });
      
      // Tool executions
      const toolExecutions = await analytics.countEvents({
        ...filter,
        type: AnalyticsEventType.TOOL_EXECUTED
      });
      
      return {
        sessions,
        messages,
        codeEdits,
        comments,
        threads,
        reviews,
        toolExecutions
      };
    } catch (error) {
      logger.error('Error getting collaboration metrics', error);
      return {
        sessions: 0,
        messages: 0,
        codeEdits: 0,
        comments: 0,
        threads: 0,
        reviews: 0,
        toolExecutions: 0
      };
    }
  }
  
  /**
   * Get activity trends
   */
  private async getActivityTrends(
    filter: AnalyticsFilter,
    timeRange: DashboardTimeRange
  ): Promise<DashboardMetrics['activityTrends']> {
    try {
      // Determine time period based on range
      let timePeriod: AnalyticsTimePeriod;
      
      switch (timeRange) {
        case DashboardTimeRange.DAY:
          timePeriod = AnalyticsTimePeriod.HOUR;
          break;
        case DashboardTimeRange.WEEK:
        case DashboardTimeRange.MONTH:
          timePeriod = AnalyticsTimePeriod.DAY;
          break;
        case DashboardTimeRange.QUARTER:
          timePeriod = AnalyticsTimePeriod.WEEK;
          break;
        case DashboardTimeRange.YEAR:
          timePeriod = AnalyticsTimePeriod.MONTH;
          break;
        default:
          timePeriod = AnalyticsTimePeriod.DAY;
      }
      
      // Activity by day
      const dailyActivity = await analytics.getTimeSeries(
        filter,
        timePeriod,
        AnalyticsAggregation.COUNT
      );
      
      const byDay = dailyActivity.map(item => ({
        date: item.date.toISOString().split('T')[0],
        count: item.value
      }));
      
      // Activity by hour
      const hourFilter: AnalyticsFilter = {
        ...filter,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      };
      
      // Aggregate by hour using custom pipeline
      const collection = await connectionPool.getCollection('analytics_events');
      
      const hourlyPipeline = [
        {
          $match: {
            timestamp: {
              $gte: hourFilter.startDate,
              $lte: hourFilter.endDate
            },
            ...(hourFilter.teamId ? { teamId: hourFilter.teamId } : {})
          }
        },
        {
          $group: {
            _id: { $hour: '$timestamp' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            hour: '$_id',
            count: 1
          }
        },
        { $sort: { hour: 1 } }
      ];
      
      const hourlyResults = await collection.aggregate(hourlyPipeline).toArray() as any[];
      
      const byHour = hourlyResults.map(item => ({
        hour: item.hour,
        count: item.count
      }));
      
      // Activity by team
      const teamActivity = await analytics.getTopValues('teamId', filter, 10);
      
      const byTeam = teamActivity.map(team => ({
        teamId: team.value,
        count: team.count
      }));
      
      return {
        byDay,
        byHour,
        byTeam
      };
    } catch (error) {
      logger.error('Error getting activity trends', error);
      return {
        byDay: [],
        byHour: [],
        byTeam: []
      };
    }
  }
  
  /**
   * Get top insights
   */
  private async getTopInsights(filter: AnalyticsFilter): Promise<DashboardMetrics['topInsights']> {
    try {
      // Most active users
      const userActivity = await this.getMostActiveUsers(filter, 10);
      
      // Most discussed files
      const discussedFiles = await this.getMostDiscussedFiles(filter, 10);
      
      // Most used tools
      const usedTools = await this.getMostUsedTools(filter, 10);
      
      // Most active teams
      const activeTeams = await this.getMostActiveTeams(filter, 10);
      
      return {
        mostActiveUsers: userActivity,
        mostDiscussedFiles: discussedFiles,
        mostUsedTools: usedTools,
        mostActiveTeams: activeTeams
      };
    } catch (error) {
      logger.error('Error getting top insights', error);
      return {
        mostActiveUsers: [],
        mostDiscussedFiles: [],
        mostUsedTools: [],
        mostActiveTeams: []
      };
    }
  }
  
  /**
   * Get most active users
   */
  private async getMostActiveUsers(
    filter: AnalyticsFilter,
    limit: number
  ): Promise<{ userId: string; activity: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            userId: { $ne: null },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {}),
            ...(filter.teamId ? { teamId: filter.teamId } : {})
          }
        },
        {
          $group: {
            _id: '$userId',
            activity: { $sum: 1 }
          }
        },
        { $sort: { activity: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            activity: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting most active users', error);
      return [];
    }
  }
  
  /**
   * Get most discussed files
   */
  private async getMostDiscussedFiles(
    filter: AnalyticsFilter,
    limit: number
  ): Promise<{ fileId: string; discussions: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: {
              $in: [
                AnalyticsEventType.COMMENT_ADDED,
                AnalyticsEventType.THREAD_CREATED
              ]
            },
            'properties.fileId': { $exists: true },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {}),
            ...(filter.teamId ? { teamId: filter.teamId } : {})
          }
        },
        {
          $group: {
            _id: '$properties.fileId',
            discussions: { $sum: 1 }
          }
        },
        { $sort: { discussions: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            fileId: '$_id',
            discussions: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting most discussed files', error);
      return [];
    }
  }
  
  /**
   * Get most used tools
   */
  private async getMostUsedTools(
    filter: AnalyticsFilter,
    limit: number
  ): Promise<{ toolId: string; uses: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: AnalyticsEventType.TOOL_EXECUTED,
            'properties.toolId': { $exists: true },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {}),
            ...(filter.teamId ? { teamId: filter.teamId } : {})
          }
        },
        {
          $group: {
            _id: '$properties.toolId',
            uses: { $sum: 1 }
          }
        },
        { $sort: { uses: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            toolId: '$_id',
            uses: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting most used tools', error);
      return [];
    }
  }
  
  /**
   * Get most active teams
   */
  private async getMostActiveTeams(
    filter: AnalyticsFilter,
    limit: number
  ): Promise<{ teamId: string; activity: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            teamId: { $ne: null },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {})
          }
        },
        {
          $group: {
            _id: '$teamId',
            activity: { $sum: 1 }
          }
        },
        { $sort: { activity: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            teamId: '$_id',
            activity: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting most active teams', error);
      return [];
    }
  }
  
  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(filter: AnalyticsFilter): Promise<DashboardMetrics['performanceMetrics']> {
    try {
      // API response times
      const apiResponseTimes = await this.getApiResponseTimes(filter);
      
      // Resource usage
      const resourceUsage = await this.getResourceUsage(filter);
      
      // Errors
      const errors = await this.getErrorCounts(filter);
      
      return {
        apiResponseTimes,
        resourceUsage,
        errors
      };
    } catch (error) {
      logger.error('Error getting performance metrics', error);
      return {
        apiResponseTimes: [],
        resourceUsage: [],
        errors: []
      };
    }
  }
  
  /**
   * Get API response times
   */
  private async getApiResponseTimes(
    filter: AnalyticsFilter
  ): Promise<{ endpoint: string; avgTime: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: AnalyticsEventType.API_RESPONSE,
            'properties.endpoint': { $exists: true },
            'properties.responseTime': { $exists: true },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {}),
            ...(filter.teamId ? { teamId: filter.teamId } : {})
          }
        },
        {
          $group: {
            _id: '$properties.endpoint',
            avgTime: { $avg: '$properties.responseTime' }
          }
        },
        { $sort: { avgTime: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            endpoint: '$_id',
            avgTime: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting API response times', error);
      return [];
    }
  }
  
  /**
   * Get resource usage
   */
  private async getResourceUsage(
    filter: AnalyticsFilter
  ): Promise<{ date: string; cpu: number; memory: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: AnalyticsEventType.RESOURCE_USAGE,
            'properties.cpu': { $exists: true },
            'properties.memory': { $exists: true },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {})
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
            },
            cpu: { $avg: '$properties.cpu' },
            memory: { $avg: '$properties.memory' }
          }
        },
        { $sort: { '_id.date': 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id.date',
            cpu: 1,
            memory: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting resource usage', error);
      return [];
    }
  }
  
  /**
   * Get error counts
   */
  private async getErrorCounts(
    filter: AnalyticsFilter
  ): Promise<{ type: string; count: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: AnalyticsEventType.ERROR_OCCURRED,
            'properties.errorType': { $exists: true },
            ...(filter.startDate || filter.endDate ? {
              timestamp: {
                ...(filter.startDate ? { $gte: filter.startDate } : {}),
                ...(filter.endDate ? { $lte: filter.endDate } : {})
              }
            } : {}),
            ...(filter.teamId ? { teamId: filter.teamId } : {})
          }
        },
        {
          $group: {
            _id: '$properties.errorType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            type: '$_id',
            count: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting error counts', error);
      return [];
    }
  }
  
  /**
   * Get team insights
   */
  async getTeamInsights(teamId: string, days = 30): Promise<TeamInsights> {
    // Use cache for performance
    const cacheKey = `team_insights:${teamId}:${days}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Calculate date range
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          
          // Get team metrics from analytics
          const metrics = await analytics.getTeamCollaborationMetrics(teamId, startDate, endDate);
          
          // Get activity by day
          const activityByDay = await this.getTeamActivityByDay(teamId, startDate, endDate);
          
          // Get user activity
          const userActivity = await this.getMostActiveUsers({ teamId, startDate, endDate }, 10);
          
          // Get discussed files
          const discussedFiles = await this.getMostDiscussedFiles({ teamId, startDate, endDate }, 10);
          
          // Get popular tools
          const popularTools = await this.getMostUsedTools({ teamId, startDate, endDate }, 10);
          
          return {
            teamId,
            activeUsers: metrics.activeUsers,
            sessionsCount: metrics.sessions,
            messageCount: metrics.messages,
            codeEditCount: metrics.codeEdits,
            commentCount: metrics.comments,
            threadCount: metrics.threads,
            reviewCount: metrics.reviews,
            toolExecutionCount: metrics.toolExecutions,
            activityByDay,
            userActivity,
            discussedFiles,
            popularTools
          };
        } catch (error) {
          logger.error('Error getting team insights', error);
          throw error;
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
   * Get team activity by day
   */
  private async getTeamActivityByDay(
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; count: number }[]> {
    try {
      const timeSeries = await analytics.getTimeSeries(
        { teamId, startDate, endDate },
        AnalyticsTimePeriod.DAY
      );
      
      return timeSeries.map(item => ({
        date: item.date.toISOString().split('T')[0],
        count: item.value
      }));
    } catch (error) {
      logger.error('Error getting team activity by day', error);
      return [];
    }
  }
  
  /**
   * Get user insights
   */
  async getUserInsights(userId: string, days = 30): Promise<UserInsights> {
    // Use cache for performance
    const cacheKey = `user_insights:${userId}:${days}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Calculate date range
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          
          // Get user activity from analytics
          const activity = await analytics.getUserActivitySummary(userId, days);
          
          // Get most active teams
          const mostActiveTeams = await this.getUserMostActiveTeams(userId, startDate, endDate);
          
          // Get most edited files
          const mostEditedFiles = await this.getUserMostEditedFiles(userId, startDate, endDate);
          
          // Get most used tools
          const mostUsedTools = await this.getUserMostUsedTools(userId, startDate, endDate);
          
          // Get collaborators
          const collaborators = await this.getUserCollaborators(userId, startDate, endDate);
          
          return {
            userId,
            sessionCount: activity.sessionsJoined,
            messageCount: activity.messagesCount,
            codeEditCount: activity.codeEdits,
            commentCount: activity.commentsAdded,
            threadCount: activity.threadsCreated,
            reviewsRequested: activity.reviewsRequested,
            reviewsCompleted: activity.reviewsCompleted,
            toolExecutionCount: activity.toolsExecuted,
            activityByDay: activity.activityByDay,
            mostActiveTeams,
            mostEditedFiles,
            mostUsedTools,
            collaborators
          };
        } catch (error) {
          logger.error('Error getting user insights', error);
          throw error;
        }
      },
      1800, // 30 minutes
      CacheLevel.MEMORY,
      CacheStrategy.USER_SCOPED,
      userId
    );
  }
  
  /**
   * Get user's most active teams
   */
  private async getUserMostActiveTeams(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ teamId: string; activity: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            userId,
            teamId: { $ne: null },
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$teamId',
            activity: { $sum: 1 }
          }
        },
        { $sort: { activity: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            teamId: '$_id',
            activity: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting user most active teams', error);
      return [];
    }
  }
  
  /**
   * Get user's most edited files
   */
  private async getUserMostEditedFiles(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ fileId: string; edits: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            userId,
            type: AnalyticsEventType.CODE_EDITED,
            'properties.fileId': { $exists: true },
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$properties.fileId',
            edits: { $sum: 1 }
          }
        },
        { $sort: { edits: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            fileId: '$_id',
            edits: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting user most edited files', error);
      return [];
    }
  }
  
  /**
   * Get user's most used tools
   */
  private async getUserMostUsedTools(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ toolId: string; uses: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            userId,
            type: AnalyticsEventType.TOOL_EXECUTED,
            'properties.toolId': { $exists: true },
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$properties.toolId',
            uses: { $sum: 1 }
          }
        },
        { $sort: { uses: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            toolId: '$_id',
            uses: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting user most used tools', error);
      return [];
    }
  }
  
  /**
   * Get user's collaborators
   */
  private async getUserCollaborators(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ userId: string; interactions: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      // Find sessions the user participated in
      const sessionsQuery = {
        $or: [
          { type: AnalyticsEventType.SESSION_CREATED, userId },
          { type: AnalyticsEventType.SESSION_JOINED, userId }
        ],
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      const sessionDocs = await collection.find(sessionsQuery).toArray();
      const sessionIds = sessionDocs.map(doc => doc.sessionId);
      
      if (sessionIds.length === 0) {
        return [];
      }
      
      // Find users who participated in those sessions
      const pipeline = [
        {
          $match: {
            sessionId: { $in: sessionIds },
            userId: { $ne: userId, $ne: null },
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$userId',
            interactions: { $sum: 1 }
          }
        },
        { $sort: { interactions: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            interactions: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting user collaborators', error);
      return [];
    }
  }
  
  /**
   * Get tool usage insights
   */
  async getToolInsights(toolId: string, days = 30): Promise<ToolInsights> {
    // Use cache for performance
    const cacheKey = `tool_insights:${toolId}:${days}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Calculate date range
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          
          const filter: AnalyticsFilter = {
            type: AnalyticsEventType.TOOL_EXECUTED,
            startDate,
            endDate,
            properties: {
              toolId
            }
          };
          
          // Total executions
          const totalExecutions = await analytics.countEvents(filter);
          
          // Unique users
          const uniqueUsers = await analytics.countUniqueUsers(filter);
          
          // Average duration
          const durationPipeline = [
            {
              $match: {
                type: AnalyticsEventType.TOOL_EXECUTED,
                'properties.toolId': toolId,
                'properties.duration': { $exists: true },
                timestamp: {
                  $gte: startDate,
                  $lte: endDate
                }
              }
            },
            {
              $group: {
                _id: null,
                averageDuration: { $avg: '$properties.duration' }
              }
            }
          ];
          
          const collection = await connectionPool.getCollection('analytics_events');
          const durationResult = await collection.aggregate(durationPipeline).toArray() as any[];
          const averageDuration = durationResult.length > 0 ? durationResult[0].averageDuration : 0;
          
          // Success rate
          const successPipeline = [
            {
              $match: {
                type: AnalyticsEventType.TOOL_EXECUTED,
                'properties.toolId': toolId,
                'properties.success': { $exists: true },
                timestamp: {
                  $gte: startDate,
                  $lte: endDate
                }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                successful: { 
                  $sum: { 
                    $cond: [{ $eq: ['$properties.success', true] }, 1, 0] 
                  } 
                }
              }
            },
            {
              $project: {
                _id: 0,
                successRate: { 
                  $cond: [
                    { $eq: ['$total', 0] },
                    0,
                    { $multiply: [{ $divide: ['$successful', '$total'] }, 100] }
                  ]
                }
              }
            }
          ];
          
          const successResult = await collection.aggregate(successPipeline).toArray() as any[];
          const successRate = successResult.length > 0 ? successResult[0].successRate : 0;
          
          // Usage by day
          const usageByDay = await this.getToolUsageByDay(toolId, startDate, endDate);
          
          // Usage by team
          const usageByTeam = await this.getToolUsageByTeam(toolId, startDate, endDate);
          
          // Error types
          const errorTypes = await this.getToolErrorTypes(toolId, startDate, endDate);
          
          // Popular configurations
          const popularConfigurations = await this.getToolPopularConfigurations(toolId, startDate, endDate);
          
          return {
            toolId,
            totalExecutions,
            uniqueUsers,
            averageDuration,
            successRate,
            usageByDay,
            usageByTeam,
            errorTypes,
            popularConfigurations
          };
        } catch (error) {
          logger.error('Error getting tool insights', error);
          throw error;
        }
      },
      1800, // 30 minutes
      CacheLevel.MEMORY
    );
  }
  
  /**
   * Get tool usage by day
   */
  private async getToolUsageByDay(
    toolId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; count: number }[]> {
    try {
      const timeSeries = await analytics.getTimeSeries(
        {
          type: AnalyticsEventType.TOOL_EXECUTED,
          startDate,
          endDate,
          properties: { toolId }
        },
        AnalyticsTimePeriod.DAY
      );
      
      return timeSeries.map(item => ({
        date: item.date.toISOString().split('T')[0],
        count: item.value
      }));
    } catch (error) {
      logger.error('Error getting tool usage by day', error);
      return [];
    }
  }
  
  /**
   * Get tool usage by team
   */
  private async getToolUsageByTeam(
    toolId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ teamId: string; count: number }[]> {
    try {
      const teamUsage = await analytics.getTopValues(
        'teamId',
        {
          type: AnalyticsEventType.TOOL_EXECUTED,
          startDate,
          endDate,
          properties: { toolId }
        },
        10
      );
      
      return teamUsage.map(team => ({
        teamId: team.value,
        count: team.count
      }));
    } catch (error) {
      logger.error('Error getting tool usage by team', error);
      return [];
    }
  }
  
  /**
   * Get tool error types
   */
  private async getToolErrorTypes(
    toolId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ type: string; count: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: AnalyticsEventType.TOOL_EXECUTED,
            'properties.toolId': toolId,
            'properties.success': false,
            'properties.errorType': { $exists: true },
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$properties.errorType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            type: '$_id',
            count: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting tool error types', error);
      return [];
    }
  }
  
  /**
   * Get tool popular configurations
   */
  private async getToolPopularConfigurations(
    toolId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ config: string; count: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            type: AnalyticsEventType.TOOL_EXECUTED,
            'properties.toolId': toolId,
            'properties.config': { $exists: true },
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$properties.config',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            config: '$_id',
            count: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting tool popular configurations', error);
      return [];
    }
  }
  
  /**
   * Get session insights
   */
  async getSessionInsights(sessionId: string): Promise<SessionInsights> {
    // Use cache for performance
    const cacheKey = `session_insights:${sessionId}`;
    
    return await caching.getOrSet(
      cacheKey,
      async () => {
        try {
          // Get session details
          const session = await this.getSessionDetails(sessionId);
          
          // Get session metrics
          const metrics = await this.getSessionMetrics(sessionId);
          
          // Get participants
          const participants = await this.getSessionParticipants(sessionId);
          
          // Get edited files
          const editedFiles = await this.getSessionEditedFiles(sessionId);
          
          // Get executed tools
          const executedTools = await this.getSessionExecutedTools(sessionId);
          
          // Get activity timeline
          const activityTimeline = await this.getSessionActivityTimeline(sessionId);
          
          return {
            sessionId,
            createdAt: session.createdAt,
            duration: session.duration,
            participantCount: participants.length,
            messageCount: metrics.messageCount,
            codeEditCount: metrics.codeEditCount,
            commentCount: metrics.commentCount,
            threadCount: metrics.threadCount,
            toolExecutionCount: metrics.toolExecutionCount,
            participants,
            editedFiles,
            executedTools,
            activityTimeline
          };
        } catch (error) {
          logger.error('Error getting session insights', error);
          throw error;
        }
      },
      1800, // 30 minutes
      CacheLevel.MEMORY
    );
  }
  
  /**
   * Get session details
   */
  private async getSessionDetails(
    sessionId: string
  ): Promise<{ createdAt: Date; duration: number }> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      // Find session creation event
      const creationEvent = await collection.findOne({
        sessionId,
        type: AnalyticsEventType.SESSION_CREATED
      });
      
      if (!creationEvent) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Find session end event or use current time
      const endEvent = await collection.findOne({
        sessionId,
        type: AnalyticsEventType.SESSION_ENDED
      });
      
      const createdAt = creationEvent.timestamp;
      const endedAt = endEvent ? endEvent.timestamp : new Date();
      
      // Calculate duration in minutes
      const duration = Math.round((endedAt - createdAt) / (60 * 1000));
      
      return {
        createdAt,
        duration
      };
    } catch (error) {
      logger.error('Error getting session details', error);
      throw error;
    }
  }
  
  /**
   * Get session metrics
   */
  private async getSessionMetrics(
    sessionId: string
  ): Promise<{
    messageCount: number;
    codeEditCount: number;
    commentCount: number;
    threadCount: number;
    toolExecutionCount: number;
  }> {
    try {
      // Message count
      const messageCount = await analytics.countEvents({
        sessionId,
        type: AnalyticsEventType.CHAT_MESSAGE_SENT
      });
      
      // Code edit count
      const codeEditCount = await analytics.countEvents({
        sessionId,
        type: AnalyticsEventType.CODE_EDITED
      });
      
      // Comment count
      const commentCount = await analytics.countEvents({
        sessionId,
        type: AnalyticsEventType.COMMENT_ADDED
      });
      
      // Thread count
      const threadCount = await analytics.countEvents({
        sessionId,
        type: AnalyticsEventType.THREAD_CREATED
      });
      
      // Tool execution count
      const toolExecutionCount = await analytics.countEvents({
        sessionId,
        type: AnalyticsEventType.TOOL_EXECUTED
      });
      
      return {
        messageCount,
        codeEditCount,
        commentCount,
        threadCount,
        toolExecutionCount
      };
    } catch (error) {
      logger.error('Error getting session metrics', error);
      return {
        messageCount: 0,
        codeEditCount: 0,
        commentCount: 0,
        threadCount: 0,
        toolExecutionCount: 0
      };
    }
  }
  
  /**
   * Get session participants
   */
  private async getSessionParticipants(
    sessionId: string
  ): Promise<{ userId: string; activity: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            sessionId,
            userId: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$userId',
            activity: { $sum: 1 }
          }
        },
        { $sort: { activity: -1 } },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            activity: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting session participants', error);
      return [];
    }
  }
  
  /**
   * Get session edited files
   */
  private async getSessionEditedFiles(
    sessionId: string
  ): Promise<{ fileId: string; edits: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            sessionId,
            type: AnalyticsEventType.CODE_EDITED,
            'properties.fileId': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$properties.fileId',
            edits: { $sum: 1 }
          }
        },
        { $sort: { edits: -1 } },
        {
          $project: {
            _id: 0,
            fileId: '$_id',
            edits: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting session edited files', error);
      return [];
    }
  }
  
  /**
   * Get session executed tools
   */
  private async getSessionExecutedTools(
    sessionId: string
  ): Promise<{ toolId: string; executions: number }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            sessionId,
            type: AnalyticsEventType.TOOL_EXECUTED,
            'properties.toolId': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$properties.toolId',
            executions: { $sum: 1 }
          }
        },
        { $sort: { executions: -1 } },
        {
          $project: {
            _id: 0,
            toolId: '$_id',
            executions: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting session executed tools', error);
      return [];
    }
  }
  
  /**
   * Get session activity timeline
   */
  private async getSessionActivityTimeline(
    sessionId: string
  ): Promise<{ timestamp: Date; type: string; userId: string }[]> {
    try {
      const collection = await connectionPool.getCollection('analytics_events');
      
      const pipeline = [
        {
          $match: {
            sessionId,
            $or: [
              { type: AnalyticsEventType.SESSION_JOINED },
              { type: AnalyticsEventType.SESSION_LEFT },
              { type: AnalyticsEventType.CHAT_MESSAGE_SENT },
              { type: AnalyticsEventType.CODE_EDITED },
              { type: AnalyticsEventType.COMMENT_ADDED },
              { type: AnalyticsEventType.THREAD_CREATED },
              { type: AnalyticsEventType.TOOL_EXECUTED }
            ]
          }
        },
        { $sort: { timestamp: 1 } },
        {
          $project: {
            _id: 0,
            timestamp: 1,
            type: 1,
            userId: 1
          }
        }
      ];
      
      return await collection.aggregate(pipeline).toArray() as any[];
    } catch (error) {
      logger.error('Error getting session activity timeline', error);
      return [];
    }
  }
}

// Export singleton instance
export const insightsService = new InsightsService();
export default insightsService;