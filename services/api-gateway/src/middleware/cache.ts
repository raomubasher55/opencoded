import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@opencode/shared-utils';
import { createHash } from 'crypto';

const logger = createServiceLogger('api-cache');

export interface CacheEntry {
  data: any;
  headers: { [key: string]: string };
  statusCode: number;
  timestamp: Date;
  ttl: number;
  hits: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0
  };
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  private generateCacheKey(req: Request): string {
    const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.headers.authorization || ''}`;
    return createHash('md5').update(key).digest('hex');
  }

  public get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheStats.misses++;
      return null;
    }

    // Check if entry is expired
    const now = new Date();
    if (now.getTime() - entry.timestamp.getTime() > entry.ttl * 1000) {
      this.cache.delete(key);
      this.cacheStats.evictions++;
      this.cacheStats.misses++;
      return null;
    }

    entry.hits++;
    this.cacheStats.hits++;
    return entry;
  }

  public set(key: string, data: any, headers: { [key: string]: string }, statusCode: number, ttl: number): void {
    // Evict least recently used items if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry = {
      data,
      headers: { ...headers },
      statusCode,
      timestamp: new Date(),
      ttl,
      hits: 0
    };

    this.cache.set(key, entry);
    this.cacheStats.sets++;
  }

  public delete(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern);
    
    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
        this.cacheStats.deletes++;
      }
    }
    
    return deletedCount;
  }

  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.cacheStats.deletes += size;
    logger.info(`Cleared cache: ${size} entries removed`);
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const lastAccess = entry.timestamp.getTime() + (entry.hits * 60000); // Factor in hit frequency
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 300000); // Clean up every 5 minutes
  }

  private cleanupExpired(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now.getTime() - entry.timestamp.getTime() > entry.ttl * 1000) {
        this.cache.delete(key);
        cleanedCount++;
        this.cacheStats.evictions++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  public getStats(): any {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) * 100 : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      ...this.cacheStats
    };
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  public getCacheKey(req: Request): string {
    return this.generateCacheKey(req);
  }
}

export const cacheManager = new CacheManager();

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  varyBy?: string[]; // Headers to vary cache by
  skipIf?: (req: Request) => boolean; // Function to skip caching
  keyGenerator?: (req: Request) => string; // Custom key generator
}

export const cacheMiddleware = (options: CacheOptions = {}) => {
  const {
    ttl = 300, // Default 5 minutes
    varyBy = [],
    skipIf = () => false,
    keyGenerator
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests or if skipIf condition is met
    if (req.method !== 'GET' || skipIf(req)) {
      return next();
    }

    const cacheKey = keyGenerator ? keyGenerator(req) : cacheManager.getCacheKey(req);
    const cachedEntry = cacheManager.get(cacheKey);

    if (cachedEntry) {
      // Serve from cache
      res.set(cachedEntry.headers);
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);
      res.status(cachedEntry.statusCode).json(cachedEntry.data);
      logger.debug(`Cache hit for ${req.method} ${req.path}`);
      return;
    }

    // Capture response
    const originalSend = res.json;
    const originalStatus = res.status;
    let statusCode = 200;
    let responseData: any;

    res.status = function(code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    res.json = function(data: any) {
      responseData = data;
      
      // Cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        const headers: { [key: string]: string } = {};
        
        // Include vary headers
        varyBy.forEach(header => {
          const value = req.headers[header.toLowerCase()];
          if (value) {
            headers[header] = Array.isArray(value) ? value[0] : value;
          }
        });

        // Copy important response headers
        const responseHeaders = res.getHeaders();
        ['content-type', 'cache-control', 'etag'].forEach(header => {
          if (responseHeaders[header]) {
            headers[header] = responseHeaders[header] as string;
          }
        });

        cacheManager.set(cacheKey, data, headers, statusCode, ttl);
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        logger.debug(`Cached response for ${req.method} ${req.path} (TTL: ${ttl}s)`);
      } else {
        res.set('X-Cache', 'SKIP');
        logger.debug(`Skipped caching for ${req.method} ${req.path} (Status: ${statusCode})`);
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

// Cache invalidation middleware
export const cacheInvalidationMiddleware = (patterns: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(data: any) {
      // Invalidate cache on successful write operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let totalInvalidated = 0;
          patterns.forEach(pattern => {
            totalInvalidated += cacheManager.delete(pattern);
          });
          
          if (totalInvalidated > 0) {
            logger.info(`Invalidated ${totalInvalidated} cache entries after ${req.method} ${req.path}`);
          }
        }
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Specific cache strategies for different endpoints
export const getCacheStrategy = (path: string): CacheOptions => {
  // Static content - long TTL
  if (path.startsWith('/api/llm/models') || path.startsWith('/api/tools')) {
    return { ttl: 3600 }; // 1 hour
  }
  
  // User-specific content - short TTL with user variation
  if (path.startsWith('/api/sessions') || path.startsWith('/api/auth')) {
    return { 
      ttl: 300, // 5 minutes
      varyBy: ['authorization'],
      skipIf: (req) => req.method !== 'GET'
    };
  }
  
  // File content - medium TTL with path variation
  if (path.startsWith('/api/files')) {
    return { 
      ttl: 900, // 15 minutes
      varyBy: ['authorization'],
      skipIf: (req) => Object.keys(req.query).length > 0 // Skip if has query params
    };
  }
  
  // Default strategy
  return { ttl: 300 }; // 5 minutes
};