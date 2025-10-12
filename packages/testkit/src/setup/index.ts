/**
 * Pre-configured test setup with automatic resource cleanup
 *
 * This module provides a zero-config setup for TestKit resource cleanup.
 * Simply add '@orchestr8/testkit/setup' to your vitest setupFiles to get
 * automatic resource management with sensible defaults.
 *
 * @example
 * ```typescript
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: [
 *       '@orchestr8/testkit/register',
 *       '@orchestr8/testkit/setup',  // ← Automatic cleanup
 *     ],
 *   },
 * })
 * ```
 *
 * @example Custom configuration
 * ```typescript
 * // test-setup.ts (only if you need customization)
 * import { createTestSetup } from '@orchestr8/testkit/setup'
 *
 * await createTestSetup({
 *   packageName: 'my-package',
 *   logStats: true
 * })
 * ```
 */

import { setupResourceCleanup, type VitestResourceOptions } from '../config/index.js'
import { cleanupAllResources } from '../utils/index.js'
import { afterAll } from 'vitest'

/**
 * Options for test setup configuration
 */
export interface TestSetupOptions extends VitestResourceOptions {
  /** Optional package name for logging (default: none) */
  packageName?: string
}

/**
 * Create a test setup with custom configuration
 *
 * @param options - Configuration options for resource management
 *
 * @example
 * ```typescript
 * import { createTestSetup } from '@orchestr8/testkit/setup'
 *
 * await createTestSetup({
 *   cleanupAfterEach: true,
 *   enableLeakDetection: true,
 *   packageName: 'my-package',
 *   logStats: true
 * })
 * ```
 */
export async function createTestSetup(options: TestSetupOptions = {}): Promise<void> {
  const {
    cleanupAfterEach = true,
    cleanupAfterAll = true,
    enableLeakDetection = true,
    logStats = process.env['LOG_CLEANUP_STATS'] === '1',
    packageName,
    ...resourceOptions
  } = options

  // Setup resource cleanup with specified options
  await setupResourceCleanup({
    cleanupAfterEach,
    cleanupAfterAll,
    enableLeakDetection,
    logStats,
    ...resourceOptions,
  })

  // Add comprehensive cleanup hook for safety
  // This ensures cleanup even if setupResourceCleanup's afterAll doesn't run
  afterAll(async () => {
    await cleanupAllResources({ continueOnError: true })
  })

  // Log confirmation in non-production environments
  if (packageName && process.env['NODE_ENV'] !== 'production') {
    console.log(`✅ TestKit resource cleanup configured (${packageName})`)
  } else if (!packageName && process.env['NODE_ENV'] !== 'production' && logStats) {
    console.log('✅ TestKit resource cleanup configured')
  }
}

// Apply recommended defaults for most projects when imported as a setupFile
// This makes it work seamlessly when added to vitest.config.ts setupFiles
// Using void to handle async without top-level await (for CJS compatibility)
void createTestSetup()
