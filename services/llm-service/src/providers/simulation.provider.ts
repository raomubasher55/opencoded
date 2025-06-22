import { LlmConfig } from '@opencode/shared-types';
import { createServiceLogger } from '@opencode/shared-utils';
import {
  LlmProvider,
  LlmMessage,
  LlmCompletionOptions,
  LlmCompletionResponse,
  LlmTool
} from '../interfaces/llm-provider.interface';

const logger = createServiceLogger('simulation-provider');

/**
 * Simulation provider for development without API keys
 */
export class SimulationProvider implements LlmProvider {
  private config: LlmConfig | null = null;
  private defaultModel = 'simulation-model';
  
  /**
   * Initialize the simulation
   */
  async initialize(config: LlmConfig): Promise<void> {
    this.config = config;
    logger.info(`Simulation provider initialized with model ${this.getCurrentModel()}`);
  }
  
  /**
   * Get available simulation models
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      'simulation-basic',
      'simulation-advanced',
      'simulation-code-expert'
    ];
  }
  
  /**
   * Get the current model
   */
  getCurrentModel(): string {
    return this.config?.model || this.defaultModel;
  }
  
  /**
   * Create a completion using simulation
   */
  async createCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions
  ): Promise<LlmCompletionResponse> {
    try {
      // Get the last user message to respond to
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      
      // Generate simulated response
      const { content, toolCalls } = this.generateSimulatedResponse(
        lastUserMessage?.content || '',
        options?.tools
      );
      
      // Create response object
      const response: LlmCompletionResponse = {
        id: `sim_${Date.now()}`,
        model: this.getCurrentModel(),
        content,
        finishReason: 'stop',
        usage: {
          promptTokens: this.countTokens(messages),
          completionTokens: Math.ceil(content.length / 4),
          totalTokens: this.countTokens(messages) + Math.ceil(content.length / 4)
        }
      };
      
      // Add tool calls if generated
      if (toolCalls && toolCalls.length > 0) {
        response.toolCalls = toolCalls;
      }
      
      return response;
    } catch (error) {
      logger.error('Error creating simulation completion', error);
      throw error;
    }
  }
  
  /**
   * Create a streaming completion using simulation
   */
  async createStreamingCompletion(
    messages: LlmMessage[],
    options: LlmCompletionOptions,
    onContent: (content: string) => void,
    onToolCall?: (toolCall: any) => void,
    onFinish?: (response: Partial<LlmCompletionResponse>) => void
  ): Promise<void> {
    try {
      // Get the last user message to respond to
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      
      // Generate simulated response
      const { content, toolCalls } = this.generateSimulatedResponse(
        lastUserMessage?.content || '',
        options?.tools
      );
      
      // Track response data
      const responseId = `sim_${Date.now()}`;
      const responseModel = this.getCurrentModel();
      
      // Stream the content with delays
      const chunks = this.chunkString(content, 10);
      for (const chunk of chunks) {
        // Add random delay to simulate thinking
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        onContent(chunk);
      }
      
      // Send tool calls if present and handler provided
      if (toolCalls && toolCalls.length > 0 && onToolCall) {
        for (const toolCall of toolCalls) {
          await new Promise(resolve => setTimeout(resolve, 500));
          onToolCall(toolCall);
        }
      }
      
      // Call onFinish with the complete response
      if (onFinish) {
        onFinish({
          id: responseId,
          model: responseModel,
          content,
          finishReason: 'stop',
          toolCalls: toolCalls
        });
      }
    } catch (error) {
      logger.error('Error creating simulation streaming completion', error);
      throw error;
    }
  }
  
  /**
   * Count tokens in messages
   */
  countTokens(messages: LlmMessage[]): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      // Base tokens per message
      totalTokens += 4;
      
      // Tokens for content (rough estimate: 1 token per 4 chars)
      if (message.content) {
        totalTokens += Math.ceil(message.content.length / 4);
      }
      
      // Tokens for name if present
      if (message.name) {
        totalTokens += 1;
      }
    }
    
    return totalTokens;
  }
  
  /**
   * Generate a simulated response based on user message
   */
  private generateSimulatedResponse(
    userMessage: string,
    tools?: LlmTool[]
  ): { content: string; toolCalls?: any[] } {
    // Default response if nothing matches
    let content = 'I understand your request. As a simulated AI assistant, I can help you with various coding tasks, answer questions, and provide guidance.';
    let toolCalls: any[] | undefined = undefined;
    
    // Convert to lowercase for easier matching
    const message = userMessage.toLowerCase();
    
    // Generate different responses based on message content
    if (message.includes('hello') || message.includes('hi ') || message === 'hi') {
      content = 'Hello! How can I help you with your coding project today?';
    }
    else if (message.includes('help') || message.includes('what can you do')) {
      content = 'I can help you with various coding tasks, such as:\n\n' +
        '- Explaining code\n' +
        '- Generating new code\n' +
        '- Debugging issues\n' +
        '- Answering programming questions\n' +
        '- Running commands or scripts';
    }
    else if (message.includes('explain') || message.includes('what is')) {
      content = 'This is a simulation response that would normally explain the concept you asked about. In a real implementation, I would analyze the relevant code and provide a detailed explanation.';
    }
    else if (message.includes('generate') || message.includes('create') || message.includes('write')) {
      content = 'Here\'s a simple example of a JavaScript function that demonstrates what you requested:\n\n```javascript\nfunction processData(data) {\n  // Validate input\n  if (!data || !Array.isArray(data)) {\n    throw new Error(\'Invalid input: expected an array\');\n  }\n  \n  // Process the data\n  return data.map(item => {\n    return {\n      id: item.id,\n      value: item.value * 2,\n      processed: true\n    };\n  });\n}\n```\n\nYou can use this function by passing an array of objects with id and value properties.';
    }
    else if (message.includes('run') || message.includes('execute')) {
      // If tools are available and include execute_command, use a tool call
      if (tools && tools.find(t => t.name === 'execute_command')) {
        content = 'I\'ll run that command for you.';
        toolCalls = [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'execute_command',
              arguments: JSON.stringify({
                command: 'echo',
                args: ['This is a simulated command execution']
              })
            }
          }
        ];
      } else {
        content = 'I can help you run commands, but I need permission to use the execute_command tool. In a real implementation, I would be able to execute commands directly.';
      }
    }
    else if (message.includes('list files') || message.includes('show files')) {
      // If tools are available and include list_files, use a tool call
      if (tools && tools.find(t => t.name === 'list_files')) {
        content = 'Let me list the files for you.';
        toolCalls = [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'list_files',
              arguments: JSON.stringify({
                path: '.'
              })
            }
          }
        ];
      } else {
        content = 'I can help you list files, but I need permission to use the list_files tool. In a real implementation, I would be able to show you a list of files in your project.';
      }
    }
    
    return { content, toolCalls };
  }
  
  /**
   * Split a string into smaller chunks for streaming
   */
  private chunkString(str: string, size: number): string[] {
    const chunks: string[] = [];
    let index = 0;
    
    while (index < str.length) {
      // Use a variable chunk size to make it feel more natural
      const chunkSize = Math.floor(Math.random() * size) + 1;
      chunks.push(str.slice(index, index + chunkSize));
      index += chunkSize;
    }
    
    return chunks;
  }
}