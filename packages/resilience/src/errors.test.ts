import { describe, expect, it } from 'vitest'

import {
  CircuitBreakerOpenError,
  RetryExhaustedError,
  TimeoutError,
  isCircuitBreakerOpenError,
  isRetryExhaustedError,
  isTimeoutError,
} from './errors.js'

describe('Resilience Error Types', () => {
  describe('TimeoutError', () => {
    it('creates timeout error with required fields', () => {
      const error = new TimeoutError('Operation timed out', 5000, 'fetchData')

      expect(error).toBeInstanceOf(TimeoutError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('TimeoutError')
      expect(error.message).toBe('Operation timed out')
      expect(error.timeoutMs).toBe(5000)
      expect(error.operationName).toBe('fetchData')
    })

    it('creates timeout error without operation name', () => {
      const error = new TimeoutError('Timed out', 3000)

      expect(error.timeoutMs).toBe(3000)
      expect(error.operationName).toBeUndefined()
    })

    it('type guard identifies TimeoutError correctly', () => {
      const timeoutError = new TimeoutError('Timeout', 1000)
      const regularError = new Error('Regular error')

      expect(isTimeoutError(timeoutError)).toBe(true)
      expect(isTimeoutError(regularError)).toBe(false)
      expect(isTimeoutError(null)).toBe(false)
      expect(isTimeoutError(undefined)).toBe(false)
    })
  })

  describe('CircuitBreakerOpenError', () => {
    it('creates circuit breaker error with all fields', () => {
      const retryAfter = new Date(Date.now() + 30000)
      const error = new CircuitBreakerOpenError(
        'Circuit breaker is open',
        'service:operation',
        retryAfter,
        5,
      )

      expect(error).toBeInstanceOf(CircuitBreakerOpenError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CircuitBreakerOpenError')
      expect(error.code).toBe('CIRCUIT_OPEN')
      expect(error.message).toBe('Circuit breaker is open')
      expect(error.circuitKey).toBe('service:operation')
      expect(error.retryAfter).toBe(retryAfter)
      expect(error.consecutiveFailures).toBe(5)
    })

    it('provides nextRetryTime as timestamp', () => {
      const retryAfter = new Date(Date.now() + 60000)
      const error = new CircuitBreakerOpenError(
        'Circuit open',
        'key',
        retryAfter,
        3,
      )

      expect(error.nextRetryTime).toBe(retryAfter.getTime())
    })

    it('type guard identifies CircuitBreakerOpenError correctly', () => {
      const cbError = new CircuitBreakerOpenError('Open', 'key', new Date(), 1)
      const regularError = new Error('Regular error')

      expect(isCircuitBreakerOpenError(cbError)).toBe(true)
      expect(isCircuitBreakerOpenError(regularError)).toBe(false)
      expect(isCircuitBreakerOpenError(null)).toBe(false)
      expect(isCircuitBreakerOpenError(undefined)).toBe(false)
    })
  })

  describe('RetryExhaustedError', () => {
    it('creates retry exhausted error with last error', () => {
      const lastError = new Error('Network failed')
      const error = new RetryExhaustedError(
        'All retry attempts failed',
        3,
        lastError,
      )

      expect(error).toBeInstanceOf(RetryExhaustedError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('RetryExhaustedError')
      expect(error.message).toBe('All retry attempts failed')
      expect(error.attempts).toBe(3)
      expect(error.lastError).toBe(lastError)
    })

    it('creates retry exhausted error without last error', () => {
      const error = new RetryExhaustedError('Retries exhausted', 5)

      expect(error.attempts).toBe(5)
      expect(error.lastError).toBeUndefined()
    })

    it('type guard identifies RetryExhaustedError correctly', () => {
      const retryError = new RetryExhaustedError('Exhausted', 3)
      const regularError = new Error('Regular error')

      expect(isRetryExhaustedError(retryError)).toBe(true)
      expect(isRetryExhaustedError(regularError)).toBe(false)
      expect(isRetryExhaustedError(null)).toBe(false)
      expect(isRetryExhaustedError(undefined)).toBe(false)
    })
  })

  describe('Error inheritance', () => {
    it('all custom errors are instanceof Error', () => {
      const timeoutError = new TimeoutError('Timeout', 1000)
      const cbError = new CircuitBreakerOpenError('Open', 'key', new Date(), 1)
      const retryError = new RetryExhaustedError('Exhausted', 3)

      expect(timeoutError).toBeInstanceOf(Error)
      expect(cbError).toBeInstanceOf(Error)
      expect(retryError).toBeInstanceOf(Error)
    })

    it('errors have correct prototype chain', () => {
      const timeoutError = new TimeoutError('Timeout', 1000)

      expect(Object.getPrototypeOf(timeoutError)).toBe(TimeoutError.prototype)
      expect(timeoutError.constructor).toBe(TimeoutError)
    })
  })
})
