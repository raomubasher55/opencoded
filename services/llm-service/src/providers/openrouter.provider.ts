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

const logger = createServiceLogger('openrouter-provider');

/**
 * OpenRouter provider implementation
 * Supports multiple models through OpenRouter API
 */
export class OpenRouterProvider implements LlmProvider {
  private client: AxiosInstance | null = null;
  private config: LlmConfig | null = null;
  private readonly baseURL = 'https://openrouter.ai/api/v1';
  private defaultModel = 'openai/gpt-4-turbo';
  
  /**
   * Initialize the OpenRouter client
   */
  async initialize(config: LlmConfig): Promise<void> {
    try {
      if (!config.apiKey) {
        throw new Error('OpenRouter API key is required');
      }
      
      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://opencode.dev',
          'X-Title': 'OpenCode IDE'
        }
      });
      
      this.config = config;
      logger.info(`OpenRouter provider initialized with model ${this.getCurrentModel()}`);
    } catch (error) {
      logger.error('Error initializing OpenRouter provider', error);
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
      throw new Error('OpenRouter provider not initialized');
    }
    
    try {
      const payload = {
        model: this.getCurrentModel(),
        messages: this.convertMessages(messages),
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2048,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
        stream: false,
        tools: options?.tools ? this.convertTools(options.tools) : undefined
      };
      
      logger.debug('Creating OpenRouter completion', { 
        model: payload.model,
        messageCount: messages.length,
        hasTools: !!options?.tools
      });
      
      const response = await this.client.post('/chat/completions', payload);
      
      return this.parseResponse(response.data);
    } catch (error: any) {
      logger.error('Error creating OpenRouter completion', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        throw new Error(`OpenRouter API error: ${errorMessage}`);
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
      throw new Error('OpenRouter provider not initialized');
    }
    
    try {
      const payload = {
        model: this.getCurrentModel(),
        messages: this.convertMessages(messages),
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2048,
        top_p: options?.topP || 1,
        frequency_penalty: options?.frequencyPenalty || 0,
        presence_penalty: options?.presencePenalty || 0,
        stream: true,
        tools: options?.tools ? this.convertTools(options.tools) : undefined
      };
      
      logger.debug('Creating OpenRouter streaming completion', { 
        model: payload.model,
        messageCount: messages.length
      });
      
      const response = await this.client.post('/chat/completions', payload, {
        responseType: 'stream'
      });
      
      return new Promise((resolve, reject) => {
        let fullContent = '';
        let buffer = '';
        
        response.data.on('data', (chunk: Buffer) => {
          const chunkStr = chunk.toString();
          buffer += chunkStr;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                
                if (delta?.content) {
                  fullContent += delta.content;
                  if (onChunk) {
                    onChunk(delta.content);
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
      logger.error('Error creating OpenRouter streaming completion', error);
      throw error;
    }
  }
  
  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    if (!this.client) {
      throw new Error('OpenRouter provider not initialized');
    }
    
    try {
      const response = await this.client.get('/models');
      return response.data.data.map((model: any) => model.id);
    } catch (error) {
      logger.error('Error fetching OpenRouter models', error);
      
      // Return common OpenRouter models as fallback
      return [
        'openai/gpt-4-turbo',
        'openai/gpt-4',
        'openai/gpt-3.5-turbo',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
        'anthropic/claude-3-haiku',
        'google/gemini-pro',
        'meta-llama/llama-2-70b-chat',
        'mistralai/mistral-7b-instruct',
        'cohere/command-r-plus'
      ];
    }
  }
  
  /**
   * Convert internal messages to OpenRouter format
   */
  private convertMessages(messages: LlmMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_calls: msg.toolCalls ? this.convertToolCalls(msg.toolCalls) : undefined
    }));
  }
  
  /**
   * Convert internal tools to OpenRouter format
   */
  private convertTools(tools: LlmTool[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }
  
  /**
   * Convert tool calls to OpenRouter format
   */
  private convertToolCalls(toolCalls: any[]): any[] {
    return toolCalls.map(call => ({
      id: call.id,
      type: 'function',
      function: {
        name: call.function.name,
        arguments: call.function.arguments
      }
    }));
  }
  
  /**
   * Parse OpenRouter API response
   */
  private parseResponse(data: any): LlmCompletionResponse {
    const choice = data.choices?.[0];
    
    if (!choice) {
      throw new Error('Invalid response from OpenRouter API');
    }
    
    return {
      content: choice.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model || this.getCurrentModel(),
      finishReason: choice.finish_reason || 'stop',
      toolCalls: choice.message?.tool_calls ? this.parseToolCalls(choice.message.tool_calls) : undefined
    };
  }
  
  /**
   * Parse tool calls from response
   */
  private parseToolCalls(toolCalls: any[]): any[] {
    return toolCalls.map(call => ({
      id: call.id,
      type: call.type,
      function: {
        name: call.function.name,
        arguments: call.function.arguments
      }
    }));
  }
}