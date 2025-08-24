/**
 * Utilities for handling benchmark and performance tests
 * @module benchmark-utils
 */

/**
 * Determines whether benchmark tests should run based on environment conditions.
 *
 * Benchmark tests are resource-intensive and should only run when:
 * - Explicitly requested via PERF=1 environment variable
 *
 * They should NEVER run in:
 * - Wallaby.js (too slow, not its concern)
 * - CI environments (flaky due to resource variance)
 * - Normal test runs (to avoid accidental performance testing)
 *
 * @returns {boolean} True if benchmark tests should execute
 */
export function shouldRunBenchmarks(): boolean {
  const isWallaby = !!process.env.WALLABY_WORKER
  const isPerfMode = process.env.PERF === '1'
  const isCI = process.env.CI === 'true'

  // Never run in Wallaby or CI (flaky), only in explicit PERF mode
  return !isWallaby && !isCI && isPerfMode
}

/**
 * Environment detection flags for benchmark testing
 */
export const benchmarkEnvironment = {
  /** Whether currently running in Wallaby.js */
  isWallaby: !!process.env.WALLABY_WORKER,

  /** Whether performance mode is explicitly enabled */
  isPerfMode: process.env.PERF === '1',

  /** Whether running in CI environment */
  isCI: process.env.CI === 'true',

  /** Whether running in test mode */
  isTestMode: process.env.NODE_ENV === 'test',
} as const

/**
 * Skip condition for vitest describe blocks containing benchmark tests.
 * Use with describe.skipIf() for consistent benchmark test gating.
 *
 * @example
 * ```typescript
 * import { SKIP_BENCHMARKS_IF } from '@orchestr8/testing'
 *
 * describe.skipIf(SKIP_BENCHMARKS_IF)('Benchmark Tests', () => {
 *   // performance tests here
 * })
 * ```
 */
export const SKIP_BENCHMARKS_IF = !shouldRunBenchmarks()
