import dotenv from 'dotenv';
import { createServiceLogger } from '@opencode/shared-utils';

// Load environment variables
dotenv.config();

const logger = createServiceLogger('config');

// Service configuration interface
interface ServiceConfig {
  port: number;
  environment: string;
  jwtSecret: string;
  logLevel: string;
  mongoUri: string;
  redisUri?: string;
  defaultMaxSessions: number;
  defaultMaxMessagesPerSession: number;
  defaultMaxTokensPerMessage: number;
  sessionTtlDays: number;
}

// Load configuration from environment
export const config: ServiceConfig = {
  port: parseInt(process.env.PORT || '4004', 10),
  environment: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_do_not_use_in_production',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Database configuration
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/opencode-sessions',
  redisUri: process.env.REDIS_URI,
  
  // Session limits
  defaultMaxSessions: parseInt(process.env.DEFAULT_MAX_SESSIONS || '50', 10),
  defaultMaxMessagesPerSession: parseInt(process.env.DEFAULT_MAX_MESSAGES_PER_SESSION || '100', 10),
  defaultMaxTokensPerMessage: parseInt(process.env.DEFAULT_MAX_TOKENS_PER_MESSAGE || '4000', 10),
  sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS || '30', 10)
};

// Log configuration (omitting sensitive values)
logger.info('Service configuration loaded', {
  port: config.port,
  environment: config.environment,
  usingRedis: !!config.redisUri
});

// Export config
export default config;