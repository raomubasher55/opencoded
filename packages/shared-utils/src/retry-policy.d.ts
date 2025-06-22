export interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryableErrors: Array<string | RegExp>;
}
export declare class RetryPolicy {
    private readonly options;
    constructor(options?: Partial<RetryOptions>);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private isRetryable;
    private sleep;
}
