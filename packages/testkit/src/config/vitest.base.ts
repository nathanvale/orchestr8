/**
 * Base Vitest Configuration
 *
 * Provides a standardized Vitest configuration that all packages can extend.
 * Includes environment detection, Wallaby compatibility, and optimized settings
 * for stability and performance.
 */

import { defineConfig, type UserConfig } from 'vitest/config'
import { getTestEnvironment, getTestTimeouts } from '../env/core.js'

export interface VitestEnvironmentConfig {
  /** Whether running in CI environment */
  isCI: boolean
  /** Whether running in Wallaby test runner */
  isWallaby: boolean
  /** Whether running in Vitest environment */
  isVitest: boolean
  /** Whether running in Jest environment */
  isJest: boolean
  /** Current NODE_ENV value */
  nodeEnv: string
}

export interface VitestPoolOptions {
  /** Pool strategy: 'forks' for stability, 'threads' for speed */
  pool: 'forks' | 'threads' | 'vmThreads'
  /** Isolate tests from each other */
  isolate: boolean
  /** Bail on first test failure */
  bail: number | boolean
  /** Maximum number of threads/forks */
  maxWorkers: number
  /** Minimum number of threads/forks */
  minWorkers: number
}

export interface VitestBaseConfig {
  /** Environment-specific configuration */
  environment: VitestEnvironmentConfig
  /** Pool configuration options */
  poolOptions: VitestPoolOptions
  /** Timeout configurations */
  timeouts: {
    test: number
    hook: number
    teardown: number
  }
  /** Coverage configuration */
  coverage: {
    enabled: boolean
    threshold: number
    reporter: string[]
  }
}

/**
 * Detect current test environment and create configuration context
 */
export function createVitestEnvironmentConfig(): VitestEnvironmentConfig {
  const env = getTestEnvironment()

  return {
    isCI: env.isCI,
    isWallaby: env.isWallaby,
    isVitest: env.isVitest,
    isJest: env.isJest,
    nodeEnv: env.nodeEnv,
  }
}

/**
 * Create optimized pool configuration based on environment
 *
 * Default Strategy: 'forks' for stability and isolation
 * - Better memory isolation between tests
 * - More reliable in CI environments
 * - Prevents test pollution
 *
 * Alternative: 'threads' for speed (can be overridden)
 * - Faster test execution
 * - Lower memory overhead
 * - May have isolation issues with globals
 */
export function createVitestPoolOptions(envConfig: VitestEnvironmentConfig): VitestPoolOptions {
  // Use forks for stability in all environments by default
  // Packages can override to 'threads' if they need speed over isolation
  const pool: 'forks' | 'threads' = 'forks'

  // Worker configuration based on environment
  let maxWorkers = 4
  let minWorkers = 1

  if (envConfig.isCI) {
    // Limit workers in CI to avoid resource exhaustion
    maxWorkers = 2
    minWorkers = 1
  } else if (envConfig.isWallaby) {
    // Single worker for Wallaby to ensure predictable behavior
    maxWorkers = 1
    minWorkers = 1
  }

  return {
    pool,
    isolate: true, // Always isolate tests for reliability
    bail: envConfig.isCI ? 1 : false, // Bail fast in CI, continue locally
    maxWorkers,
    minWorkers,
  }
}

/**
 * Create timeout configuration based on environment
 */
export function createVitestTimeouts(_envConfig: VitestEnvironmentConfig) {
  const timeouts = getTestTimeouts()

  return {
    test: timeouts.unit,
    hook: timeouts.unit,
    teardown: 20_000, // Always allow ample time for cleanup
  }
}

/**
 * Create coverage configuration
 */
export function createVitestCoverage(envConfig: VitestEnvironmentConfig) {
  return {
    enabled: !envConfig.isWallaby, // Disable in Wallaby for performance
    threshold: 80, // Target coverage percentage
    reporter: envConfig.isCI ? ['json', 'clover'] : ['text', 'html'],
  }
}

/**
 * Create complete base configuration object
 */
export function createVitestBaseConfig(): VitestBaseConfig {
  const environment = createVitestEnvironmentConfig()
  const poolOptions = createVitestPoolOptions(environment)
  const timeouts = createVitestTimeouts(environment)
  const coverage = createVitestCoverage(environment)

  return {
    environment,
    poolOptions,
    timeouts,
    coverage,
  }
}

/**
 * Base Vitest configuration that packages can extend
 */
