/**
 * Auto-executing test setup for zero-config resource cleanup
 *
 * This module automatically runs createTestSetup() with sensible defaults
 * when imported. Use this in vitest setupFiles for zero-config setup.
 *
 * @example
 * ```typescript
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: [
 *       '@orchestr8/testkit/register',
 *       '@orchestr8/testkit/setup/auto',  // ← Zero-config automatic cleanup
 *     ],
 *   },
 * })
 * ```
 *
 * For custom configuration, use '@orchestr8/testkit/setup' instead and
 * call createTestSetup() with your options.
 */

import { createTestSetup } from './index.js'

// Apply recommended defaults for most projects when imported as a setupFile
// This makes it work seamlessly when added to vitest.config.ts setupFiles
// Using void to handle async without top-level await (for CJS compatibility)
void createTestSetup().catch((error) => {
  console.error('[TestKit] Failed to initialize resource cleanup:', error)
  throw error
})
