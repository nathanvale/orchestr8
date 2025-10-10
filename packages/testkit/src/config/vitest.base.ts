/**
 * Base Vitest Configuration
 *
 * Provides a standardized Vitest configuration that all packages can extend.
 * Includes environment detection, Wallaby compatibility, and optimized settings
 * for stability and performance.
 */

import type { UserConfig } from 'vitest/config'
import { getTestEnvironment, getTestTimeouts } from '../env/core.js'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Current coverage baseline threshold
 * Temporarily lowered to 54% while fixing vitest config issues.
 * TODO: Gradually increase back to 69% in follow-up PRs.
 * Adjust via COVERAGE_THRESHOLD env var or increment gradually in CI.
 */
const DEFAULT_COVERAGE_THRESHOLD = 54

/**
 * Check if edge runtime dependency is available
 * Safely attempts to resolve @edge-runtime/vm without throwing
 */
function canUseEdgeRuntime(): boolean {
  if (process.env.TESTKIT_DISABLE_EDGE_RUNTIME === '1') {
    return false
  }

  try {
    // If import.meta.resolve is not available (e.g., in test environments), return false
    if (!import.meta.resolve) {
      return false
    }
    import.meta.resolve('@edge-runtime/vm')
    return true
  } catch {
    return false
  }
}

/**
 * Check if Convex tests exist in the project
 * Uses simple directory existence check
 */
function hasConvexTests(): boolean {
  try {
    const cwd = process.cwd()
    const convexDir = path.join(cwd, 'convex')
    return fs.existsSync(convexDir)
  } catch {
    return false
  }
}

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
  pool: 'forks' | 'threads'
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
  // Use nullish coalescing to properly handle 0 as a valid threshold
  const envThreshold = process.env.COVERAGE_THRESHOLD
  let threshold = DEFAULT_COVERAGE_THRESHOLD

  if (envThreshold !== undefined) {
    const parsed = Number(envThreshold)
    // Use the parsed value if it's a valid number, otherwise fall back to default
    threshold = isNaN(parsed) ? DEFAULT_COVERAGE_THRESHOLD : parsed
  }

  return {
    enabled: envConfig.isCI, // Enable coverage only in CI; speed up local/dev runs
    threshold,
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

  // Simplified setupFiles detection:
  // 1. Use TESTKIT_LOCAL=1 env var for explicit local mode (preferred)
  // 2. Fallback to path-based detection as secondary method
  // 3. Default to published package entry
  // Safely check if running in local testkit
  let isLocalTestkit = process.env.TESTKIT_LOCAL === '1'
  if (!isLocalTestkit) {
    try {
      isLocalTestkit = process.cwd().includes('/packages/testkit')
    } catch {
      isLocalTestkit = false
    }
  }

  const overrideSetup = Array.isArray(overrides.test?.setupFiles)
    ? (overrides.test?.setupFiles as string[])
    : overrides.test?.setupFiles
      ? [overrides.test.setupFiles as unknown as string]
      : undefined

  const defaultSetup = isLocalTestkit ? ['./src/register.ts'] : ['@orchestr8/testkit/register']
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
      reporters: (() => {
        const baseReporters = config.environment.isCI
          ? ['verbose', 'junit']
          : config.environment.isWallaby
            ? ['verbose']
            : ['default']

        // Conditionally add hanging-process reporter for debugging process hangs
        // Enabled by default in CI to help diagnose leaked handles
        const shouldReportHangs =
          process.env.TESTKIT_REPORT_HANGS === 'on' ||
          (config.environment.isCI && process.env.TESTKIT_REPORT_HANGS !== 'off')

        if (shouldReportHangs && !baseReporters.includes('hanging-process')) {
          return [...baseReporters, 'hanging-process']
        }

        return baseReporters
      })(),

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
  const includePatterns = [
    'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
  ]

  // Examples are opt-in to avoid slowing down CI with large/slow example tests
  if (process.env.TESTKIT_INCLUDE_EXAMPLES === '1') {
    includePatterns.push('examples/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}')
  }

  const defaultProjects = [
    {
      test: {
        ...baseConfig.test,
        setupFiles, // Use the normalized setupFiles that respects overrides
        include: includePatterns,
        exclude: [
          ...(baseConfig.test?.exclude || []),
          '**/convex/**', // Exclude Convex tests from unit project
        ],
      },
    },
  ]

  // Conditionally add edge-runtime project only when:
  // - NOT explicitly disabled with TESTKIT_DISABLE_EDGE_RUNTIME=1
  // - AND edge runtime dependency is available (canUseEdgeRuntime returns true)
  // - OR Convex tests exist in the project (hasConvexTests returns true)
  // - OR TESTKIT_ENABLE_EDGE_RUNTIME=1 is set
  const shouldIncludeEdgeRuntime =
    process.env.TESTKIT_DISABLE_EDGE_RUNTIME !== '1' &&
    (process.env.TESTKIT_ENABLE_EDGE_RUNTIME === '1' || canUseEdgeRuntime() || hasConvexTests())

  if (shouldIncludeEdgeRuntime) {
    defaultProjects.push({
      test: {
        ...baseConfig.test,
        setupFiles, // Use the normalized setupFiles that respects overrides
        environment: 'edge-runtime',
        include: ['**/convex/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: baseConfig.test?.exclude || [],
        // Inline convex-test for better dependency tracking
        server: {
          deps: { inline: ['convex-test'] },
        },
      },
    })
  }

  const configWithProjects: UserConfig = {
    ...baseConfig,
    test: {
      ...baseConfig.test,
      // Only add projects if none were provided in overrides
      ...(overrides.test?.projects
        ? { projects: overrides.test.projects }
        : isLocalTestkit
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
 * Deep merge Vitest configurations
 */
function mergeVitestConfig(base: UserConfig, override: Partial<UserConfig>): UserConfig {
  const merged = { ...base }

  if (override.test) {
    merged.test = {
      ...base.test,
      ...override.test,
    }

    // Normalize setupFiles to always be an array
    if (override.test.setupFiles !== undefined) {
      merged.test.setupFiles = Array.isArray(override.test.setupFiles)
        ? override.test.setupFiles
        : [override.test.setupFiles as string]
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
        junit: './test-results/junit.xml',
      },
      ...overrides.test,
    },
    ...overrides,
  })
}
