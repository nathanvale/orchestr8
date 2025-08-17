import type { ResilienceOperation } from './types.js'
import { retry } from './retry.js'
import { timeout } from './timeout.js'
import { circuitBreaker } from './circuit-breaker.js'
import type {
  RetryOptions,
  TimeoutOptions,
  CircuitBreakerOptions,
} from './types.js'

export interface ComposedResilienceOptions {
  retry?: RetryOptions
  timeout?: TimeoutOptions
  circuitBreaker?: CircuitBreakerOptions
}

export function composeResilience<T>(
  operation: ResilienceOperation<T>,
  options: ComposedResilienceOptions,
): ResilienceOperation<T> {
  let composed = operation

  // Apply timeout first (innermost)
  if (options.timeout) {
    const timeoutOp = composed
    composed = () => timeout(timeoutOp, options.timeout!)
  }

  // Apply circuit breaker
  if (options.circuitBreaker) {
    composed = circuitBreaker(composed, options.circuitBreaker)
  }

  // Apply retry last (outermost)
  if (options.retry) {
    const retryOp = composed
    composed = () => retry(retryOp, options.retry!)
  }

  return composed
}
