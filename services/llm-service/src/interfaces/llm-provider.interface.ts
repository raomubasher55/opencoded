import { LlmConfig } from '@opencode/shared-types';

/**
 * Common message format for LLM requests
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Tool definition for LLM function calling
 */
export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * Options for LLM completion
 */
export interface LlmCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  tools?: LlmTool[];
  toolChoice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
  stream?: boolean;
}

/**
 * LLM completion response
 */
export interface LlmCompletionResponse {
  id: string;
  model: string;
  content: string;
  finishReason: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Interface for all LLM providers
 */
export interface LlmProvider {
  /**
   * Initialize the provider with configuration
   */
  initialize(config: LlmConfig): Promise<void>;
  
  /**
   * Get available models from this provider
   */
  getAvailableModels(): Promise<string[]>;
  
  /**
   * Get the currently configured model
   */
  getCurrentModel(): string;
  
  /**
   * Create a completion
   */
  createCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions
  ): Promise<LlmCompletionResponse>;
  
  /**
   * Create a streaming completion
   */
  createStreamingCompletion(
    messages: LlmMessage[],
    options: LlmCompletionOptions,
    onContent: (content: string) => void,
    onToolCall?: (toolCall: any) => void,
    onFinish?: (response: Partial<LlmCompletionResponse>) => void
  ): Promise<void>;
  
  /**
   * Count tokens in messages
   */
  countTokens(messages: LlmMessage[]): number;
}