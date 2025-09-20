/**
 * Test registration utilities for setting up test environments
 */

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
    WALLABY: Boolean(process.env.WALLABY_WORKER),
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
  // eslint-disable-next-line no-var
  var __TEST_CONFIG__: TestConfig | undefined
}
