/**
 * Retry implementation with backoff and jitter strategies
 */

import type { RetryConfig, ResilientOperation } from './types.js'

import { isCircuitBreakerOpenError } from './errors.js'
import { RetryExhaustedError } from './errors.js'

/**
 * Default retry predicate - retries all errors except CircuitBreakerOpenError
 */
const defaultRetryOn = (error: unknown): boolean => {
  // Never retry circuit breaker open errors
  if (isCircuitBreakerOpenError(error)) {
    return false
  }

  // By default, retry all other errors
  return true
}

/**
 * Calculate delay with exponential backoff
 */
function calculateExponentialDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt - 1)
  return Math.min(exponentialDelay, maxDelay)
}

/**
 * Apply jitter to a delay
 */
function applyJitter(delay: number, jitterStrategy: 'none' | 'full'): number {
  if (jitterStrategy === 'none') {
    return delay
  }

  // Full jitter: random value between 0 and delay
  return Math.random() * delay
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve()
    if (signal?.aborted) return reject(new Error('Operation was cancelled'))

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timeoutId)
      cleanup()
      reject(new Error('Operation was cancelled'))
    }

    const cleanup = () => {
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort)
      }
    }

    if (signal && typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

/**
 * Callback for retry events
 */
export type RetryCallback = (
  attempt: number,
  delay: number,
  error: unknown,
) => void

/**
 * Retry wrapper with configurable backoff and jitter
 */
export class RetryWrapper {
  private attemptCount = 0

  constructor(
    private readonly config: RetryConfig,
    private readonly onRetry?: RetryCallback,
  ) {}

  /**
   * Get the number of attempts made
   */
  getAttemptCount(): number {
    return this.attemptCount
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(
    operation: ResilientOperation<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const retryOn = this.config.retryOn ?? defaultRetryOn
    let lastError: unknown
    this.attemptCount = 0

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      this.attemptCount = attempt

      try {
        // Check for cancellation before each attempt
        if (signal?.aborted) {
          const error = new Error('Operation cancelled')
          error.name = 'AbortError'
          throw error
        }

        // Execute the operation
        const result = await operation(signal)
        return result
      } catch (error) {
        lastError = error

        // Check if we should retry this error
        if (!retryOn(error)) {
          throw error
        }

        // If this was the last attempt
        if (attempt === this.config.maxAttempts) {
          // If only 1 attempt configured, throw original error
          if (this.config.maxAttempts === 1) {
            throw error
          }
          // Otherwise throw retry exhausted
          throw new RetryExhaustedError(
            `Retry exhausted after ${attempt} attempts`,
            attempt,
            error,
          )
        }

        // Calculate delay for next attempt
        let delay: number
        if (this.config.backoffStrategy === 'exponential') {
          delay = calculateExponentialDelay(
            attempt,
            this.config.initialDelay,
            this.config.maxDelay,
          )
        } else {
          // Fixed backoff
          delay = Math.min(this.config.initialDelay, this.config.maxDelay)
        }

        // Apply jitter
        delay = applyJitter(delay, this.config.jitterStrategy)

        // Notify callback if provided
        if (this.onRetry) {
          this.onRetry(attempt, delay, error)
        }

        // Wait before next attempt
        await sleep(delay, signal)
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new RetryExhaustedError(
      `Retry exhausted after ${this.config.maxAttempts} attempts`,
      this.config.maxAttempts,
      lastError,
    )
  }

  /**
   * Create a retry wrapper with default configuration
   */
  static withDefaults(partial?: Partial<RetryConfig>): RetryWrapper {
    const config: RetryConfig = {
      maxAttempts: partial?.maxAttempts ?? 3,
      backoffStrategy: partial?.backoffStrategy ?? 'exponential',
      jitterStrategy: partial?.jitterStrategy ?? 'full',
      initialDelay: partial?.initialDelay ?? 100,
      maxDelay: partial?.maxDelay ?? 5000,
      retryOn: partial?.retryOn,
    }
    return new RetryWrapper(config)
  }
}
