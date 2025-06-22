export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: Array<string | RegExp>;
}

export class RetryPolicy {
  private readonly options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      backoffFactor: options.backoffFactor || 2,
      retryableErrors: options.retryableErrors || [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'EPIPE',
        'EHOSTUNREACH',
        'EAI_AGAIN',
        /^5\d\d$/, // 5xx status codes
        'Network Error',
        'Socket hang up',
        'service unavailable',
      ],
    };
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let delay = this.options.initialDelay;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.options.maxRetries || !this.isRetryable(error)) {
          throw error;
        }

        // Wait for the calculated delay
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * this.options.backoffFactor, this.options.maxDelay);
      }
    }

    // This should never be reached due to the throw in the catch block
    throw lastError!;
  }

  private isRetryable(error: unknown): boolean {
    const err = error as Error;
    
    if (!err) return false;

    // Check if the error code or message matches any of our retryable errors
    return this.options.retryableErrors.some((retryableError) => {
      if (typeof retryableError === 'string') {
        return (
          (err as any).code === retryableError ||
          (err.message && err.message.includes(retryableError))
        );
      }
      return retryableError.test((err as any).code || err.message || '');
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}