import { defineWorkspace } from 'vitest/config'
import { resolve } from 'path'

/**
 * Unified workspace configuration for Vitest and Wallaby
 * This ensures consistent test behavior across all environments
 */

// Environment detection
const isCI = process.env.CI === 'true'
const isWallaby = process.env.WALLABY_WORKER !== undefined

// Shared configuration for all packages
const sharedConfig = {
  globals: true,
  mockReset: true,
  clearMocks: true,
  restoreMocks: false, // Let test utilities handle restoration
  sequence: {
    shuffle: false, // Deterministic test order
  },
  env: {
    NODE_ENV: 'test',
    TEST_SEED: process.env.TEST_SEED || '12345',
  },
}

// Timeout configuration
const timeouts = {
  test: isCI ? 15000 : isWallaby ? 10000 : 10000,
  hook: isCI ? 15000 : isWallaby ? 10000 : 10000,
  teardown: isCI ? 30000 : isWallaby ? 20000 : 20000,
}

export default defineWorkspace([
  // Root project configuration (for root-level tests if any)
  {
    test: {
      ...sharedConfig,
      name: 'root',
      root: '.',
      environment: 'node',
      include: ['*.test.ts', 'tests/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
      setupFiles: [resolve(__dirname, 'packages/testkit/src/setup.ts')],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
      teardownTimeout: timeouts.teardown,
    },
  },
  // Testkit package configuration
  {
    test: {
      ...sharedConfig,
      name: 'testkit',
      root: resolve(__dirname, 'packages/testkit'),
      environment: 'happy-dom',
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      ],
      setupFiles: [
        resolve(__dirname, 'packages/testkit/src/setup.ts'),
        resolve(__dirname, 'packages/testkit/src/register.ts'),
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          'coverage/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/index.ts',
          '**/__tests__/**',
          '**/__mocks__/**',
          '**/tests/**',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
      teardownTimeout: timeouts.teardown,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: isCI ? 2 : 4,
          minThreads: 1,
          isolate: true,
          useAtomics: true,
        },
      },
    },
  },
  // Utils package configuration
  {
    test: {
      ...sharedConfig,
      name: 'utils',
      root: resolve(__dirname, 'packages/utils'),
      environment: 'node',
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
      teardownTimeout: timeouts.teardown,
    },
  },
  // Quality-check package configuration
  {
    test: {
      ...sharedConfig,
      name: 'quality-check',
      root: resolve(__dirname, 'packages/quality-check'),
      environment: 'node',
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
      setupFiles: [resolve(__dirname, 'packages/testkit/src/setup.ts')],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
      teardownTimeout: timeouts.teardown,
    },
  },
])
