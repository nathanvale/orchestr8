/**
 * Pre-configured test setup with automatic resource cleanup
 *
 * This module provides the core setup function for TestKit resource cleanup.
 * For zero-config automatic setup, use '@orchestr8/testkit/setup/auto'.
 * For custom configuration, import and call createTestSetup() with your options.
 *
 * @example Zero-config automatic setup
 * ```typescript
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: [
 *       '@orchestr8/testkit/register',
 *       '@orchestr8/testkit/setup/auto',  // ← Automatic cleanup
 *     ],
 *   },
 * })
 * ```
 *
 * @example Custom configuration
 * ```typescript
 * // test-setup.ts
 * import { createTestSetup } from '@orchestr8/testkit/setup'
 *
 * await createTestSetup({
 *   packageName: 'my-package',
 *   logStats: true,
 *   cleanupAfterEach: false  // Custom override
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
