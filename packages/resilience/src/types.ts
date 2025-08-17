export interface RetryOptions {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitter: boolean
}

export interface TimeoutOptions {
  timeoutMs: number
}

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeMs: number
  halfOpenProbes: number
  keyGenerator?: (context?: unknown) => string
}

export type ResilienceOperation<T> = (signal?: AbortSignal) => Promise<T>

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

export class RetryExhaustedError extends Error {
  constructor(
    public attempts: number,
    public lastError: Error,
  ) {
    super(`Retry exhausted after ${attempts} attempts`)
    this.name = 'RetryExhaustedError'
  }
}
