/// <reference types="vitest/globals" />
import { mkdirSync } from 'node:fs'
import { cpus } from 'node:os'
import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import { vitestSharedConfig } from './vitest.shared'

/**
 * Modern Vitest Configuration (2025)
 *
 * Uses modern projects pattern for monorepo support with optimal performance.
 * Configured for ADHD-friendly development with fast feedback loops.
 *
 * Key improvements:
 * - threads pool for better performance
 * - auto-discovery of workspace packages
 * - optimized coverage configuration
 * - ADHD-friendly minimal output
 */

// Modern approach: Use Vitest's native project discovery
// Coverage directory simplified with workspace-aware naming
const coverageDirectory = './test-results/coverage'

// Ensure test directories exist (not just in CI)
try {
  mkdirSync('./test-results', { recursive: true })
  mkdirSync(coverageDirectory, { recursive: true })
  // Create .tmp subdirectory that v8 coverage provider expects
  mkdirSync(`${coverageDirectory}/.tmp`, { recursive: true })
} catch {
  // Directory might already exist, ignore error
}

export default mergeConfig(
  vitestSharedConfig,
  defineConfig({
    // Cache configuration
    cacheDir: '.vitest',

    test: {
      // Modern 2025 workspace pattern for automatic package discovery
      projects: [
        // Auto-discover all packages with their own configs
        'packages/*',
        // Include root-level tests (ADHD-optimized: exclude slow tests by default)
        {
          test: {
            name: 'root',
            environment: 'node',
            // Wallaby detection: When running in Wallaby, exclude slow tests
            // Otherwise use TEST_MODE environment variable
            include:
              process.env.WALLABY_WORKER || process.env.WALLABY_WORKER_ID
                ? [
                    'tests/**/*.unit.{test,spec}.{ts,tsx}',
                    'tests/**/*.{test,spec}.{ts,tsx}',
                    '!tests/**/*.integration.{test,spec}.{ts,tsx}',
                    '!tests/**/*.e2e.{test,spec}.{ts,tsx}',
                    '!tests/**/*.slow.{test,spec}.{ts,tsx}',
                  ]
                : process.env.TEST_MODE === 'integration'
                  ? ['tests/**/*.integration.{test,spec}.{ts,tsx}']
                  : process.env.TEST_MODE === 'e2e'
                    ? ['tests/**/*.e2e.{test,spec}.{ts,tsx}']
                    : process.env.TEST_MODE === 'all'
                      ? ['tests/**/*.{test,spec}.{ts,tsx}']
                      : [
                          'tests/**/*.unit.{test,spec}.{ts,tsx}',
                          'tests/**/*.{test,spec}.{ts,tsx}',
                          '!tests/**/*.integration.{test,spec}.{ts,tsx}',
                          '!tests/**/*.e2e.{test,spec}.{ts,tsx}',
                          '!tests/**/*.slow.{test,spec}.{ts,tsx}',
                        ],
          },
        },
      ],

      // Default environment for root project
      environment: 'node',

      // Global excludes - ADHD-optimized: exclude slow tests from watch mode
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.next/**',
        // Exclude slow tests from watch mode
        '**/*.integration.test.{ts,tsx}',
        '**/*.e2e.test.{ts,tsx}',
        '**/*.slow.test.{ts,tsx}',
      ],

      // Include pattern for different modes - ADHD-optimized test classification
      include:
        process.env.TEST_MODE === 'integration'
          ? ['**/*.integration.test.{ts,tsx}']
          : process.env.TEST_MODE === 'e2e'
            ? ['**/*.e2e.test.{ts,tsx}']
            : ['**/*.unit.test.{ts,tsx}', '**/*.test.{ts,tsx}'],

      // Setup files
      setupFiles: ['./vitest.setup.tsx'],

      // Modern 2025: threads pool for optimal performance
      // Threads provide better performance and memory efficiency
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          // Optimize for available CPUs, leaving some for system
          maxThreads: Math.max(1, cpus().length - 1),
          minThreads: 1,
        },
      },

      // Why: Ensure test isolation to prevent state bleed between tests
      isolate: true,

      // ADHD-optimized watch configuration - instant feedback
      watch: {
        // Only rerun tests for changed files
        mode: 'typecheck',
        useFsEvents: true,
        ignorePermissionErrors: true,
      },

      // Test organization for predictable order
      sequence: {
        shuffle: false, // Predictable order
        hooks: 'stack', // Run setup/teardown in order
      },

      // Focus helpers for ADHD workflow
      allowOnly: true, // Allow test.only() for hyperfocus
      passWithNoTests: true, // Don't fail on empty suites

      // Smart retries (CI only, not during dev)
      retry: process.env.CI ? 2 : 0,

      // Module resolution
      deps: {
        moduleDirectories: ['node_modules'],
      },

      // Why: Globals (describe, it, expect) match Jest patterns most devs know
      globals: true,
      // Why: Clear mocks prevents test pollution and flaky failures
      clearMocks: true,

      // Optimized coverage configuration for 2025
      coverage: {
        provider: 'v8', // Fastest coverage provider
        // ADHD-friendly: minimal output locally, comprehensive in CI
        reporter: process.env['CI'] ? ['text', 'html', 'lcov', 'json-summary'] : ['text-summary'], // Clean, minimal local output
        reportsDirectory: coverageDirectory,
        reportOnFailure: true,
        clean: true, // Clean coverage directory before each run
        exclude: [
          'coverage/**',
          'dist/**',
          'build/**',
          'node_modules/**',
          '**/*.d.ts',
          '**/*.config.{js,ts,mjs}',
          '**/.{eslint,prettier}rc.{js,cjs,yml,yaml,json}',
          '**/*.test.{js,ts,jsx,tsx}',
          '**/*.spec.{js,ts,jsx,tsx}',
          'vitest.setup.tsx',
          'vitest.server.setup.ts',
          'wallaby.js',
          'tests/**',
          '**/test-utils.tsx',
          '**/mocks/**',
        ],
        include: [
          'packages/*/src/**/*.{js,ts,jsx,tsx}',
          'apps/*/src/**/*.{js,ts,jsx,tsx}',
          'tooling/**/*.{js,ts,jsx,tsx}',
        ],
        // Coverage threshold strategy:
        // - Global thresholds apply to all files by default
        // - Critical modules can have stricter per-file thresholds
        // - Uncomment and adjust perFile config below for critical utilities
        thresholds: {
          global: {
            // Starting thresholds - will be ratcheted up over time
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
          },
        },
        // Skip coverage collection in watch mode for performance
        enabled: process.env['VITEST_WATCH'] !== 'true',
        skipFull: false,
      },

      // Timeouts that respect ADHD time blindness
      testTimeout: 5000, // 5s max for unit tests
      hookTimeout: 10000, // 10s for setup/teardown
      teardownTimeout: 15000, // MSW cleanup and worker termination need extra time

      // ADHD-friendly reporter configuration: minimal cognitive load
      reporters: process.env['GITHUB_ACTIONS']
        ? ['dot', 'github-actions', 'junit']
        : process.env['CI']
          ? ['dot', 'junit']
          : process.env['VERBOSE'] === 'true'
            ? ['verbose']
            : [['default', { summary: false }]], // ADHD-friendly: minimal noise
      outputFile: {
        junit: `${coverageDirectory}/junit.xml`,
      },

      // Snapshot configuration
      snapshotFormat: {
        printBasicPrototype: false,
      },

      // Advanced options for ADHD-optimized feedback
      // passWithNoTests: true, // Already set above in focus helpers
      logHeapUsage: process.env.NODE_ENV === 'development', // Memory debugging in dev only
      // Use built-in unstub support instead of manual teardown calls
      unstubEnvs: true,
      unstubGlobals: true,

      // UI mode configuration (for development)
      ui: process.env['VITEST_UI'] === 'true',
      open: false, // Don't auto-open browser
    },

    // Vite configuration for better module resolution
    resolve: {
      alias: {
        // Why: Absolute paths prevent SSR/Vite module resolution issues with relative paths
        '@': path.resolve(process.cwd(), 'src'),
        '@tests': path.resolve(process.cwd(), 'tests'),
        // Force rollup resolution to WASM fallback to avoid native optional binary install issues under certain package managers
        // 'rollup': '@rollup/wasm-node', // Temporarily disabled to debug EPIPE issue
        // Removed unused @types, @utils and @config aliases to reduce cognitive load until directories exist
      },
    },

    // Define externals to prevent Vite from trying to bundle Bun-specific modules
    define: {
      'import.meta.vitest': 'undefined',
    },

    // Build configuration
    build: {
      rollupOptions: {
        external: ['@rollup/rollup-linux-x64-gnu', '@rollup/rollup-darwin-arm64'],
      },
    },

    // ESBuild configuration for TypeScript processing
    esbuild: {
      target: 'esnext',
      keepNames: true,
      jsx: 'automatic',
    },
  }),
)
