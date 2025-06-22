import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('rate-limiter');

export interface RateLimitRule {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests in window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipIf?: (req: Request) => boolean; // Function to skip rate limiting
  onLimitReached?: (req: Request, res: Response) => void; // Custom limit reached handler
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class AdvancedRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private rules: Map<string, RateLimitRule> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeRules();
    this.startCleanup();
  }

  private initializeRules(): void {
    // Default rules
    this.addRule('default', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000,
      keyGenerator: (req) => this.getClientIP(req)
    });

    // Strict rules for auth endpoints
    this.addRule('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20, // Strict limit for auth
      keyGenerator: (req) => this.getClientIP(req)
    });

    // Moderate rules for LLM endpoints (expensive operations)
    this.addRule('llm', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
      keyGenerator: (req) => {
        const ip = this.getClientIP(req);
        const userId = this.getUserId(req);
        return userId ? `user:${userId}` : `ip:${ip}`;
      }
    });

    // Generous rules for file operations
    this.addRule('files', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req) => {
        const userId = this.getUserId(req);
        return userId ? `user:${userId}` : `ip:${this.getClientIP(req)}`;
      }
    });

    // Rules for collaboration endpoints
    this.addRule('collaboration', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
      keyGenerator: (req) => {
        const userId = this.getUserId(req);
        return userId ? `user:${userId}` : `ip:${this.getClientIP(req)}`;
      }
    });

    // Premium user rules (if user has premium status)
    this.addRule('premium', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 500, // Higher limits for premium users
      keyGenerator: (req) => `premium:${this.getUserId(req)}`,
      skipIf: (req) => !this.isPremiumUser(req)
    });

    logger.info('Initialized rate limiting rules');
  }

  public addRule(name: string, rule: RateLimitRule): void {
    this.rules.set(name, rule);
  }

  public checkRateLimit(ruleName: string, req: Request): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      logger.warn(`Rate limit rule not found: ${ruleName}`);
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    // Skip if condition is met
    if (rule.skipIf && rule.skipIf(req)) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const key = rule.keyGenerator ? rule.keyGenerator(req) : this.getClientIP(req);
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    let entry = this.store.get(`${ruleName}:${key}`);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + rule.windowMs,
        firstRequest: now
      };
      this.store.set(`${ruleName}:${key}`, entry);
      
      return {
        allowed: true,
        remaining: rule.maxRequests - 1,
        resetTime: entry.resetTime
      };
    }

    // Check if within current window
    if (entry.firstRequest > windowStart) {
      entry.count++;
      
      if (entry.count > rule.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
          retryAfter
        };
      }
      
      return {
        allowed: true,
        remaining: rule.maxRequests - entry.count,
        resetTime: entry.resetTime
      };
    }

    // Reset window
    entry = {
      count: 1,
      resetTime: now + rule.windowMs,
      firstRequest: now
    };
    this.store.set(`${ruleName}:${key}`, entry);
    
    return {
      allowed: true,
      remaining: rule.maxRequests - 1,
      resetTime: entry.resetTime
    };
  }

  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.headers['x-forwarded-for'] as string ||
           req.headers['x-real-ip'] as string ||
           'unknown';
  }

  private getUserId(req: Request): string | null {
    // Extract user ID from JWT token or request context
    if (req.headers.authorization) {
      try {
        // In a real implementation, you'd decode the JWT
        // For now, we'll use a simple extraction
        const token = req.headers.authorization.replace('Bearer ', '');
        // This is a simplified approach - in reality you'd properly decode the JWT
        return token.length > 10 ? token.substring(0, 10) : null;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  private isPremiumUser(req: Request): boolean {
    // Check if user has premium status
    // This would typically involve checking user data from token or database
    const userId = this.getUserId(req);
    // For demo purposes, assume users with ID containing 'premium' are premium
    return userId ? userId.includes('premium') : false;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 300000); // Clean up every 5 minutes
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired rate limit entries`);
    }
  }

  public getStats(): any {
    const stats: any = {
      totalEntries: this.store.size,
      ruleCount: this.rules.size,
      rules: {}
    };

    for (const [ruleName, rule] of this.rules.entries()) {
      const ruleEntries = Array.from(this.store.keys()).filter(key => key.startsWith(`${ruleName}:`));
      stats.rules[ruleName] = {
        activeEntries: ruleEntries.length,
        windowMs: rule.windowMs,
        maxRequests: rule.maxRequests
      };
    }

    return stats;
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const rateLimiter = new AdvancedRateLimiter();

export const createRateLimitMiddleware = (ruleName: string, customRule?: RateLimitRule) => {
  if (customRule) {
    rateLimiter.addRule(ruleName, customRule);
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const result = rateLimiter.checkRateLimit(ruleName, req);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': rateLimiter.rules.get(ruleName)?.maxRequests.toString() || '0',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });

    if (!result.allowed) {
      res.set('Retry-After', result.retryAfter?.toString() || '60');
      
      logger.warn(`Rate limit exceeded for rule ${ruleName}: ${req.ip} ${req.method} ${req.path}`);
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfter
      });
    }

    next();
  };
};

// Middleware factory for different endpoint types
export const getRateLimitMiddleware = (path: string) => {
  if (path.startsWith('/api/auth')) {
    return createRateLimitMiddleware('auth');
  }
  
  if (path.startsWith('/api/llm')) {
    return createRateLimitMiddleware('llm');
  }
  
  if (path.startsWith('/api/files')) {
    return createRateLimitMiddleware('files');
  }
  
  if (path.startsWith('/api/collaboration')) {
    return createRateLimitMiddleware('collaboration');
  }
  
  return createRateLimitMiddleware('default');
};

// Admin endpoint to view rate limit stats
export const rateLimitStatsHandler = (req: Request, res: Response) => {
  const stats = rateLimiter.getStats();
  res.json({
    success: true,
    data: stats
  });
};