/// <reference types="vitest/globals" />
import { mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';

// Ensure coverage directory exists for JUnit reporter
if (process.env['CI'] === 'true') {
  try {
    mkdirSync('./coverage', { recursive: true });
  } catch {
    // Directory might already exist, ignore error
  }
}

// Removed unused CPU and runtime detection variables - using single-threaded mode
// to avoid worker thread termination issues

export default defineConfig({
  // Cache configuration (applies to Vite caching)
  cacheDir: '.vitest',

  test: {
    // Environment configuration
    environment: 'happy-dom', // Faster than jsdom for DOM testing

    // Performance optimizations for 2025
    // Use single-threaded mode to avoid worker termination issues with Bun/Node hybrid
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Force single-threaded to avoid worker termination
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

    // Timeout configurations
    testTimeout: 10000, // 10 seconds for individual tests
    hookTimeout: 10000, // 10 seconds for hooks
    teardownTimeout: 15000, // 15 seconds for teardown to allow proper cleanup

    // Reporter configuration with balanced output
    reporters:
      process.env['CI'] === 'true'
        ? ['dot', 'junit']
        : process.env['VERBOSE'] === 'true'
          ? ['verbose']
          : ['default'],
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
      '@': './src',
      '@tests': './tests',
      '@types': './types',
      '@utils': './src/utils',
      '@config': './config',
    },
  },

  // Define externals to prevent Vite from trying to bundle Bun-specific modules
  define: {
    'import.meta.vitest': 'undefined',
  },

  // External dependencies that should not be bundled
  build: {
    rollupOptions: {
      external: ['bun'],
    },
  },

  // Optimizations to prevent Vite from trying to bundle certain modules
  optimizeDeps: {
    exclude: ['bun'],
  },

  // SSR configuration to treat Bun as external
  ssr: {
    external: ['bun'],
  },

  // ESBuild configuration for TypeScript processing
  esbuild: {
    target: 'esnext',
    keepNames: true,
    jsx: 'automatic', // Use React 17+ automatic JSX transform
  },
});
