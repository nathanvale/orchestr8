import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'quality-check',
    environment: 'node',
    // Disable coverage for quality-check (no tests yet)
    coverage: {
      enabled: false,
    },
  },
})
