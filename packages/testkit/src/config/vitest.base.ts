/**
 * Base Vitest Configuration
 *
 * Provides a standardized Vitest configuration that all packages can extend.
 * Includes environment detection, Wallaby compatibility, and optimized settings
 * for stability and performance.
 */

import { defineConfig, type UserConfig } from 'vitest/config'
// no-op
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
    enabled: envConfig.isCI, // Enable coverage only in CI; speed up local/dev runs
    threshold: 70, // Current coverage baseline (target: 80% in follow-up)
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

  // Normalize setupFiles so overrides can propagate into projects too.
  // By default, consumers should use the published entry '@template/testkit/register'.
  // However, when running this package itself, tests may need './src/register.ts'.
  // Determine if running inside the testkit package using cwd heuristics only
  const cwdPath = process.cwd().replace(/\\/g, '/')
  const rootOverride = typeof overrides.test?.root === 'string' ? overrides.test?.root : undefined
  const rootPath = rootOverride ? String(rootOverride).replace(/\\/g, '/') : ''
  const isRunningInTestkit =
    (!!rootPath &&
      (rootPath.includes('/packages/testkit/') || rootPath.endsWith('/packages/testkit'))) ||
    cwdPath.includes('/packages/testkit/') ||
    cwdPath.endsWith('/packages/testkit') ||
    process.env['TESTKIT_LOCAL'] === '1'
  const overrideSetup = Array.isArray(overrides.test?.setupFiles)
    ? (overrides.test?.setupFiles as string[])
    : overrides.test?.setupFiles
      ? [overrides.test.setupFiles as unknown as string]
      : undefined
  const defaultSetup = isRunningInTestkit ? ['./src/register.ts'] : ['@template/testkit/register']
  const setupFiles = overrideSetup ?? defaultSetup

  const baseConfig: UserConfig = {
    test: {
      // Environment setup
      environment: 'node',
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

      // Coverage configuration (always present to satisfy tooling that reads shape)
      coverage: {
        enabled: config.coverage.enabled,
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
      },

      // Setup files - includes register by default for environment setup
      setupFiles,

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

  // Add projects configuration for Convex tests with edge-runtime
  // This replaces the deprecated environmentMatchGlobs
  const defaultProjects = [
    {
      test: {
        ...baseConfig.test,
        setupFiles, // Use the normalized setupFiles that respects overrides
        include: [
          'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          'examples/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ],
        exclude: [
          ...(baseConfig.test?.exclude || []),
          '**/convex/**', // Exclude Convex tests from unit project
        ],
      },
    },
    {
      test: {
        ...baseConfig.test,
        setupFiles, // Use the normalized setupFiles that respects overrides
        environment: 'edge-runtime',
        include: ['**/convex/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        // Inline convex-test for better dependency tracking
        server: {
          deps: { inline: ['convex-test'] },
        },
      },
    },
  ]

  const configWithProjects: UserConfig = {
    ...baseConfig,
    test: {
      ...baseConfig.test,
      // Only add projects if none were provided in overrides
      ...(overrides.test?.projects
        ? { projects: overrides.test.projects }
        : isRunningInTestkit
          ? {}
          : { projects: defaultProjects }),
    },
  }

  // Deep merge with overrides
  return mergeVitestConfig(configWithProjects, overrides)
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
      coverage: { provider: 'v8', enabled: false }, // Disable coverage in Wallaby but keep shape
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
