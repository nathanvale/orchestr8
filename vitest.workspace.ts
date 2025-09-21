import { resolve } from 'path'
import { defineWorkspace } from 'vitest/config'
import {
  createBaseVitestConfig,
  defineVitestConfig,
} from './packages/testkit/src/config/vitest.base.js'

/**
 * Unified workspace configuration for Vitest and Wallaby
 * Uses the base configuration from testkit for consistency across all environments
 */

// Environment detection for integration tests
const isIntegration = process.env.TEST_MODE === 'integration'

export default defineWorkspace([
  // Root project configuration (for root-level tests if any)
  defineVitestConfig({
    test: {
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
      globalSetup: resolve(__dirname, 'packages/testkit/vitest.globalSetup.ts'),
      setupFiles: [
        '@template/testkit/register',
        resolve(__dirname, 'packages/testkit/src/setup.ts'),
      ],
      // Override base config for workspace-specific needs
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: {
        shuffle: false,
      },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env.TEST_SEED || '12345',
        VITEST: 'true',
      },
    },
  }),

  // Testkit package configuration
  defineVitestConfig({
    test: {
      name: 'testkit',
      root: resolve(__dirname, 'packages/testkit'),
      environment: 'happy-dom',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/*.integration.test.*',
      ],
      globalSetup: resolve(__dirname, 'packages/testkit/vitest.globalSetup.ts'),
      setupFiles: [
        '@template/testkit/register',
        resolve(__dirname, 'packages/testkit/src/setup.ts'),
      ],
      // Override pool for testkit package
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          isolate: true,
        },
      },
      // Override base config for workspace-specific needs
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: {
        shuffle: false,
      },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env.TEST_SEED || '12345',
        VITEST: 'true',
      },
    },
  }),

  // Utils package configuration
  defineVitestConfig({
    test: {
      name: 'utils',
      root: resolve(__dirname, 'packages/utils'),
      environment: 'node',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.integration.test.*',
      ],
      // Override base config for workspace-specific needs
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: {
        shuffle: false,
      },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env.TEST_SEED || '12345',
        VITEST: 'true',
      },
    },
  }),

  // Quality-check package configuration
  defineVitestConfig({
    test: {
      name: 'quality-check',
      root: resolve(__dirname, 'packages/quality-check'),
      environment: 'node',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.integration.test.*',
      ],
      globalSetup: resolve(__dirname, 'packages/testkit/vitest.globalSetup.ts'),
      setupFiles: [
        '@template/testkit/register',
        resolve(__dirname, 'packages/testkit/src/setup.ts'),
      ],
      // Override base config for workspace-specific needs
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: {
        shuffle: false,
      },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env.TEST_SEED || '12345',
        VITEST: 'true',
      },
    },
  }),

  // Integration tests (gated)
  ...(isIntegration
    ? [
        createBaseVitestConfig({
          test: {
            name: 'testkit-integration',
            root: resolve(__dirname, 'packages/testkit'),
            environment: 'node',
            include: [
              'src/**/*.integration.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
              'tests/**/*.integration.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            ],
            exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
            globalSetup: resolve(__dirname, 'packages/testkit/vitest.globalSetup.ts'),
            setupFiles: [
              '@template/testkit/register',
              resolve(__dirname, 'packages/testkit/src/setup.ts'),
            ],
            // Override timeouts for integration tests
            testTimeout: 60000,
            hookTimeout: 60000,
            teardownTimeout: 30000,
            pool: 'threads',
            poolOptions: {
              threads: {
                singleThread: false,
                isolate: true,
              },
            },
            // Override base config for workspace-specific needs
            globals: true,
            mockReset: true,
            clearMocks: true,
            restoreMocks: false,
            sequence: {
              shuffle: false,
            },
            env: {
              NODE_ENV: 'test',
              TEST_SEED: process.env.TEST_SEED || '12345',
              VITEST: 'true',
            },
          },
        }),
      ]
    : []),
])
