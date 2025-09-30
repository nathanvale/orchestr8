/**
 * Legacy Filesystem Utilities
 *
 * ⚠️ DEPRECATED: These utilities will be removed in v3.0.0
 *
 * This module contains deprecated filesystem utilities that have been replaced
 * with more robust resource-managed alternatives.
 *
 * Migration guide:
 * - Replace useTempDirectoryWithResourceManager() with createTempDirectoryWithResourceManager()
 *
 * @deprecated All methods in this module will be removed in v3.0.0
 */

import type { TempDirectory, TempDirectoryOptions } from '../fs/temp.js'

/**
 * Create a temporary directory with resource management (deprecated interface)
 *
 * @deprecated Will be removed in v3.0.0. Use createTempDirectoryWithResourceManager instead
 *
 * @example
 * // ❌ DEPRECATED:
 * const tempDir = await useTempDirectoryWithResourceManager({ prefix: 'test-' })
 *
 * // ✅ NEW:
 * import { createTempDirectoryWithResourceManager } from '@orchestr8/testkit/fs'
 * const tempDir = await createTempDirectoryWithResourceManager({ prefix: 'test-' })
 */
export async function useTempDirectoryWithResourceManager(
  options: TempDirectoryOptions = {},
): Promise<TempDirectory> {
  console.error(`
⚠️  [DEPRECATED] useTempDirectoryWithResourceManager() will be removed in v3.0.0

Use createTempDirectoryWithResourceManager instead:

  // Replace this:
  import { useTempDirectoryWithResourceManager } from '@orchestr8/testkit/legacy'
  const tempDir = await useTempDirectoryWithResourceManager(options)

  // With this:
  import { createTempDirectoryWithResourceManager } from '@orchestr8/testkit/fs'
  const tempDir = await createTempDirectoryWithResourceManager(options)

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  // Re-export the actual implementation
  const { createTempDirectoryWithResourceManager } = await import('../fs/cleanup.js')
  return createTempDirectoryWithResourceManager(options)
}
