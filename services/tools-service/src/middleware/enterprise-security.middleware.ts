import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createServiceLogger } from '@opencode/shared-utils';
import telemetry from '../utils/telemetry';

const logger = createServiceLogger('enterprise-security');

/**
 * Security level enum for enterprise features
 */
export enum SecurityLevel {
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum'
}

/**
 * Enhanced security middleware for enterprise deployments
 */
export class EnterpriseSecurityMiddleware {
  /**
   * Enhanced security headers middleware
   * @param level Security level
   */
  static securityHeaders = (level: SecurityLevel = SecurityLevel.STANDARD) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Common security headers for all levels
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Add more restrictive headers based on security level
      if (level === SecurityLevel.HIGH || level === SecurityLevel.MAXIMUM) {
        // Content Security Policy
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
        
        // Strict Transport Security
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        
        // Referrer Policy
        res.setHeader('Referrer-Policy', 'no-referrer');
      }
      
      // Maximum security adds additional headers
      if (level === SecurityLevel.MAXIMUM) {
        // Cache control
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        
        // Add Feature-Policy
        res.setHeader('Feature-Policy', "camera 'none'; microphone 'none'; geolocation 'none'");
        
        // Add Cross-Origin headers
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      }
      
      next();
    };
  };
  
  /**
   * IP-based access control
   * @param allowedIPs Array of allowed IP addresses or CIDR blocks
   */
  static ipRestriction = (allowedIPs: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip in development environment
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_IP_CHECK === 'true') {
        return next();
      }
      
      const clientIP = req.ip || req.connection.remoteAddress || '';
      
      // Check if client IP is in allowed list
      const isAllowed = allowedIPs.some(allowedIP => {
        // Exact match
        if (allowedIP === clientIP) {
          return true;
        }
        
        // CIDR match
        if (allowedIP.includes('/')) {
          // In a real implementation, we would use a proper CIDR matching library
          // This is simplified for example purposes
          return allowedIP.startsWith(clientIP.split('.').slice(0, 2).join('.'));
        }
        
        return false;
      });
      
      if (!isAllowed) {
        logger.warn(`IP access denied: ${clientIP}`);
        telemetry.trackEvent('security_violation', {
          type: 'ip_restriction',
          ip: clientIP,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          message: 'Access denied from your IP address'
        });
      }
      
      next();
    };
  };
  
  /**
   * API key validation middleware for machine-to-machine communication
   */
  static apiKeyAuth = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for API key in header
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          message: 'API key is required'
        });
      }
      
      // In a real implementation, this would validate against database
      // For now, we'll check against environment variable
      const validApiKey = process.env.API_KEY;
      
      if (apiKey !== validApiKey) {
        logger.warn(`Invalid API key used`);
        telemetry.trackEvent('security_violation', {
          type: 'invalid_api_key',
          path: req.path
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }
      
      next();
    };
  };
  
  /**
   * Request validation and sanitization
   */
  static sanitizeRequests = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set a maximum allowed payload size
      const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
      
      // Check request body size
      if (req.headers['content-length'] && parseInt(req.headers['content-length']) > MAX_PAYLOAD_SIZE) {
        return res.status(413).json({
          success: false,
          message: 'Request payload too large'
        });
      }
      
      // Basic sanitization of request parameters
      const sanitizeValue = (value: any): any => {
        if (typeof value === 'string') {
          // Sanitize strings to prevent injection attacks
          return value
            .replace(/[<>]/g, '') // Remove angle brackets to prevent HTML injection
            .replace(/[\\'\"]\\s*\\w+\\s*[\\(]/g, '') // Remove potential script execution
            .trim();
        } else if (typeof value === 'object' && value !== null) {
          // Recursively sanitize objects and arrays
          if (Array.isArray(value)) {
            return value.map(item => sanitizeValue(item));
          } else {
            const sanitized: Record<string, any> = {};
            for (const [key, val] of Object.entries(value)) {
              sanitized[key] = sanitizeValue(val);
            }
            return sanitized;
          }
        }
        
        // Return other types as-is
        return value;
      };
      
      // Sanitize request parameters
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
      }
      
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeValue(req.query);
      }
      
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeValue(req.params);
      }
      
      next();
    };
  };
  
  /**
   * Data encryption middleware for sensitive fields
   */
  static encryptSensitiveData = (sensitiveFields: string[]) => {
    // Encryption key should be stored securely in a real implementation
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-for-development';
    
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }
      
      // Create cipher for encryption
      const createCipher = () => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
        return { cipher, iv };
      };
      
      // Encrypt data
      const encrypt = (data: string): { encrypted: string, iv: string } => {
        const { cipher, iv } = createCipher();
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return {
          encrypted,
          iv: iv.toString('hex')
        };
      };
      
      // Encrypt sensitive fields
      for (const field of sensitiveFields) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          const { encrypted, iv } = encrypt(req.body[field]);
          
          // Replace with encrypted value and store IV
          req.body[field] = encrypted;
          req.body[`${field}_iv`] = iv;
          req.body[`${field}_encrypted`] = true;
        }
      }
      
      next();
    };
  };
  
  /**
   * Payload Integrity middleware using HMAC
   */
  static verifyPayloadIntegrity = () => {
    // Secret key should be stored securely in a real implementation
    const secretKey = process.env.HMAC_SECRET || 'default-hmac-secret-for-development';
    
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for signature header
      const signature = req.headers['x-signature'] as string;
      
      if (!signature) {
        // Skip validation if no signature provided
        return next();
      }
      
      // Get raw body from request
      const rawBody = JSON.stringify(req.body);
      
      // Calculate HMAC
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(rawBody);
      const calculatedSignature = hmac.digest('hex');
      
      // Verify signature using constant-time comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );
      
      if (!isValid) {
        logger.warn('Invalid payload signature');
        telemetry.trackEvent('security_violation', {
          type: 'invalid_signature',
          path: req.path
        });
        
        return res.status(400).json({
          success: false,
          message: 'Invalid payload signature'
        });
      }
      
      next();
    };
  };
  
  /**
   * Enhanced security logging middleware
   */
  static securityLogging = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log security-relevant information
      const securityLog = {
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        method: req.method,
        path: req.path,
        query: req.query,
        headers: {
          userAgent: req.headers['user-agent'],
          contentType: req.headers['content-type'],
          authorization: req.headers.authorization ? 'REDACTED' : undefined,
          origin: req.headers.origin,
          referer: req.headers.referer
        },
        userId: req.user?.id
      };
      
      // Log security information
      logger.info('Security log', securityLog);
      
      // Track security event
      telemetry.trackEvent('security_log', securityLog);
      
      next();
    };
  };
}

export const enterpriseSecurityMiddleware = EnterpriseSecurityMiddleware;
export default EnterpriseSecurityMiddleware;