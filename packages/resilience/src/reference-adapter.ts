/**
 * Reference implementation of ResilienceAdapter with explicit composition order
 * This is a simple demonstration adapter - use a production-ready library for real applications
 */

import type {
  CompositionOrder,
  ResilienceAdapter,
  ResilienceInvocationContext,
  ResiliencePolicy,
} from '@orchestr8/schema'

import { CircuitBreakerOpenError, TimeoutError } from './errors.js'

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open'
  consecutiveFailures: number
  lastFailureTime?: number
  successCount: number
}

/**
 * Simple reference resilience adapter that implements both legacy and new interfaces
 * This adapter demonstrates the interface contract but is not production-ready
 */
export class ReferenceResilienceAdapter implements ResilienceAdapter {
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  /**
   * Legacy interface for backward compatibility
   * @deprecated Use applyNormalizedPolicy for better control over composition order
   */
  async applyPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
    context?: ResilienceInvocationContext,
  ): Promise<T> {
    // For legacy interface, we use default retry-cb-timeout composition
    const normalizedPolicy = this.normalizePolicy(policy)
    return this.applyNormalizedPolicy(
      operation,
      normalizedPolicy,
      'retry-cb-timeout',
      signal,
      context,
    )
  }

  /**
   * New interface with explicit composition order
   * This provides better control and consistency across adapters
   */
  async applyNormalizedPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    normalizedPolicy: ResiliencePolicy,
    compositionOrder: CompositionOrder,
    signal?: AbortSignal,
    context?: ResilienceInvocationContext,
  ): Promise<T> {
    if (signal?.aborted) {
      throw new Error('Operation was cancelled')
    }

    // Compose the resilience patterns according to the specified order
    let wrappedOperation = operation

    // Parse composition order and wrap operations
    const patterns = compositionOrder.split('-')

    // Apply patterns in reverse order (innermost first)
    for (let i = patterns.length - 1; i >= 0; i--) {
      const pattern = patterns[i]

      switch (pattern) {
        case 'retry':
          if (normalizedPolicy.retry) {
            const currentOp = wrappedOperation
            wrappedOperation = (sig?: AbortSignal) =>
              this.withRetry(currentOp, normalizedPolicy.retry!, sig)
          }
          break

        case 'cb':
          if (normalizedPolicy.circuitBreaker) {
            const currentOp = wrappedOperation
            const cbKey = this.getCircuitBreakerKey(
              normalizedPolicy.circuitBreaker,
              context,
            )
            wrappedOperation = (sig?: AbortSignal) =>
              this.withCircuitBreaker(
                currentOp,
                normalizedPolicy.circuitBreaker!,
                cbKey,
                sig,
              )
          }
          break

        case 'timeout':
          if (normalizedPolicy.timeout) {
            const currentOp = wrappedOperation
            const timeoutMs = normalizedPolicy.timeout
            wrappedOperation = (sig?: AbortSignal) =>
              this.withTimeout(currentOp, timeoutMs, sig)
          }
          break
      }
    }

    // Execute the composed operation
    return wrappedOperation(signal)
  }

  /**
   * Simple timeout implementation
   */
  private async withTimeout<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    timeoutMs: number,
    parentSignal?: AbortSignal,
  ): Promise<T> {
    if (parentSignal?.aborted) {
      throw new Error('Operation was cancelled')
    }

    return new Promise<T>((resolve, reject) => {
      // Create an AbortController for timeout
      const timeoutController = new AbortController()

      const timeoutId = setTimeout(() => {
        timeoutController.abort()
        reject(
          new TimeoutError(
            `Operation timed out after ${timeoutMs}ms`,
            timeoutMs,
          ),
        )
      }, timeoutMs)

      // Combine parent signal with timeout signal
      const combinedSignal = parentSignal
        ? this.combineSignals([parentSignal, timeoutController.signal])
        : timeoutController.signal

      // Handle parent signal cancellation
      const abortHandler = () => {
        clearTimeout(timeoutId)
        timeoutController.abort()
        reject(new Error('Operation was cancelled'))
      }

      if (parentSignal) {
        parentSignal.addEventListener('abort', abortHandler, { once: true })
      }

      operation(combinedSignal)
        .then((result) => {
          clearTimeout(timeoutId)
          if (parentSignal) {
            parentSignal.removeEventListener('abort', abortHandler)
          }
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          if (parentSignal) {
            parentSignal.removeEventListener('abort', abortHandler)
          }
          reject(error)
        })
    })
  }

  /**
   * Simple retry implementation
   */
  private async withRetry<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    retryPolicy: NonNullable<ResiliencePolicy['retry']>,
    signal?: AbortSignal,
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      if (signal?.aborted) {
        throw new Error('Operation was cancelled')
      }

      try {
        return await operation(signal)
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
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Combine multiple abort signals into one
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort()
        break
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    return controller.signal
  }

  /**
   * Circuit breaker implementation
   */
  private async withCircuitBreaker<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    cbPolicy: NonNullable<ResiliencePolicy['circuitBreaker']>,
    key: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const state = this.getCircuitBreakerState(key)

    // Check if circuit is open
    if (state.status === 'open') {
      const timeSinceFailure = Date.now() - (state.lastFailureTime || 0)

      if (timeSinceFailure < cbPolicy.recoveryTime) {
        // Still in recovery period, reject immediately
        const retryAfter = new Date(
          (state.lastFailureTime || 0) + cbPolicy.recoveryTime,
        )
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open for ${key}`,
          key,
          retryAfter,
          state.consecutiveFailures,
        )
      }

      // Recovery time has passed, transition to half-open
      state.status = 'half-open'
      state.successCount = 0
    }

    // In half-open state, limit concurrent attempts based on policy
    if (
      state.status === 'half-open' &&
      cbPolicy.halfOpenPolicy === 'single-probe'
    ) {
      // For single-probe, we allow one test request
      // In a production implementation, you'd want to ensure only one concurrent probe
    }

    try {
      const result = await operation(signal)

      // Operation succeeded
      if (state.status === 'half-open') {
        state.successCount++

        // Check if we've had enough successes to close the circuit
        const requiredSuccesses = cbPolicy.halfOpenPolicy === 'gradual' ? 3 : 1

        if (state.successCount >= requiredSuccesses) {
          state.status = 'closed'
          state.consecutiveFailures = 0
          state.successCount = 0
        }
      } else if (state.status === 'closed') {
        // Reset failure count on success
        state.consecutiveFailures = 0
      }

      return result
    } catch (error) {
      // Operation failed
      state.consecutiveFailures++
      state.lastFailureTime = Date.now()

      // Check if we should open the circuit
      if (state.consecutiveFailures >= cbPolicy.failureThreshold) {
        state.status = 'open'
      }

      // If we were half-open, go back to open
      if (state.status === 'half-open') {
        state.status = 'open'
        state.successCount = 0
      }

      throw error
    }
  }

  /**
   * Get or create circuit breaker state
   */
  private getCircuitBreakerState(key: string): CircuitBreakerState {
    let state = this.circuitBreakers.get(key)

    if (!state) {
      state = {
        status: 'closed',
        consecutiveFailures: 0,
        successCount: 0,
      }
      this.circuitBreakers.set(key, state)
    }

    return state
  }

  /**
   * Generate circuit breaker key from policy and context
   */
  private getCircuitBreakerKey(
    cbPolicy: NonNullable<ResiliencePolicy['circuitBreaker']>,
    context?: ResilienceInvocationContext,
  ): string {
    // If a key is provided in the policy, use it
    if (cbPolicy.key) {
      return cbPolicy.key
    }

    // Otherwise, derive from context
    if (context?.workflowId && context?.stepId) {
      return `${context.workflowId}:${context.stepId}`
    }

    // Fallback to a default key
    return 'default'
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
        key: policy.circuitBreaker.key,
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
