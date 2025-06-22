import { createServiceLogger } from '@opencode/shared-utils';
import telemetry from './telemetry';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const logger = createServiceLogger('audit-logger');

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Audit event categories
 */
export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  API = 'api',
  EXTENSION = 'extension',
  TEAM = 'team',
  ADMIN = 'admin'
}

/**
 * Audit event interface
 */
export interface AuditEvent {
  id: string;
  timestamp: Date;
  actor: {
    id: string;
    username?: string;
    email?: string;
    role?: string;
    ip?: string;
    userAgent?: string;
  };
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  target?: {
    id?: string;
    type: string;
    name?: string;
  };
  details?: any;
  outcome: 'success' | 'failure';
  reason?: string;
}

/**
 * Enterprise-grade audit logging service
 */
class AuditLogger {
  private enabled: boolean;
  private logToFile: boolean;
  private logDir: string;
  private tamperProof: boolean;
  private hmacKey: string;
  
  constructor() {
    // Initialize from environment variables
    this.enabled = process.env.AUDIT_LOGGING_ENABLED === 'true';
    this.logToFile = process.env.AUDIT_LOG_TO_FILE === 'true';
    this.logDir = process.env.AUDIT_LOG_DIR || path.join(process.cwd(), 'logs', 'audit');
    this.tamperProof = process.env.AUDIT_TAMPER_PROOF === 'true';
    this.hmacKey = process.env.AUDIT_HMAC_KEY || 'default-audit-hmac-key';
    
    // Create log directory if needed
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    logger.info('Audit logger initialized', {
      enabled: this.enabled,
      logToFile: this.logToFile,
      tamperProof: this.tamperProof
    });
  }
  
  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    if (!this.enabled) {
      return;
    }
    
    // Create full audit event
    const fullEvent: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Audit event', fullEvent);
    }
    
    // Track in telemetry
    telemetry.trackEvent('audit_event', {
      id: fullEvent.id,
      timestamp: fullEvent.timestamp,
      actor: fullEvent.actor.id,
      action: fullEvent.action,
      category: fullEvent.category,
      severity: fullEvent.severity,
      outcome: fullEvent.outcome
    });
    
    // Log to file if enabled
    if (this.logToFile) {
      this.writeToFile(fullEvent);
    }
    
    // In a real implementation, we would also persist to a database
    // for searchable, indexed audit logs
  }
  
  /**
   * Write audit event to file
   */
  private writeToFile(event: AuditEvent): void {
    try {
      // Create log file name based on date
      const date = new Date().toISOString().split('T')[0];
      const filePath = path.join(this.logDir, `audit-${date}.log`);
      
      // Convert event to string
      const eventStr = JSON.stringify(event);
      
      // Add tamper-proof signature if enabled
      let logLine = eventStr;
      
      if (this.tamperProof) {
        const hmac = crypto.createHmac('sha256', this.hmacKey);
        hmac.update(eventStr);
        const signature = hmac.digest('hex');
        
        logLine = `${eventStr}|${signature}`;
      }
      
      // Append to log file
      fs.appendFileSync(filePath, logLine + '\n');
    } catch (error) {
      logger.error('Failed to write audit log to file', error);
    }
  }
  
  /**
   * Verify the integrity of audit log files
   */
  verifyLogIntegrity(filePath: string): { valid: boolean; invalidEntries: number } {
    if (!this.tamperProof) {
      throw new Error('Tamper-proof logging is not enabled');
    }
    
    try {
      // Read file
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      let invalidEntries = 0;
      
      // Verify each line
      for (const line of lines) {
        const [eventStr, signature] = line.split('|');
        
        if (!eventStr || !signature) {
          invalidEntries++;
          continue;
        }
        
        // Calculate HMAC
        const hmac = crypto.createHmac('sha256', this.hmacKey);
        hmac.update(eventStr);
        const calculatedSignature = hmac.digest('hex');
        
        // Compare signatures
        if (calculatedSignature !== signature) {
          invalidEntries++;
        }
      }
      
      return {
        valid: invalidEntries === 0,
        invalidEntries
      };
    } catch (error) {
      logger.error('Failed to verify audit log integrity', error);
      return {
        valid: false,
        invalidEntries: -1
      };
    }
  }
  
  /**
   * Search audit logs (in a real implementation, this would query a database)
   */
  search(query: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    category?: AuditCategory;
    severity?: AuditSeverity;
    action?: string;
    outcome?: 'success' | 'failure';
  }): AuditEvent[] {
    // In a real implementation, this would query a database
    // For now, we'll just return an empty array
    logger.info('Audit log search not implemented in file-based logger');
    return [];
  }
}

// Create singleton instance
export const auditLogger = new AuditLogger();
export default auditLogger;