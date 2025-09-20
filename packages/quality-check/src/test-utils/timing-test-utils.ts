/**
 * Timing Test Utilities
 *
 * Provides helper functions for testing time-dependent code with proper fake timer control.
 * Ensures reliable, fast, and deterministic timing-dependent tests.
 */

import { vi } from 'vitest'

/**
 * Configuration for timing test utilities
 */
export interface TimingTestConfig {
  /**
   * Whether to use real timers for certain operations
   * @default false
   */
  useRealTimers?: boolean

  /**
   * Default timeout for fake timer operations (ms)
   * @default 1000
   */
  defaultTimeout?: number

  /**
   * Whether to automatically advance timers in async operations
   * @default true
   */
  autoAdvance?: boolean
}

/**
 * Sets up fake timers for reliable timing tests
 * Should be called in beforeEach() of timing-dependent tests
 */
export function setupFakeTimers(config: TimingTestConfig = {}): void {
  const { useRealTimers = false } = config

  if (!useRealTimers) {
    vi.useFakeTimers()
  }
}

/**
 * Tears down fake timers and restores real timers
 * Should be called in afterEach() of timing-dependent tests
 */
export function teardownFakeTimers(): void {
  vi.useRealTimers()
  vi.clearAllTimers()
}

/**
 * Advances fake timers by specified milliseconds
 * Ensures all pending timer callbacks are executed
 */
export async function advanceTimers(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms)
  // Allow any immediate promises to resolve
  await vi.runAllTimersAsync()
}

/**
 * Advances timers to next timer and executes all pending timers
 * Useful when you don't know exact timing but want to trigger next timeout
 */
export async function advanceToNextTimer(): Promise<void> {
  vi.advanceTimersToNextTimer()
  await vi.runAllTimersAsync()
}

/**
 * Runs all pending timers immediately
 * Useful for tests that need all timeouts to complete instantly
 */
export async function runAllTimers(): Promise<void> {
  vi.runAllTimers()
  await vi.runAllTimersAsync()
}

/**
 * Creates a controlled delay that works with fake timers
 * Returns a promise that resolves after the specified time when timers are advanced
 */
