/**
 * Timers Leak Guard
 *
 * Automatically detects and clears leaked timers (setTimeout, setInterval)
 * that prevent Vitest processes from exiting cleanly.
 *
 * Features:
 * - Wraps setTimeout/setInterval to track active timers
 * - Auto-clears leaked timers in afterEach hooks
 * - Verbose mode: logs cleared timers for debugging
 */

import { afterEach } from 'vitest'
import type { getTimersGuardConfig } from './config.js'

type TimersGuardConfig = ReturnType<typeof getTimersGuardConfig>

/**
 * Metadata about a tracked timer
 */
interface TimerMetadata {
  id: ReturnType<typeof setTimeout>
  type: 'timeout' | 'interval'
  createdAt: number
  testName: string | undefined
  stack: string
}

/**
 * Timers leak guard manager
 */
class TimersLeakGuard {
  private trackedTimers = new Map<ReturnType<typeof setTimeout>, TimerMetadata>()
  private config: TimersGuardConfig
  private currentTestName: string | undefined

  // Store original timer functions
  private originalSetTimeout: typeof setTimeout
  private originalSetInterval: typeof setInterval
  private originalClearTimeout: typeof clearTimeout
  private originalClearInterval: typeof clearInterval

  constructor(config: TimersGuardConfig) {
    this.config = config

    // Capture original functions
    this.originalSetTimeout = globalThis.setTimeout
    this.originalSetInterval = globalThis.setInterval
    this.originalClearTimeout = globalThis.clearTimeout
    this.originalClearInterval = globalThis.clearInterval
  }

  /**
   * Wrap setTimeout to track timers
   */
  wrapSetTimeout(): void {
    const originalSetTimeout = this.originalSetTimeout
    const trackTimer = this.trackTimer.bind(this)

    globalThis.setTimeout = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ): unknown => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (originalSetTimeout as any)(callback, delay, ...(args as []))
      trackTimer(id, 'timeout')
      return id
    }) as typeof setTimeout
  }

  /**
   * Wrap setInterval to track intervals
   */
  wrapSetInterval(): void {
    const originalSetInterval = this.originalSetInterval
    const trackTimer = this.trackTimer.bind(this)

    globalThis.setInterval = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ): unknown => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (originalSetInterval as any)(callback, delay, ...(args as []))
      trackTimer(id, 'interval')
      return id
    }) as typeof setInterval
  }

  /**
   * Wrap clearTimeout to untrack timers
   */
  wrapClearTimeout(): void {
    const originalClearTimeout = this.originalClearTimeout
    const untrackTimer = this.untrackTimer.bind(this)

    globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>): void => {
      if (id !== undefined) {
        untrackTimer(id)
        originalClearTimeout(id)
      }
    }) as typeof clearTimeout
  }

  /**
   * Wrap clearInterval to untrack intervals
   */
  wrapClearInterval(): void {
    const originalClearInterval = this.originalClearInterval
    const untrackTimer = this.untrackTimer.bind(this)

    globalThis.clearInterval = ((id?: ReturnType<typeof setInterval>): void => {
      if (id !== undefined) {
        untrackTimer(id)
        originalClearInterval(id)
      }
    }) as typeof clearInterval
  }

  /**
   * Track a timer
   */
  private trackTimer(id: ReturnType<typeof setTimeout>, type: 'timeout' | 'interval'): void {
    const metadata: TimerMetadata = {
      id,
      type,
      createdAt: Date.now(),
      testName: this.currentTestName,
      stack: this.captureStack(),
    }
    this.trackedTimers.set(id, metadata)
  }

  /**
   * Untrack a timer when cleared
   */
  private untrackTimer(id: ReturnType<typeof setTimeout>): void {
    this.trackedTimers.delete(id)
  }

  /**
   * Cleanup leaked timers
   */
  cleanup(): void {
    for (const [id, metadata] of this.trackedTimers) {
      try {
        if (metadata.type === 'timeout') {
          this.originalClearTimeout.call(globalThis, id)
        } else {
          this.originalClearInterval.call(globalThis, id)
        }

        if (this.config.verbose) {
          this.logClearedTimer(metadata)
        }
      } catch (error) {
        // Log error but continue with other timers
        console.error(
          `[Timers Guard] Failed to clear ${metadata.type} ${id}:`,
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    // Clear tracked timers after cleanup
    this.trackedTimers.clear()
  }

  /**
   * Log a cleared timer
   */
  private logClearedTimer(metadata: TimerMetadata): void {
    const { type, testName } = metadata
    const location = testName ? `in test "${testName}"` : 'outside test context'
    console.log(`[Timers Guard] Auto-cleared leaked ${type} created ${location}`)
  }

  /**
   * Capture stack trace for debugging
   */
  private captureStack(): string {
    const stack = new Error().stack || ''
    // Remove first 3 lines (Error, this function, caller)
    return stack.split('\n').slice(3).join('\n')
  }

  /**
   * Update current test name for better error messages
   */
  setCurrentTestName(name: string | undefined): void {
    this.currentTestName = name
  }

  /**
   * Restore original timer functions
   */
  restore(): void {
    globalThis.setTimeout = this.originalSetTimeout
    globalThis.setInterval = this.originalSetInterval
    globalThis.clearTimeout = this.originalClearTimeout
    globalThis.clearInterval = this.originalClearInterval
  }
}

/**
 * Setup timers leak guard
 */
export function setupTimersGuard(config: TimersGuardConfig): void {
  const guard = new TimersLeakGuard(config)

  // Wrap timer functions
  guard.wrapSetTimeout()
  guard.wrapSetInterval()
  guard.wrapClearTimeout()
  guard.wrapClearInterval()

  // Install cleanup hook
  afterEach(() => {
    // Try to get current test name from Vitest
    try {
      const state = (expect as { getState?: () => { currentTestName?: string } }).getState?.()
      guard.setCurrentTestName(state?.currentTestName)
    } catch {
      // Ignore if we can't get test name
    }

    guard.cleanup()
  })

  if (config.verbose) {
    console.log('[Timers Guard] Enabled with config:', config)
  }
}
