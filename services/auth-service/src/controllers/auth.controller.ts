import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('auth-controller');

// Create a singleton instance of the AuthService
const authService = new AuthService();

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = req.body;
    const result = await authService.register(username, email, password);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Login attempt for email: ${req.body.email}`);
    
    // Check for required fields
    const { email, password } = req.body;
    if (!email || !password) {
      logger.warn('Login attempt missing email or password');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Email and password are required' 
      });
    }

    // Attempt login with additional logging
    logger.info('Calling auth service login method');
    const result = await authService.login(email, password);
    
    logger.info('Login successful, sending response');
    return res.status(200).json(result);
  } catch (error: any) {
    // Log the error with stack trace
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    
    // Return a structured error response instead of using next(error)
    // This ensures we always send a response
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An unexpected error occurred during login',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
};

export const generateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    const { name } = req.body;
    const apiKey = await authService.generateApiKey(userId, name);
    res.status(201).json(apiKey);
  } catch (error) {
    next(error);
  }
};

/**
 * Handle OAuth callback
 * This controller is called after successful OAuth authentication
 */
export const oauthCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // User will be attached to request by Passport after successful authentication
    const user = req.user as any;
    
    if (!user) {
      logger.error('OAuth callback called without user');
      return res.status(401).json({ message: 'Authentication failed' });
    }
    
    // Generate tokens for the authenticated user
    const userId = user.id || user._id.toString();
    const tokens = await authService.generateTokensForOAuth(userId);
    
    // Redirect to frontend with tokens
    // In production, you might want to use a more secure method to transfer tokens
    const redirectUrl = process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/oauth-success';
    res.redirect(`${redirectUrl}?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  } catch (error) {
    logger.error('Error in OAuth callback', error);
    next(error);
  }
};