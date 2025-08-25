import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CircuitBreakerConfig } from './types.js'

import { CircuitBreaker } from './circuit-breaker.js'
import {
  CircuitBreakerOpenError,
  CircuitBreakerThresholdError,
  CircuitBreakerConfigurationError,
  isCircuitBreakerThresholdError,
  isCircuitBreakerConfigurationError,
} from './errors.js'

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTime: 1000,
    sampleSize: 10,
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

      // Record 9 failures (window size is 10, threshold is 3)
      for (let i = 0; i < 9; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow('fail')
      }

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed') // Still closed because window not full
      expect(state?.windowSize).toBe(9)
    })

    it('opens circuit when window is full and threshold exceeded', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with 10 failures (threshold is 3)
      for (let i = 0; i < 10; i++) {
        await expect(
          circuitBreaker.execute('test-key', operation),
        ).rejects.toThrow('fail')
      }

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('open')
      expect(state?.windowSize).toBe(10)
      expect(state?.nextHalfOpenTime).toBeDefined()
    })

    it('does not open circuit with mixed success/failure below threshold', async () => {
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with pattern: 8 successes, 2 failures (2 failures < threshold of 3)
      for (let i = 0; i < 8; i++) {
        await circuitBreaker.execute('test-key', successOp)
      }
      await expect(circuitBreaker.execute('test-key', failOp)).rejects.toThrow()
      await expect(circuitBreaker.execute('test-key', failOp)).rejects.toThrow()

      const state = circuitBreaker.getCircuitState('test-key')
      expect(state?.status).toBe('closed')
      expect(state?.windowSize).toBe(10)
    })
  })

  describe('Open State', () => {
    beforeEach(async () => {
      // Open the circuit by causing failures
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < 10; i++) {
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
          expect(error.consecutiveFailures).toBe(10)
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
      // Open the circuit - need to fill entire window first
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < 10; i++) {
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
        failureThreshold: 5,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with pattern: [success, failure, failure, failure, failure, success, success, success, success, success]
      // This gives us 4 failures and 6 successes
      await cb.execute('key', successOp) // index 0
      for (let i = 0; i < 4; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow() // index 1-4
      }
      for (let i = 0; i < 5; i++) {
        await cb.execute('key', successOp) // index 5-9
      }

      let state = cb.getCircuitState('key')

      // Window is now full (size 10), but failures (4) < threshold (5)
      expect(state?.status).toBe('closed')
      expect(state?.windowSize).toBe(10)

      // Add one more failure to trigger opening - this will replace the success at index 0
      await expect(cb.execute('key', failOp)).rejects.toThrow()

      state = cb.getCircuitState('key')
      expect(state?.windowIndex).toBe(1) // Wrapped to index 1
      expect(state?.status).toBe('open') // Circuit opens with 5 failures

      // Wait for half-open
      vi.advanceTimersByTime(1001)

      // Success in half-open closes circuit
      await cb.execute('key', successOp)

      state = cb.getCircuitState('key')
      expect(state?.status).toBe('closed')
    })

    it('naturally displaces old outcomes', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with enough failures to trigger opening (10 operations, 3+ failures)
      for (let i = 0; i < 7; i++) {
        await cb.execute('key', successOp)
      }
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow()
      }

      let state = cb.getCircuitState('key')
      expect(state?.status).toBe('open') // Opens due to 3 failures in full window

      // Wait for half-open
      vi.advanceTimersByTime(1001)

      // Successful probe closes circuit
      await cb.execute('key', successOp)

      // Add more successes to displace old failures
      for (let i = 0; i < 10; i++) {
        await cb.execute('key', successOp)
      }

      state = cb.getCircuitState('key')
      expect(state?.status).toBe('closed')

      // Window now contains only successes (failures have been displaced)
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
      for (let i = 0; i < 10; i++) {
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

    it('enforces maximum circuit limit with LRU eviction', async () => {
      const cb = new CircuitBreaker(defaultConfig)
      const operation = vi.fn().mockResolvedValue('success')

      // Create exactly 1000 circuits (at capacity)
      for (let i = 0; i < 1000; i++) {
        await cb.execute(`key-${i}`, operation)
        vi.advanceTimersByTime(1) // Ensure different timestamps
      }

      // Verify we're at capacity
      expect(cb.getStateMapSize()).toBe(1000)

      // Access a few keys to make them more recently used
      vi.advanceTimersByTime(1000) // Large time gap
      await cb.execute('key-0', operation) // Make key-0 more recent
      vi.advanceTimersByTime(1)
      await cb.execute('key-500', operation) // Make key-500 more recent
      vi.advanceTimersByTime(1)
      await cb.execute('key-999', operation) // Make key-999 more recent
      vi.advanceTimersByTime(1)

      // Now add a new circuit - this should evict one of the least recently used
      await cb.execute('key-new', operation)

      // Verify we're still at capacity
      expect(cb.getStateMapSize()).toBe(1000)

      // The recently accessed keys should still exist
      expect(cb.getCircuitState('key-0')).toBeDefined()
      expect(cb.getCircuitState('key-500')).toBeDefined()
      expect(cb.getCircuitState('key-999')).toBeDefined()
      expect(cb.getCircuitState('key-new')).toBeDefined()

      // One of the keys that wasn't recently accessed should be evicted
      // Find out which one was evicted
      let evictedKeys = []
      for (let i = 1; i < 1000; i++) {
        // Skip the keys we recently accessed
        if (i === 500 || i === 999) continue
        if (!cb.getCircuitState(`key-${i}`)) {
          evictedKeys.push(`key-${i}`)
        }
      }
      expect(evictedKeys.length).toBe(1) // Exactly one key should be evicted
    })

    it('uses LRU eviction with deterministic ordering', async () => {
      const cb = new CircuitBreaker(defaultConfig)
      const operation = vi.fn().mockResolvedValue('success')

      // Fill to capacity
      for (let i = 0; i < 1000; i++) {
        await cb.execute(`key-${i}`, operation)
        vi.advanceTimersByTime(1) // Ensure different timestamps
      }

      // Access first few keys to make them recently used
      for (let i = 0; i < 10; i++) {
        await cb.execute(`key-${i}`, operation)
        vi.advanceTimersByTime(1)
      }

      // Add new circuits - should evict the least recently used ones
      // (keys that weren't accessed in the second loop)
      for (let i = 0; i < 5; i++) {
        await cb.execute(`key-new-${i}`, operation)
        vi.advanceTimersByTime(1)
      }

      // Recently accessed keys should still exist
      for (let i = 0; i < 10; i++) {
        expect(cb.getCircuitState(`key-${i}`)).toBeDefined()
      }

      // New keys should exist
      for (let i = 0; i < 5; i++) {
        expect(cb.getCircuitState(`key-new-${i}`)).toBeDefined()
      }

      // Some of the middle keys should have been evicted
      let evictedCount = 0
      for (let i = 10; i < 1000; i++) {
        if (!cb.getCircuitState(`key-${i}`)) {
          evictedCount++
        }
      }
      expect(evictedCount).toBe(5) // Should have evicted 5 to make room for new ones
    })

    it('prevents race conditions during concurrent state access', async () => {
      const cb = new CircuitBreaker(defaultConfig)
      const operation = vi.fn().mockResolvedValue('success')

      // Fill to capacity
      for (let i = 0; i < 1000; i++) {
        await cb.execute(`key-${i}`, operation)
      }

      // Simulate concurrent access that could cause race conditions
      const promises: Promise<string>[] = []
      for (let i = 0; i < 100; i++) {
        // Mix of existing keys and new keys
        const useExistingKey = i % 2 === 0
        const key = useExistingKey ? `key-${i % 1000}` : `key-new-${i}`
        promises.push(cb.execute(key, operation))
      }

      // All operations should complete without throwing
      const results = await Promise.all(promises)
      expect(results).toHaveLength(100)
      results.forEach((result) => expect(result).toBe('success'))

      // Circuit breaker should maintain its size limit
      let totalCircuits = 0
      for (let i = 0; i < 1000; i++) {
        if (cb.getCircuitState(`key-${i}`)) {
          totalCircuits++
        }
      }
      for (let i = 0; i < 100; i++) {
        if (cb.getCircuitState(`key-new-${i}`)) {
          totalCircuits++
        }
      }
      expect(totalCircuits).toBeLessThanOrEqual(1000)
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
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: 5 successes, 5 failures = 50% failure rate
      for (let i = 0; i < 5; i++) {
        await cb.execute('key', successOp)
      }
      for (let i = 0; i < 5; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      }

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
        sampleSize: 10,
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
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window with all failures (need to fill the entire window)
      for (let i = 0; i < 10; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      }

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
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: 8 successes, 2 failures (need full window)
      for (let i = 0; i < 8; i++) {
        await cb.execute('key', successOp)
      }
      for (let i = 0; i < 2; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      }

      // Circuit should be open (2 failures = threshold)
      await expect(cb.execute('key', successOp)).rejects.toThrow(
        CircuitBreakerOpenError,
      )

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')
    })
  })

  describe('Async Cleanup Performance', () => {
    it('performs non-blocking cleanup operations', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 100, // Short recovery time
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const operation = vi.fn().mockResolvedValue('success')

      // Create many circuits that will become stale
      for (let i = 0; i < 200; i++) {
        await cb.execute(`old-key-${i}`, operation)
        vi.advanceTimersByTime(1) // Ensure different timestamps
      }

      // Advance time to make them stale for cleanup
      vi.advanceTimersByTime(config.recoveryTime * 15) // Way past cleanup threshold
      // Also advance past cleanup interval to ensure cleanup is triggered
      vi.advanceTimersByTime(60001)

      // Mock setImmediate to track if async cleanup is used
      const originalSetImmediate = global.setImmediate
      const setImmediatespy = vi.fn(originalSetImmediate)
      global.setImmediate = setImmediatespy

      try {
        // Trigger cleanup by creating a new circuit (this should schedule async cleanup)
        await cb.execute('trigger-cleanup', operation)

        // Verify that setImmediate was called for async cleanup
        expect(setImmediatespy).toHaveBeenCalled()
      } finally {
        global.setImmediate = originalSetImmediate
      }
    })

    it('chunks cleanup operations to prevent event loop blocking', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 100,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const operation = vi.fn().mockResolvedValue('success')

      // Create a large number of stale circuits that will trigger chunking
      for (let i = 0; i < 50; i++) {
        await cb.execute(`stale-key-${i}`, operation)
        vi.advanceTimersByTime(1)
      }

      // Make them stale and advance past cleanup interval
      vi.advanceTimersByTime(config.recoveryTime * 15)
      vi.advanceTimersByTime(60001) // Past cleanup interval

      // Mock setImmediate to verify chunked processing
      let setImmediateCalls = 0
      const originalSetImmediate = global.setImmediate
      global.setImmediate = vi.fn((callback: () => void) => {
        setImmediateCalls++
        return originalSetImmediate(callback)
      })

      try {
        // Trigger cleanup
        await cb.execute('trigger-cleanup', operation)

        // Advance fake timers to allow async operations to complete
        await vi.runAllTimersAsync()

        // Should have processed cleanup in chunks
        // At minimum: 1 call to schedule cleanup + potentially more for chunking
        expect(setImmediateCalls).toBeGreaterThan(0)
      } finally {
        global.setImmediate = originalSetImmediate
      }
    })

    it('throttles cleanup to prevent excessive operations', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const operation = vi.fn().mockResolvedValue('success')

      // Create some circuits
      for (let i = 0; i < 50; i++) {
        await cb.execute(`key-${i}`, operation)
      }

      // Mock setImmediate to track cleanup attempts
      let cleanupAttempts = 0
      const originalSetImmediate = global.setImmediate
      global.setImmediate = vi.fn((callback: () => void) => {
        cleanupAttempts++
        return originalSetImmediate(callback)
      })

      try {
        // Rapidly execute multiple operations to see if cleanup is throttled
        for (let i = 0; i < 20; i++) {
          await cb.execute(`rapid-${i}`, operation)
          vi.advanceTimersByTime(1) // Small time advance
        }

        // Cleanup should be throttled - not called for every operation
        expect(cleanupAttempts).toBeLessThan(20)
      } finally {
        global.setImmediate = originalSetImmediate
      }
    })

    it('does not affect active circuit operations during cleanup', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 100,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const operation = vi.fn().mockResolvedValue('success')

      // Create active circuits
      const activeKeys = ['active-1', 'active-2', 'active-3']
      for (const key of activeKeys) {
        await cb.execute(key, operation)
      }

      // Create stale circuits
      for (let i = 0; i < 100; i++) {
        await cb.execute(`stale-${i}`, operation)
      }

      // Make stale circuits eligible for cleanup
      vi.advanceTimersByTime(config.recoveryTime * 15)

      // Continue using active circuits during cleanup
      for (const key of activeKeys) {
        await cb.execute(key, operation)
      }

      // Trigger cleanup
      await cb.execute('cleanup-trigger', operation)

      // Active circuits should still exist and be functional
      for (const key of activeKeys) {
        expect(cb.getCircuitState(key)).toBeDefined()
        // Should be able to execute without issues
        const result = await cb.execute(key, operation)
        expect(result).toBe('success')
      }
    })

    it('cleans up stale circuits over time', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 100,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const operation = vi.fn().mockResolvedValue('success')

      // Create circuits that will become stale
      const staleKeys = []
      for (let i = 0; i < 50; i++) {
        const key = `stale-${i}`
        staleKeys.push(key)
        await cb.execute(key, operation)
        vi.advanceTimersByTime(1) // Ensure different timestamps
      }

      // Record initial size
      const initialSize = cb.getStateMapSize()

      // Make them stale (ensure they're old enough for cleanup)
      vi.advanceTimersByTime(config.recoveryTime * 15)

      // Force cleanup by advancing past cleanup interval and accessing a new circuit
      vi.advanceTimersByTime(60001) // Past cleanup interval

      // This should trigger cleanup
      await cb.execute('trigger-cleanup', operation)

      // Advance fake timers to allow async operations to complete
      await vi.runAllTimersAsync()

      // Final size should account for new circuit too
      const finalSize = cb.getStateMapSize()

      // Should have cleaned up some stale circuits (initial + 1 new - some cleaned)
      expect(finalSize).toBeLessThanOrEqual(initialSize + 1)

      // Some stale circuits should be gone
      let staleCleaned = 0
      for (const key of staleKeys) {
        if (!cb.getCircuitState(key)) {
          staleCleaned++
        }
      }
      expect(staleCleaned).toBeGreaterThan(0)
    })
  })

  describe('Enhanced Error Handling', () => {
    it('creates threshold error with detailed context', async () => {
      const cb = new CircuitBreaker(defaultConfig)
      const operation = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window to trigger threshold
      for (let i = 0; i < 10; i++) {
        await expect(cb.execute('test-key', operation)).rejects.toThrow('fail')
      }

      // Get the state after threshold is exceeded
      const state = cb.getCircuitState('test-key')
      expect(state?.status).toBe('open')

      // Create enhanced threshold error
      const thresholdError = cb.createThresholdError('test-key', state!)

      expect(thresholdError).toBeInstanceOf(CircuitBreakerThresholdError)
      expect(thresholdError).toBeInstanceOf(CircuitBreakerOpenError)
      expect(thresholdError.name).toBe('CircuitBreakerThresholdError')
      expect(thresholdError.code).toBe('CIRCUIT_BREAKER_THRESHOLD')
      expect(thresholdError.circuitKey).toBe('test-key')
      expect(thresholdError.consecutiveFailures).toBe(10)
      expect(thresholdError.failureRate).toBe(1.0) // 10/10 = 100%
      expect(thresholdError.threshold).toBe(3) // from defaultConfig
      expect(thresholdError.sampleSize).toBe(10) // from defaultConfig
      expect(isCircuitBreakerThresholdError(thresholdError)).toBe(true)
    })

    it('maintains backward compatibility with existing error handling', async () => {
      const cb = new CircuitBreaker(defaultConfig)
      const operation = vi.fn().mockRejectedValue(new Error('original error'))

      // Circuit should still throw original errors during normal operations
      await expect(cb.execute('test-key', operation)).rejects.toThrow(
        'original error',
      )

      // After opening, circuit should throw CircuitBreakerOpenError
      for (let i = 0; i < 9; i++) {
        await expect(cb.execute('test-key', operation)).rejects.toThrow(
          'original error',
        )
      }

      // Now circuit should be open
      const state = cb.getCircuitState('test-key')
      expect(state?.status).toBe('open')

      // Subsequent operations should throw CircuitBreakerOpenError
      await expect(cb.execute('test-key', operation)).rejects.toThrow(
        CircuitBreakerOpenError,
      )
    })

    it('enhanced errors provide specific threshold information for rate-based thresholds', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 0.5, // 50% failure rate
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Fill window: 4 successes, 6 failures = 60% failure rate (exceeds 50% threshold)
      for (let i = 0; i < 4; i++) {
        await cb.execute('key', successOp)
      }
      for (let i = 0; i < 6; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      }

      // Circuit should be open (60% failure rate exceeds 50% threshold)
      await expect(cb.execute('key', successOp)).rejects.toThrow(
        CircuitBreakerOpenError,
      )

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')

      const thresholdError = cb.createThresholdError('key', state!)
      expect(thresholdError.failureRate).toBe(0.6) // 6/10 = 60%
      expect(thresholdError.threshold).toBe(0.5) // 50%
      expect(thresholdError.consecutiveFailures).toBe(6)
    })

    it('enhanced errors provide specific threshold information for count-based thresholds', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 2, // 2 absolute failures
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))

      // Create scenario with 2 failures out of 10 (need to fill window)
      for (let i = 0; i < 8; i++) {
        await cb.execute('key', successOp)
      }
      for (let i = 0; i < 2; i++) {
        await expect(cb.execute('key', failOp)).rejects.toThrow('fail')
      }

      const state = cb.getCircuitState('key')
      expect(state?.status).toBe('open')

      const thresholdError = cb.createThresholdError('key', state!)
      expect(thresholdError.failureRate).toBe(0.2) // 2/10 = 20%
      expect(thresholdError.threshold).toBe(2) // absolute count
      expect(thresholdError.consecutiveFailures).toBe(2)
    })
  })

  describe('Edge Cases', () => {
    it('handles gradual half-open policy', async () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 10,
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
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }
      const cb = new CircuitBreaker(config)

      // Config key is stored but execute still uses provided key
      expect(cb).toBeDefined()
      expect(config.key).toBe('custom-circuit-key')
    })
  })

  describe('Configuration Validation', () => {
    it('throws CircuitBreakerConfigurationError for invalid sampleSize (too small)', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 5, // Less than minimum of 10
        halfOpenPolicy: 'single-probe',
      }

      expect(() => new CircuitBreaker(config)).toThrow(
        CircuitBreakerConfigurationError,
      )
      expect(() => new CircuitBreaker(config)).toThrow(
        'Invalid sampleSize: must be at least 10, got 5',
      )
    })

    it('throws CircuitBreakerConfigurationError for invalid failureThreshold (too high for rate-based)', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 1.5, // Greater than 1.0 for rate-based threshold
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      expect(() => new CircuitBreaker(config)).toThrow(
        CircuitBreakerConfigurationError,
      )
      expect(() => new CircuitBreaker(config)).toThrow(
        'Invalid failureThreshold: must be between 0 and 1 for rate-based thresholds, got 1.5',
      )
    })

    it('throws CircuitBreakerConfigurationError for zero failureThreshold', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 0,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      expect(() => new CircuitBreaker(config)).toThrow(
        CircuitBreakerConfigurationError,
      )
      expect(() => new CircuitBreaker(config)).toThrow(
        'Invalid failureThreshold: must be greater than 0, got 0',
      )
    })

    it('throws CircuitBreakerConfigurationError for negative recoveryTime', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: -1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      expect(() => new CircuitBreaker(config)).toThrow(
        CircuitBreakerConfigurationError,
      )
      expect(() => new CircuitBreaker(config)).toThrow(
        'Invalid recoveryTime: must be positive, got -1000',
      )
    })

    it('throws CircuitBreakerConfigurationError for invalid halfOpenPolicy', () => {
      const config = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'invalid-policy' as const,
      }

      expect(() => new CircuitBreaker(config)).toThrow(
        CircuitBreakerConfigurationError,
      )
      expect(() => new CircuitBreaker(config)).toThrow(
        'Invalid halfOpenPolicy: must be "single-probe" or "gradual", got "invalid-policy"',
      )
    })

    it('accepts valid configuration with rate-based threshold', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 0.5,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'single-probe',
      }

      expect(() => new CircuitBreaker(config)).not.toThrow()
    })

    it('accepts valid configuration with count-based threshold', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 10,
        halfOpenPolicy: 'gradual',
      }

      expect(() => new CircuitBreaker(config)).not.toThrow()
    })

    it('provides detailed error information in CircuitBreakerConfigurationError', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTime: 1000,
        sampleSize: 8, // Keep as 8 for validation testing
        halfOpenPolicy: 'single-probe',
      }

      let caughtError: CircuitBreakerConfigurationError | null = null
      try {
        new CircuitBreaker(config)
      } catch (error) {
        if (isCircuitBreakerConfigurationError(error)) {
          caughtError = error
        }
      }

      expect(caughtError).not.toBeNull()
      expect(caughtError!.field).toBe('sampleSize')
      expect(caughtError!.provided).toBe(8)
      expect(caughtError!.expected).toBe('number >= 10')
    })
  })
})
