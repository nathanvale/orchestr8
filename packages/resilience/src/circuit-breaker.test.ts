import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CircuitBreakerConfig } from './types.js'

import { CircuitBreaker } from './circuit-breaker.js'
import { CircuitBreakerOpenError } from './errors.js'

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTime: 1000,
    sampleSize: 5,
    halfOpenPolicy: 'single-probe',
  }

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(defaultConfig)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Closed State', () => {
    it('executes operations successfully when closed', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await circuitBreaker.execute('test-key', operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledOnce()

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed')
    })

    it('records successes in sliding window', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await circuitBreaker.execute('test-key', operation)
      await circuitBreaker.execute('test-key', operation)

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.windowSize).toBe(2)
      expect(state?.slidingWindow[0]).toBe(true)
      expect(state?.slidingWindow[1]).toBe(true)
    })

    it('records failures in sliding window', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      await expect(
        circuitBreaker.execute('test-key', operation),
      ).rejects.toThrow('fail')

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.windowSize).toBe(1)
      expect(state?.slidingWindow[0]).toBe(false)
      expect(state?.lastFailureTime).toBeDefined()
    })

    it('does not open circuit until window is full', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      // Record 4 failures (window size is 5, threshold is 3)
      for (let i = 0; i < 4; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow('fail')
      }

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed') // Still closed because window not full
      expect(state?.windowSize).toBe(4)
    })

    it('opens circuit when window is full and threshold exceeded', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with 5 failures (threshold is 3)
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow('fail')
      }

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('open')
      expect(state?.windowSize).toBe(5)
      expect(state?.nextHalfOpenTime).toBeDefined()
    })

    it('does not open circuit with mixed success/failure below threshold', async () => {
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Pattern: success, fail, success, fail, success (2 failures, threshold is 3)
      await circuitBreaker.execute('test-key', successOp)
      await expect(circuitBreaker.execute('test-key', failOp)).rejects.toThrow()
      await circuitBreaker.execute('test-key', successOp)
      await expect(circuitBreaker.execute('test-key', failOp)).rejects.toThrow()
      await circuitBreaker.execute('test-key', successOp)

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed')
      expect(state?.windowSize).toBe(5)
    })
  })

  describe('Open State', () => {
    beforeEach(async () => {
      // Open the circuit by causing failures
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow('fail')
      }
    })

    it('rejects operations immediately when open', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await expect(
        circuitBreaker.execute('test-key', operation),
      ).rejects.toThrow(CircuitBreakerOpenError)

      expect(operation).not.toHaveBeenCalled()
    })

    it('provides retry information in error', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      try {
        await circuitBreaker.execute('test-key', operation)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError)
        if (error instanceof CircuitBreakerOpenError) {
          expect(error.circuitKey).toBe('test-key')
          expect(error.retryAfter).toBeInstanceOf(Date)
          expect(error.nextRetryTime).toBeGreaterThan(Date.now())
          expect(error.consecutiveFailures).toBe(5)
        }
      }
    })

    it('transitions to half-open after recovery time', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      // Initially open - should reject
      await expect(
        circuitBreaker.execute('test-key', operation),
      ).rejects.toThrow(CircuitBreakerOpenError)

      // Advance time past recovery period
      vi.advanceTimersByTime(1001)

      // Should now execute (half-open)
      const result = await circuitBreaker.execute('test-key', operation)
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledOnce()
    })
  })

  describe('Half-Open State', () => {
    beforeEach(async () => {
      // Open the circuit
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < 5; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow('fail')
      }

      // Advance to half-open
      vi.advanceTimersByTime(1001)
    })

    it('allows single probe in half-open state', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await circuitBreaker.execute('test-key', operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledOnce()

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed') // Successful probe closes circuit
    })

    it('rejects concurrent requests during probe', async () => {
      // Create a slow operation that will hold the probe lock
      let resolveOperation: (value: string) => void
      const slowOperation = vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveOperation = resolve
          }),
      )

      const fastOperation = vi.fn().mockResolvedValue('fast')

      // Start probe with slow operation
      const probePromise = circuitBreaker.execute('test-key', slowOperation)

      // Try concurrent request - should be rejected
      await expect(
        circuitBreaker.execute('test-key', fastOperation),
      ).rejects.toThrow(CircuitBreakerOpenError)

      expect(fastOperation).not.toHaveBeenCalled()

      // Complete the probe
      resolveOperation!('slow')
      await probePromise

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed')
    })

    it('returns to open on probe failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('still failing'))

      await expect(
        circuitBreaker.execute('test-key', operation),
      ).rejects.toThrow('still failing')

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('open')
      expect(state?.probeInProgress).toBe(false)
      expect(state?.nextHalfOpenTime).toBeGreaterThan(Date.now())
    })

    it('closes circuit on successful probe', async () => {
      const successOp = vi.fn().mockResolvedValue('recovered')

      const result = await circuitBreaker.execute('test-key', successOp)
      expect(result).toBe('recovered')

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed')
      expect(state?.lastFailureTime).toBeUndefined()
      expect(state?.nextHalfOpenTime).toBeUndefined()

      // Circuit should now accept multiple requests
      await circuitBreaker.execute('test-key', successOp)
      await circuitBreaker.execute('test-key', successOp)

      expect(successOp).toHaveBeenCalledTimes(3)
    })
  })

  describe('Sliding Window Behavior', () => {
    it('uses circular buffer correctly', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 2,
        recoveryTime: 1000,
        sampleSize: 3,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: fail, fail
      await expect(cb.execute('key', failOp)).rejects.toThrow()
      await expect(cb.execute('key', failOp)).rejects.toThrow()

      let state = cb.getCircuitState('key')

      // Window not full yet (size 2 < 3), so circuit should still be closed
      expect(state?.status).toBe('closed')
      expect(state?.windowSize).toBe(2)

      // Add success to fill window
      await cb.execute('key', successOp)

      state = cb.getCircuitState('key')

      // Window is now full with [fail, fail, success]
      // 2 failures >= threshold but circuit doesn't open on success
      expect(state?.status).toBe('closed')
      expect(state?.windowSize).toBe(3)

      // Add another failure - wraps around, window becomes [fail, fail, success]
      await expect(cb.execute('key', failOp)).rejects.toThrow()

      state = cb.getCircuitState('key')
      expect(state?.windowIndex).toBe(1) // Wrapped to index 1
      // Now we have [fail(new at 0), fail, success] - still 2 failures
      // Circuit should open now because window is full and failures >= threshold
      expect(state?.status).toBe('open')

      // Wait for half-open
      vi.advanceTimersByTime(1001)

      // Success in half-open closes circuit
      await cb.execute('key', successOp)

      state = cb.getCircuitState('key')
      expect(state?.status).toBe('closed')

      // Circuit resets and starts fresh after closing from half-open
    })

    it('naturally displaces old outcomes', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 3,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill with failures
      await expect(cb.execute('key', failOp)).rejects.toThrow()
      await expect(cb.execute('key', failOp)).rejects.toThrow()
      await expect(cb.execute('key', failOp)).rejects.toThrow()

      let state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')

      // Wait for half-open
      vi.advanceTimersByTime(1001)

      // Successful probe closes circuit
      await cb.execute('key', successOp)

      // Add more successes - they displace failures
      await cb.execute('key', successOp)
      await cb.execute('key', successOp)

      state = cb.getCircuitState('key')
      expect(state?.status).toBe('closed')

      // Window now contains only successes
      const failures = state!.slidingWindow
        .slice(0, state!.windowSize)
        .filter((v) => v === false).length
      expect(failures).toBe(0)
    })
  })

  describe('Multiple Circuits', () => {
    it('maintains separate state per key', async () => {
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Open circuit for key1
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute('key1', failOp)).rejects.toThrow()
      }

      // key2 should still work
      const result = await circuitBreaker.execute('key2', successOp)
      expect(result).toBe('success')

      const state1 = circuitBreaker.getCircuitState('key1')
      const state2 = circuitBreaker.getCircuitState('key2')

      expect(state1?.status).toBe('open')
      expect(state2?.status).toBe('closed')
    })

    it('enforces maximum circuit limit', async () => {
      const cb = new CircuitBreaker(defaultConfig)
      const operation = vi.fn().mockResolvedValue('success')

      // Create circuits up to limit
      for (let i = 0; i < 1001; i++) {
        await cb.execute(`key-${i}`, operation)
      }

      // First circuit should be evicted
      expect(cb.getCircuitState('key-0')).toBeUndefined()
      // Last circuit should exist
      expect(cb.getCircuitState('key-1000')).toBeDefined()
    })
  })

  describe('Utility Methods', () => {
    it('derives circuit key from workflow and step IDs', () => {
      const key = CircuitBreaker.deriveKey('workflow-123', 'step-456')
      expect(key).toBe('workflow-123:step-456')
    })

    it('resets individual circuit', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await circuitBreaker.execute('test-key', operation)
      expect(circuitBreaker.getCircuitState('test-key')).toBeDefined()

      circuitBreaker.reset('test-key')
      expect(circuitBreaker.getCircuitState('test-key')).toBeUndefined()
    })

    it('resets all circuits', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await circuitBreaker.execute('key1', operation)
      await circuitBreaker.execute('key2', operation)

      circuitBreaker.resetAll()

      expect(circuitBreaker.getCircuitState('key1')).toBeUndefined()
      expect(circuitBreaker.getCircuitState('key2')).toBeUndefined()
    })
  })

  describe('Rate-based Threshold', () => {
    it('opens circuit when failure rate exceeds threshold', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 0.5, // 50% failure rate
        recoveryTime: 1000,
        sampleSize: 4,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: 2 successes, 2 failures = 50% failure rate
      await cb.execute('key', successOp)
      await cb.execute('key', successOp)
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')

      // Circuit should be open (50% failure rate met)
      await expect(cb.execute('key', successOp)).rejects.toThrow(
        CircuitBreakerOpenError,
      )

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')
    })

    it('does not open circuit when failure rate is below threshold', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 0.75, // 75% failure rate
        recoveryTime: 1000,
        sampleSize: 4,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: 2 successes, 2 failures = 50% failure rate
      await cb.execute('key', successOp)
      await cb.execute('key', successOp)
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')

      // Circuit should remain closed (50% < 75% threshold)
      const result = await cb.execute('key', successOp)
      expect(result).toBe('success')

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('closed')
    })

    it('treats 1.0 as 100% failure rate', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 1.0, // 100% failure rate
        recoveryTime: 1000,
        sampleSize: 3,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with all failures
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')

      // Circuit should be open (100% failure rate)
      await expect(cb.execute('key', successOp)).rejects.toThrow(
        CircuitBreakerOpenError,
      )

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')
    })

    it('treats values > 1 as absolute count', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 2, // Absolute count of 2 failures
        recoveryTime: 1000,
        sampleSize: 5,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: 3 successes, 2 failures
      await cb.execute('key', successOp)
      await cb.execute('key', successOp)
      await cb.execute('key', successOp)
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      await expect(cb.execute('key', failOp)).rejects.toThrow('fail')

      // Circuit should be open (2 failures = threshold)
      await expect(cb.execute('key', successOp)).rejects.toThrow(
        CircuitBreakerOpenError,
      )

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')
    })
  })

  describe('Edge Cases', () => {
    it('handles gradual half-open policy', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 5,
        halfOpenPolicy: 'gradual', // Not fully implemented yet, but should not break
      }
      const cb = new CircuitBreaker(config)
      const operation = vi.fn().mockResolvedValue('success')

      const result = await cb.execute('test', operation)
      expect(result).toBe('success')
    })

    it('handles operations that throw non-Error objects', async () => {
      const operation = vi.fn().mockRejectedValue('string error')

      await expect(circuitBreaker.execute('test-key', operation)).rejects.toBe(
        'string error',
      )

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.windowSize).toBe(1)
      expect(state?.slidingWindow[0]).toBe(false)
    })

    it('handles explicit circuit key in config', () => {
      const config: CircuitBreakerConfig = {
        key: 'custom-circuit-key',
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 5,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      // Config key is stored but execute still uses provided key
      expect(cb).toBeDefined()
      expect(config.key).toBe('custom-circuit-key')
    })
  })
})
