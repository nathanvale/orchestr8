/**
 * Test registration utilities for setting up test environments
 *
 * IMPORTANT: This file imports bootstrap.ts first to ensure all mocks
 * are properly initialized before any other code runs.
 */

// Bootstrap MUST be imported first - this sets up all vi.mock declarations
import './bootstrap.js'

// Install global lifecycle hooks for process mocking
// This ensures spawnedProcesses and call tracking are cleared after each test
// while keeping registered mocks intact. It prevents cross-test leakage when
// using a single fork/pool.
import { setupProcessMocking } from './cli/process-mock.js'
setupProcessMocking()

// Install global lifecycle hooks for process listener cleanup
// This prevents accumulation of process listeners across tests
import { afterEach } from 'vitest'
import { removeAllProcessListeners } from './utils/process-listeners.js'
afterEach(() => removeAllProcessListeners())

// Conditionally enable leak guards based on configuration
// Guards provide automatic cleanup of leaked resources (SQLite DBs, timers, etc.)
import { hasAnyGuardsEnabled, setupGuards } from './guards/index.js'
if (hasAnyGuardsEnabled()) {
  // Setup guards asynchronously (won't block test execution)
  void setupGuards()
}

import type { TestConfig, TestEnvironment } from './types.js'

/**
 * Default test configuration
 */
export const defaultTestConfig: TestConfig = {
  timeout: 5000,
  maxMemory: 512 * 1024 * 1024, // 512MB
  parallel: true,
  environment: {
    NODE_ENV: 'test',
    CI: Boolean(process.env.CI),
    WALLABY: process.env.WALLABY_ENV === 'true',
    VITEST: Boolean(process.env.VITEST),
  },
}

/**
 * Register test environment with custom configuration
 */
export function registerTestEnvironment(config: Partial<TestConfig> = {}): TestConfig {
  const mergedConfig = {
    ...defaultTestConfig,
    ...config,
    environment: {
      ...defaultTestConfig.environment,
      ...config.environment,
    },
  }

  // Set global test configuration
  if (globalThis.__TEST_CONFIG__) {
    Object.assign(globalThis.__TEST_CONFIG__, mergedConfig)
  } else {
    globalThis.__TEST_CONFIG__ = mergedConfig
  }

  return mergedConfig
}

/**
 * Get current test configuration
 */
export function getTestConfig(): TestConfig {
  return globalThis.__TEST_CONFIG__ || defaultTestConfig
}

/**
 * Check if running in a specific test environment
 */
export function isTestEnvironment(env: keyof TestEnvironment): boolean {
  const config = getTestConfig()
  return Boolean(config.environment[env])
}

// Global type extension
declare global {
  var __TEST_CONFIG__: TestConfig | undefined
}
