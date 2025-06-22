import NodeCache from 'node-cache';
import { createHash } from 'crypto';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('caching-service');

/**
 * Cache configuration
 */
interface CacheConfig {
  stdTTL: number;       // Default TTL in seconds
  checkperiod: number;  // How often to check for expired keys
  maxKeys: number;      // Maximum number of keys in cache
}

/**
 * Cache levels for different types of data
 */
export enum CacheLevel {
  MEMORY = 'memory',       // In-memory cache only
  PERSISTENT = 'persistent', // Redis or other persistent cache
  DISTRIBUTED = 'distributed' // Distributed cache across nodes
}

/**
 * Cache strategy types
 */
export enum CacheStrategy {
  SIMPLE = 'simple',    // Simple key-value caching
  USER_SCOPED = 'user', // Cache per user
  TEAM_SCOPED = 'team', // Cache per team
  VERSIONED = 'versioned' // Cache with versioning
}

/**
 * Result caching service for improved performance
 */
export class CachingService {
  private cache: NodeCache;
  
  private readonly memoryCache: NodeCache;
  private readonly persistentCache: NodeCache;
  private readonly distributedCache: NodeCache;
  private readonly cacheHitCounter: Map<string, number> = new Map();
  private readonly cacheMissCounter: Map<string, number> = new Map();
  private readonly lastOptimizationRun: Date = new Date();
  private optimizationInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new caching service
   * @param config Cache configuration
   */
  constructor(config: CacheConfig = {
    stdTTL: 600,       // 10 minutes
    checkperiod: 60,   // Check every minute
    maxKeys: 1000      // Store up to 1000 keys
  }) {
    // Create different cache instances for different levels
    this.memoryCache = new NodeCache({
      ...config,
      stdTTL: 300      // 5 minutes for memory cache
    });
    
    this.persistentCache = new NodeCache({
      ...config,
      stdTTL: 3600     // 1 hour for persistent cache
    });
    
    this.distributedCache = new NodeCache({
      ...config,
      stdTTL: 86400    // 24 hours for distributed cache
    });
    
    // Use memory cache as default
    this.cache = this.memoryCache;
    
    // Start cache optimization process if enabled
    if (process.env.ENABLE_CACHE_OPTIMIZATION === 'true') {
      this.startOptimization();
    }
    
    logger.info('Cache service initialized');
  }
  
