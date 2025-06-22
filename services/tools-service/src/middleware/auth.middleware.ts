import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT secret key from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';

// In production, we should never use a default secret
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'default_jwt_secret') {
  console.error('WARNING: Using default JWT secret in production. This is insecure!');
  console.error('Set the JWT_SECRET environment variable to a secure random string.');
}

// Extend Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  // Get the token from the header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication token is required' });
    return;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      id: string; 
      email: string; 
      role: string;
    };
    
    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to require admin role
 * Must be used after authenticateJWT
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin privileges required' });
    return;
  }

  next();
};

// The requireAdmin middleware is already defined above