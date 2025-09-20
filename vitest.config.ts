/// <reference types="vitest/globals" />
import { mkdirSync } from 'node:fs'
import { cpus } from 'node:os'
import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import { vitestSharedConfig } from './vitest.shared.js'

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

// Environment detection for test output control
const isCI = process.env['CI'] === 'true'
const isVitestSilent = process.env['VITEST_SILENT'] === 'true'
const isDebugMode = process.env['DEBUG'] === 'true' || process.env['VERBOSE'] === 'true'

// Determine silent mode based on environment
const silentMode = isDebugMode ? false : isCI ? true : isVitestSilent ? true : false

export default mergeConfig(
  vitestSharedConfig,
  defineConfig({
    // Cache configuration
    cacheDir: '.vitest',

    test: {
      // Note: Global setup/teardown temporarily disabled due to Vitest v3 compatibility issues
      // TODO: Find alternative approach for zombie prevention
      // globalSetup: './vitest.globalSetup.ts',
      // globalTeardown: './vitest.globalTeardown.ts',
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
              process.env['WALLABY_WORKER'] || process.env['WALLABY_WORKER_ID']
                ? [
                    'tests/**/*.{test,spec}.{ts,tsx}',
                    '!tests/**/*.integration.{test,spec}.{ts,tsx}',
                    '!tests/**/*.e2e.{test,spec}.{ts,tsx}',
                    '!tests/**/*.slow.{test,spec}.{ts,tsx}',
                  ]
                : process.env['TEST_MODE'] === 'integration'
                  ? ['tests/**/*.integration.{test,spec}.{ts,tsx}']
                  : process.env['TEST_MODE'] === 'e2e'
                    ? ['tests/**/*.e2e.{test,spec}.{ts,tsx}']
                    : process.env['TEST_MODE'] === 'all'
                      ? ['tests/**/*.{test,spec}.{ts,tsx}']
                      : [
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
        '**/*.disposal.test.{ts,tsx}',
      ],

      // Include pattern for different modes - ADHD-optimized test classification
      include:
        process.env['TEST_MODE'] === 'integration'
          ? ['**/*.integration.test.{ts,tsx}']
          : process.env['TEST_MODE'] === 'e2e'
            ? ['**/*.e2e.test.{ts,tsx}']
            : ['**/*.test.{ts,tsx}'],

      // Setup files - includes memory monitoring and zombie prevention for all tests
      setupFiles: [
        './vitest.setup.tsx',
        './tests/setup/console-suppression.ts', // Console noise suppression
        './tests/setup/memory-cleanup.ts', // Memory monitoring hooks
        './tests/setup/zombie-prevention.ts', // Zombie process prevention
      ],

      // Environment-aware pool configuration for optimal zombie prevention
      // Wallaby: Use threads with singleThread for better instrumentation
      // Regular: Use forks with controlled workers to prevent zombies
      pool: process.env['WALLABY_WORKER'] ? 'threads' : 'forks',
      poolOptions: {
        threads: {
          // Single thread for Wallaby's real-time feedback and instrumentation
          singleThread: !!process.env['WALLABY_WORKER'],
          isolate: true,
          useAtomics: false, // Avoid segfaults in older Node versions
        },
        forks: {
          // Controlled multi-process execution for regular tests
          singleFork: false,
          // Optimize for available CPUs, leaving some for system
          maxForks: isCI ? 2 : Math.max(1, cpus().length - 1),
          minForks: 1,
          isolate: true,
        },
      },

      // Why: Ensure test isolation to prevent state bleed between tests
      isolate: true,

      // ADHD-optimized watch configuration - instant feedback
      watch: true,

      // Test organization for predictable order
      sequence: {
        shuffle: false, // Predictable order
        hooks: 'stack', // Run setup/teardown in order
      },

      // Focus helpers for ADHD workflow
      allowOnly: true, // Allow test.only() for hyperfocus
      passWithNoTests: true, // Don't fail on empty suites

      // Smart retries (CI only, not during dev)
      retry: process.env['CI'] ? 2 : 0,

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

      // Timeouts for zombie process prevention (more aggressive)
      testTimeout: 5000, // 5s max for unit tests
      hookTimeout: 10000, // 10s for setup/teardown
      teardownTimeout: 5000, // 5s for teardown (aggressive to prevent zombies)

      // Environment-aware reporter configuration for noise reduction
      reporters: process.env['GITHUB_ACTIONS']
        ? ['github-actions', 'junit'] // GitHub Actions reporter for CI
        : isCI
          ? ['dot', 'junit'] // Minimal CI output
          : isDebugMode
            ? ['verbose'] // Full output in debug mode
            : isVitestSilent
              ? [['default', { summary: false, hideSkipped: true }]] // Silent mode: minimal output
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
      logHeapUsage: process.env['MEMORY_DEBUG'] === 'true', // Only log heap when explicitly debugging memory

      // Silent mode configuration
      silent: silentMode,
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

    // Define externals to prevent Vite from trying to bundle Node-specific modules
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
