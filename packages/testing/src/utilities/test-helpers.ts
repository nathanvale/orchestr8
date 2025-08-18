/**
 * Test helper utilities
 */

import type {
  ExecutionError,
  StepResult,
  WorkflowResult,
} from '@orchestr8/schema'

import { vi } from 'vitest'

/**
 * Create a successful step result
 */
export function createSuccessfulStepResult(
  stepId: string,
  output: unknown = { success: true },
): StepResult {
  const now = new Date().toISOString()
  return {
    stepId,
    status: 'completed',
    output,
    startTime: now,
    endTime: now,
  }
}

/**
 * Create a failed step result
 */
export function createFailedStepResult(
  stepId: string,
  error: ExecutionError,
): StepResult {
  const now = new Date().toISOString()
  return {
    stepId,
    status: 'failed',
    error,
    startTime: now,
    endTime: now,
  }
}

/**
 * Create a skipped step result
 */
export function createSkippedStepResult(stepId: string): StepResult {
  const now = new Date().toISOString()
  return {
    stepId,
    status: 'skipped',
    startTime: now,
    endTime: now,
  }
}

/**
 * Create a cancelled step result
 */
export function createCancelledStepResult(stepId: string): StepResult {
  const now = new Date().toISOString()
  return {
    stepId,
    status: 'cancelled',
    startTime: now,
    endTime: now,
  }
}

/**
 * Create a successful workflow result
 */
export function createSuccessfulWorkflowResult(
  executionId: string,
  steps: Record<string, StepResult>,
): WorkflowResult {
  const now = new Date()
  return {
    executionId,
    status: 'completed',
    steps,
    variables: {},
    startTime: now.toISOString(),
    endTime: now.toISOString(),
    duration: 100,
  }
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Create a deferred promise for testing async behavior
 */
export function createDeferredPromise<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve: (value: T) => void
  let reject: (error: Error) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

/**
 * Create an AbortController with timeout
 */
export function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort('Timeout'), timeout)
  return controller
}

/**
 * Fake timers utilities for testing with Vitest
 */
export const fakeTimers = {
  /**
   * Install fake timers
   */
  install(): void {
    vi.useFakeTimers()
  },

  /**
   * Uninstall fake timers
   */
  uninstall(): void {
    vi.useRealTimers()
  },

  /**
   * Advance timers by time
   */
  async advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms)
  },

  /**
   * Run all pending timers
   */
  async runAll(): Promise<void> {
    await vi.runAllTimersAsync()
  },

  /**
   * Run only pending timers (not recursive)
   */
  async runPending(): Promise<void> {
    await vi.runOnlyPendingTimersAsync()
  },
}

/**
 * Memory size calculator for testing truncation
 */
export function calculateJsonSize(obj: unknown): number {
  try {
    return JSON.stringify(obj).length
  } catch {
    return 0
  }
}

/**
 * Create large data for testing memory limits
 */
export function createLargeData(sizeInKb: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const targetSize = sizeInKb * 1024
  let result = ''

  while (result.length < targetSize) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result.substring(0, targetSize)
}

/**
 * Create a circular reference for testing
 */
export function createCircularReference(): Record<string, unknown> {
  const obj: Record<string, unknown> = { value: 'test' }
  obj.circular = obj
  return obj
}
