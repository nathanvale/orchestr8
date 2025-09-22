import { resolve } from 'path'
import { createBaseVitestConfig } from './packages/testkit/src/config/vitest.base.js'

/**
 * Build the list of Vitest projects for this monorepo.
 * This is the single source of truth used by both Vitest and Wallaby.
 */
export function getVitestProjects() {
  const isWallaby = Boolean(process.env['WALLABY_WORKER'])
  const isIntegration = process.env['TEST_MODE'] === 'integration' && !isWallaby
  const isE2E = process.env['TEST_MODE'] === 'e2e' && !isWallaby
  const globalTeardownPath = resolve(__dirname, 'packages/testkit/src/teardown/globalTeardown.ts')

  const root = createBaseVitestConfig({
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
      ...(isWallaby ? {} : { globalTeardown: globalTeardownPath }),
      setupFiles: [resolve(__dirname, 'packages/testkit/src/register.ts')],
      // Consistent overrides
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: { shuffle: false },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env['TEST_SEED'] || '12345',
        VITEST: 'true',
      },
    },
  })

  const testkit = createBaseVitestConfig({
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
      ...(isWallaby ? {} : { globalTeardown: globalTeardownPath }),
      setupFiles: [resolve(__dirname, 'packages/testkit/src/register.ts')],
      // Testkit runs faster on threads without sacrificing isolation
      pool: 'threads',
      poolOptions: { threads: { singleThread: false, isolate: true } },
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: { shuffle: false },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env['TEST_SEED'] || '12345',
        VITEST: 'true',
      },
    },
  })

  const utils = createBaseVitestConfig({
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
      ...(isWallaby ? {} : { globalTeardown: globalTeardownPath }),
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: { shuffle: false },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env['TEST_SEED'] || '12345',
        VITEST: 'true',
      },
    },
  })

  const qualityCheck = createBaseVitestConfig({
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
      ...(isWallaby ? {} : { globalTeardown: globalTeardownPath }),
      setupFiles: [resolve(__dirname, 'packages/testkit/src/register.ts')],
      globals: true,
      mockReset: true,
      clearMocks: true,
      restoreMocks: false,
      sequence: { shuffle: false },
      env: {
        NODE_ENV: 'test',
        TEST_SEED: process.env['TEST_SEED'] || '12345',
        VITEST: 'true',
      },
    },
  })

  if (isIntegration) {
    // When integration mode is active, return ONLY the integration project
    return [
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
          ...(isWallaby ? {} : { globalTeardown: globalTeardownPath }),
          setupFiles: [resolve(__dirname, 'packages/testkit/src/register.ts')],
          testTimeout: 60_000,
          hookTimeout: 60_000,
          teardownTimeout: 30_000,
          pool: 'threads',
          poolOptions: { threads: { singleThread: false, isolate: true } },
          globals: true,
          mockReset: true,
          clearMocks: true,
          restoreMocks: false,
          sequence: { shuffle: false },
          env: {
            NODE_ENV: 'test',
            TEST_SEED: process.env['TEST_SEED'] || '12345',
            VITEST: 'true',
          },
        },
      }),
    ]
  }

  if (isE2E) {
    // When e2e mode is active, return ONLY the e2e project
    return [
      createBaseVitestConfig({
        test: {
          name: 'testkit-e2e',
          root: resolve(__dirname, 'packages/testkit'),
          environment: 'node',
          include: [
            'src/**/*.e2e.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'tests/**/*.e2e.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
          globalSetup: resolve(__dirname, 'packages/testkit/vitest.globalSetup.ts'),
          ...(isWallaby ? {} : { globalTeardown: globalTeardownPath }),
          setupFiles: [resolve(__dirname, 'packages/testkit/src/register.ts')],
          testTimeout: 120_000,
          hookTimeout: 120_000,
          teardownTimeout: 60_000,
          pool: 'threads',
          poolOptions: { threads: { singleThread: false, isolate: true } },
          globals: true,
          mockReset: true,
          clearMocks: true,
          restoreMocks: false,
          sequence: { shuffle: false },
          env: {
            NODE_ENV: 'test',
            TEST_SEED: process.env['TEST_SEED'] || '12345',
            VITEST: 'true',
          },
        },
      }),
    ]
  }

  // Return unit test projects when not in integration mode
  return [root, testkit, utils, qualityCheck]
}
