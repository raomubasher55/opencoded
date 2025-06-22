import { Message } from '@opencode/shared-types';

export interface TokenCounterOptions {
  tokensPerMessage: number;
  tokensPerName: number;
  tokensPerChar: number;
}

// A simple token counter for LLM context management
// For production use, consider using more accurate tokenizers specific to each model
export class TokenCounter {
  private readonly options: TokenCounterOptions;

  constructor(options: Partial<TokenCounterOptions> = {}) {
    this.options = {
      tokensPerMessage: options.tokensPerMessage || 4, // Average tokens used for message metadata
      tokensPerName: options.tokensPerName || 2, // Average tokens used for name fields
      tokensPerChar: options.tokensPerChar || 0.25, // Average tokens per character (4 chars ≈ 1 token)
    };
  }

  // Estimate tokens for a string
  public countTokensInString(text: string): number {
    return Math.ceil(text.length * this.options.tokensPerChar);
  }

  // Estimate tokens for a message
  public countTokensInMessage(message: Message): number {
    let count = this.options.tokensPerMessage;

    // Count role name tokens
    count += this.options.tokensPerName;

    // Count content tokens
    if (message.content) {
      count += this.countTokensInString(message.content);
    }

    // Count tool calls
    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        // Tool name
        count += this.options.tokensPerName;
        
        // Tool arguments (as JSON string)
        const args = JSON.stringify(toolCall.arguments);
        count += this.countTokensInString(args);
        
        // Tool result if present
        if (toolCall.result) {
          const resultStr = toolCall.result.success ? 
            (toolCall.result.output || '') : 
            (toolCall.result.error || '');
          count += this.countTokensInString(resultStr);
          
          // Add for metadata if present
          if (toolCall.result.metadata) {
            const metadataStr = JSON.stringify(toolCall.result.metadata);
            count += this.countTokensInString(metadataStr);
          }
        }
      }
    }

    return count;
  }

  // Estimate tokens for an array of messages
  public countTokensInMessages(messages: Message[]): number {
    return messages.reduce((total, message) => {
      return total + this.countTokensInMessage(message);
    }, 0);
  }

  // Trim messages to fit within a token limit
  public trimMessagesToFitLimit(messages: Message[], limit: number): Message[] {
    if (messages.length === 0) return [];
    
    const result: Message[] = [];
    let totalTokens = 0;
    
    // Process in reverse order (newer messages first)
    // This ensures we keep the most recent context if we need to trim
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = this.countTokensInMessage(message);
      
      if (totalTokens + tokens <= limit) {
        result.unshift(message); // Add to beginning to maintain original order
        totalTokens += tokens;
      } else {
        break; // Stop adding messages once we hit the limit
      }
    }
    
    return result;
  }
}