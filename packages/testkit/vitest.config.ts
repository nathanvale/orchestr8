import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    name: 'testkit',
    root: __dirname,
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
    setupFiles: ['./src/setup.ts', './src/register.ts'],
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
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 20000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
        isolate: true,
        useAtomics: true,
      },
    },
    env: {
      NODE_ENV: 'test',
      TEST_SEED: process.env.TEST_SEED || '12345',
    },
    mockReset: true,
    clearMocks: true,
    restoreMocks: false, // Let our test utilities handle restoration
    sequence: {
      seed: Date.now(),
      shuffle: false,
    },
  },
})
