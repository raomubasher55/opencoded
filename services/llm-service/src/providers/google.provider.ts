import { LlmConfig } from '@opencode/shared-types';
import { createServiceLogger } from '@opencode/shared-utils';
import {
  LlmProvider,
  LlmMessage,
  LlmCompletionOptions,
  LlmCompletionResponse,
  LlmTool
} from '../interfaces/llm-provider.interface';
import axios, { AxiosInstance } from 'axios';

const logger = createServiceLogger('google-provider');

/**
 * Google Gemini provider implementation
 */
export class GoogleProvider implements LlmProvider {
  private client: AxiosInstance | null = null;
  private config: LlmConfig | null = null;
  private readonly baseURL = 'https://generativelanguage.googleapis.com/v1beta';
  private defaultModel = 'gemini-1.5-pro';
  
  /**
   * Initialize the Google Gemini client
   */
  async initialize(config: LlmConfig): Promise<void> {
    try {
      if (!config.apiKey) {
        throw new Error('Google API key is required');
      }
      
      this.client = axios.create({
        baseURL: this.baseURL,
        params: {
          key: config.apiKey
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      this.config = config;
      logger.info(`Google provider initialized with model ${this.getCurrentModel()}`);
    } catch (error) {
      logger.error('Error initializing Google provider', error);
      throw error;
    }
  }
  
  /**
   * Get the current model
   */
  getCurrentModel(): string {
    return this.config?.model || this.defaultModel;
  }
  
  /**
   * Check if provider is configured and ready
   */
  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }
  
  /**
   * Create a completion
   */
  async createCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions
  ): Promise<LlmCompletionResponse> {
    if (!this.client) {
      throw new Error('Google provider not initialized');
    }
    
    try {
      const payload = {
        contents: this.convertMessages(messages),
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.95,
          topK: 40,
          candidateCount: 1
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };

      // Add tools if provided
      if (options?.tools && options.tools.length > 0) {
        payload['tools'] = [{
          functionDeclarations: this.convertTools(options.tools)
        }];
      }
      
      logger.debug('Creating Google completion', { 
        model: this.getCurrentModel(),
        messageCount: messages.length,
        hasTools: !!options?.tools
      });
      
      const response = await this.client.post(
        `/models/${this.getCurrentModel()}:generateContent`,
        payload
      );
      
      return this.parseResponse(response.data);
    } catch (error: any) {
      logger.error('Error creating Google completion', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        throw new Error(`Google API error: ${errorMessage}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Create a streaming completion
   */
  async createStreamingCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LlmCompletionResponse> {
    if (!this.client) {
      throw new Error('Google provider not initialized');
    }
    
    try {
      const payload = {
        contents: this.convertMessages(messages),
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.95,
          topK: 40,
          candidateCount: 1
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };
      
      logger.debug('Creating Google streaming completion', { 
        model: this.getCurrentModel(),
        messageCount: messages.length
      });
      
      const response = await this.client.post(
        `/models/${this.getCurrentModel()}:streamGenerateContent`,
        payload,
        {
          responseType: 'stream'
        }
      );
      
      return new Promise((resolve, reject) => {
        let fullContent = '';
        let buffer = '';
        
        response.data.on('data', (chunk: Buffer) => {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          // Parse streaming JSON responses
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                const candidate = parsed.candidates?.[0];
                const content = candidate?.content?.parts?.[0]?.text;
                
                if (content) {
                  fullContent += content;
                  if (onChunk) {
                    onChunk(content);
                  }
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        });
        
        response.data.on('end', () => {
          resolve({
            content: fullContent,
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0
            },
            model: this.getCurrentModel(),
            finishReason: 'stop'
          });
        });
        
        response.data.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error: any) {
      logger.error('Error creating Google streaming completion', error);
      throw error;
    }
  }
  
  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Google provider not initialized');
    }
    
    try {
      const response = await this.client.get('/models');
      return response.data.models
        .filter((model: any) => model.name.includes('gemini'))
        .map((model: any) => model.name.replace('models/', ''));
    } catch (error) {
      logger.error('Error fetching Google models', error);
      
      // Return common Gemini models as fallback
      return [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro',
        'gemini-pro-vision'
      ];
    }
  }
  
  /**
   * Convert internal messages to Google format
   */
  private convertMessages(messages: LlmMessage[]): any[] {
    const contents: any[] = [];
    
    for (const msg of messages) {
      // Map roles: assistant -> model, user -> user, system -> user (with system prefix)
      let role = msg.role;
      let content = msg.content;
      
      if (role === 'assistant') {
        role = 'model';
      } else if (role === 'system') {
        role = 'user';
        content = `System: ${content}`;
      }
      
      contents.push({
        role,
        parts: [{ text: content }]
      });
    }
    
    return contents;
  }
  
  /**
   * Convert internal tools to Google format
   */
  private convertTools(tools: LlmTool[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters?.properties || {},
        required: tool.parameters?.required || []
      }
    }));
  }
  
  /**
   * Parse Google API response
   */
  private parseResponse(data: any): LlmCompletionResponse {
    const candidate = data.candidates?.[0];
    
    if (!candidate) {
      throw new Error('Invalid response from Google API');
    }
    
    const content = candidate.content?.parts?.[0]?.text || '';
    const finishReason = this.mapFinishReason(candidate.finishReason);
    
    // Extract function calls if present
    let toolCalls: any[] | undefined;
    const functionCall = candidate.content?.parts?.find((part: any) => part.functionCall);
    if (functionCall) {
      toolCalls = [{
        id: `call_${Date.now()}`,
        type: 'function',
        function: {
          name: functionCall.functionCall.name,
          arguments: JSON.stringify(functionCall.functionCall.args)
        }
      }];
    }
    
    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model: this.getCurrentModel(),
      finishReason,
      toolCalls
    };
  }
  
  /**
   * Map Google finish reasons to standard format
   */
  private mapFinishReason(reason: string): string {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}