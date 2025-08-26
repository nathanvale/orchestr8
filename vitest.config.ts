/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment configuration
    environment: 'happy-dom', // Faster than jsdom for DOM testing

    // Performance optimizations for 2025
    pool: 'forks', // Use forks instead of threads for better Bun compatibility
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: false, // Better performance with Bun
        minForks: 1,
        maxForks: process.env['CI'] === 'true' ? 4 : 8, // Limit in CI, use 8 cores locally
      },
    },

    // File patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'dist', 'build', 'coverage', '.turbo', '**/.bun/**'],

    // Module resolution fixes for MSW and ES modules
    deps: {
      moduleDirectories: ['node_modules'],
      optimizer: {
        web: {
          exclude: [
            // Exclude Bun-specific modules from transformation
            'bun',
          ],
        },
      },
    },

    // Setup files
    setupFiles: ['./vitest.setup.tsx'],

    // Global configuration
    globals: true, // Enable global test functions (describe, it, expect)
    clearMocks: true, // Auto-clear mocks between tests
    mockReset: true, // Reset mock state between tests
    restoreMocks: true, // Restore original implementation after tests

    // Coverage configuration with 2025 optimizations
    coverage: {
      provider: 'v8', // Faster than istanbul, better Bun compatibility
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        'build/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.{js,ts,mjs}',
        '**/.{eslint,prettier}rc.{js,cjs,yml,yaml,json}',
        'vitest.setup.ts',
        'wallaby.js',
      ],
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      // Configurable thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      // Skip coverage collection in watch mode for performance
      enabled: process.env['VITEST_WATCH'] !== 'true',
      skipFull: false,
    },

    // Watch mode optimizations
    watchExclude: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '**/.bun/**'],

    // Timeout configurations
    testTimeout: 10000, // 10 seconds for individual tests
    hookTimeout: 10000, // 10 seconds for hooks
    teardownTimeout: 5000, // 5 seconds for teardown

    // Reporter configuration
    reporters: process.env['CI'] === 'true' ? ['verbose', 'junit'] : ['verbose'],
    outputFile: {
      junit: './coverage/junit.xml',
    },

    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false,
    },

    // Advanced options for ADHD-optimized feedback
    passWithNoTests: true,
    logHeapUsage: process.env.NODE_ENV === 'development',

    // UI mode configuration (for development)
    ui: process.env['VITEST_UI'] === 'true',
    open: false, // Don't auto-open browser
  },

  // Vite configuration for better module resolution
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@tests': new URL('./tests', import.meta.url).pathname,
      '@types': new URL('./types', import.meta.url).pathname,
      '@utils': new URL('./src/utils', import.meta.url).pathname,
      '@config': new URL('./config', import.meta.url).pathname,
      // Mock the bun module during tests
      'bun': new URL('./tests/mocks/bun.mock.ts', import.meta.url).pathname,
    },
  },

  // ESBuild configuration for TypeScript processing
  esbuild: {
    target: 'esnext',
    keepNames: true,
    jsx: 'automatic', // Use React 17+ automatic JSX transform
  },
});
