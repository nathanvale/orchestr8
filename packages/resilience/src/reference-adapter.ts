/**
 * Reference implementation of ResilienceAdapter with explicit composition order
 * This is a simple demonstration adapter - use a production-ready library for real applications
 */

import type {
  CompositionOrder,
  ResilienceAdapter,
  ResiliencePolicy,
} from '@orchestr8/core'

/**
 * Simple reference resilience adapter that implements both legacy and new interfaces
 * This adapter demonstrates the interface contract but is not production-ready
 */
export class ReferenceResilienceAdapter implements ResilienceAdapter {
  /**
   * Legacy interface for backward compatibility
   * @deprecated Use applyNormalizedPolicy for better control over composition order
   */
  async applyPolicy<T>(
    operation: () => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
  ): Promise<T> {
    // For legacy interface, we use default retry-cb-timeout composition
    const normalizedPolicy = this.normalizePolicy(policy)
    return this.applyNormalizedPolicy(
      operation,
      normalizedPolicy,
      'retry-cb-timeout',
      signal,
    )
  }

  /**
   * New interface with explicit composition order
   * This provides better control and consistency across adapters
   */
  async applyNormalizedPolicy<T>(
    operation: () => Promise<T>,
    normalizedPolicy: ResiliencePolicy,
    compositionOrder: CompositionOrder,
    signal?: AbortSignal,
  ): Promise<T> {
    // For this simple reference implementation, we just log the composition order
    // and apply basic timeout and retry if present
    
    if (signal?.aborted) {
      throw new Error('Operation was cancelled')
    }

    // Apply basic timeout if specified
    if (normalizedPolicy.timeout) {
      return this.withTimeout(operation, normalizedPolicy.timeout, signal)
    }

    // Apply basic retry if specified
    if (normalizedPolicy.retry) {
      return this.withRetry(operation, normalizedPolicy.retry, signal)
    }

    // No resilience patterns, just execute
    return operation()
  }

  /**
   * Simple timeout implementation
   */
  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) {
      throw new Error('Operation was cancelled')
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      // Handle signal cancellation
      const abortHandler = () => {
        clearTimeout(timeoutId)
        reject(new Error('Operation was cancelled'))
      }

      if (signal) {
        signal.addEventListener('abort', abortHandler, { once: true })
      }

      operation()
        .then(result => {
          clearTimeout(timeoutId)
          if (signal) {
            signal.removeEventListener('abort', abortHandler)
          }
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          if (signal) {
            signal.removeEventListener('abort', abortHandler)
          }
          reject(error)
        })
    })
  }

  /**
   * Simple retry implementation
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retryPolicy: NonNullable<ResiliencePolicy['retry']>,
    signal?: AbortSignal,
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      if (signal?.aborted) {
        throw new Error('Operation was cancelled')
      }

      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't delay after the last attempt
        if (attempt < retryPolicy.maxAttempts) {
          const delay = this.calculateBackoffDelay(
            attempt,
            retryPolicy.initialDelay,
            retryPolicy.maxDelay,
            retryPolicy.backoffStrategy,
            retryPolicy.jitterStrategy,
          )

          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('All retry attempts failed')
  }

  /**
   * Calculate backoff delay with jitter
   */
  private calculateBackoffDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    backoffStrategy: 'fixed' | 'exponential',
    jitterStrategy: 'none' | 'full-jitter',
  ): number {
    let delay: number

    if (backoffStrategy === 'exponential') {
      delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
    } else {
      delay = initialDelay
    }

    if (jitterStrategy === 'full-jitter') {
      delay = Math.random() * delay
    }

    return Math.max(0, delay)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Normalize a resilience policy with default values
   */
  private normalizePolicy(policy: ResiliencePolicy): ResiliencePolicy {
    const normalized: ResiliencePolicy = {}

    if (policy.retry) {
      normalized.retry = {
        maxAttempts: policy.retry.maxAttempts ?? 3,
        backoffStrategy: policy.retry.backoffStrategy ?? 'exponential',
        jitterStrategy: policy.retry.jitterStrategy ?? 'full-jitter',
        initialDelay: policy.retry.initialDelay ?? 1000,
        maxDelay: policy.retry.maxDelay ?? 10000,
      }
    }

    if (policy.circuitBreaker) {
      normalized.circuitBreaker = {
        failureThreshold: policy.circuitBreaker.failureThreshold ?? 5,
        recoveryTime: policy.circuitBreaker.recoveryTime ?? 30000,
        sampleSize: policy.circuitBreaker.sampleSize ?? 10,
        halfOpenPolicy: policy.circuitBreaker.halfOpenPolicy ?? 'single-probe',
      }
    }

    if (policy.timeout) {
      normalized.timeout = policy.timeout
    }

    return normalized
  }
}