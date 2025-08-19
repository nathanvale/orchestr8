/**
 * Production resilience adapter implementation using composition engine
 */

import type {
  CompositionOrder,
  ResilienceAdapter,
  ResilienceInvocationContext,
  ResiliencePolicy,
} from '@orchestr8/schema'

import type {
  CircuitBreakerConfig,
  NormalizedResilienceConfig,
  ResilienceContext,
  ResilientOperation,
  RetryConfig,
  TimeoutConfig,
} from './types.js'

import { CircuitBreaker } from './circuit-breaker.js'
import { ResilienceComposer } from './composition.js'
import { TimeoutError } from './errors.js'
import { RetryWrapper } from './retry.js'

/**
 * Production-ready resilience adapter with composition engine
 */
export class ProductionResilienceAdapter implements ResilienceAdapter {
  private readonly composer: ResilienceComposer
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map()

  constructor() {
    this.composer = new ResilienceComposer()

    // Set up pattern wrappers
    this.composer.setRetryWrapper(this.wrapWithRetry.bind(this))
    this.composer.setCircuitBreakerWrapper(
      this.wrapWithCircuitBreaker.bind(this),
    )
    this.composer.setTimeoutWrapper(this.wrapWithTimeout.bind(this))
  }

  /**
   * Legacy interface for backward compatibility
   * @deprecated Use applyNormalizedPolicy for better control
   */
  async applyPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    policy: ResiliencePolicy,
    signal?: AbortSignal,
    context?: ResilienceInvocationContext,
  ): Promise<T> {
    // For legacy interface, use default retry-cb-timeout composition
    return this.applyNormalizedPolicy(
      operation,
      policy,
      'retry-cb-timeout',
      signal,
      context,
    )
  }

  /**
   * Apply resilience patterns with explicit composition order
   */
  async applyNormalizedPolicy<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    normalizedPolicy: ResiliencePolicy,
    compositionOrder: CompositionOrder,
    signal?: AbortSignal,
    context?: ResilienceInvocationContext,
  ): Promise<T> {
    // Normalize the policy first
    const normalized = this.normalizePolicy(normalizedPolicy)

    // Create resilience context with signal
    const resilienceContext: ResilienceContext = {
      ...context,
      signal,
    }

    // Use composition engine to create middleware
    const middleware = this.composer.compose<T>(
      normalized,
      compositionOrder,
    )

    // Execute through middleware
    return middleware(operation, resilienceContext)
  }

  /**
   * Wrap operation with retry logic
   */
  private async wrapWithRetry<T>(
    operation: ResilientOperation<T>,
    config: RetryConfig,
    context?: ResilienceContext,
  ): Promise<T> {
    const retryWrapper = new RetryWrapper(config)
    return retryWrapper.execute(operation, context?.signal)
  }

  /**
   * Wrap operation with circuit breaker
   */
  private async wrapWithCircuitBreaker<T>(
    operation: ResilientOperation<T>,
    config: CircuitBreakerConfig,
    context?: ResilienceContext,
  ): Promise<T> {
    // Derive circuit breaker key
    const key = this.deriveCircuitBreakerKey(config, context)

    // Get or create circuit breaker for this key
    let circuitBreaker = this.circuitBreakers.get(key)
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(config)

      // Bounded map - remove oldest if at limit
      if (this.circuitBreakers.size >= 1000) {
        const firstKey = this.circuitBreakers.keys().next().value
        if (firstKey) {
          this.circuitBreakers.delete(firstKey)
        }
      }

      this.circuitBreakers.set(key, circuitBreaker)
    }

    // Execute through circuit breaker
    return circuitBreaker.execute(key, () => operation(context?.signal))
  }

  /**
   * Wrap operation with timeout
   */
  private async wrapWithTimeout<T>(
    operation: ResilientOperation<T>,
    config: TimeoutConfig,
    context?: ResilienceContext,
  ): Promise<T> {
    // Check for early cancellation
    if (context?.signal?.aborted) {
      throw new Error('Operation was cancelled')
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutController = new AbortController()
      let timeoutId: ReturnType<typeof setTimeout>

      // Create timeout
      timeoutId = setTimeout(() => {
        timeoutController.abort()
        reject(
          new TimeoutError(
            `Operation timed out after ${config.duration}ms`,
            config.duration,
          ),
        )
      }, config.duration)

      // Combine signals if parent signal exists
      const combinedSignal = context?.signal
        ? this.combineSignals([context.signal, timeoutController.signal])
        : timeoutController.signal

      // Handle parent cancellation
      const abortHandler = () => {
        clearTimeout(timeoutId)
        timeoutController.abort()
        reject(new Error('Operation was cancelled'))
      }

      if (context?.signal) {
        context.signal.addEventListener('abort', abortHandler, { once: true })
      }

      // Execute operation
      operation(combinedSignal)
        .then((result) => {
          clearTimeout(timeoutId)
          if (context?.signal) {
            context.signal.removeEventListener('abort', abortHandler)
          }
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          if (context?.signal) {
            context.signal.removeEventListener('abort', abortHandler)
          }
          reject(error)
        })
    })
  }

  /**
   * Derive circuit breaker key from config and context
   */
  private deriveCircuitBreakerKey(
    config: CircuitBreakerConfig,
    context?: ResilienceContext,
  ): string {
    // Use explicit key if provided
    if (config.key) {
      return config.key
    }

    // Derive from context
    if (context?.workflowId && context?.stepId) {
      return CircuitBreaker.deriveKey(context.workflowId, context.stepId)
    }

    // Fallback to default
    return 'default'
  }

  /**
   * Combine multiple abort signals into one
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort()
        return controller.signal
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    return controller.signal
  }

  /**
   * Normalize a resilience policy with default values
   */
  private normalizePolicy(
    policy: ResiliencePolicy,
  ): NormalizedResilienceConfig {
    const normalized: NormalizedResilienceConfig = {}

    if (policy.retry) {
      // Map legacy jitter strategy to new format
      let jitterStrategy: 'none' | 'full' = 'full'
      if (policy.retry.jitterStrategy === 'none') {
        jitterStrategy = 'none'
      } else if (policy.retry.jitterStrategy === 'full-jitter' || !policy.retry.jitterStrategy) {
        jitterStrategy = 'full'
      }

      normalized.retry = {
        maxAttempts: policy.retry.maxAttempts ?? 3,
        backoffStrategy: policy.retry.backoffStrategy ?? 'exponential',
        jitterStrategy,
        initialDelay: policy.retry.initialDelay ?? 100,
        maxDelay: policy.retry.maxDelay ?? 5000,
        retryOn: undefined, // Will use default predicate
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
      normalized.timeout = {
        duration: policy.timeout,
      }
    }

    return normalized
  }

  /**
   * Get circuit breaker state for monitoring (optional)
   */
  getCircuitBreakerState(key: string): unknown {
    const cb = this.circuitBreakers.get(key)
    return cb?.getCircuitState(key)
  }

  /**
   * Reset a specific circuit (for testing)
   */
  resetCircuit(key: string): void {
    const cb = this.circuitBreakers.get(key)
    cb?.reset(key)
  }

  /**
   * Reset all circuits (for testing)
   */
  resetAllCircuits(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.resetAll()
    }
    this.circuitBreakers.clear()
  }
}
