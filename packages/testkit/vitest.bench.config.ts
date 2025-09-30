import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Benchmark-specific configuration
    benchmark: {
      include: ['benchmarks/**/*.bench.ts'],
      exclude: ['node_modules/**', 'dist/**', '__tests__/**', 'tests/**'],
      reporters: ['default'],
      outputFile: './bench-results.json',
    },
    // Global test configuration for benchmark environment
    globals: true,
    environment: 'node',
    setupFiles: ['./src/setup.ts'],
    // Increase timeouts for benchmarks
    testTimeout: 60000,
    hookTimeout: 30000,
    // Disable coverage for benchmarks
    coverage: {
      enabled: false,
    },
    // Memory configuration for benchmarks
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork for consistent benchmark results
      },
    },
  },
})
