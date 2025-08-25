import { describe, expect, it } from 'vitest'

import {
  CircuitBreakerConfigurationError,
  CircuitBreakerOpenError,
  CircuitBreakerThresholdError,
  CircuitBreakerTimeoutError,
  RetryExhaustedError,
  TimeoutError,
  isCircuitBreakerConfigurationError,
  isCircuitBreakerOpenError,
  isCircuitBreakerThresholdError,
  isCircuitBreakerTimeoutError,
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
      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN')
      expect(error.legacyCode).toBe('CIRCUIT_OPEN') // Deprecated alias
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

  describe('CircuitBreakerTimeoutError', () => {
    it('creates timeout error with all fields', () => {
      const retryAfter = new Date(Date.now() + 30000)
      const error = new CircuitBreakerTimeoutError(
        'Circuit breaker timed out during probe',
        'service:operation',
        retryAfter,
        5,
        3000,
        'probeOperation',
      )

      expect(error).toBeInstanceOf(CircuitBreakerTimeoutError)
      expect(error).toBeInstanceOf(CircuitBreakerOpenError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CircuitBreakerTimeoutError')
      expect(error.code).toBe('CIRCUIT_BREAKER_TIMEOUT')
      expect(error.message).toBe('Circuit breaker timed out during probe')
      expect(error.circuitKey).toBe('service:operation')
      expect(error.retryAfter).toBe(retryAfter)
      expect(error.consecutiveFailures).toBe(5)
      expect(error.timeoutMs).toBe(3000)
      expect(error.operationName).toBe('probeOperation')
    })

    it('creates timeout error without operation name', () => {
      const retryAfter = new Date()
      const error = new CircuitBreakerTimeoutError(
        'Timeout',
        'key',
        retryAfter,
        1,
        5000,
      )

      expect(error.timeoutMs).toBe(5000)
      expect(error.operationName).toBeUndefined()
    })

    it('type guard identifies CircuitBreakerTimeoutError correctly', () => {
      const timeoutError = new CircuitBreakerTimeoutError(
        'Timeout',
        'key',
        new Date(),
        1,
        1000,
      )
      const regularError = new Error('Regular error')
      const cbError = new CircuitBreakerOpenError('Open', 'key', new Date(), 1)

      expect(isCircuitBreakerTimeoutError(timeoutError)).toBe(true)
      expect(isCircuitBreakerTimeoutError(regularError)).toBe(false)
      expect(isCircuitBreakerTimeoutError(cbError)).toBe(false)
      expect(isCircuitBreakerTimeoutError(null)).toBe(false)
      expect(isCircuitBreakerTimeoutError(undefined)).toBe(false)
    })

    it('maintains backward compatibility with CircuitBreakerOpenError', () => {
      const timeoutError = new CircuitBreakerTimeoutError(
        'Timeout',
        'key',
        new Date(),
        1,
        1000,
      )

      // Should be identified as CircuitBreakerOpenError as well
      expect(isCircuitBreakerOpenError(timeoutError)).toBe(true)
      expect(timeoutError).toBeInstanceOf(CircuitBreakerOpenError)
    })
  })

  describe('CircuitBreakerConfigurationError', () => {
    it('creates configuration error with all fields', () => {
      const error = new CircuitBreakerConfigurationError(
        'Invalid sampleSize: must be at least 10',
        'sampleSize',
        5,
        'number >= 10',
      )

      expect(error).toBeInstanceOf(CircuitBreakerConfigurationError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CircuitBreakerConfigurationError')
      expect(error.code).toBe('CIRCUIT_BREAKER_CONFIGURATION')
      expect(error.message).toBe('Invalid sampleSize: must be at least 10')
      expect(error.field).toBe('sampleSize')
      expect(error.provided).toBe(5)
      expect(error.expected).toBe('number >= 10')
    })

    it('type guard identifies CircuitBreakerConfigurationError correctly', () => {
      const configError = new CircuitBreakerConfigurationError(
        'Invalid config',
        'field',
        'value',
        'expected',
      )
      const regularError = new Error('Regular error')

      expect(isCircuitBreakerConfigurationError(configError)).toBe(true)
      expect(isCircuitBreakerConfigurationError(regularError)).toBe(false)
      expect(isCircuitBreakerConfigurationError(null)).toBe(false)
      expect(isCircuitBreakerConfigurationError(undefined)).toBe(false)
    })
  })

  describe('CircuitBreakerThresholdError', () => {
    it('creates threshold error with all fields', () => {
      const retryAfter = new Date(Date.now() + 60000)
      const error = new CircuitBreakerThresholdError(
        'Circuit breaker opened due to high failure rate',
        'service:operation',
        retryAfter,
        7,
        0.7,
        0.5,
        10,
      )

      expect(error).toBeInstanceOf(CircuitBreakerThresholdError)
      expect(error).toBeInstanceOf(CircuitBreakerOpenError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CircuitBreakerThresholdError')
      expect(error.code).toBe('CIRCUIT_BREAKER_THRESHOLD')
      expect(error.message).toBe(
        'Circuit breaker opened due to high failure rate',
      )
      expect(error.circuitKey).toBe('service:operation')
      expect(error.retryAfter).toBe(retryAfter)
      expect(error.consecutiveFailures).toBe(7)
      expect(error.failureRate).toBe(0.7)
      expect(error.threshold).toBe(0.5)
      expect(error.sampleSize).toBe(10)
    })

    it('type guard identifies CircuitBreakerThresholdError correctly', () => {
      const thresholdError = new CircuitBreakerThresholdError(
        'Threshold exceeded',
        'key',
        new Date(),
        5,
        0.8,
        0.5,
        10,
      )
      const regularError = new Error('Regular error')
      const cbError = new CircuitBreakerOpenError('Open', 'key', new Date(), 1)

      expect(isCircuitBreakerThresholdError(thresholdError)).toBe(true)
      expect(isCircuitBreakerThresholdError(regularError)).toBe(false)
      expect(isCircuitBreakerThresholdError(cbError)).toBe(false)
      expect(isCircuitBreakerThresholdError(null)).toBe(false)
      expect(isCircuitBreakerThresholdError(undefined)).toBe(false)
    })

    it('maintains backward compatibility with CircuitBreakerOpenError', () => {
      const thresholdError = new CircuitBreakerThresholdError(
        'Threshold',
        'key',
        new Date(),
        1,
        0.6,
        0.5,
        10,
      )

      // Should be identified as CircuitBreakerOpenError as well
      expect(isCircuitBreakerOpenError(thresholdError)).toBe(true)
      expect(thresholdError).toBeInstanceOf(CircuitBreakerOpenError)
    })
  })

  describe('Error inheritance', () => {
    it('all custom errors are instanceof Error', () => {
      const timeoutError = new TimeoutError('Timeout', 1000)
      const cbError = new CircuitBreakerOpenError('Open', 'key', new Date(), 1)
      const retryError = new RetryExhaustedError('Exhausted', 3)
      const cbTimeoutError = new CircuitBreakerTimeoutError(
        'Timeout',
        'key',
        new Date(),
        1,
        1000,
      )
      const configError = new CircuitBreakerConfigurationError(
        'Config',
        'field',
        'value',
        'expected',
      )
      const thresholdError = new CircuitBreakerThresholdError(
        'Threshold',
        'key',
        new Date(),
        1,
        0.6,
        0.5,
        10,
      )

      expect(timeoutError).toBeInstanceOf(Error)
      expect(cbError).toBeInstanceOf(Error)
      expect(retryError).toBeInstanceOf(Error)
      expect(cbTimeoutError).toBeInstanceOf(Error)
      expect(configError).toBeInstanceOf(Error)
      expect(thresholdError).toBeInstanceOf(Error)
    })

    it('errors have correct prototype chain', () => {
      const timeoutError = new TimeoutError('Timeout', 1000)
      const cbTimeoutError = new CircuitBreakerTimeoutError(
        'Timeout',
        'key',
        new Date(),
        1,
        1000,
      )
      const configError = new CircuitBreakerConfigurationError(
        'Config',
        'field',
        'value',
        'expected',
      )
      const thresholdError = new CircuitBreakerThresholdError(
        'Threshold',
        'key',
        new Date(),
        1,
        0.6,
        0.5,
        10,
      )

      expect(Object.getPrototypeOf(timeoutError)).toBe(TimeoutError.prototype)
      expect(timeoutError.constructor).toBe(TimeoutError)

      expect(Object.getPrototypeOf(cbTimeoutError)).toBe(
        CircuitBreakerTimeoutError.prototype,
      )
      expect(cbTimeoutError.constructor).toBe(CircuitBreakerTimeoutError)

      expect(Object.getPrototypeOf(configError)).toBe(
        CircuitBreakerConfigurationError.prototype,
      )
      expect(configError.constructor).toBe(CircuitBreakerConfigurationError)

      expect(Object.getPrototypeOf(thresholdError)).toBe(
        CircuitBreakerThresholdError.prototype,
      )
      expect(thresholdError.constructor).toBe(CircuitBreakerThresholdError)
    })

    it('specialized errors maintain hierarchy with base CircuitBreakerOpenError', () => {
      const cbTimeoutError = new CircuitBreakerTimeoutError(
        'Timeout',
        'key',
        new Date(),
        1,
        1000,
      )
      const thresholdError = new CircuitBreakerThresholdError(
        'Threshold',
        'key',
        new Date(),
        1,
        0.6,
        0.5,
        10,
      )

      // Both should inherit from CircuitBreakerOpenError
      expect(cbTimeoutError).toBeInstanceOf(CircuitBreakerOpenError)
      expect(thresholdError).toBeInstanceOf(CircuitBreakerOpenError)

      // And should work with the base type guard
      expect(isCircuitBreakerOpenError(cbTimeoutError)).toBe(true)
      expect(isCircuitBreakerOpenError(thresholdError)).toBe(true)

      // But configuration error should not inherit from CircuitBreakerOpenError
      const configError = new CircuitBreakerConfigurationError(
        'Config',
        'field',
        'value',
        'expected',
      )
      expect(configError).not.toBeInstanceOf(CircuitBreakerOpenError)
      expect(isCircuitBreakerOpenError(configError)).toBe(false)
    })
  })
})
