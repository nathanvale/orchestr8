import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Using node, not jsdom
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: process.env.CI
        ? ['text', 'json', 'lcov', 'cobertura']
        : ['text', 'json', 'html'],
      reportsDirectory: process.env.CI
        ? './test-results/coverage'
        : './coverage',
      exclude: [
        'node_modules',
        'dist',
        'build',
        '.turbo',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI
      ? {
          junit: './test-results/junit.xml',
        }
      : undefined,
    setupFiles: ['./tests/vitest/vitest-setup.ts'],
    include: ['packages/**/*.test.ts', 'packages/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'build', '.turbo'],
  },
  resolve: {
    conditions: ['development', 'default'],
    alias: {
      '@orchestr8/core': path.resolve(dirname, 'packages/core/src'),
      '@orchestr8/resilience': path.resolve(dirname, 'packages/resilience/src'),
      '@orchestr8/schema': path.resolve(dirname, 'packages/schema/src'),
      '@orchestr8/agent-base': path.resolve(dirname, 'packages/agent-base/src'),
      '@orchestr8/testing': path.resolve(dirname, 'packages/testing/src'),
      '@orchestr8/cli': path.resolve(dirname, 'packages/cli/src'),
      '@orchestr8/logger': path.resolve(dirname, 'packages/logger/src'),
    },
  },
})
