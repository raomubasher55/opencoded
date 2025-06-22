import { EventEmitter } from 'events';
import * as os from 'os';

/**
 * Telemetry data point with metadata
 */
interface TelemetryEvent {
  name: string;
  value: number | string | object;
  timestamp: Date;
  tags: Record<string, string>;
}

/**
 * Service for collecting and reporting telemetry data
 */
export class TelemetryService extends EventEmitter {
  private enabled: boolean;
  private buffer: TelemetryEvent[] = [];
  private bufferSize: number;
  private flushInterval: NodeJS.Timeout | null = null;
  private defaultTags: Record<string, string>;
  
  /**
   * Create a new telemetry service
   * @param options Configuration options
   */
  constructor(options: {
    enabled?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
    defaultTags?: Record<string, string>;
  } = {}) {
    super();
    
    this.enabled = options.enabled ?? (process.env.TELEMETRY_ENABLED === 'true');
    this.bufferSize = options.bufferSize ?? 100;
    this.defaultTags = options.defaultTags ?? {};
    
    // Set up system information tags
    this.defaultTags = {
      service: 'tools-service',
      hostname: os.hostname(),
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      ...this.defaultTags
    };
    
    // Set up flush interval if enabled
    const flushIntervalMs = options.flushIntervalMs ?? 30000; // 30 seconds
    if (this.enabled && flushIntervalMs > 0) {
      this.flushInterval = setInterval(() => this.flush(), flushIntervalMs);
    }
  }
  
  /**
   * Track a numeric metric
   * @param name Metric name
   * @param value Numeric value
   * @param tags Additional tags
   */
  trackMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!this.enabled) return;
    
    this.buffer.push({
      name,
      value,
      timestamp: new Date(),
      tags: { ...this.defaultTags, ...tags }
    });
    
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }
  
  /**
   * Track an event
   * @param name Event name
   * @param properties Event properties
   * @param tags Additional tags
   */
  trackEvent(name: string, properties: Record<string, any> = {}, tags: Record<string, string> = {}): void {
    if (!this.enabled) return;
    
    this.buffer.push({
      name,
      value: properties,
      timestamp: new Date(),
      tags: { ...this.defaultTags, ...tags }
    });
    
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }
  
  /**
   * Track execution time of a function
   * @param name Timer name
   * @param fn Function to time
   * @param tags Additional tags
   * @returns Function result
   */
  async trackTime<T>(name: string, fn: () => Promise<T>, tags: Record<string, string> = {}): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.trackMetric(`${name}.duration`, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackMetric(`${name}.duration`, duration, { ...tags, success: 'false' });
      this.trackEvent(`${name}.error`, { error: (error as Error).message }, tags);
      throw error;
    }
  }
  
  /**
   * Flush telemetry data to configured outputs
   */
  flush(): void {
    if (!this.enabled || this.buffer.length === 0) return;
    
    // Clone and clear buffer
    const events = [...this.buffer];
    this.buffer = [];
    
    // Emit events for handlers to process
    this.emit('flush', events);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Telemetry] Flushed ${events.length} events`);
    }
  }
  
  /**
   * Enable or disable telemetry
   * @param enabled Whether telemetry should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    // Set up or clear flush interval
    if (enabled && !this.flushInterval) {
      this.flushInterval = setInterval(() => this.flush(), 30000);
    } else if (!enabled && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
  
  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    this.flush();
    this.removeAllListeners();
  }
}

// Export a singleton instance
export default new TelemetryService();