import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../utils/rate-limiter';
import telemetry from '../utils/telemetry';
import crypto from 'crypto';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('enterprise-middleware');

/**
 * Team membership types
 */
export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

/**
 * Team member information
 */
export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  invitedBy?: string;
  joinedAt: Date;
}

/**
 * Enterprise plan levels
 */
export enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

/**
 * Security level enum for enterprise features
 */
export enum SecurityLevel {
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum'
}

/**
 * Enterprise middleware for handling team-based access, rate limiting, and security features
 */
export class EnterpriseMiddleware {
  /**
   * Apply enterprise-level rate limiting based on plan tier
   */
  static rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    // Get plan tier from user object (added by auth middleware)
    const planTier = (req.user as any)?.planTier || PlanTier.FREE;
    
    // Apply rate limiting based on plan tier
    switch (planTier) {
      case PlanTier.ENTERPRISE:
        // Enterprise users get very high limits
        return createRateLimiter.custom({
          windowMs: 60 * 1000,
          maxRequests: 1000,
          // Skip rate limiting for specific endpoints
          skip: (req) => req.path.includes('/health')
        })(req, res, next);
        
      case PlanTier.PROFESSIONAL:
        // Professional users get higher limits
        return createRateLimiter.lenient()(req, res, next);
        
      case PlanTier.STARTER:
        // Starter users get standard limits
        return createRateLimiter.standard()(req, res, next);
        
      case PlanTier.FREE:
      default:
        // Free users get strict limits
        return createRateLimiter.strict()(req, res, next);
    }
  };
  
  /**
   * Check if user is a member of the specified team
   * @param requiredRole Minimum required role (defaults to MEMBER)
   */
  static teamMember = (teamId: string, requiredRole: TeamRole = TeamRole.MEMBER) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip in development environment
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_TEAM_CHECK === 'true') {
        return next();
      }
      
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      // In a real implementation, this would query the database
      // For now, we'll just simulate team membership
      const teamMember: TeamMember | null = {
        id: '123',
        userId,
        teamId,
        role: TeamRole.MEMBER,
        joinedAt: new Date()
      };
      
      // Check if user is a member of the team
      if (!teamMember) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this team'
        });
      }
      
      // Check if user has required role
      const roleValues = Object.values(TeamRole);
      const userRoleIndex = roleValues.indexOf(teamMember.role);
      const requiredRoleIndex = roleValues.indexOf(requiredRole);
      
      if (userRoleIndex > requiredRoleIndex) {
        return res.status(403).json({
          success: false,
          message: `This action requires ${requiredRole} access`
        });
      }
      
      // Add team member info to request
      (req as any).teamMember = teamMember;
      
      next();
    };
  };
  
  /**
   * Check if user's plan includes a specific feature
   * @param feature Feature name to check
   */
  static hasFeature = (feature: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip in development environment
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_FEATURE_CHECK === 'true') {
        return next();
      }
      
      // Get plan tier from user object
      const planTier = (req.user as any)?.planTier || PlanTier.FREE;
      
      // Feature availability by plan tier (would be more sophisticated in real implementation)
      const featureMap: Record<string, PlanTier[]> = {
        'basic-execution': [PlanTier.FREE, PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
        'container-execution': [PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
        'advanced-analysis': [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
        'team-sharing': [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
        'audit-logging': [PlanTier.ENTERPRISE],
        'custom-tools': [PlanTier.ENTERPRISE]
      };
      
      // Check if feature exists and is available in user's plan
      if (!featureMap[feature] || !featureMap[feature].includes(planTier)) {
        return res.status(402).json({
          success: false,
          message: `The ${feature} feature requires an upgrade to your plan`,
          requiredPlan: featureMap[feature]?.[0] || PlanTier.ENTERPRISE
        });
      }
      
      next();
    };
  };
  
  /**
   * Add telemetry tracking to requests
   */
  static telemetry = (req: Request, res: Response, next: NextFunction) => {
    // Start tracking request time
    const startTime = Date.now();
    
    // Track request path
    telemetry.trackEvent('api_request', {
      path: req.path,
      method: req.method,
      query: Object.keys(req.query).length
    }, {
      userId: req.user?.id || 'anonymous',
      planTier: (req.user as any)?.planTier || PlanTier.FREE
    });
    
    // Override end function to track response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      // Calculate request duration
      const duration = Date.now() - startTime;
      
      // Track response
      telemetry.trackMetric('api_response_time', duration, {
        path: req.path,
        method: req.method,
        status: res.statusCode.toString(),
        userId: req.user?.id || 'anonymous',
        planTier: (req.user as any)?.planTier || PlanTier.FREE
      });
      
      // Call original end function
      return originalEnd.call(this, chunk, encoding, callback);
    };
    
    next();
  };
  
  /**
   * Audit logging for sensitive operations
   */
  static auditLog = (operation: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Create audit entry (would save to database in real implementation)
      const auditEntry = {
        timestamp: new Date(),
        operation,
        userId: req.user?.id || 'anonymous',
        teamId: (req as any).teamMember?.teamId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.path,
        requestMethod: req.method,
        requestBody: req.body ? JSON.stringify(req.body).substring(0, 1000) : null
      };
      
      // Log audit entry in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Audit]', auditEntry);
      }
      
      // Track audit event
      telemetry.trackEvent('audit_log', auditEntry);
      
      next();
    };
  };
}

export default EnterpriseMiddleware;