export function createBaseVitestConfig(overrides: Partial<UserConfig> = {}): UserConfig {
  const config = createVitestBaseConfig()

  const baseConfig: UserConfig = {
    test: {
      // Environment setup
      environment: 'node',
      // Route Convex tests to edge-runtime to better match Convex's runtime
      environmentMatchGlobs: [
        // Any tests located under a convex/ folder will run in edge-runtime
        ['**/convex/**', 'edge-runtime'],
      ],
      globals: false, // Explicit imports for better IDE support

      // Pool configuration
      pool: config.poolOptions.pool,
      isolate: config.poolOptions.isolate,

      // Timeout configuration
      testTimeout: config.timeouts.test,
      hookTimeout: config.timeouts.hook,
      teardownTimeout: config.timeouts.teardown,

      // Pool-specific options
      poolOptions: {
        forks: {
          singleFork: config.poolOptions.maxWorkers === 1,
          maxForks: config.poolOptions.maxWorkers,
          minForks: config.poolOptions.minWorkers,
        },
        threads: {
          singleThread: config.poolOptions.maxWorkers === 1,
          maxThreads: config.poolOptions.maxWorkers,
          minThreads: config.poolOptions.minWorkers,
        },
      },

      // Bail configuration
      bail:
        config.poolOptions.bail === true
          ? 1
          : config.poolOptions.bail === false
            ? undefined
            : config.poolOptions.bail,

      // Environment variables
      env: {
        NODE_ENV: 'test',
        VITEST: 'true',
      },

      // File patterns
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      ],

      // Coverage configuration
      coverage: config.coverage.enabled
        ? {
            provider: 'v8' as const,
            reporter: config.coverage.reporter as (
              | 'text'
              | 'json'
              | 'html'
              | 'clover'
              | 'json-summary'
              | 'lcov'
              | 'lcovonly'
              | 'none'
              | 'teamcity'
              | 'text-file'
              | 'text-lcov'
              | 'text-summary'
              | 'cobertura'
            )[],
            reportsDirectory: './test-results/coverage',
            exclude: [
              'node_modules/',
              'dist/',
              'coverage/',
              '**/*.d.ts',
              '**/*.config.*',
              '**/index.ts',
            ],
            thresholds: {
              statements: config.coverage.threshold,
              branches: config.coverage.threshold,
              functions: config.coverage.threshold,
              lines: config.coverage.threshold,
            },
          }
        : undefined,

      // Setup files - includes register by default for environment setup
      setupFiles: ['@template/testkit/register'],

      // Inline convex-test for better dependency tracking in Vitest
      server: {
        deps: { inline: ['convex-test'] },
      },

      // Reporter configuration
      reporters: config.environment.isCI
        ? ['verbose', 'junit']
        : config.environment.isWallaby
          ? ['verbose']
          : ['default'],

      // Output configuration
      outputFile: config.environment.isCI
        ? {
            junit: './test-results/junit.xml',
          }
        : undefined,
    },
  }

  // Deep merge with overrides
  return mergeVitestConfig(baseConfig, overrides)
}

/**
 * Default base configuration export
 */
export const baseVitestConfig = createBaseVitestConfig()

/**
 * Convenience function to create a Vitest config with base settings
 */
export function defineVitestConfig(overrides: Partial<UserConfig> = {}) {
  return defineConfig(createBaseVitestConfig(overrides))
}

/**
 * Deep merge Vitest configurations
 */
function mergeVitestConfig(base: UserConfig, override: Partial<UserConfig>): UserConfig {
  const merged = { ...base }

  if (override.test) {
    merged.test = {
      ...base.test,
      ...override.test,
    }

    // Handle nested objects
    if (base.test?.poolOptions && override.test.poolOptions) {
      merged.test.poolOptions = {
        ...base.test.poolOptions,
        ...override.test.poolOptions,
      }
    }

    if (base.test?.coverage && override.test.coverage) {
      merged.test.coverage = {
        ...base.test.coverage,
        ...override.test.coverage,
      }
    }

    if (base.test?.env && override.test.env) {
      merged.test.env = {
        ...base.test.env,
        ...override.test.env,
      }
    }
  }

  // Merge other top-level properties
  Object.keys(override).forEach((key) => {
    if (key !== 'test') {
      ;(merged as Record<string, unknown>)[key] = (override as Record<string, unknown>)[key]
    }
  })

  return merged
}

/**
 * Wallaby-specific configuration optimizations
 */
export function createWallabyOptimizedConfig(overrides: Partial<UserConfig> = {}): UserConfig {
  return createBaseVitestConfig({
    test: {
      // Wallaby-specific optimizations
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
          maxForks: 1,
          minForks: 1,
        },
      },
      isolate: true,
      coverage: undefined, // Disable coverage in Wallaby
      reporters: ['verbose'],
      ...overrides.test,
    },
    ...overrides,
  })
}

/**
 * CI-optimized configuration
 */
export function createCIOptimizedConfig(overrides: Partial<UserConfig> = {}): UserConfig {
  return createBaseVitestConfig({
    test: {
      // CI-specific optimizations
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 2,
          minForks: 1,
        },
      },
      bail: 1,
      reporters: ['verbose', 'junit'],
      outputFile: {
        junit: './junit.xml',
      },
      ...overrides.test,
    },
    ...overrides,
  })
}
