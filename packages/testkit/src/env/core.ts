/**
 * Minimal environment utilities without importing 'vitest'.
 *
 * This module is safe to import from configuration files.
 */

/**
 * Check if running in CI environment
 */
function isCI(): boolean {
  // CI env var should be explicitly 'true', '1', or 'yes' to be considered CI
  // Empty string or other values should be considered false
  const ci = process.env.CI
  return ci === 'true' || ci === '1' || ci === 'yes'
}

/**
 * Check if running in Wallaby test runner
 */
function isWallaby(): boolean {
  return process.env.WALLABY_ENV === 'true'
}

/**
 * Test environment detection utilities
 */
export function getTestEnvironment() {
  return {
    isCI: isCI(),
    isWallaby: isWallaby(),
    isVitest: Boolean(process.env.VITEST),
    isJest: Boolean(process.env.JEST_WORKER_ID),
    nodeEnv: process.env.NODE_ENV || 'test',
  }
}

/**
 * Set up test environment variables
 */
export function setupTestEnv(overrides: Record<string, string> = {}) {
  const originalEnv = { ...process.env }

  // Set default test environment
  const testEnv = {
    NODE_ENV: 'test',
    CI: 'false',
    VITEST: 'true',
    ...overrides,
  }

  Object.assign(process.env, testEnv)

  return {
    restore: () => {
      process.env = originalEnv
    },
  }
}

/**
 * Get timeout values based on environment
 */
export function getTestTimeouts() {
  const env = getTestEnvironment()

  const baseTimeouts = {
    unit: 5000,
    integration: 15000,
    e2e: 30000,
  }

  // Increase timeouts in CI
  if (env.isCI) {
    return {
      unit: baseTimeouts.unit * 2,
      integration: baseTimeouts.integration * 1.5,
      e2e: baseTimeouts.e2e * 1.5,
    }
  }

  return baseTimeouts
}
