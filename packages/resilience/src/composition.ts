/**
 * Resilience pattern composition engine
 * Handles middleware chaining and validation for resilience patterns
 */

import type { CompositionOrder } from '@orchestr8/schema'

import type {
  CircuitBreakerConfig,
  NormalizedResilienceConfig,
  ResilienceContext,
  ResilientOperation,
  RetryConfig,
  TimeoutConfig,
} from './types.js'

import { CircuitBreaker } from './circuit-breaker.js'
import { CircuitBreakerOpenError } from './errors.js'
import { deriveKey } from './key-derivation.js'

/**
 * Middleware function type - wraps an operation with resilience behavior
 */
export type ResilienceMiddleware<T> = (
  operation: ResilientOperation<T>,
  context?: ResilienceContext,
) => Promise<T>

/**
 * Wrapper function type for individual resilience patterns
 */
export type PatternWrapper<
  T,
  C = RetryConfig | CircuitBreakerConfig | TimeoutConfig,
> = (
  operation: ResilientOperation<T>,
  config: C,
  context?: ResilienceContext,
) => Promise<T>

/**
 * Supported composition orders as a const array for validation
 */
const SUPPORTED_ORDERS = ['retry-cb-timeout', 'timeout-cb-retry'] as const

/**
 * Resilience composition engine
 * Validates and composes resilience patterns according to specified order
 */
export class ResilienceComposer {
  private retryWrapper?: PatternWrapper<unknown, RetryConfig>
  private circuitBreakerWrapper?: PatternWrapper<unknown, CircuitBreakerConfig>
  private timeoutWrapper?: PatternWrapper<unknown, TimeoutConfig>

  /**
   * Set the retry pattern wrapper implementation
   */
  setRetryWrapper<T>(wrapper: PatternWrapper<T, RetryConfig>): void {
    this.retryWrapper = wrapper as PatternWrapper<unknown, RetryConfig>
  }

  /**
   * Set the circuit breaker pattern wrapper implementation
   */
  setCircuitBreakerWrapper<T>(
    wrapper: PatternWrapper<T, CircuitBreakerConfig>,
  ): void {
    this.circuitBreakerWrapper = wrapper as PatternWrapper<
      unknown,
      CircuitBreakerConfig
    >
  }

  /**
   * Set the timeout pattern wrapper implementation
   */
  setTimeoutWrapper<T>(wrapper: PatternWrapper<T, TimeoutConfig>): void {
    this.timeoutWrapper = wrapper as PatternWrapper<unknown, TimeoutConfig>
  }

  /**
   * Compose resilience patterns into a middleware chain
   * @param config - Normalized resilience configuration
   * @param compositionOrder - The order in which to compose patterns
   * @returns A middleware function that applies all configured patterns
   */
  compose<T>(
    config: NormalizedResilienceConfig,
    compositionOrder: CompositionOrder,
  ): ResilienceMiddleware<T> {
    // Validate composition order
    if (!this.isValidCompositionOrder(compositionOrder)) {
      throw new Error(
        `Unsupported composition order: ${compositionOrder}. ` +
          `Supported orders are: ${SUPPORTED_ORDERS.join(', ')}`,
      )
    }

    // Parse the composition order
    const patterns = compositionOrder.split('-')

    // Build middleware chain in reverse order (innermost first)
    return async (
      operation: ResilientOperation<T>,
      context?: ResilienceContext,
    ): Promise<T> => {
      // Check for early cancellation
      if (context?.signal?.aborted) {
        throw new Error('Operation was cancelled')
      }

      // Start with the base operation
      let wrappedOperation = operation

      // Apply patterns in reverse order to build the chain
      for (let i = patterns.length - 1; i >= 0; i--) {
        const pattern = patterns[i]

        switch (pattern) {
          case 'retry':
            if (config.retry && this.retryWrapper) {
              const currentOp = wrappedOperation
              const retryConfig = config.retry
              const wrapper = this.retryWrapper
              wrappedOperation = async (signal?: AbortSignal) => {
                // Create a new context with the signal for this layer
                const layerContext = { ...context, signal }
                return wrapper(
                  currentOp,
                  retryConfig,
                  layerContext as ResilienceContext,
                ) as Promise<T>
              }
            }
            break

          case 'cb':
            if (config.circuitBreaker && this.circuitBreakerWrapper) {
              const currentOp = wrappedOperation
              const cbConfig = config.circuitBreaker
              const wrapper = this.circuitBreakerWrapper
              wrappedOperation = async (signal?: AbortSignal) => {
                // Create a new context with the signal for this layer
                const layerContext = { ...context, signal }
                return wrapper(
                  currentOp,
                  cbConfig,
                  layerContext as ResilienceContext,
                ) as Promise<T>
              }
            }
            break

          case 'timeout':
            if (config.timeout && this.timeoutWrapper) {
              const currentOp = wrappedOperation
              const timeoutConfig = config.timeout
              const wrapper = this.timeoutWrapper
              wrappedOperation = async (signal?: AbortSignal) => {
                // Create a new context with the signal for this layer
                const layerContext = { ...context, signal }
                return wrapper(
                  currentOp,
                  timeoutConfig,
                  layerContext as ResilienceContext,
                ) as Promise<T>
              }
            }
            break

          default:
            // Skip unknown patterns (shouldn't happen after validation)
            break
        }
      }

      // Execute the composed operation
      return wrappedOperation(context?.signal)
    }
  }

