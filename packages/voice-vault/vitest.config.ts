import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'voice-vault',
    environment: 'node',
    // Disable coverage for voice-vault (no real tests, only examples)
    coverage: {
      enabled: false,
    },
  },
})
