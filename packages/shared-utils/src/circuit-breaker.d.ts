export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerOptions {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenSuccessThreshold: number;
}
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private readonly options;
    constructor(options?: Partial<CircuitBreakerOptions>);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private isOpen;
    private moveToHalfOpenIfNeeded;
    private recordSuccess;
    private recordFailure;
    private reset;
    getState(): CircuitState;
}