  /**
   * Validate if a composition order is supported
   */
  private isValidCompositionOrder(
    order: string,
  ): order is (typeof SUPPORTED_ORDERS)[number] {
    return (SUPPORTED_ORDERS as readonly string[]).includes(order)
  }
}

/**
 * Default retry wrapper implementation
 */
export async function defaultRetryWrapper<T>(
  operation: ResilientOperation<T>,
  config: RetryConfig,
  context?: ResilienceContext,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    // Check for cancellation
    if (context?.signal?.aborted) throw new Error('Operation was cancelled')

    try {
      return await operation(context?.signal)
    } catch (error) {
      lastError = error

      // Never retry on CircuitBreakerOpenError
      if (error instanceof CircuitBreakerOpenError) {
        throw error
      }

      // Check custom retry predicate if provided
      if (config.retryOn && !config.retryOn(error)) {
        throw error
      }

      // Don't delay after the last attempt
      if (attempt < config.maxAttempts) {
        const delay = calculateBackoffDelay(
          attempt,
          config.initialDelay,
          config.maxDelay,
          config.backoffStrategy,
          config.jitterStrategy,
        )

        await sleep(delay, context?.signal)
      }
    }
  }

  // All retries exhausted
  throw lastError
}

/**
 * Default timeout wrapper implementation
 */
export async function defaultTimeoutWrapper<T>(
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
      reject(new Error(`Operation timed out after ${config.duration}ms`))
    }, config.duration)

    // Combine signals if parent signal exists
    const combinedSignal = context?.signal
      ? combineSignals([context.signal, timeoutController.signal])
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
 * Default circuit breaker wrapper using CircuitBreaker class
 */
export async function defaultCircuitBreakerWrapper<T>(
  operation: ResilientOperation<T>,
  config: CircuitBreakerConfig,
  context?: ResilienceContext,
): Promise<T> {
  // Derive key for circuit isolation
  const key = deriveKey(context, config)

  // Create or reuse circuit breaker instance
  // Note: In production, this should be cached/singleton per config
  const circuitBreaker = new CircuitBreaker(config)

  // Execute through circuit breaker
  return circuitBreaker.execute(key, () => operation(context?.signal))
}

/**
 * Calculate backoff delay with optional jitter
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffStrategy: 'fixed' | 'exponential',
  jitterStrategy: 'none' | 'full',
): number {
  let delay: number

  if (backoffStrategy === 'exponential') {
    delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
  } else {
    delay = initialDelay
  }

  if (jitterStrategy === 'full') {
    delay = Math.random() * delay
  }

  return Math.max(0, delay)
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
 * Combine multiple abort signals into one
 */
function combineSignals(signals: AbortSignal[]): AbortSignal {
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