export function createControlledDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Waits for a condition to be true, advancing timers if needed
 * Useful for testing async operations with timing dependencies
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    advanceTimers?: boolean
  } = {},
): Promise<void> {
  const { timeout = 5000, interval = 10, advanceTimers: shouldAdvanceTimers = true } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }

    if (shouldAdvanceTimers) {
      await advanceTimers(interval)
    } else {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Creates a mock function that tracks timing of calls
 * Useful for verifying that functions are called at expected times
 */
export function createTimingMock() {
  const calls: Array<{ timestamp: number; args: unknown[] }> = []

  const mockFn = vi.fn((...args: unknown[]) => {
    calls.push({ timestamp: Date.now(), args })
  })

  return {
    mock: mockFn,
    calls,
    getCallTimestamps: () => calls.map((call) => call.timestamp),
    getTimeBetweenCalls: (index1: number, index2: number) => {
      if (index1 >= calls.length || index2 >= calls.length) {
        throw new Error('Call index out of range')
      }
      return calls[index2].timestamp - calls[index1].timestamp
    },
    reset: () => {
      calls.length = 0
      mockFn.mockClear()
    },
  }
}

/**
 * Test helper for testing timeout behavior
 * Automatically sets up fake timers and provides timeout testing utilities
 */
export class TimeoutTester {
  private startTime: number = 0
  private timeoutPromise: Promise<unknown> | null = null
  private resolved = false
  private rejected = false
  private result: unknown = undefined
  private error: unknown = undefined

  /**
   * Starts tracking a promise that should timeout
   */
  track<T>(promise: Promise<T>): TimeoutTester {
    this.startTime = Date.now()
    this.timeoutPromise = promise
    this.resolved = false
    this.rejected = false
    this.result = undefined
    this.error = undefined

    promise
      .then((result) => {
        this.resolved = true
        this.result = result
      })
      .catch((error) => {
        this.rejected = true
        this.error = error
      })

    return this
  }

  /**
   * Advances timers and checks if promise has resolved
   */
  async advanceAndCheck(ms: number): Promise<{
    resolved: boolean
    rejected: boolean
    result?: unknown
    error?: unknown
    elapsedTime: number
  }> {
    await advanceTimers(ms)

    return {
      resolved: this.resolved,
      rejected: this.rejected,
      result: this.result,
      error: this.error,
      elapsedTime: Date.now() - this.startTime,
    }
  }

  /**
   * Waits for the tracked promise to settle (resolve or reject)
   */
  async waitForSettlement(): Promise<void> {
    if (!this.timeoutPromise) {
      throw new Error('No promise being tracked')
    }

    try {
      await this.timeoutPromise
    } catch {
      // Ignore rejections, we just want to wait for settlement
    }
  }
}

/**
 * Common timing test patterns
 */
export const TimingPatterns = {
  /**
   * Tests that a function times out after a specified period
   */
  async testTimeout<T>(
    fn: () => Promise<T>,
    expectedTimeoutMs: number,
    tolerance: number = 10,
  ): Promise<void> {
    const tester = new TimeoutTester()
    const promise = fn()
    tester.track(promise)

    // Should not resolve before timeout
    const beforeTimeout = await tester.advanceAndCheck(expectedTimeoutMs - tolerance)
    if (beforeTimeout.resolved || beforeTimeout.rejected) {
      throw new Error(`Promise settled before expected timeout of ${expectedTimeoutMs}ms`)
    }

    // Should resolve/reject after timeout
    const afterTimeout = await tester.advanceAndCheck(tolerance * 2)
    if (!afterTimeout.resolved && !afterTimeout.rejected) {
      throw new Error(`Promise did not settle after expected timeout of ${expectedTimeoutMs}ms`)
    }
  },

  /**
   * Tests that a function completes within a specified time
   */
  async testCompletion<T>(fn: () => Promise<T>, maxTimeMs: number): Promise<T> {
    const tester = new TimeoutTester()
    const promise = fn()
    tester.track(promise)

    const result = await tester.advanceAndCheck(maxTimeMs)
    if (!result.resolved) {
      if (result.rejected) {
        throw result.error
      }
      throw new Error(`Function did not complete within ${maxTimeMs}ms`)
    }

    return result.result as T
  },

  /**
   * Tests retry behavior with exponential backoff
   */
  async testRetryWithBackoff(
    fn: () => Promise<unknown>,
    expectedRetries: number,
    baseDelay: number,
    backoffFactor: number = 2,
  ): Promise<void> {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))

    // Replace the function with our mock for the first N calls
    for (let i = 0; i < expectedRetries; i++) {
      mockFn.mockRejectedValueOnce(new Error(`Attempt ${i + 1} failed`))
    }
    mockFn.mockResolvedValueOnce('success')

    const tester = new TimeoutTester()
    const promise = fn()
    tester.track(promise)

    // Advance through each retry
    for (let i = 0; i < expectedRetries; i++) {
      const delay = baseDelay * Math.pow(backoffFactor, i)

      const result = await tester.advanceAndCheck(delay)
      if (i < expectedRetries - 1) {
        // Should not be resolved yet
        if (result.resolved) {
          throw new Error(`Promise resolved too early at retry ${i + 1}`)
        }
      }
    }

    // Final check - should be resolved now
    const finalResult = await tester.advanceAndCheck(10)
    if (!finalResult.resolved) {
      throw new Error('Promise did not resolve after all retries')
    }
  },
}

/**
 * Utility for testing debounced functions
 */
export class DebounceTimer {
  /**
   * Simulates rapid calls to a debounced function
   */
  async testDebounce(
    fn: () => void,
    debounceMs: number,
    numberOfCalls: number,
    callInterval: number,
  ): Promise<{ actualCalls: number; expectedCalls: number }> {
    const mockFn = vi.fn(fn)

    // Make rapid calls
    for (let i = 0; i < numberOfCalls; i++) {
      mockFn()
      await advanceTimers(callInterval)
    }

    // Wait for debounce to complete
    await advanceTimers(debounceMs)

    // Calculate expected calls based on debounce logic
    const expectedCalls = callInterval >= debounceMs ? numberOfCalls : 1

    return {
      actualCalls: mockFn.mock.calls.length,
      expectedCalls,
    }
  }
}
