// Custom type definitions to help with OpenAI SDK type issues
// These are simplified versions that match our implementation

declare module 'openai' {
  export default class OpenAI {
    constructor(options: { apiKey: string });
    
    chat: {
      completions: {
        create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
      }
    };
    
    models: {
      list(): Promise<{ data: Array<{ id: string }> }>;
    };
  }
  
  export interface ChatCompletionCreateParams {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    stop?: string[];
    stream?: boolean;
    tools?: any[];
    tool_choice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
  }
  
  export type ChatCompletionMessageParam = {
    role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
    content: string | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      }
    }>;
  };
  
  export interface ChatCompletion {
    id: string;
    model: string;
    choices: Array<{
      message: ChatCompletionMessageParam;
      finish_reason: string;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }
}