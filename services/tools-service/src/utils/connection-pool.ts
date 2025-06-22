import { createServiceLogger } from '@opencode/shared-utils';
import { MongoClient, Db, Collection, MongoClientOptions } from 'mongodb';

const logger = createServiceLogger('connection-pool');

/**
 * Connection pool statistics
 */
interface ConnectionStats {
  activeConnections: number;
  availableConnections: number;
  pendingConnections: number;
  totalOperations: number;
  operationsPerSecond: number;
  averageOperationTime: number;
}

/**
 * Database connection pool manager
 */
export class ConnectionPoolManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectionString: string;
  private dbName: string;
  private options: MongoClientOptions;
  private connectionPromise: Promise<void> | null = null;
  private collections: Map<string, Collection> = new Map();
  private operationStats: {
    totalOperations: number;
    operationTimes: number[];
    lastResetTime: number;
  } = {
    totalOperations: 0,
    operationTimes: [],
    lastResetTime: Date.now()
  };
  
  /**
   * Create a new connection pool manager
   */
  constructor() {
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.dbName = process.env.MONGODB_DB || 'opencode';
    
    // Configure connection pool
    const poolSize = parseInt(process.env.MONGODB_POOL_SIZE || '10', 10);
    
    this.options = {
      maxPoolSize: poolSize,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      waitQueueTimeoutMS: 2000
    };
    
    logger.info('Connection pool manager initialized', {
      poolSize,
      dbName: this.dbName
    });
  }
  
  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }
    
    // If connection is already in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // Start new connection process
    this.connectionPromise = this.connectInternal();
    return this.connectionPromise;
  }
  
  /**
   * Internal connection method
   */
  private async connectInternal(): Promise<void> {
    try {
      logger.info('Connecting to database', { uri: this.maskConnectionString() });
      
      // Create client with connection pool
      this.client = new MongoClient(this.connectionString, this.options);
      
      // Connect to database
      await this.client.connect();
      
      // Get database
      this.db = this.client.db(this.dbName);
      
      logger.info('Connected to database', { dbName: this.dbName });
      
      // Start monitoring interval
      this.startMonitoring();
    } catch (error) {
      logger.error('Error connecting to database', error);
      this.client = null;
      this.db = null;
      this.connectionPromise = null;
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }
  
  /**
   * Mask connection string for logging
   */
  private maskConnectionString(): string {
    if (!this.connectionString) return 'undefined';
    
    try {
      const url = new URL(this.connectionString);
      
      // Mask password if present
      if (url.password) {
        url.password = '********';
      }
      
      return url.toString();
    } catch (error) {
      // If URL parsing fails, just mask the entire string
      return this.connectionString.replace(/\/\/([^@]+)@/, '//********@');
    }
  }
  
  /**
   * Get a collection
   */
  async getCollection<T>(name: string): Promise<Collection<T>> {
    await this.connect();
    
    if (!this.db) {
      throw new Error('Database connection not established');
    }
    
    // Check if collection is already cached
    if (this.collections.has(name)) {
      return this.collections.get(name) as Collection<T>;
    }
    
    // Get collection and cache it
    const collection = this.db.collection<T>(name);
    this.collections.set(name, collection);
    
    return collection;
  }
  
  /**
   * Get database instance
   */
  async getDb(): Promise<Db> {
    await this.connect();
    
    if (!this.db) {
      throw new Error('Database connection not established');
    }
    
    return this.db;
  }
  
  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collections.clear();
      logger.info('Disconnected from database');
    }
  }
  
  /**
   * Track an operation
   */
  trackOperation(timeMs: number): void {
    this.operationStats.totalOperations++;
    this.operationStats.operationTimes.push(timeMs);
    
    // Keep only the last 1000 operation times
    if (this.operationStats.operationTimes.length > 1000) {
      this.operationStats.operationTimes.shift();
    }
    
    // Reset stats every hour
    const now = Date.now();
    if (now - this.operationStats.lastResetTime > 60 * 60 * 1000) {
      this.operationStats.totalOperations = 0;
      this.operationStats.operationTimes = [];
      this.operationStats.lastResetTime = now;
    }
  }
  
  /**
   * Get connection statistics
   */
  async getStats(): Promise<ConnectionStats | null> {
    if (!this.client || !this.db) {
      return null;
    }
    
    try {
      // Get server status
      const adminDb = this.db.admin();
      const serverStatus = await adminDb.serverStatus();
      
      // Calculate operations per second
      const totalOperations = this.operationStats.totalOperations;
      const elapsedSeconds = (Date.now() - this.operationStats.lastResetTime) / 1000;
      const opsPerSecond = totalOperations / (elapsedSeconds || 1);
      
      // Calculate average operation time
      const operationTimes = this.operationStats.operationTimes;
      const avgOpTime = operationTimes.length > 0
        ? operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length
        : 0;
      
      // Extract connection pool stats
      const poolStats = serverStatus.connections;
      
      return {
        activeConnections: poolStats.current,
        availableConnections: poolStats.available,
        pendingConnections: poolStats.pending,
        totalOperations,
        operationsPerSecond: opsPerSecond,
        averageOperationTime: avgOpTime
      };
    } catch (error) {
      logger.error('Error getting connection stats', error);
      return null;
    }
  }
  
  /**
   * Start monitoring the connection pool
   */
  private startMonitoring(): void {
    // Monitor every 5 minutes
    const interval = 5 * 60 * 1000;
    
    setInterval(async () => {
      try {
        const stats = await this.getStats();
        
        if (stats) {
          logger.info('Connection pool stats', stats);
          
          // Check for potential issues
          if (stats.pendingConnections > 10) {
            logger.warn('High number of pending connections', {
              pending: stats.pendingConnections
            });
          }
          
          if (stats.averageOperationTime > 1000) {
            logger.warn('High average operation time', {
              avgTimeMs: stats.averageOperationTime
            });
          }
        }
      } catch (error) {
        logger.error('Error monitoring connection pool', error);
      }
    }, interval);
  }
  
  /**
   * Execute a database operation with tracking
   */
  async withTracking<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Execute operation
      return await operation();
    } finally {
      // Track operation time
      const timeMs = Date.now() - startTime;
      this.trackOperation(timeMs);
    }
  }
}

// Export singleton instance
export const connectionPool = new ConnectionPoolManager();
export default connectionPool;