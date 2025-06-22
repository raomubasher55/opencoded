import fs from 'fs';
import path from 'path';
import os from 'os';

// Define the configuration interface
export interface OpenCodedConfig {
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

// Path to global config file
const CONFIG_DIR = path.join(os.homedir(), '.opencoded');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Simple config management with file-based storage
 */
class SimpleConfig {
  private data: OpenCodedConfig;
  
  constructor() {
    this.data = this.loadFromFile() || { ...defaultConfig };
  }
  
  /**
   * Load config from file
   */
  private loadFromFile(): OpenCodedConfig | null {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${CONFIG_FILE}`);
    }
    return null;
  }
  
  /**
   * Save config to file
   */
  private saveToFile(): void {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Warning: Failed to save config to ${CONFIG_FILE}`);
    }
  }
  
  /**
   * Get config value
   */
  get<K extends keyof OpenCodedConfig>(key: K): OpenCodedConfig[K] {
    return this.data[key];
  }
  
  /**
   * Set config value
   */
  set<K extends keyof OpenCodedConfig>(key: K, value: OpenCodedConfig[K]): void {
    this.data[key] = value;
    this.saveToFile();
  }
  
  /**
   * Get all config data
   */
  get store(): OpenCodedConfig {
    return { ...this.data };
  }
}

// Initialize configuration store
const configStore = new SimpleConfig();

/**
 * Load configuration from multiple sources:
 * 1. Global config (~/.opencoded/config.json)
 * 2. Project config (.opencoded/config.json)
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
    configStore.set(key as keyof OpenCodedConfig, value as any);
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