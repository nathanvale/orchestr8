/**
 * Production resilience adapter implementation using composition engine
 */

import type {
  CompositionOrder,
  ResilienceAdapter,
  ResilienceInvocationContext,
  ResiliencePolicy,
} from '@orchestr8/schema'

import type { CircuitBreakerObserver } from './circuit-breaker.js'
import type { ResilienceTelemetry } from './observability.js'
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
import { deriveKey } from './key-derivation.js'
import { defaultTelemetry } from './observability.js'
import { RetryWrapper } from './retry.js'

/**
 * Production-ready resilience adapter with composition engine
 */
export class ProductionResilienceAdapter implements ResilienceAdapter {
  private readonly composer: ResilienceComposer
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private readonly cbAccessTimes: Map<string, number> = new Map()
  private readonly maxCircuitInstances: number
  private readonly circuitObserver?: CircuitBreakerObserver
  private readonly telemetry: ResilienceTelemetry

  constructor(options?: {
    maxInstances?: number
    circuitObserver?: CircuitBreakerObserver
    telemetry?: ResilienceTelemetry
  }) {
    this.composer = new ResilienceComposer()
    this.maxCircuitInstances = options?.maxInstances ?? 1000
    this.telemetry = options?.telemetry ?? defaultTelemetry
    this.circuitObserver =
      options?.circuitObserver ?? this.telemetry.createCircuitBreakerObserver()

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

    // Log composition start
    this.telemetry.logEvent('composition_start', resilienceContext, {
      compositionOrder,
      policies: {
        retry: !!normalized.retry,
        circuitBreaker: !!normalized.circuitBreaker,
        timeout: !!normalized.timeout,
      },
    })

    const timer = this.telemetry.startTimer('resilience_composition')

    try {
      // Use composition engine to create middleware
      const middleware = this.composer.compose<T>(normalized, compositionOrder)

      // Execute through middleware
      const result = await middleware(operation, resilienceContext)

      const duration = timer()
      this.telemetry.logEvent('composition_complete', resilienceContext, {
        compositionOrder,
        duration,
      })

      return result
    } catch (error) {
      const duration = timer()
      this.telemetry.logEvent('composition_error', resilienceContext, {
        compositionOrder,
        duration,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Wrap operation with retry logic
   */
  private async wrapWithRetry<T>(
    operation: ResilientOperation<T>,
    config: RetryConfig,
    context?: ResilienceContext,
  ): Promise<T> {
    const retryWrapper = new RetryWrapper(config, (attempt, delay, error) => {
      if (attempt > 1) {
        this.telemetry.logEvent('retry_attempt', context ?? {}, {
          attempt,
          maxAttempts: config.maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      if (delay > 0) {
        this.telemetry.logEvent('retry_backoff', context ?? {}, {
          attempt,
          delay,
          strategy: config.backoffStrategy,
          jitter: config.jitterStrategy,
        })
      }
    })

    try {
      const result = await retryWrapper.execute(operation, context?.signal)

      // Log success if there were retries
      if (retryWrapper.getAttemptCount() > 1) {
        this.telemetry.logEvent('retry_success', context ?? {}, {
          attempts: retryWrapper.getAttemptCount(),
          maxAttempts: config.maxAttempts,
        })
      }

      return result
    } catch (error) {
      // Log exhausted retries
      if (retryWrapper.getAttemptCount() >= config.maxAttempts) {
        this.telemetry.logEvent('retry_exhausted', context ?? {}, {
          attempts: retryWrapper.getAttemptCount(),
          maxAttempts: config.maxAttempts,
          finalError: error instanceof Error ? error.message : String(error),
        })
      }
      throw error
    }
  }

  /**
   * Wrap operation with circuit breaker
   */
  private async wrapWithCircuitBreaker<T>(
    operation: ResilientOperation<T>,
    config: CircuitBreakerConfig,
    context?: ResilienceContext,
  ): Promise<T> {
    // Derive keys
    const baseKey = this.deriveCircuitBreakerKey(config, context)
    const compositeKey = this.computeCompositeKey(config, context)

    // Get or create circuit breaker for this composite key (config-aware)
    let circuitBreaker = this.circuitBreakers.get(compositeKey)
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(config, this.circuitObserver)

      // Bounded map - LRU eviction if at limit
      if (this.circuitBreakers.size >= this.maxCircuitInstances) {
        let lruKey: string | undefined
        let lruTime = Number.POSITIVE_INFINITY
        for (const [key, ts] of this.cbAccessTimes.entries()) {
          if (ts < lruTime) {
            lruTime = ts
            lruKey = key
          }
        }
        if (lruKey) {
          this.circuitBreakers.delete(lruKey)
          this.cbAccessTimes.delete(lruKey)
        }
      }

      this.circuitBreakers.set(compositeKey, circuitBreaker)
    }

    // Access time update for LRU bookkeeping
    this.cbAccessTimes.set(compositeKey, Date.now())

    // Execute through circuit breaker
    return circuitBreaker.execute(baseKey, () => operation(context?.signal))
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
      let timedOut = false

      // Create timeout
      timeoutId = setTimeout(() => {
        timedOut = true
        timeoutController.abort()

        this.telemetry.logEvent('timeout_triggered', context ?? {}, {
          duration: config.duration,
          operationName: config.operationName,
        })

        reject(
          new TimeoutError(
            `Operation timed out after ${config.duration}ms`,
            config.duration,
          ),
        )
      }, config.duration)

      // Combine signals if parent signal exists
      const combinedSignal = context?.signal
        ? AbortSignal.any([context.signal, timeoutController.signal])
        : timeoutController.signal

      // Handle parent cancellation
      const abortHandler = () => {
        clearTimeout(timeoutId)
        timeoutController.abort()
        reject(new Error('Operation was cancelled'))
      }

      if (
        context?.signal &&
        typeof context.signal.addEventListener === 'function'
      ) {
        context.signal.addEventListener('abort', abortHandler, { once: true })
      }

      // Execute operation
      operation(combinedSignal)
        .then((result) => {
          clearTimeout(timeoutId)

          if (!timedOut) {
            this.telemetry.logEvent('timeout_cleared', context ?? {}, {
              duration: config.duration,
              operationName: config.operationName,
            })
          }

          if (
            context?.signal &&
            typeof context.signal.removeEventListener === 'function'
          ) {
            context.signal.removeEventListener('abort', abortHandler)
          }
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          if (
            context?.signal &&
            typeof context.signal.removeEventListener === 'function'
          ) {
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
    // Use the centralized key derivation function
    return deriveKey(context, config)
  }

  /**
   * Compute a composite cache key that includes the base circuit key and a
   * stable hash of the circuit breaker configuration. This prevents reusing a
   * CircuitBreaker instance across different configs for the same base key.
   */
  private computeCompositeKey(
    config: CircuitBreakerConfig,
    context?: ResilienceContext,
  ): string {
    const baseKey = this.deriveCircuitBreakerKey(config, context)
    const hash = this.hashCircuitBreakerConfig(config)
    return `${baseKey}::${hash}`
  }

  /**
   * Create a stable, deterministic hash for circuit breaker config.
   * Uses sorted JSON stringification and a lightweight FNV-1a hash.
   */
  private hashCircuitBreakerConfig(config: CircuitBreakerConfig): string {
    const stableStringify = (obj: unknown): string => {
      if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
      if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
      const entries = Object.entries(obj as Record<string, unknown>).sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
      )
      return `{${entries
        .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
        .join(',')}}`
    }

    const str = stableStringify(config)
    // FNV-1a 32-bit hash
    let hash = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      // 32-bit overflow via multiplication by FNV prime 16777619
      hash = (hash >>> 0) * 0x01000193
      hash >>>= 0
    }
    return hash.toString(16)
  }

  // combineSignals removed in favor of AbortSignal.any (Node >= 20)

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
      } else if (
        policy.retry.jitterStrategy === 'full-jitter' ||
        !policy.retry.jitterStrategy
      ) {
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
    // Find the most recent CB instance matching the base key
    let found: CircuitBreaker | undefined
    for (const [compositeKey, cb] of Array.from(
      this.circuitBreakers.entries(),
    ).reverse()) {
      const base = this.extractBaseKey(compositeKey)
      if (base === key) {
        found = cb
        break
      }
    }
    return found?.getCircuitState(key)
  }

  /**
   * Reset a specific circuit (for testing)
   */
  resetCircuit(key: string): void {
    // Reset all CB instances that match the base key
    for (const [compositeKey, cb] of this.circuitBreakers.entries()) {
      const base = this.extractBaseKey(compositeKey)
      if (base === key) cb.reset(key)
    }
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

  /** Extract the base key from a composite key `${base}::${hash}` */
  private extractBaseKey(compositeKey: string): string {
    const idx = compositeKey.lastIndexOf('::')
    return idx === -1 ? compositeKey : compositeKey.slice(0, idx)
  }
}
