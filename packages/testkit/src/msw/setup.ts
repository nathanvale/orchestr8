/**
 * MSW setup utilities for test environments
 * Provides lifecycle management and integration with testing frameworks
 */

import { beforeAll, afterEach, afterAll } from 'vitest'
import type { RequestHandler } from 'msw'
import {
  createMSWServer,
  startMSWServer,
  stopMSWServer,
  resetMSWHandlers,
  disposeMSWServer,
} from './server'
import type { MSWConfig } from './config'

/**
 * Setup MSW for testing with automatic lifecycle management
 * Call this in your test setup files or individual test suites
 */
export function setupMSW(handlers: RequestHandler[] = [], config: Partial<MSWConfig> = {}): void {
  // Create server before all tests
  beforeAll(() => {
    createMSWServer(handlers, config)
    startMSWServer(config)
  })

  // Reset handlers after each test to ensure isolation
  afterEach(() => {
    resetMSWHandlers()
  })

  // Stop and dispose server after all tests
  afterAll(() => {
    stopMSWServer()
    disposeMSWServer()
  })
}

/**
 * Setup MSW for Vitest global setup
 * Use in vitest.globalSetup.ts for cross-test-suite persistence
 */
export function setupMSWGlobal(
  handlers: RequestHandler[] = [],
  config: Partial<MSWConfig> = {},
): {
  setup: () => void
  teardown: () => void
} {
  return {
    setup: () => {
      createMSWServer(handlers, config)
      startMSWServer(config)
    },
    teardown: () => {
      stopMSWServer()
      disposeMSWServer()
    },
  }
}

/**
 * Manual MSW setup for custom test scenarios
 * Provides fine-grained control over server lifecycle
 */
export function setupMSWManual(
  handlers: RequestHandler[] = [],
  config: Partial<MSWConfig> = {},
): {
  start: () => void
  stop: () => void
  reset: () => void
  dispose: () => void
} {
  createMSWServer(handlers, config)

  return {
    start: () => startMSWServer(config),
    stop: () => stopMSWServer(),
    reset: () => resetMSWHandlers(),
    dispose: () => disposeMSWServer(),
  }
}

/**
 * Quick setup for simple test scenarios
 * Combines server creation and startup in one call
 */
export function quickSetupMSW(
  handlers: RequestHandler[] = [],
  config: Partial<MSWConfig> = {},
): void {
  createMSWServer(handlers, config)
  startMSWServer(config)
}

/**
 * Environment-aware MSW setup
 * Automatically configures based on detected environment
 */
export function setupMSWForEnvironment(
  handlers: RequestHandler[] = [],
  customConfig: Partial<MSWConfig> = {},
): void {
  const isCI = process.env.CI === 'true'
  const isWallaby = process.env.WALLABY_WORKER === 'true'
  const isVerbose = process.env.VITEST_VERBOSE === 'true'

  const envConfig: Partial<MSWConfig> = {
    // Less strict in CI to avoid flaky tests
    onUnhandledRequest: isCI ? 'warn' : 'error',
    // Quiet in Wallaby to reduce noise
    quiet: isWallaby && !isVerbose,
    // Shorter timeout in CI
    timeout: isCI ? 3000 : 5000,
  }

  const finalConfig = {
    ...envConfig,
    ...customConfig,
  }

  setupMSW(handlers, finalConfig)
}

/**
 * Create a test-scoped MSW setup
 * Useful for test suites that need isolated handlers
 */
export function createTestScopedMSW(
  baseHandlers: RequestHandler[] = [],
  config: Partial<MSWConfig> = {},
): {
  addHandlers: (...handlers: RequestHandler[]) => void
  setup: () => void
  cleanup: () => void
} {
  let allHandlers = [...baseHandlers]

  return {
    addHandlers: (...handlers: RequestHandler[]) => {
      allHandlers.push(...handlers)
    },
    setup: () => {
      createMSWServer(allHandlers, config)
      startMSWServer(config)
    },
    cleanup: () => {
      stopMSWServer()
      disposeMSWServer()
      allHandlers = [...baseHandlers] // Reset to base handlers
    },
  }
}
