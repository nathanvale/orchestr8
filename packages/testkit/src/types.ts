/**
 * Core types for the testkit package
 */

export interface TestEnvironment {
  /** The current test environment (test, development, production) */
  NODE_ENV: 'test' | 'development' | 'production'
  /** Whether running in CI environment */
  CI: boolean
  /** Whether running in Wallaby test runner */
  WALLABY: boolean
  /** Whether running in Vitest */
  VITEST: boolean
}

export interface TestConfig {
  /** Test timeout in milliseconds */
  timeout: number
  /** Maximum memory usage for tests */
  maxMemory: number
  /** Whether to run tests in parallel */
  parallel: boolean
  /** Test environment setup */
  environment: TestEnvironment
}

export interface TestKit {
  /** Environment utilities */
  env: TestEnvironment
  /** Test configuration */
  config: TestConfig
  /** MSW utilities */
  msw: unknown
  /** Container utilities */
  containers: unknown
  /** Convex test utilities */
  convex: unknown
  /** General test utilities */
  utils: unknown
}
