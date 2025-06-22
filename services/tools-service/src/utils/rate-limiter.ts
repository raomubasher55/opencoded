import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;    // Error message
  statusCode?: number; // Error status code
  keyGenerator?: (req: Request) => string; // Function to generate key
  skip?: (req: Request) => boolean; // Function to skip rate limiting
  headers?: boolean;   // Whether to include rate limit headers
}

/**
 * Rate limiter for API endpoints
 */
export class RateLimiter {
  private cache: NodeCache;
  private config: Required<RateLimitConfig>;
  
  /**
   * Create a new rate limiter
   * @param options Rate limit options
   */
  constructor(options: RateLimitConfig) {
    this.cache = new NodeCache({
      stdTTL: Math.ceil(options.windowMs / 1000), // TTL in seconds
      checkperiod: Math.min(Math.ceil(options.windowMs / 1000), 60), // Check period
      useClones: false
    });
    
    // Set default options
    this.config = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      message: options.message || 'Too many requests, please try again later',
      statusCode: options.statusCode || 429,
      headers: options.headers !== false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      skip: options.skip || this.defaultSkip
    };
  }
  
  /**
   * Default key generator function (uses IP address)
   */
  private defaultKeyGenerator(req: Request): string {
    return req.ip || 
      (req.headers['x-forwarded-for'] as string) || 
      (req.socket.remoteAddress || '');
  }
  
  /**
   * Default skip function (doesn't skip anything)
   */
  private defaultSkip(_req: Request): boolean {
    return false;
  }
  
  /**
   * Middleware to apply rate limiting
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip rate limiting if needed
      if (this.config.skip(req)) {
        return next();
      }
      
      // Get rate limit key for this request
      const key = this.config.keyGenerator(req);
      
      // Get current count or initialize
      let requestCount = this.cache.get<number>(key) || 0;
      
      // Check if rate limit exceeded
      if (requestCount >= this.config.maxRequests) {
        // Set rate limit headers if enabled
        if (this.config.headers) {
          res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('Retry-After', Math.ceil(this.config.windowMs / 1000).toString());
        }
        
        return res.status(this.config.statusCode).json({
          success: false,
          error: 'Too Many Requests',
          message: this.config.message
        });
      }
      
      // Increment request count
      this.cache.set<number>(key, ++requestCount);
      
      // Set rate limit headers if enabled
      if (this.config.headers) {
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (this.config.maxRequests - requestCount).toString());
      }
      
      next();
    };
  }
  
  /**
   * Reset rate limits for a specific key
   * @param key Rate limit key to reset
   */
  resetKey(key: string): boolean {
    return this.cache.del(key) > 0;
  }
  
  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.cache.flushAll();
  }
  
  /**
   * Get current rate limit status for a key
   * @param key Rate limit key
   */
  getKeyStatus(key: string): { requests: number; remaining: number; resetTime: Date } {
    const requests = this.cache.get<number>(key) || 0;
    const ttl = this.cache.getTtl(key);
    
    return {
      requests,
      remaining: Math.max(0, this.config.maxRequests - requests),
      resetTime: ttl ? new Date(ttl) : new Date(Date.now() + this.config.windowMs)
    };
  }
}

/**
 * Create rate limiter middleware with standard configurations
 */
export const createRateLimiter = {
  // Standard rate limiter: 100 requests per minute
  standard: () => new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests, please try again in a minute'
  }).middleware(),
  
  // Strict rate limiter: 30 requests per minute
  strict: () => new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: 'Too many requests, please try again in a minute'
  }).middleware(),
  
  // Lenient rate limiter: 300 requests per minute
  lenient: () => new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 300,
    message: 'Too many requests, please try again in a minute'
  }).middleware(),
  
  // Custom rate limiter
  custom: (options: RateLimitConfig) => new RateLimiter(options).middleware()
};