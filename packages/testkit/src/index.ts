/**
 * @orchestr8/testkit - Lean core export with no optional dependencies
 *
 * This is the main entry point that only exports core utilities that don't
 * require optional dependencies like convex-test, better-sqlite3, msw, etc.
 *
 * For optional features, use the specific sub-exports: '@orchestr8/testkit/msw',
 * '@orchestr8/testkit/containers', etc.
 */

// Only export from modules with no optional dependencies
export * from './utils/index.js'
export * from './config/index.js'

// Export only core functions from env and fs (no vitest dependencies)
export * from './env/core.js'
export * from './fs/core.js'

// Export types that don't depend on vitest
export type {
  FakeTimerOptions,
  FakeTimerContext,
  SystemTimeContext,
  DateHelpers,
  TimezoneContext,
  TimerType,
  RetryConfig,
  DebounceConfig,
  ThrottleConfig,
} from './env/types.js'

// DO NOT export: cli, containers, convex, sqlite, msw, register (these have optional deps)
export type { TestConfig, TestEnvironment, TestKit } from './types.js'
