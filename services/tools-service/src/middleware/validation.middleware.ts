import { Request, Response, NextFunction } from 'express';

/**
 * Basic request validation middleware
 * Validates request body exists for POST and PUT requests
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  if ((req.method === 'POST' || req.method === 'PUT') && !req.body) {
    res.status(400).json({ success: false, message: 'Request body is required' });
    return;
  }

  next();
};

/**
 * Validate specific fields are present in the request body
 * @param requiredFields Array of required field names
 */
export const validateFields = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body) {
      res.status(400).json({ success: false, message: 'Request body is required' });
      return;
    }

    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
      return;
    }

    next();
  };
};

/**
 * Sanitize request body to prevent XSS attacks
 * This is a very basic implementation - in production you would use a library like xss
 */
export const sanitizeBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    // Simple recursive function to sanitize strings in an object
    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Basic sanitization - remove <script> tags
          result[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .trim();
        } else {
          result[key] = sanitize(value);
        }
      }
      
      return result;
    };

    req.body = sanitize(req.body);
  }

  next();
};

/**
 * Rate limiting middleware
 * This is a very basic in-memory implementation
 * In production, you would use Redis or another store to track requests
 */
const requestCounts: Record<string, { count: number, resetTime: number }> = {};

export const rateLimit = (maxRequests: number, timeWindowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Get client IP or user ID if authenticated
    const clientId = req.user?.id || req.ip || 'unknown';
    const now = Date.now();
    
    // Initialize or reset counter if needed
    if (!requestCounts[clientId] || now > requestCounts[clientId].resetTime) {
      requestCounts[clientId] = {
        count: 0,
        resetTime: now + timeWindowMs
      };
    }
    
    // Increment request count
    requestCounts[clientId].count++;
    
    // Check if limit exceeded
    if (requestCounts[clientId].count > maxRequests) {
      res.status(429).json({ 
        success: false, 
        message: 'Rate limit exceeded. Please try again later.' 
      });
      return;
    }
    
    next();
  };
};