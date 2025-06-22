import { Message } from '@opencode/shared-types';
export interface TokenCounterOptions {
    tokensPerMessage: number;
    tokensPerName: number;
    tokensPerChar: number;
}
export declare class TokenCounter {
    private readonly options;
    constructor(options?: Partial<TokenCounterOptions>);
    countTokensInString(text: string): number;
    countTokensInMessage(message: Message): number;
    countTokensInMessages(messages: Message[]): number;
    trimMessagesToFitLimit(messages: Message[], limit: number): Message[];
}
