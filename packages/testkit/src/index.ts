/**
 * @orchestr8/testkit - Lean core export with no optional dependencies
 *
 * This is the main entry point that only exports core utilities that don't
 * require optional dependencies like convex-test, better-sqlite3, msw, etc.
 *
 * For the full export with all utilities, import from '@orchestr8/testkit/full'
 * or use the specific sub-exports: '@orchestr8/testkit/msw', '@orchestr8/testkit/containers', etc.
 */

// Core utilities that have no optional dependencies
export * from './utils/index.js'
export * from './config/index.js'

// Selective exports from env (excluding vitest-dependent mocks)
export { getTestEnvironment, setupTestEnv, getTestTimeouts } from './env/core.js'

// Export some env types that don't depend on vitest
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

// Selective exports from fs (excluding vitest-dependent cleanup utilities)
export {
  createTempDirectory,
  createNamedTempDirectory,
  createMultipleTempDirectories,
  cleanupMultipleTempDirectories,
  type TempDirectory,
  type TempDirectoryOptions,
  type DirectoryStructure,
} from './fs/temp.js'

// Export types for external consumption
export type { TestConfig, TestEnvironment, TestKit } from './types.js'

// NOTE: register.js is excluded from the lean export as it depends on vitest's vi mocking system
// Use '@orchestr8/testkit/register' if you need test registration utilities