  /**
   * Generate a cache key from the input object
   * @param input Input object to hash
   * @param strategy Cache strategy to use
   * @param userId Optional user ID for user-scoped caching
   * @param teamId Optional team ID for team-scoped caching
   * @param version Optional version for versioned caching
   * @returns Cache key
   */
  private generateKey(
    input: any,
    strategy: CacheStrategy = CacheStrategy.SIMPLE,
    userId?: string,
    teamId?: string,
    version?: string
  ): string {
    // Create base input string
    let stringInput = typeof input === 'string' 
      ? input 
      : JSON.stringify(input);
    
    // Apply strategy-specific modifications
    switch (strategy) {
      case CacheStrategy.USER_SCOPED:
        stringInput = `user:${userId || 'anonymous'}:${stringInput}`;
        break;
        
      case CacheStrategy.TEAM_SCOPED:
        stringInput = `team:${teamId || 'none'}:${stringInput}`;
        break;
        
      case CacheStrategy.VERSIONED:
        stringInput = `v${version || '1'}:${stringInput}`;
        break;
    }
    
    // Create hash
    return createHash('md5')
      .update(stringInput)
      .digest('hex');
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key or object to hash
   * @param level Cache level to check
   * @param strategy Cache strategy to use
   * @param userId Optional user ID for user-scoped caching
   * @param teamId Optional team ID for team-scoped caching
   * @param version Optional version for versioned caching
   * @returns Cached value or undefined if not found
   */
  get<T>(
    key: string | any,
    level: CacheLevel = CacheLevel.MEMORY,
    strategy: CacheStrategy = CacheStrategy.SIMPLE,
    userId?: string,
    teamId?: string,
    version?: string
  ): T | undefined {
    // Generate cache key
    const cacheKey = typeof key === 'string' 
      ? key 
      : this.generateKey(key, strategy, userId, teamId, version);
    
    // Get cache instance for the specified level
    const cache = this.getCacheForLevel(level);
    
    // Try to get value from cache
    const value = cache.get<T>(cacheKey);
    
    // Update stats
    if (value !== undefined) {
      this.incrementHitCounter(cacheKey);
    } else {
      this.incrementMissCounter(cacheKey);
    }
    
    return value;
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key or object to hash
   * @param value Value to cache
   * @param ttl TTL in seconds (optional, uses default if not provided)
   * @param level Cache level to use
   * @param strategy Cache strategy to use
   * @param userId Optional user ID for user-scoped caching
   * @param teamId Optional team ID for team-scoped caching
   * @param version Optional version for versioned caching
   * @returns true if successfully stored
   */
  set<T>(
    key: string | any,
    value: T,
    ttl?: number,
    level: CacheLevel = CacheLevel.MEMORY,
    strategy: CacheStrategy = CacheStrategy.SIMPLE,
    userId?: string,
    teamId?: string,
    version?: string
  ): boolean {
    // Generate cache key
    const cacheKey = typeof key === 'string' 
      ? key 
      : this.generateKey(key, strategy, userId, teamId, version);
    
    // Get cache instance for the specified level
    const cache = this.getCacheForLevel(level);
    
    // Set value in cache
    return cache.set<T>(cacheKey, value, ttl || 0);
  }
  
  /**
   * Remove a value from the cache
   * @param key Cache key or object to hash
   * @returns Number of removed entries (0 or 1)
   */
  del(key: string | any): number {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    return this.cache.del(cacheKey);
  }
  
  /**
   * Check if a key exists in the cache
   * @param key Cache key or object to hash
   * @returns true if the key exists
   */
  has(key: string | any): boolean {
    const cacheKey = typeof key === 'string' ? key : this.generateKey(key);
    return this.cache.has(cacheKey);
  }
  
  /**
   * Get or set a value in the cache
   * @param key Cache key or object to hash
   * @param getter Function to get the value if not in cache
   * @param ttl TTL in seconds (optional, uses default if not provided)
   * @param level Cache level to use
   * @param strategy Cache strategy to use
   * @param userId Optional user ID for user-scoped caching
   * @param teamId Optional team ID for team-scoped caching
   * @param version Optional version for versioned caching
   * @returns The cached or newly fetched value
   */
  async getOrSet<T>(
    key: string | any,
    getter: () => Promise<T>,
    ttl?: number,
    level: CacheLevel = CacheLevel.MEMORY,
    strategy: CacheStrategy = CacheStrategy.SIMPLE,
    userId?: string,
    teamId?: string,
    version?: string
  ): Promise<T> {
    // Generate cache key
    const cacheKey = typeof key === 'string' 
      ? key 
      : this.generateKey(key, strategy, userId, teamId, version);
    
    // Get cache instance for the specified level
    const cache = this.getCacheForLevel(level);
    
    // Check if value exists in cache
    const cachedValue = cache.get<T>(cacheKey);
    if (cachedValue !== undefined) {
      this.incrementHitCounter(cacheKey);
      return cachedValue;
    }
    
    this.incrementMissCounter(cacheKey);
    
    // Get fresh value
    const value = await getter();
    
    // Store in cache
    cache.set<T>(cacheKey, value, ttl || 0);
    
    return value;
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.flushAll();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    keys: number;
    hits: number;
    misses: number;
    ksize: number;
    vsize: number;
  } {
    return this.cache.getStats();
  }

  /**
   * Get the appropriate cache for the specified level
   */
  private getCacheForLevel(level: CacheLevel): NodeCache {
    switch (level) {
      case CacheLevel.MEMORY:
        return this.memoryCache;
      case CacheLevel.PERSISTENT:
        return this.persistentCache;
      case CacheLevel.DISTRIBUTED:
        return this.distributedCache;
      default:
        return this.memoryCache;
    }
  }
  
  /**
   * Increment hit counter for a key
   */
  private incrementHitCounter(key: string): void {
    const current = this.cacheHitCounter.get(key) || 0;
    this.cacheHitCounter.set(key, current + 1);
  }
  
  /**
   * Increment miss counter for a key
   */
  private incrementMissCounter(key: string): void {
    const current = this.cacheMissCounter.get(key) || 0;
    this.cacheMissCounter.set(key, current + 1);
  }
  
  /**
   * Start cache optimization process
   */
  private startOptimization(): void {
    // Run optimization every 10 minutes
    const interval = 10 * 60 * 1000;
    
    this.optimizationInterval = setInterval(() => {
      this.optimizeCache();
    }, interval);
    
    logger.info('Cache optimization started');
  }
  
  /**
   * Stop cache optimization process
   */
  public stopOptimization(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
      logger.info('Cache optimization stopped');
    }
  }
  
  /**
   * Optimize cache based on usage patterns
   */
  private optimizeCache(): void {
    try {
      logger.info('Running cache optimization');
      
      // Get frequently accessed keys
      const frequentKeys = this.getFrequentlyAccessedKeys();
      
      // Get rarely accessed keys
      const rareKeys = this.getRarelyAccessedKeys();
      
      // Promote frequently accessed keys to higher-level caches
      for (const key of frequentKeys) {
        // Check if key exists in memory cache
        const value = this.memoryCache.get(key);
        if (value !== undefined) {
          // Promote to persistent cache
          this.persistentCache.set(key, value);
          logger.debug(`Promoted key to persistent cache: ${key}`);
        }
      }
      
      // Remove rarely accessed keys from higher-level caches
      for (const key of rareKeys) {
        this.persistentCache.del(key);
        this.distributedCache.del(key);
        logger.debug(`Removed rarely used key from higher-level caches: ${key}`);
      }
      
      // Reset counters periodically
      if (new Date().getTime() - this.lastOptimizationRun.getTime() > 24 * 60 * 60 * 1000) {
        this.cacheHitCounter.clear();
        this.cacheMissCounter.clear();
        this.lastOptimizationRun = new Date();
        logger.info('Reset cache counters');
      }
      
      // Log cache statistics
      logger.info('Cache optimization complete', {
        memoryStats: this.memoryCache.getStats(),
        persistentStats: this.persistentCache.getStats(),
        distributedStats: this.distributedCache.getStats()
      });
    } catch (error) {
      logger.error('Error during cache optimization', error);
    }
  }
  
  /**
   * Get frequently accessed keys
   */
  private getFrequentlyAccessedKeys(): string[] {
    const threshold = 10; // Keys accessed more than 10 times
    const frequentKeys: string[] = [];
    
    for (const [key, hits] of this.cacheHitCounter.entries()) {
      if (hits > threshold) {
        frequentKeys.push(key);
      }
    }
    
    return frequentKeys;
  }
  
  /**
   * Get rarely accessed keys
   */
  private getRarelyAccessedKeys(): string[] {
    const threshold = 2; // Keys accessed less than 2 times
    const rareKeys: string[] = [];
    
    for (const [key, hits] of this.cacheHitCounter.entries()) {
      if (hits < threshold) {
        rareKeys.push(key);
      }
    }
    
    return rareKeys;
  }
}

// Export a singleton instance
export default new CachingService();