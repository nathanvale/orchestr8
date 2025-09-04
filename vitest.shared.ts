/**
 * Shared Vitest Configuration Base (2025)
 * 
 * Common configuration shared across all workspace packages.
 * Packages can extend this base configuration with their specific needs.
 */

import { defineConfig } from 'vitest/config'
import type { InlineConfig } from 'vitest'
import { cpus } from 'node:os'

export const vitestSharedConfig: InlineConfig = {
  test: {
    // Modern performance optimizations
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.max(1, cpus().length - 1),
        minThreads: 1,
      },
    },

    // Test isolation and globals
    isolate: true,
    globals: true,
    clearMocks: true,

    // ADHD-friendly timeouts: generous but not excessive
    testTimeout: 10000,
    hookTimeout: 10000, 
    teardownTimeout: 15000,

    // Clean environment management
    unstubEnvs: true,
    unstubGlobals: true,

    // Coverage defaults
    coverage: {
      provider: 'v8',
      enabled: false, // Enable per-package as needed
      clean: true,
      reportOnFailure: true,
      exclude: [
        'coverage/**',
        'dist/**',
        'build/**',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs}',
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        '**/test-utils.{js,ts,jsx,tsx}',
        '**/mocks/**',
      ],
    },

    // ADHD-friendly output: minimal noise
    passWithNoTests: true,
    logHeapUsage: false, // Only enable for debugging
  },
}

/**
 * Helper function to create package-specific Vitest config
 * @param overrides - Package-specific configuration overrides
 */
export function createVitestConfig(overrides: InlineConfig = {}) {
  return defineConfig({
    ...vitestSharedConfig,
    ...overrides,
    test: {
      ...vitestSharedConfig.test,
      ...overrides.test,
    },
  })
}

export default vitestSharedConfig