/**
 * MSW (Mock Service Worker) utilities for API mocking in tests
 */

/**
 * Base MSW configuration for the testkit
 */
export interface MSWConfig {
  /** Whether MSW is enabled */
  enabled: boolean
  /** API base URL for mocking */
  baseUrl: string
  /** Request timeout in milliseconds */
  timeout: number
}

/**
 * Default MSW configuration
 */
export const defaultMSWConfig: MSWConfig = {
  enabled: true,
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
}

/**
 * Initialize MSW for testing
 */
export function setupMSW(config: Partial<MSWConfig> = {}): MSWConfig {
  const mergedConfig = {
    ...defaultMSWConfig,
    ...config,
  }

  // MSW setup logic will be implemented here
  // This is a placeholder for the actual MSW integration

  return mergedConfig
}

/**
 * Create a mock API handler
 */
export function createMockHandler(endpoint: string, response: unknown) {
  // Mock handler creation logic
  return {
    endpoint,
    response,
  }
}

/**
 * Reset all MSW handlers
 */
export function resetMSWHandlers(): void {
  // Reset logic will be implemented here
}
