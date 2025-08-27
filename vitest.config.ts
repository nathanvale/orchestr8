/// <reference types="vitest/globals" />
import { mkdirSync } from 'node:fs'
import { defineConfig } from 'vite'

// Ensure coverage directory exists for JUnit reporter.
// NOTE: Some CI providers set CI="true" (string) while others set CI=1 or any non-empty value.
// Using a truthy check avoids brittle equality against a specific string variant.
if (process.env['CI']) {
  try {
    mkdirSync('./coverage', { recursive: true })
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
    // Environment configuration (toggle with DOM_ENV=jsdom for fuller API parity)
    environment: process.env['DOM_ENV'] === 'jsdom' ? 'jsdom' : 'happy-dom',

    // Why: Single-threaded mode prevents worker termination issues in Bun/Vitest hybrid
    // Trade-off: Slower test execution but more stable CI runs
    pool: 'threads',
    poolOptions: {
      threads: {
        // Why: Worker threads crash when mixing Bun runtime with Vitest's Node workers
        // Context: https://github.com/oven-sh/bun/issues/14949
        // Future: Re-enable multi-threading once Bun/Vitest compatibility improves
        singleThread: true,
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

    // Why: Globals (describe, it, expect) match Jest patterns most devs know
    globals: true,
    // Why: Clear mocks prevents test pollution and flaky failures
    clearMocks: true,

    // Why: Coverage ensures code quality and catches untested paths
    coverage: {
      // Why: V8 provider is 2-3x faster than Istanbul and works better with Bun
      provider: 'v8',
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
        'vitest.setup.tsx',
        'wallaby.js',
        'tests/mocks/**',
        'tests/setup/**',
        'tests/utils/**',
      ],
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      // Coverage threshold strategy:
      // - Global thresholds apply to all files by default
      // - Critical modules can have stricter per-file thresholds
      // - Uncomment and adjust perFile config below for critical utilities
      thresholds: {
        global: {
          // Why: Start with achievable thresholds to avoid blocking initial development
          branches: 50, // Why: Complex conditionals are harder to test - start lower
          functions: 70, // Why: Balance between coverage and development velocity
          lines: 80, // Why: Industry standard minimum for production code
          statements: 80, // Why: Match line coverage for consistency
        },
        // Per-file coverage overrides for critical modules
        // Uncomment and customize for your critical paths:
        // perFile: true,
        // '@/utils/auth.ts': {
        //   branches: 90,
        //   functions: 90,
        //   lines: 90,
        //   statements: 90,
        // },
        // '@/utils/crypto.ts': {
        //   branches: 95,
        //   functions: 95,
        //   lines: 95,
        //   statements: 95,
        // },
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
    reporters: process.env['CI']
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
    passWithNoTests: true, // Template project may have no tests initially
    logHeapUsage: process.env.NODE_ENV === 'development', // Memory debugging in dev only

    // UI mode configuration (for development)
    ui: process.env['VITEST_UI'] === 'true',
    open: false, // Don't auto-open browser
  },

  // Vite configuration for better module resolution
  resolve: {
    alias: {
      '@': './src',
      '@tests': './tests',
      // Removed unused @types, @utils and @config aliases to reduce cognitive load until directories exist
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
})
