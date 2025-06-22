import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { AuthTokens } from '@opencode/shared-types';
import { BadRequestError, NotFoundError, UnauthorizedError, createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('auth-service');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

export class AuthService {
  /**
   * Register a new user
   */
  async register(username: string, email: string, password: string) {
    // Check if user already exists
    const existingUser = await UserModel.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      throw new BadRequestError('User with this email or username already exists');
    }

    // Create new user
    const user = new UserModel({
      username,
      email,
      passwordHash: password // Will be hashed by the pre-save hook
    });

    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      ...tokens
    };
  }

  /**
   * Login a user
   */
  async login(email: string, password: string) {
    try {
      logger.info(`Attempting to find user with email: ${email}`);
      
      // Find user by email
      const user = await UserModel.findOne({ email });
      if (!user) {
        logger.warn(`No user found with email: ${email}`);
        throw new NotFoundError('User not found');
      }
      
      logger.info(`User found, verifying password`);
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.warn(`Invalid password for user: ${email}`);
        throw new UnauthorizedError('Invalid credentials');
      }
      
      logger.info(`Password verified for user: ${email}, generating tokens`);
      
      // Generate tokens
      const tokens = await this.generateTokens(user.id);
      
      logger.info(`Tokens generated successfully for user: ${email}`);
      
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        ...tokens
      };
    } catch (error: any) {
      logger.error(`Login error for ${email}: ${error.message}`, { stack: error.stack });
      throw error; // Re-throw to be handled by the controller
    }
  }

  /**
   * Refresh an authentication token
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    // Verify refresh token
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Find user
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate new tokens
    return await this.generateTokens(user.id);
  }

  /**
   * Generate API key for a user
   */
  async generateApiKey(userId: string, name: string) {
    if (!name) {
      throw new BadRequestError('API key name is required');
    }

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate API key
    const apiKey = user.generateApiKey(name);
    await user.save();

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key,
      createdAt: apiKey.createdAt
    };
  }

  /**
   * Generate tokens for OAuth authenticated user
   */
  async generateTokensForOAuth(userId: string): Promise<AuthTokens> {
    // Find user to ensure they exist
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate tokens
    return await this.generateTokens(userId);
  }

  /**
   * Helper function to generate JWT tokens
   */
  private async generateTokens(userId: string): Promise<AuthTokens> {
    // Get the user to include role in token
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const payload = { 
      userId, 
      role: user.role || 'user' // Default to user if no role is set
    };
    
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY
    });

    const refreshToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY
    });

    // Convert expiry string like '15m' to seconds
    let expiresIn = 900; // Default 15 minutes in seconds
    if (ACCESS_TOKEN_EXPIRY.endsWith('m')) {
      expiresIn = parseInt(ACCESS_TOKEN_EXPIRY) * 60;
    } else if (ACCESS_TOKEN_EXPIRY.endsWith('s')) {
      expiresIn = parseInt(ACCESS_TOKEN_EXPIRY);
    } else if (ACCESS_TOKEN_EXPIRY.endsWith('h')) {
      expiresIn = parseInt(ACCESS_TOKEN_EXPIRY) * 3600;
    } else if (ACCESS_TOKEN_EXPIRY.endsWith('d')) {
      expiresIn = parseInt(ACCESS_TOKEN_EXPIRY) * 86400;
    }

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }
}