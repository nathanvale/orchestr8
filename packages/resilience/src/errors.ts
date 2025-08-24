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
 * Error thrown when a circuit breaker times out during half-open probe
 */
export class CircuitBreakerTimeoutError extends CircuitBreakerOpenError {
  constructor(
    message: string,
    circuitKey: string,
    retryAfter: Date,
    consecutiveFailures: number,
    public readonly timeoutMs: number,
    public readonly operationName?: string,
  ) {
    super(message, circuitKey, retryAfter, consecutiveFailures)
    Object.defineProperty(this, 'name', {
      value: 'CircuitBreakerTimeoutError',
      configurable: true,
    })
    Object.defineProperty(this, 'code', {
      value: 'CIRCUIT_BREAKER_TIMEOUT',
      configurable: true,
    })
    Object.setPrototypeOf(this, CircuitBreakerTimeoutError.prototype)
  }
}

/**
 * Error thrown when circuit breaker configuration is invalid
 */
export class CircuitBreakerConfigurationError extends Error {
  readonly name = 'CircuitBreakerConfigurationError'
  readonly code = 'CIRCUIT_BREAKER_CONFIGURATION'

  constructor(
    message: string,
    public readonly field: string,
    public readonly provided: unknown,
    public readonly expected: string,
  ) {
    super(message)
    Object.setPrototypeOf(this, CircuitBreakerConfigurationError.prototype)
  }
}

/**
 * Error thrown when circuit breaker threshold is exceeded
 */
export class CircuitBreakerThresholdError extends CircuitBreakerOpenError {
  constructor(
    message: string,
    circuitKey: string,
    retryAfter: Date,
    consecutiveFailures: number,
    public readonly failureRate: number,
    public readonly threshold: number,
    public readonly sampleSize: number,
  ) {
    super(message, circuitKey, retryAfter, consecutiveFailures)
    Object.defineProperty(this, 'name', {
      value: 'CircuitBreakerThresholdError',
      configurable: true,
    })
    Object.defineProperty(this, 'code', {
      value: 'CIRCUIT_BREAKER_THRESHOLD',
      configurable: true,
    })
    Object.setPrototypeOf(this, CircuitBreakerThresholdError.prototype)
  }
}

/**
 * Type guard for RetryExhaustedError
 */
export function isRetryExhaustedError(
  error: unknown,
): error is RetryExhaustedError {
  return error instanceof RetryExhaustedError
}

/**
 * Type guard for CircuitBreakerTimeoutError
 */
export function isCircuitBreakerTimeoutError(
  error: unknown,
): error is CircuitBreakerTimeoutError {
  return error instanceof CircuitBreakerTimeoutError
}

/**
 * Type guard for CircuitBreakerConfigurationError
 */
export function isCircuitBreakerConfigurationError(
  error: unknown,
): error is CircuitBreakerConfigurationError {
  return error instanceof CircuitBreakerConfigurationError
}

/**
 * Type guard for CircuitBreakerThresholdError
 */
export function isCircuitBreakerThresholdError(
  error: unknown,
): error is CircuitBreakerThresholdError {
  return error instanceof CircuitBreakerThresholdError
}
