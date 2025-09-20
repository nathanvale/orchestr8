/**
 * Core fake timers utilities for testing with Vitest
 */

import { vi } from 'vitest'

import type {
  FakeTimerContext,
  FakeTimerOptions,
  SystemTimeContext,
  TimezoneContext,
} from './types.js'

/**
 * Create a fake timer context for controlling time in tests
 */
export function useFakeTimers(options?: FakeTimerOptions): FakeTimerContext {
  vi.useFakeTimers(options)

  return {
    advance: (ms: number) => {
      vi.advanceTimersByTime(ms)
    },

    advanceAsync: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms)
    },

    runAll: () => {
      vi.runAllTimers()
    },

    runAllAsync: async () => {
      await vi.runAllTimersAsync()
    },

    restore: () => {
      vi.useRealTimers()
    },

    getTimerCount: () => {
      return vi.getTimerCount()
    },

    clearAll: () => {
      vi.clearAllTimers()
    },
  }
}

/**
 * System time manipulation utilities
 */
export function createSystemTimeContext(): SystemTimeContext {
  let isMockedState = false
  let originalDateNow: typeof Date.now | undefined

  return {
    setTime: (date: Date | string | number) => {
      vi.setSystemTime(date)
      isMockedState = true
    },

    getTime: () => {
      return new Date()
    },

    restore: () => {
      vi.useRealTimers()
      if (originalDateNow) {
        Date.now = originalDateNow
        originalDateNow = undefined
      }
      isMockedState = false
    },

    isMocked: () => {
      return isMockedState
    },
  }
}

/**
 * Timezone manipulation utilities
 */
export function createTimezoneContext(): TimezoneContext {
  let originalTimezone: string | undefined

  return {
    setTimezone: (tz: string) => {
      if (originalTimezone === undefined) {
        originalTimezone = process.env.TZ
      }
      process.env.TZ = tz
    },

    getTimezone: () => {
      return process.env.TZ
    },

    restore: () => {
      if (originalTimezone !== undefined) {
        process.env.TZ = originalTimezone
        originalTimezone = undefined
      } else {
        delete process.env.TZ
      }
    },

    testInTimezone: <T>(tz: string, fn: () => T): T => {
      const original = process.env.TZ
      process.env.TZ = tz
      try {
        return fn()
      } finally {
        if (original !== undefined) {
          process.env.TZ = original
        } else {
          delete process.env.TZ
        }
      }
    },
  }
}

/**
 * Mock Date.now to return a specific timestamp
 */
export function mockDateNow(timestamp: number): () => void {
  const spy = vi.spyOn(Date, 'now').mockReturnValue(timestamp)
  return () => spy.mockRestore()
}

/**
 * Mock Date constructor to return a specific date
 */
export function mockDateConstructor(date: Date): () => void {
  const spy = vi.spyOn(global, 'Date').mockImplementation(() => date)
  return () => spy.mockRestore()
}

/**
 * Convenience function to set up fake timers with automatic cleanup
 */
export function withFakeTimers<T>(
  fn: (timers: FakeTimerContext) => T,
  options?: FakeTimerOptions,
): T {
  const timers = useFakeTimers(options)
  try {
    return fn(timers)
  } finally {
    timers.restore()
  }
}

/**
 * Convenience function to set up system time with automatic cleanup
 */
export function withSystemTime<T>(
  date: Date | string | number,
  fn: (context: SystemTimeContext) => T,
): T {
  const context = createSystemTimeContext()
  context.setTime(date)
  try {
    return fn(context)
  } finally {
    context.restore()
  }
}

/**
 * Convenience function to test in a specific timezone with automatic cleanup
 */
export function withTimezone<T>(tz: string, fn: () => T): T {
  const context = createTimezoneContext()
  return context.testInTimezone(tz, fn)
}

/**
 * Advanced timer control for step-by-step execution
 */
export class TimerController {
  private timers: FakeTimerContext

  constructor(options?: FakeTimerOptions) {
    this.timers = useFakeTimers(options)
  }

  /**
   * Advance time by a specific amount
   */
  advance(ms: number): void {
    this.timers.advance(ms)
  }

  /**
   * Advance time asynchronously by a specific amount
   */
  async advanceAsync(ms: number): Promise<void> {
    await this.timers.advanceAsync(ms)
  }

  /**
   * Run all pending timers
   */
  runAll(): void {
    this.timers.runAll()
  }

  /**
   * Run all pending timers asynchronously
   */
  async runAllAsync(): Promise<void> {
    await this.timers.runAllAsync()
  }

  /**
   * Get the count of pending timers
   */
  getTimerCount(): number {
    return this.timers.getTimerCount()
  }

  /**
   * Clear all pending timers
   */
  clearAll(): void {
    this.timers.clearAll()
  }

  /**
   * Advance to the next timer and execute it
   */
  async advanceToNext(): Promise<void> {
    const count = this.getTimerCount()
    if (count > 0) {
      await this.timers.runAllAsync()
    }
  }

  /**
   * Step through timers one by one
   */
  async stepThrough(steps = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.advanceToNext()
      if (this.getTimerCount() === 0) {
        break
      }
    }
  }

  /**
   * Clean up and restore real timers
   */
  restore(): void {
    this.timers.restore()
  }
}

/**
 * Setup function for test lifecycle hooks
 */
export function setupTimerCleanup(): {
  beforeEach: () => void
  afterEach: () => void
} {
  const activeContexts: Array<{
    timers?: FakeTimerContext
    systemTime?: SystemTimeContext
    timezone?: TimezoneContext
  }> = []

  return {
    beforeEach: () => {
      // Clear any contexts from previous tests
      activeContexts.length = 0
    },

    afterEach: () => {
      // Clean up all active contexts
      activeContexts.forEach((context) => {
        context.timers?.restore()
        context.systemTime?.restore()
        context.timezone?.restore()
      })
      activeContexts.length = 0

      // Ensure real timers are restored
      vi.useRealTimers()
    },
  }
}

/**
 * Global timer utilities for common scenarios
 */
export const timeHelpers = {
  /**
   * Set up fake timers and return control context
   */
  useFakeTimers: (options?: FakeTimerOptions) => useFakeTimers(options),

  /**
   * Set system time to a specific value
   */
  setSystemTime: (date: Date | string | number) => {
    vi.setSystemTime(date)
  },

  /**
   * Mock Date.now to return a specific timestamp
   */
  mockNow: (timestamp: number) => mockDateNow(timestamp),

  /**
   * Create a timer controller for advanced scenarios
   */
  createController: (options?: FakeTimerOptions) => new TimerController(options),

  /**
   * Test in a specific timezone
   */
  testInTimezone: withTimezone,

  /**
   * Test with a specific system time
   */
  testAtTime: withSystemTime,

  /**
   * Test with fake timers
   */
  testWithFakeTimers: withFakeTimers,
}
