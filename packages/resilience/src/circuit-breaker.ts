import type { CircuitBreakerOptions, ResilienceOperation } from './types.js'
import { CircuitOpenError } from './types.js'

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  lastFailureTime?: number
  successCount: number
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

export function circuitBreaker<T>(
  operation: ResilienceOperation<T>,
  options: CircuitBreakerOptions,
): ResilienceOperation<T> {
  return async (signal?: AbortSignal) => {
    const key = options.keyGenerator ? options.keyGenerator() : 'default'

    if (!circuitBreakers.has(key)) {
      circuitBreakers.set(key, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
      })
    }

    const breaker = circuitBreakers.get(key)!

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (breaker.state === CircuitState.OPEN && breaker.lastFailureTime) {
      const timeSinceFailure = Date.now() - breaker.lastFailureTime
      if (timeSinceFailure >= options.resetTimeMs) {
        breaker.state = CircuitState.HALF_OPEN
        breaker.successCount = 0
      }
    }

    // Check circuit state
    if (breaker.state === CircuitState.OPEN) {
      throw new CircuitOpenError()
    }

    try {
      const result = await operation(signal)

      // Success handling
      if (breaker.state === CircuitState.HALF_OPEN) {
        breaker.successCount++
        if (breaker.successCount >= options.halfOpenProbes) {
          breaker.state = CircuitState.CLOSED
          breaker.failureCount = 0
        }
      } else {
        breaker.failureCount = 0
      }

      return result
    } catch (error) {
      // Failure handling
      breaker.failureCount++
      breaker.lastFailureTime = Date.now()

      if (breaker.failureCount >= options.failureThreshold) {
        breaker.state = CircuitState.OPEN
      }

      throw error
    }
  }
}
