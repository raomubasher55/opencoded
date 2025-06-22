// Custom type declarations for Anthropic SDK
// These match the implementation we've created but may differ from the actual SDK

declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(options: { apiKey: string });
    
    messages: {
      create(params: MessageCreateParams): Promise<MessageResponse>;
    };
  }
  
  export interface MessageCreateParams {
    model: string;
    messages: MessageParam[];
    max_tokens?: number;
    temperature?: number;
    stop_sequences?: string[];
    stream?: boolean;
    tools?: Tool[];
  }
  
  export interface MessageParam {
    role: 'assistant' | 'user';
    content: string | ContentBlock[];
  }
  
  export interface ContentBlock {
    type: string;
    text?: string;
    tool_use_id?: string;
    content?: string;
    id?: string;
    name?: string;
    input?: any;
  }
  
  export interface ToolUseBlock extends ContentBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: any;
  }
  
  export interface Tool {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }
  
  export interface MessageResponse {
    id: string;
    model: string;
    content: ContentBlock[];
    stop_reason?: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  }
}