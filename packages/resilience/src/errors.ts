/**
 * Error types for resilience patterns
 */

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  readonly name = 'TimeoutError'

  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operationName?: string,
  ) {
    super(message)
    Object.setPrototypeOf(this, TimeoutError.prototype)
  }
}

/**
 * Error thrown when a circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  readonly name = 'CircuitBreakerOpenError'
  readonly code = 'CIRCUIT_BREAKER_OPEN'

  /**
   * @deprecated Use 'code' property instead
   */
  readonly legacyCode = 'CIRCUIT_OPEN'

  constructor(
    message: string,
    public readonly circuitKey: string,
    public readonly retryAfter: Date,
    public readonly consecutiveFailures: number,
  ) {
    super(message)
    Object.setPrototypeOf(this, CircuitBreakerOpenError.prototype)
  }

  /** Time in milliseconds until the circuit will transition to half-open */
  get nextRetryTime(): number {
    return this.retryAfter.getTime()
  }
}

/**
 * Error thrown when retry attempts are exhausted
 */
export class RetryExhaustedError extends Error {
  readonly name = 'RetryExhaustedError'

  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError?: unknown,
  ) {
    super(message)
    Object.setPrototypeOf(this, RetryExhaustedError.prototype)
  }
}

/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError
}

/**
 * Type guard for CircuitBreakerOpenError
 */
export function isCircuitBreakerOpenError(
  error: unknown,
): error is CircuitBreakerOpenError {
  return error instanceof CircuitBreakerOpenError
}

/**
 * Type guard for RetryExhaustedError
 */
export function isRetryExhaustedError(
  error: unknown,
): error is RetryExhaustedError {
  return error instanceof RetryExhaustedError
}
