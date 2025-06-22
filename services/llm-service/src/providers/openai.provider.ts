import { LlmConfig } from '@opencode/shared-types';
import { createServiceLogger } from '@opencode/shared-utils';
import {
  LlmProvider,
  LlmMessage,
  LlmCompletionOptions,
  LlmCompletionResponse,
  LlmTool
} from '../interfaces/llm-provider.interface';

const logger = createServiceLogger('openai-provider');

// We'll use 'any' for now to make the build pass
type OpenAIClient = any;
type OpenAIMessage = any;
type OpenAITool = any;

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LlmProvider {
  private client: OpenAIClient | null = null;
  private config: LlmConfig | null = null;
  private defaultModel = 'gpt-4';
  
  /**
   * Initialize the OpenAI client
   */
  async initialize(config: LlmConfig): Promise<void> {
    try {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      
      // Dynamically import OpenAI to avoid TypeScript issues
      const { default: OpenAI } = await import('openai');
      
      this.client = new OpenAI({
        apiKey: config.apiKey
      });
      
      this.config = config;
      logger.info(`OpenAI provider initialized with model ${this.getCurrentModel()}`);
    } catch (error) {
      logger.error('Error initializing OpenAI provider', error);
      throw error;
    }
  }
  
  /**
   * Get available models from OpenAI
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }
      
      const response = await this.client.models.list();
      return response.data
        .filter((model: any) => 
          model.id.includes('gpt') || 
          model.id.includes('text-davinci') || 
          model.id.includes('code-davinci')
        )
        .map((model: any) => model.id);
    } catch (error) {
      logger.error('Error fetching OpenAI models', error);
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
   * Create a completion using OpenAI
   */
  async createCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions
  ): Promise<LlmCompletionResponse> {
    try {
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }
      
      // Convert message format for OpenAI
      const openaiMessages = this.convertToOpenAIMessages(messages);
      
      // Create request options
      const requestOptions: any = {
        model: this.getCurrentModel(),
        messages: openaiMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stop: options?.stopSequences,
        stream: false
      };
      
      // Add tools if specified
      if (options?.tools && options.tools.length > 0) {
        requestOptions.tools = options.tools;
        
        if (options.toolChoice) {
          requestOptions.tool_choice = options.toolChoice === 'auto' ? 'auto' : 
            options.toolChoice === 'required' ? 'required' : options.toolChoice;
        }
      }
      
      // Make API call
      const completion = await this.client.chat.completions.create(requestOptions);
      
      // Extract the content and tool calls
      const choice = completion.choices[0];
      const response: LlmCompletionResponse = {
        id: completion.id,
        model: completion.model,
        content: choice.message.content || '',
        finishReason: choice.finish_reason || 'stop',
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0
        }
      };
      
      // Add tool calls if present
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        response.toolCalls = choice.message.tool_calls.map((toolCall: any) => ({
          id: toolCall.id,
          type: toolCall.type,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }
        }));
      }
      
      return response;
    } catch (error) {
      logger.error('Error creating OpenAI completion', error);
      throw error;
    }
  }
  
  /**
   * Create a streaming completion using OpenAI
   */
  async createStreamingCompletion(
    messages: LlmMessage[],
    options: LlmCompletionOptions,
    onContent: (content: string) => void,
    onToolCall?: (toolCall: any) => void,
    onFinish?: (response: Partial<LlmCompletionResponse>) => void
  ): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }
      
      // Convert message format for OpenAI
      const openaiMessages = this.convertToOpenAIMessages(messages);
      
      // Create request options
      const requestOptions: any = {
        model: this.getCurrentModel(),
        messages: openaiMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stop: options?.stopSequences,
        stream: true
      };
      
      // Add tools if specified
      if (options?.tools && options.tools.length > 0) {
        requestOptions.tools = options.tools;
        
        if (options.toolChoice) {
          requestOptions.tool_choice = options.toolChoice === 'auto' ? 'auto' : 
            options.toolChoice === 'required' ? 'required' : options.toolChoice;
        }
      }
      
      // Track content for concatenation
      let fullContent = '';
      let toolCalls: any[] = [];
      let responseId = '';
      let responseModel = '';
      let finishReason = '';
      
      // Make streaming API call
      const stream = await this.client.chat.completions.create(requestOptions);
      
      for await (const chunk of stream) {
        // Get the delta content
        const delta = chunk.choices[0]?.delta;
        
        // If no ID yet, set it
        if (!responseId && chunk.id) {
          responseId = chunk.id;
        }
        
        // If no model yet, set it
        if (!responseModel && chunk.model) {
          responseModel = chunk.model;
        }
        
        // Process content
        if (delta?.content) {
          fullContent += delta.content;
          onContent(delta.content);
        }
        
        // Process tool calls
        if (delta?.tool_calls && delta.tool_calls.length > 0 && onToolCall) {
          for (const toolCall of delta.tool_calls) {
            // Find or create tool call in our tracking array
            let existingToolCall = toolCalls.find((tc: any) => tc.id === toolCall.id);
            
            if (!existingToolCall) {
              existingToolCall = {
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: '',
                  arguments: ''
                }
              };
              toolCalls.push(existingToolCall);
            }
            
            // Update function name if present
            if (toolCall.function?.name) {
              existingToolCall.function.name = toolCall.function.name;
            }
            
            // Append to arguments if present
            if (toolCall.function?.arguments) {
              existingToolCall.function.arguments += toolCall.function.arguments;
            }
            
            // Call the handler with the current state of the tool call
            onToolCall(existingToolCall);
          }
        }
        
        // Capture finish reason
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }
      
      // Call onFinish with the complete response
      if (onFinish) {
        onFinish({
          id: responseId,
          model: responseModel,
          content: fullContent,
          finishReason,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined
        });
      }
    } catch (error) {
      logger.error('Error creating OpenAI streaming completion', error);
      throw error;
    }
  }
  
  /**
   * Count tokens in messages
   * This is a simplified estimation, actual token count may vary
   */
  countTokens(messages: LlmMessage[]): number {
    // Use a simplified token counting method
    // For accurate counts, consider using tiktoken or similar
    let totalTokens = 0;
    
    for (const message of messages) {
      // Base tokens per message (metadata)
      totalTokens += 4;
      
      // Tokens for content (rough estimate: 1 token per 4 chars)
      if (message.content) {
        totalTokens += Math.ceil(message.content.length / 4);
      }
      
      // Tokens for name if present
      if (message.name) {
        totalTokens += 1;
      }
      
      // Tokens for tool calls
      if (message.toolCalls && message.toolCalls.length > 0) {
        for (const toolCall of message.toolCalls) {
          // Function name
          totalTokens += 1;
          
          // Function arguments (JSON string)
          totalTokens += Math.ceil(toolCall.function.arguments.length / 4);
        }
      }
    }
    
    return totalTokens;
  }
  
  /**
   * Convert messages to OpenAI format
   */
  private convertToOpenAIMessages(messages: LlmMessage[]): OpenAIMessage[] {
    return messages.map(message => {
      const openaiMessage: any = {
        role: message.role,
        content: message.content
      };
      
      if (message.name) {
        openaiMessage.name = message.name;
      }
      
      if (message.toolCallId) {
        openaiMessage.tool_call_id = message.toolCallId;
      }
      
      if (message.toolCalls) {
        openaiMessage.tool_calls = message.toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
      }
      
      return openaiMessage;
    });
  }
}