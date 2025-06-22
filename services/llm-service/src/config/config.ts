import dotenv from 'dotenv';
import { createServiceLogger } from '@opencode/shared-utils';
import { LlmConfig } from '@opencode/shared-types';

// Load environment variables
dotenv.config();

const logger = createServiceLogger('config');

// Service configuration interface
interface ServiceConfig {
  port: number;
  environment: string;
  jwtSecret: string;
  logLevel: string;
  defaultProvider: {
    name: string;
    model: string;
    apiKey?: string;
  };
  openai: {
    apiKey?: string;
    defaultModel: string;
    organizationId?: string;
  };
  anthropic: {
    apiKey?: string;
    defaultModel: string;
  };
  google: {
    apiKey?: string;
    defaultModel: string;
  };
  openrouter: {
    apiKey?: string;
    defaultModel: string;
  };
  bedrock: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    defaultModel: string;
  };
}

// Load configuration from environment
export const config: ServiceConfig = {
  port: parseInt(process.env.PORT || '4002', 10),
  environment: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_do_not_use_in_production',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Default provider configuration
  defaultProvider: {
    name: process.env.DEFAULT_LLM_PROVIDER || 'simulation',
    model: process.env.DEFAULT_LLM_MODEL || 'simulation-basic',
    apiKey: process.env.DEFAULT_LLM_API_KEY,
  },
  
  // Provider-specific configurations
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
    organizationId: process.env.OPENAI_ORGANIZATION_ID,
  },
  
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-opus-20240229',
  },
  
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
    defaultModel: process.env.GOOGLE_DEFAULT_MODEL || 'gemini-1.5-pro',
  },
  
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4-turbo',
  },
  
  bedrock: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    defaultModel: process.env.BEDROCK_DEFAULT_MODEL || 'anthropic.claude-v2',
  }
};

// Log configuration (omitting sensitive values)
logger.info('Service configuration loaded', {
  port: config.port,
  environment: config.environment,
  defaultProvider: config.defaultProvider.name,
  defaultModel: config.defaultProvider.model,
});

/**
 * Get provider-specific configuration
 */
export function getProviderConfig(provider: string): LlmConfig {
  const providerName = provider.toLowerCase();
  
  switch (providerName) {
    case 'openai':
      return {
        provider: 'openai',
        model: config.openai.defaultModel,
        apiKey: config.openai.apiKey,
        options: {
          organizationId: config.openai.organizationId
        }
      };
      
    case 'anthropic':
      return {
        provider: 'anthropic',
        model: config.anthropic.defaultModel,
        apiKey: config.anthropic.apiKey
      };
      
    case 'google':
      return {
        provider: 'google',
        model: config.google.defaultModel,
        apiKey: config.google.apiKey
      };
      
    case 'openrouter':
      return {
        provider: 'openrouter',
        model: config.openrouter.defaultModel,
        apiKey: config.openrouter.apiKey
      };
      
    case 'bedrock':
      return {
        provider: 'bedrock',
        model: config.bedrock.defaultModel,
        options: {
          region: config.bedrock.region,
          accessKeyId: config.bedrock.accessKeyId,
          secretAccessKey: config.bedrock.secretAccessKey
        }
      };
      
    default:
      // Default to the configured default provider
      return {
        provider: config.defaultProvider.name as 'openai' | 'anthropic' | 'google' | 'openrouter' | 'bedrock',
        model: config.defaultProvider.model,
        apiKey: config.defaultProvider.apiKey
      };
  }
}