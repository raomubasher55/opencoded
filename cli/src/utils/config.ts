import fs from 'fs';
import path from 'path';
import os from 'os';
import Conf from 'conf';

interface OpenCodedConfig {
  apiUrl?: string;
  apiKey?: string;
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
  };
  ui?: {
    theme: 'light' | 'dark' | 'system';
    fontFamily?: string;
    fontSize?: number;
  };
}

// Default configuration
const defaultConfig: OpenCodedConfig = {
  apiUrl: 'http://localhost:8080',
  llm: {
    provider: 'openai',
    model: 'gpt-4'
  },
  ui: {
    theme: 'system'
  }
};

// Initialize configuration store
const configStore = new Conf({
  projectName: 'opencoded',
  defaults: defaultConfig
});

/**
 * Load configuration from multiple sources:
 * 1. Global config (~/.opencode/config.json)
 * 2. Project config (.opencode/config.json)
 * 3. Environment variables
 */
export function loadConfig(): OpenCodedConfig {
  const config = { ...defaultConfig };

  // Load from config store
  const storeConfig = configStore.store;
  Object.assign(config, storeConfig);

  // Load from project config
  const projectConfig = loadProjectConfig();
  if (projectConfig) {
    Object.assign(config, projectConfig);
  }

  // Load from environment variables
  if (process.env.OPENCODED_API_URL) {
    config.apiUrl = process.env.OPENCODED_API_URL;
  }

  if (process.env.OPENCODED_API_KEY) {
    config.apiKey = process.env.OPENCODED_API_KEY;
  }

  if (process.env.OPENCODED_LLM_PROVIDER) {
    config.llm.provider = process.env.OPENCODED_LLM_PROVIDER;
  }

  if (process.env.OPENCODED_LLM_MODEL) {
    config.llm.model = process.env.OPENCODED_LLM_MODEL;
  }

  if (process.env.OPENCODED_LLM_API_KEY) {
    config.llm.apiKey = process.env.OPENCODED_LLM_API_KEY;
  }

  return config;
}

/**
 * Save configuration to global config
 */
export function saveConfig(config: Partial<OpenCodedConfig>): void {
  Object.entries(config).forEach(([key, value]) => {
    configStore.set(key as keyof OpenCodedConfig, value);
  });
}

/**
 * Load project-specific configuration
 */
export function loadProjectConfig(projectPath = process.cwd()): Partial<OpenCodedConfig> | null {
  const configPath = path.join(projectPath, '.opencoded', 'config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent) as Partial<OpenCodedConfig>;
    } catch (error) {
      console.warn(`Warning: Failed to load project config at ${configPath}`);
      return null;
    }
  }
  
  return null;
}

/**
 * Save project-specific configuration
 */
export function saveProjectConfig(config: Partial<OpenCodedConfig>, projectPath = process.cwd()): void {
  const configDir = path.join(projectPath, '.opencoded');
  const configPath = path.join(configDir, 'config.json');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Merge with existing config if it exists
  let existingConfig: Partial<OpenCodedConfig> = {};
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      existingConfig = JSON.parse(configContent) as Partial<OpenCodedConfig>;
    } catch (error) {
      console.warn(`Warning: Failed to load existing project config at ${configPath}`);
    }
  }
  
  // Merge configs
  const mergedConfig = { ...existingConfig, ...config };
  
  // Save config
  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
}