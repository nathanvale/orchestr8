import { defineConfig } from 'vitest/config'
import * as path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Setup files for testkit bootstrap - ensures mocks are initialized correctly
    setupFiles: [path.resolve(__dirname, 'packages/testkit/src/setup.ts')],
  },
})
