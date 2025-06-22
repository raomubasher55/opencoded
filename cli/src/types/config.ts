export interface OpenCodedConfig {
  apiUrl?: string;
  apiKey?: string;
  api?: {
    url?: string;
    key?: string;
  };
  llm?: {
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