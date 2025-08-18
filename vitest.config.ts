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
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'build',
        '.turbo',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types.ts',
      ],
    },
    setupFiles: [],
    include: ['packages/**/*.test.ts', 'packages/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'build', '.turbo'],
  },
  resolve: {
    alias: {
      '@orchestr8/core': path.resolve(dirname, 'packages/core/src'),
      '@orchestr8/resilience': path.resolve(dirname, 'packages/resilience/src'),
      '@orchestr8/schema': path.resolve(dirname, 'packages/schema/src'),
      '@orchestr8/agent-base': path.resolve(dirname, 'packages/agent-base/src'),
      '@orchestr8/testing': path.resolve(dirname, 'packages/testing/src'),
      '@orchestr8/cli': path.resolve(dirname, 'packages/cli/src'),
    },
  },
})
