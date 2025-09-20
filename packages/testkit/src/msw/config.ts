/**
 * MSW configuration for test environments
 */

/**
 * MSW server configuration options
 */
export interface MSWConfig {
  /** Whether MSW is enabled */
  enabled: boolean
  /** API base URL for mocking */
  baseUrl: string
  /** Request timeout in milliseconds */
  timeout: number
  /** Handler for unhandled requests */
  onUnhandledRequest: 'error' | 'warn' | 'bypass'
  /** Whether to quiet MSW logs */
  quiet: boolean
  /** Custom headers to add to all responses */
  defaultHeaders?: Record<string, string>
}

/**
 * Default MSW configuration
 */
export const defaultMSWConfig: MSWConfig = {
  enabled: true,
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
  onUnhandledRequest: 'error',
  quiet: false,
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
}

/**
 * Environment-aware configuration
 */
export function createMSWConfig(overrides: Partial<MSWConfig> = {}): MSWConfig {
  const isCI = process.env.CI === 'true'
  const isWallaby = process.env.WALLABY_WORKER === 'true'
  const isTest = process.env.NODE_ENV === 'test'

  // Adjust defaults based on environment
  const envDefaults: Partial<MSWConfig> = {
    // More lenient in CI to avoid flaky tests
    onUnhandledRequest: isCI ? 'warn' : 'error',
    // Quieter in Wallaby to reduce noise
    quiet: isWallaby,
    // Shorter timeout in test environments
    timeout: isTest ? 3000 : 5000,
  }

  return {
    ...defaultMSWConfig,
    ...envDefaults,
    ...overrides,
  }
}

/**
 * Validate MSW configuration
 */
export function validateMSWConfig(config: MSWConfig): void {
  if (!config.baseUrl) {
    throw new Error('MSW baseUrl is required')
  }

  if (config.timeout < 100) {
    throw new Error('MSW timeout must be at least 100ms')
  }

  if (!['error', 'warn', 'bypass'].includes(config.onUnhandledRequest)) {
    throw new Error('MSW onUnhandledRequest must be "error", "warn", or "bypass"')
  }
}
