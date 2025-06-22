import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../utils/analytics';
import { InsightsService } from '../services/insights.service';
import { CachingService } from '../utils/caching';

// Initialize services
const analyticsService = new AnalyticsService();
const cachingService = new CachingService();
// @ts-ignore - Temporarily ignore constructor type errors
const insightsService = new InsightsService(analyticsService, cachingService);

export class AnalyticsController {
  /**
   * Track a new analytics event
   */
  public async trackEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventType, userId, teamId, sessionId, data } = req.body;
      
      await analyticsService.trackEvent(eventType, {
        userId,
        teamId,
        sessionId,
        ...data
      });
      
      res.status(201).json({ success: true, message: 'Event tracked successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get user insights dashboard
   */
  public async getUserInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId || req.user?.id;
      const timeRange = req.query.timeRange as string || '7d';
      
      if (!userId) {
        res.status(400).json({ success: false, message: 'User ID is required' });
        return;
      }
      
      const insights = await insightsService.getUserInsights(userId, timeRange);
      res.status(200).json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get team insights dashboard
   */
  public async getTeamInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { teamId } = req.params;
      const timeRange = req.query.timeRange as string || '7d';
      
      if (!teamId) {
        res.status(400).json({ success: false, message: 'Team ID is required' });
        return;
      }
      
      const insights = await insightsService.getTeamInsights(teamId, timeRange);
      res.status(200).json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get tool usage insights
   */
  public async getToolInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { toolId } = req.params;
      const timeRange = req.query.timeRange as string || '7d';
      
      let insights;
      if (toolId) {
        insights = await insightsService.getToolInsights(toolId, timeRange);
      } else {
        insights = await insightsService.getAllToolsInsights(timeRange);
      }
      
      res.status(200).json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get session insights
   */
  public async getSessionInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        res.status(400).json({ success: false, message: 'Session ID is required' });
        return;
      }
      
      const insights = await insightsService.getSessionInsights(sessionId);
      res.status(200).json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get organization-wide insights
   */
  public async getOrganizationInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '30d';
      const insights = await insightsService.getOrganizationInsights(timeRange);
      res.status(200).json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get real-time active sessions
   */
  public async getActiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeSessions = await analyticsService.getActiveSessions();
      res.status(200).json({ success: true, data: activeSessions });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get event history for entity (user, team, tool)
   */
  public async getEventHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, entityId } = req.params;
      const { startDate, endDate, limit, eventTypes } = req.query;
      
      const filter: any = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
        eventTypes: eventTypes ? (eventTypes as string).split(',') : undefined
      };
      
      let events;
      switch (entityType) {
        case 'user':
          events = await analyticsService.getUserEvents(entityId, filter);
          break;
        case 'team':
          events = await analyticsService.getTeamEvents(entityId, filter);
          break;
        case 'tool':
          events = await analyticsService.getToolEvents(entityId, filter);
          break;
        case 'session':
          events = await analyticsService.getSessionEvents(entityId, filter);
          break;
        default:
          res.status(400).json({ success: false, message: 'Invalid entity type' });
          return;
      }
      
      res.status(200).json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }
}

export default new AnalyticsController();