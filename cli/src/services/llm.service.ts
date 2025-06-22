import { createServiceLogger } from '@opencode/shared-utils';
import { Message, LlmRequest, LlmConfig } from '@opencode/shared-types';
import axios from 'axios';

const logger = createServiceLogger('llm-service-client');

/**
 * Client for communicating with the LLM service
 */
export class LlmServiceClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;

    // Ensure the API URL doesn't end with a slash
    if (this.apiUrl.endsWith('/')) {
      this.apiUrl = this.apiUrl.slice(0, -1);
    }

    logger.info(`LLM service client initialized with URL: ${this.apiUrl}`);
  }

  /**
   * Get the current LLM configuration from the service
   */
  async getConfig(): Promise<LlmConfig> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/llm/config`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data as LlmConfig;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to get LLM config: ${error.response.data?.message || error.response.statusText}`);
      }
      logger.error('Error getting LLM config', error);
      throw error;
    }
  }

  /**
   * Get available LLM providers
   */
  async getProviders(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/llm/providers`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.providers;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to get LLM providers: ${error.response.data?.message || error.response.statusText}`);
      }
      logger.error('Error getting LLM providers', error);
      throw error;
    }
  }

  /**
   * Get available models for the current provider
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/llm/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.models;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to get LLM models: ${error.response.data?.message || error.response.statusText}`);
      }
      logger.error('Error getting LLM models', error);
      throw error;
    }
  }

  /**
   * Create a completion with the LLM
   */
  async createCompletion(request: LlmRequest): Promise<any> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/llm/completions`, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to create completion: ${error.response.data?.message || error.response.statusText}`);
      }
      logger.error('Error creating completion', error);
      throw error;
    }
  }

  /**
   * Create a streaming completion with the LLM
   * Returns a promise that resolves with the full response when the stream ends
   */
  async createStreamingCompletion(
    request: LlmRequest,
    onContent: (content: string) => void,
    onToolCall?: (toolCall: any) => void
  ): Promise<any> {
    try {
      // Create streaming request
      const response = await axios.post(`${this.apiUrl}/api/llm/completions/stream`, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        responseType: 'stream'
      });

      // Accumulate the full response for when the stream ends
      let fullResponse: any = { content: '' };
      
      // Create a simple implementation for processing the stream
      const stream = response.data;
      let buffer = '';
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          // Convert Buffer to string and add to buffer
          const chunkStr = chunk.toString('utf-8');
          buffer += chunkStr;
          
          // Process complete events
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep the last incomplete chunk
          
          for (const event of events) {
            if (event.startsWith('data: ')) {
              const data = event.substring(6);
              
              if (data === '[DONE]') {
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'content') {
                  fullResponse.content += parsed.content;
                  onContent(parsed.content);
                } 
                else if (parsed.type === 'tool_call' && onToolCall) {
                  fullResponse.toolCalls = fullResponse.toolCalls || [];
                  fullResponse.toolCalls.push(parsed.toolCall);
                  onToolCall(parsed.toolCall);
                }
                else if (parsed.type === 'error') {
                  reject(new Error(parsed.error));
                }
              } catch (error) {
                logger.error('Error parsing SSE data', error);
              }
            }
          }
        });
        
        stream.on('end', () => {
          resolve(fullResponse);
        });
        
        stream.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Failed to create streaming completion: ${error.response.data?.message || error.response.statusText}`);
      }
      logger.error('Error in streaming completion', error);
      throw error;
    }
  }
}