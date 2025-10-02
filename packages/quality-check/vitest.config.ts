import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'quality-check',
    environment: 'node',
    coverage: {
      enabled: process.env['CI'] === 'true',
      provider: 'v8',
      // Allow 0% coverage for packages without real tests
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
})
