import { resolve } from 'path'
import { defineWorkspace } from 'vitest/config'

/**
 * Unified workspace configuration for Vitest and Wallaby
 * This ensures consistent test behavior across all environments
 */

// Environment detection
const isCI = process.env.CI === 'true'
const isWallaby = process.env.WALLABY_WORKER !== undefined
const isIntegration = process.env.TEST_MODE === 'integration'

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
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.integration.test.*',
      ],
      setupFiles: [resolve(__dirname, 'packages/testkit/src/setup.ts')],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
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
        '**/*.integration.test.*',
      ],
      setupFiles: [
        resolve(__dirname, 'packages/testkit/src/setup.ts'),
        resolve(__dirname, 'packages/testkit/src/register.ts'),
      ],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          isolate: true,
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
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.integration.test.*',
      ],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
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
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.integration.test.*',
      ],
      setupFiles: [resolve(__dirname, 'packages/testkit/src/setup.ts')],
      testTimeout: timeouts.test,
      hookTimeout: timeouts.hook,
    },
  },
  // Integration tests (gated)
  ...(isIntegration
    ? [
        {
          test: {
            ...sharedConfig,
            name: 'testkit-integration',
            root: resolve(__dirname, 'packages/testkit'),
            environment: 'node',
            include: [
              'src/**/*.integration.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
              'tests/**/*.integration.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            ],
            exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
            setupFiles: [resolve(__dirname, 'packages/testkit/src/setup.ts')],
            // Longer timeouts for container startup
            testTimeout: isCI ? 60000 : isWallaby ? 45000 : 45000,
            hookTimeout: isCI ? 60000 : isWallaby ? 45000 : 45000,
            pool: 'threads',
            poolOptions: {
              threads: {
                singleThread: false,
                isolate: true,
              },
            },
          },
        },
      ]
    : []),
])
