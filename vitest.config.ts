/// <reference types="vitest/globals" />
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Shared Vitest Configuration
 *
 * This is the base configuration used by all projects in the monorepo.
 * Individual projects can override these settings as needed.
 *
 * For multi-project workspace configuration, see vitest.workspace.ts
 */

// Helper function to extract package name from current working directory
function getPackageName(): string {
  const cwd = process.cwd()
  if (cwd.includes('/packages/')) {
    const match = /\/packages\/([^/]+)/.exec(cwd)
    return match?.[1] ?? 'root'
  }
  if (cwd.includes('/apps/')) {
    const match = /\/apps\/([^/]+)/.exec(cwd)
    return match?.[1] ?? 'root'
  }
  return 'root'
}

const packageName = getPackageName()
const coverageDirectory = `./test-results/coverage/${packageName}`

// Ensure coverage directory exists for JUnit reporter.
if (process.env['CI']) {
  try {
    mkdirSync(coverageDirectory, { recursive: true })
  } catch {
    // Directory might already exist, ignore error
  }
}

export default defineConfig({
  // Cache configuration
  cacheDir: '.vitest',

  test: {
    // Default environment (can be overridden per project)
    environment: 'node',

    // Include all test files across the monorepo
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'packages/**/src/**/*.{test,spec}.{ts,tsx}',
      'packages/**/tests/**/*.{test,spec}.{ts,tsx}',
      'apps/*/src/**/*.{test,spec}.{ts,tsx}',
      'apps/*/tests/**/*.{test,spec}.{ts,tsx}',
    ],

    // Global excludes
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.next/**'],

    // Setup files
    setupFiles: ['./vitest.setup.tsx'],

    // Why: Forks pool prevents worker termination issues in Bun/Vitest hybrid
    // Trade-off: Slightly slower than threads but more stable for Bun runtime
    // Context: Official Vitest/Bun workaround for worker stability issues
    pool: 'forks',

    // Why: Ensure test isolation to prevent state bleed between tests
    isolate: true,

    // Module resolution
    deps: {
      moduleDirectories: ['node_modules'],
    },

    // Why: Globals (describe, it, expect) match Jest patterns most devs know
    globals: true,
    // Why: Clear mocks prevents test pollution and flaky failures
    clearMocks: true,

    // Why: Coverage ensures code quality and catches untested paths
    coverage: {
      // Why: V8 provider is 2-3x faster than Istanbul and works better with Bun
      provider: 'v8',
      reporter: process.env['CI']
        ? ['text', 'text-summary', 'html', 'lcov', 'json-summary']
        : ['text-summary'], // Reduce reporter noise in local development
      reportsDirectory: coverageDirectory,
      reportOnFailure: true,
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
      include: ['packages/*/src/**/*.{js,ts,jsx,tsx}', 'apps/*/src/**/*.{js,ts,jsx,tsx}'],
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

    // Why: Generous timeouts prevent flaky failures in CI/slow environments
    testTimeout: 10000, // Why: API calls and DB operations need more than default 5s
    hookTimeout: 10000, // Why: Setup/teardown may involve complex initialization
    teardownTimeout: 15000, // Why: MSW cleanup and worker termination need extra time

    // Reporter configuration with balanced output
    reporters: process.env['GITHUB_ACTIONS']
      ? ['dot', 'github-actions', 'junit']
      : process.env['CI']
        ? ['dot', 'junit']
        : process.env['VERBOSE'] === 'true'
          ? ['verbose']
          : ['default'],
    outputFile: {
      junit: `${coverageDirectory}/junit.xml`,
    },

    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false,
    },

    // Advanced options for ADHD-optimized feedback
    passWithNoTests: true, // Template project may have no tests initially
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
})
