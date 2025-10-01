/**
 * Legacy SQLite Utilities
 *
 * ⚠️ DEPRECATED: These utilities will be removed in v3.0.0
 *
 * This module contains deprecated SQLite utilities that have been replaced
 * with more flexible options-based APIs.
 *
 * Migration guide:
 * - Replace createSimpleMemoryUrl() with createMemoryUrl() using options parameter
 *
 * @deprecated All methods in this module will be removed in v3.0.0
 */

/**
 * Create a simple memory database URL with basic identifier support (legacy API).
 *
 * @param identifier - Optional identifier for the database
 * @returns SQLite memory database URL
 * @deprecated Will be removed in v3.0.0. Use createMemoryUrl with options parameter for enhanced features
 *
 * @example
 * // ❌ DEPRECATED:
 * const url = createSimpleMemoryUrl('test-db')
 *
 * // ✅ NEW:
 * import { createMemoryUrl } from '@orchestr8/testkit/sqlite'
 * const url = createMemoryUrl('raw', { identifier: 'test-db' })
 */
export async function createSimpleMemoryUrl(identifier?: string): Promise<string> {
  console.error(`
⚠️  [DEPRECATED] createSimpleMemoryUrl() will be removed in v3.0.0

Use createMemoryUrl with options parameter instead:

  // Replace this:
  import { createSimpleMemoryUrl } from '@orchestr8/testkit/legacy'
  const url = createSimpleMemoryUrl('${identifier || ''}')

  // With this:
  import { createMemoryUrl } from '@orchestr8/testkit/sqlite'
  const url = createMemoryUrl('raw', { identifier: '${identifier || ''}' })

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  // Re-export the actual implementation
  const { createMemoryUrl } = await import('../sqlite/memory.js')
  return createMemoryUrl('raw', { identifier })
}
