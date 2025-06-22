"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
// Circuit breaker implementation for service resilience
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(options = {}) {
        this.options = {
            failureThreshold: options.failureThreshold || 5,
            resetTimeout: options.resetTimeout || 30000,
            halfOpenSuccessThreshold: options.halfOpenSuccessThreshold || 2,
        };
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
    }
    async execute(fn) {
        if (this.isOpen()) {
            this.moveToHalfOpenIfNeeded();
            if (this.state === CircuitState.OPEN) {
                throw new Error('Circuit is open, requests are blocked');
            }
        }
        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    isOpen() {
        return this.state === CircuitState.OPEN || this.state === CircuitState.HALF_OPEN;
    }
    moveToHalfOpenIfNeeded() {
        if (this.state === CircuitState.OPEN &&
            Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
            this.state = CircuitState.HALF_OPEN;
            this.successCount = 0;
        }
    }
    recordSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.options.halfOpenSuccessThreshold) {
                this.reset();
            }
        }
        else if (this.state === CircuitState.CLOSED) {
            // Reset any failure count on success in closed state
            this.failureCount = 0;
        }
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === CircuitState.CLOSED &&
            this.failureCount >= this.options.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
        else if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
        }
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
    }
    getState() {
        return this.state;
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuit-breaker.js.map