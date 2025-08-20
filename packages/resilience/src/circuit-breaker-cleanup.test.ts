import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { CircuitBreakerConfig } from './types.js'

import { CircuitBreaker } from './circuit-breaker.js'

describe('Circuit Breaker Cleanup', () => {
  let circuitBreaker: CircuitBreaker
  let config: CircuitBreakerConfig

  beforeEach(() => {
    vi.useFakeTimers()

    config = {
      failureThreshold: 3,
      recoveryTime: 1000,
      sampleSize: 10,
      halfOpenPolicy: 'single-probe',
    }

    circuitBreaker = new CircuitBreaker(config)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should cleanup expired circuits after cleanup interval', async () => {
    const operations: Array<() => Promise<void>> = []

    // Create multiple circuits
    for (let i = 0; i < 10; i++) {
      const key = `circuit-${i}`
      operations.push(async () => {
        await circuitBreaker.execute(key, async () => {
          return 'success'
        })
      })
    }

    // Execute all operations to create circuits
    await Promise.all(operations.map((op) => op()))

    // Get initial state count
    const initialState = circuitBreaker.getDebugInfo('circuit-0')
    expect(initialState).toBeDefined()

    // Advance time past cleanup interval (60 seconds)
    vi.advanceTimersByTime(61000)

    // Access one circuit to trigger cleanup
    await circuitBreaker.execute('circuit-new', async () => {
      return 'success'
    })

    // Advance time to make old circuits expire (10x reset timeout)
    vi.advanceTimersByTime(config.recoveryTime * 10 + 1000)

    // Trigger another access to perform cleanup
    await circuitBreaker.execute('circuit-trigger', async () => {
      return 'success'
    })

    // Old circuits should be cleaned up
    const cleanedState = circuitBreaker.getDebugInfo('circuit-0')
    expect(cleanedState).toBeUndefined()

    // Recent circuits should still exist
    const recentState = circuitBreaker.getDebugInfo('circuit-trigger')
    expect(recentState).toBeDefined()
  })

  it('should not cleanup if interval has not elapsed', async () => {
    // Create a circuit
    await circuitBreaker.execute('test-circuit', async () => {
      return 'success'
    })

    // Advance time less than cleanup interval
    vi.advanceTimersByTime(30000) // 30 seconds

    // Create another circuit (should not trigger cleanup)
    await circuitBreaker.execute('another-circuit', async () => {
      return 'success'
    })

    // Both circuits should still exist
    expect(circuitBreaker.getDebugInfo('test-circuit')).toBeDefined()
    expect(circuitBreaker.getDebugInfo('another-circuit')).toBeDefined()
  })

  it('should cleanup stale open circuits', async () => {
    const key = 'failing-circuit'

    // Make circuit fail enough times to fill the window and open
    for (let i = 0; i < config.sampleSize; i++) {
      try {
        await circuitBreaker.execute(key, async () => {
          throw new Error('Test failure')
        })
      } catch {
        // Expected
      }
    }

    // Circuit should be open
    const openState = circuitBreaker.getDebugInfo(key)
    expect(openState?.status).toBe('open')

    // Advance time way past recovery time
    vi.advanceTimersByTime(config.recoveryTime * 20 + 61000) // Way past expiry + cleanup interval

    // Trigger cleanup
    await circuitBreaker.execute('cleanup-trigger', async () => {
      return 'success'
    })

    // Stale open circuit should be cleaned up
    const cleanedState = circuitBreaker.getDebugInfo(key)
    expect(cleanedState).toBeUndefined()
  })

  it('should maintain bounded state map during cleanup', async () => {
    // Create many circuits to test bounded map
    const operations: Array<() => Promise<void>> = []

    for (let i = 0; i < 100; i++) {
      const key = `bounded-${i}`
      operations.push(async () => {
        await circuitBreaker.execute(key, async () => {
          return 'success'
        })
      })
    }

    await Promise.all(operations.map((op) => op()))

    // Advance time to trigger cleanup
    vi.advanceTimersByTime(61000)

    // Create one more to trigger cleanup
    await circuitBreaker.execute('final-circuit', async () => {
      return 'success'
    })

    // State map should remain bounded (implementation has max 1000)
    // This test just ensures cleanup doesn't break the bounded map
    expect(circuitBreaker.getDebugInfo('final-circuit')).toBeDefined()
  })
})
