import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Root configuration that delegates to workspace
 * This ensures consistent behavior across all test environments
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, 'packages/testkit/src/setup.ts')],
    // Individual package configs will override these defaults
    mockReset: true,
    clearMocks: true,
    restoreMocks: false,
  },
})
