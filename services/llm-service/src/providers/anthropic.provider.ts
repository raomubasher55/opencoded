import { LlmConfig } from '@opencode/shared-types';
import { createServiceLogger } from '@opencode/shared-utils';
import {
  LlmProvider,
  LlmMessage,
  LlmCompletionOptions,
  LlmCompletionResponse,
  LlmTool
} from '../interfaces/llm-provider.interface';

const logger = createServiceLogger('anthropic-provider');

// We'll use 'any' for now to make the build pass
type AnthropicClient = any;
type AnthropicMessage = any;
type AnthropicTool = any;

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider implements LlmProvider {
  private client: AnthropicClient | null = null;
  private config: LlmConfig | null = null;
  private defaultModel = 'claude-3-opus-20240229';
  private availableModels = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2'
  ];
  
  /**
   * Initialize the Anthropic client
   */
  async initialize(config: LlmConfig): Promise<void> {
    try {
      if (!config.apiKey) {
        throw new Error('Anthropic API key is required');
      }
      
      // Dynamically import Anthropic to avoid TypeScript issues
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      
      this.client = new Anthropic({
        apiKey: config.apiKey
      });
      
      this.config = config;
      logger.info(`Anthropic provider initialized with model ${this.getCurrentModel()}`);
    } catch (error) {
      logger.error('Error initializing Anthropic provider', error);
      throw error;
    }
  }
  
  /**
   * Get available models from Anthropic
   * Currently returns a hardcoded list as Anthropic doesn't have a models list endpoint
   */
  async getAvailableModels(): Promise<string[]> {
    return [...this.availableModels];
  }
  
  /**
   * Get the current model
   */
  getCurrentModel(): string {
    const model = this.config?.model;
    
    // Check if the specified model is valid
    if (model && this.availableModels.includes(model)) {
      return model;
    }
    
    return this.defaultModel;
  }
  
  /**
   * Create a completion using Anthropic
   */
  async createCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions
  ): Promise<LlmCompletionResponse> {
    try {
      if (!this.client) {
        throw new Error('Anthropic client not initialized');
      }
      
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertToAnthropicMessages(messages);
      
      // Create request options
      const requestOptions: any = {
        model: this.getCurrentModel(),
        messages: anthropicMessages,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature,
        stop_sequences: options?.stopSequences,
        stream: false
      };
      
      // Add tools if specified
      if (options?.tools && options.tools.length > 0) {
        requestOptions.tools = this.convertToAnthropicTools(options.tools);
      }
      
      // Make API call
      const response = await this.client.messages.create(requestOptions);
      
      // Extract content and tool calls
      const textContent = response.content.find((item: any) => item.type === 'text');
      const toolCalls = response.content
        .filter((item: any) => item.type === 'tool_use')
        .map((item: any) => ({
          id: item.id,
          type: 'function',
          function: {
            name: item.name,
            arguments: JSON.stringify(item.input)
          }
        }));
      
      return {
        id: response.id,
        model: response.model,
        content: textContent ? textContent.text : '',
        finishReason: response.stop_reason || 'stop',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };
    } catch (error) {
      logger.error('Error creating Anthropic completion', error);
      throw error;
    }
  }
  
  /**
   * Create a streaming completion using Anthropic
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
        throw new Error('Anthropic client not initialized');
      }
      
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertToAnthropicMessages(messages);
      
      // Create request options
      const requestOptions: any = {
        model: this.getCurrentModel(),
        messages: anthropicMessages,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature,
        stop_sequences: options?.stopSequences,
        stream: true
      };
      
      // Add tools if specified
      if (options?.tools && options.tools.length > 0) {
        requestOptions.tools = this.convertToAnthropicTools(options.tools);
      }
      
      // Track content and tool calls for concatenation
      let fullContent = '';
      const toolCalls: Record<string, any> = {};
      let responseId = '';
      let responseModel = '';
      let finishReason = '';
      
      // Make streaming API call
      const stream = await this.client.messages.create(requestOptions);
      
      for await (const chunk of stream) {
        // If no ID yet, set it
        if (!responseId && chunk.id) {
          responseId = chunk.id;
        }
        
        // If no model yet, set it
        if (!responseModel && chunk.model) {
          responseModel = chunk.model;
        }
        
        // Process content delta
        if (chunk.delta?.type === 'text_delta') {
          fullContent += chunk.delta.text;
          onContent(chunk.delta.text);
        }
        
        // Process tool use
        if (chunk.delta?.type === 'tool_use') {
          const toolDelta = chunk.delta;
          
          // Find or create tool call in our tracking object
          if (!toolCalls[toolDelta.id]) {
            toolCalls[toolDelta.id] = {
              id: toolDelta.id,
              type: 'function',
              function: {
                name: toolDelta.name,
                arguments: ''
              }
            };
          }
          
          // Update function arguments if present
          if (toolDelta.input) {
            // For Anthropic, we need to build the JSON object piece by piece
            const existingArgs = toolCalls[toolDelta.id].function.arguments;
            let updatedArgs = existingArgs;
            
            try {
              // If existing args is valid JSON, parse it
              const existingObj = existingArgs ? JSON.parse(existingArgs) : {};
              
              // Merge with new properties
              const mergedObj = { ...existingObj, ...toolDelta.input };
              
              // Stringify the result
              updatedArgs = JSON.stringify(mergedObj);
            } catch (e) {
              // If parsing fails, just use the new input
              updatedArgs = JSON.stringify(toolDelta.input);
            }
            
            toolCalls[toolDelta.id].function.arguments = updatedArgs;
          }
          
          // Call the handler with the current state of the tool call
          if (onToolCall) {
            onToolCall(toolCalls[toolDelta.id]);
          }
        }
        
        // Capture finish reason
        if (chunk.stop_reason) {
          finishReason = chunk.stop_reason;
        }
      }
      
      // Call onFinish with the complete response
      if (onFinish) {
        onFinish({
          id: responseId,
          model: responseModel,
          content: fullContent,
          finishReason,
          toolCalls: Object.values(toolCalls)
        });
      }
    } catch (error) {
      logger.error('Error creating Anthropic streaming completion', error);
      throw error;
    }
  }
  
  /**
   * Count tokens in messages
   * This is a simplified estimation, actual token count may vary
   */
  countTokens(messages: LlmMessage[]): number {
    // Use a simplified token counting method
    // For more accurate counts, Anthropic recommends sending a countTokens request
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
   * Convert messages to Anthropic format
   */
  private convertToAnthropicMessages(messages: LlmMessage[]): AnthropicMessage[] {
    return messages.map(message => {
      if (message.role === 'tool') {
        // Tool responses are different in Anthropic
        return {
          role: 'assistant',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId || '',
              content: message.content
            }
          ]
        };
      }
      
      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      };
    });
  }
  
  /**
   * Convert tools to Anthropic format
   */
  private convertToAnthropicTools(tools: LlmTool[]): AnthropicTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    }));
  }
}