import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('auth-middleware');

// Extend the Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      logger.warn('Missing Authorization header');
      res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Authentication Error', 
        message: 'Authorization header is required' 
      });
      return;
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      logger.warn('Invalid Authorization header format');
      res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Authentication Error', 
        message: 'Invalid Authorization header format' 
      });
      return;
    }
    
    // Verify token
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    logger.error('JWT authentication error', error);
    
    if ((error as Error).name === 'TokenExpiredError') {
      res.status(StatusCodes.UNAUTHORIZED).json({ 
        error: 'Authentication Error', 
        message: 'Token expired' 
      });
      return;
    }
    
    res.status(StatusCodes.UNAUTHORIZED).json({ 
      error: 'Authentication Error', 
      message: 'Invalid token' 
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ 
      error: 'Authentication Error', 
      message: 'User not authenticated' 
    });
    return;
  }
  
  if (req.user.role !== 'admin') {
    res.status(StatusCodes.FORBIDDEN).json({ 
      error: 'Authorization Error', 
      message: 'Admin role required' 
    });
    return;
  }
  
  next();
};