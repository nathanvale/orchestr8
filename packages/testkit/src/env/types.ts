/**
 * Timer and time manipulation types for testing utilities
 */

/**
 * Options for configuring fake timers
 */
export interface FakeTimerOptions {
  /**
   * Array of timer types to fake. If not specified, all timer types are faked.
   */
  toFake?: Array<
    | 'setTimeout'
    | 'setInterval'
    | 'setImmediate'
    | 'clearTimeout'
    | 'clearInterval'
    | 'clearImmediate'
    | 'Date'
  >

  /**
   * Whether to advance the time automatically for async operations
   */
  shouldAdvanceTime?: boolean

  /**
   * Amount of time to advance automatically (in milliseconds)
   */
  advanceTimeDelta?: number
}

/**
 * Context object returned by useFakeTimers for controlling time
 */
export interface FakeTimerContext {
  /**
   * Advance timers by the specified amount of milliseconds
   */
  advance: (ms: number) => void

  /**
   * Advance timers asynchronously by the specified amount of milliseconds
   */
  advanceAsync: (ms: number) => Promise<void>

  /**
   * Run all pending timers
   */
  runAll: () => void

  /**
   * Run all pending timers asynchronously
   */
  runAllAsync: () => Promise<void>

  /**
   * Restore real timers
   */
  restore: () => void

  /**
   * Get the count of pending timers
   */
  getTimerCount: () => number

  /**
   * Clear all pending timers
   */
  clearAll: () => void
}

/**
 * System time manipulation context
 */
export interface SystemTimeContext {
  /**
   * Set a fixed system time
   */
  setTime: (date: Date | string | number) => void

  /**
   * Get the current mocked time
   */
  getTime: () => Date

  /**
   * Restore real system time
   */
  restore: () => void

  /**
   * Check if time is currently mocked
   */
  isMocked: () => boolean
}

/**
 * Date/time helper utilities
 */
export interface DateHelpers {
  /**
   * Create a date relative to now (e.g., "2 hours from now", "3 days ago")
   */
  createRelativeDate: (offset: string, from?: Date) => Date

  /**
   * Format a date for testing purposes
   */
  formatForTest: (date: Date, format?: string) => string

  /**
   * Create a date at a specific time today
   */
  todayAt: (time: string) => Date

  /**
   * Create a date for tomorrow at a specific time
   */
  tomorrowAt: (time: string) => Date

  /**
   * Create a date for yesterday at a specific time
   */
  yesterdayAt: (time: string) => Date
}

/**
 * Timezone manipulation context
 */
export interface TimezoneContext {
  /**
   * Set a specific timezone for testing
   */
  setTimezone: (tz: string) => void

  /**
   * Get the current timezone
   */
  getTimezone: () => string | undefined

  /**
   * Restore the original timezone
   */
  restore: () => void

  /**
   * Test a function in a specific timezone
   */
  testInTimezone: <T>(tz: string, fn: () => T) => T
}

/**
 * Timer type enumeration
 */
export type TimerType = 'timeout' | 'interval' | 'immediate'

/**
 * Timer queue entry
 */
export interface TimerEntry {
  id: number
  type: TimerType
  callback: (...args: unknown[]) => void
  delay: number
  args: unknown[]
  createdAt: number
  nextExecution: number
}

/**
 * Configuration for retry with backoff testing
 */
export interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay?: number
  backoffFactor?: number
  jitter?: boolean
}

/**
 * Debounce testing configuration
 */
export interface DebounceConfig {
  delay: number
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

/**
 * Throttle testing configuration
 */
export interface ThrottleConfig {
  limit: number
  leading?: boolean
  trailing?: boolean
}
