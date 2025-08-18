import { beforeEach, vi } from 'vitest'

/**
 * Global test setup for @orchestr8 monorepo
 *
 * This file ensures consistent test behavior across all packages:
 * - Resets all mocks between tests to prevent state leakage
 * - Configures global test utilities
 * - Sets up common test environment
 */

// Reset all mocks before each test to ensure test isolation
beforeEach(() => {
  vi.resetAllMocks()
})

// Set test environment flag
process.env.NODE_ENV = 'test'

// Configure longer timeout for integration tests if needed
if (process.env.CI) {
  // CI environments may need longer timeouts
  vi.setConfig({ testTimeout: 30000 })
}

// Export test utilities that can be imported by test files
export const testUtils = {
  /**
   * Create a deterministic delay for testing async operations
   */
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Create an AbortController with automatic cleanup
   */
  createAbortController: () => {
    const controller = new AbortController()
    // Automatically abort after test to prevent hanging operations
    beforeEach(() => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    })
    return controller
  },
}
