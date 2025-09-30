/**
 * Legacy API Module - Deprecated Functions
 *
 * ⚠️ WARNING: All exports from this module are deprecated and will be removed in v3.0.0
 *
 * This module provides access to deprecated APIs for backward compatibility during
 * the migration to v2.0.0. These APIs have been moved here to maintain a clear
 * upgrade path while encouraging migration to modern alternatives.
 *
 * ## Migration Strategy
 *
 * 1. **Immediate Action**: Update your imports to use new APIs
 * 2. **Temporary Compatibility**: Use this module only during migration
 * 3. **v3.0.0 Removal**: All functions here will be removed
 *
 * ## Quick Migration Guide
 *
 * ### Convex Auth
 * ```typescript
 * // ❌ DEPRECATED
 * import { setUser, clearUser } from '@orchestr8/testkit/legacy'
 * setUser(harness, { subject: 'user123' })
 *
 * // ✅ NEW
 * const asUser = harness.auth.withUser({ subject: 'user123' })
 * await asUser.query(api.private.data)
 * ```
 *
 * ### Filesystem
 * ```typescript
 * // ❌ DEPRECATED
 * import { useTempDirectoryWithResourceManager } from '@orchestr8/testkit/legacy'
 *
 * // ✅ NEW
 * import { createTempDirectoryWithResourceManager } from '@orchestr8/testkit/fs'
 * ```
 *
 * ### Containers
 * ```typescript
 * // ❌ DEPRECATED
 * import { createTestContainer, containerConfigs } from '@orchestr8/testkit/legacy'
 *
 * // ✅ NEW
 * import { createMySQLContext, MySQLPresets } from '@orchestr8/testkit/containers'
 * ```
 *
 * ### MSW
 * ```typescript
 * // ❌ DEPRECATED
 * import { createMockHandler } from '@orchestr8/testkit/legacy'
 *
 * // ✅ NEW
 * import { http } from 'msw'
 * import { createSuccessResponse } from '@orchestr8/testkit/msw'
 * ```
 *
 * @see {@link https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md | Complete Migration Guide}
 *
 * @deprecated This entire module will be removed in v3.0.0
 */

// Log deprecation warning when the module is imported
console.warn(`
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  DEPRECATED: @orchestr8/testkit/legacy                      │
│                                                                 │
│  All APIs in this module will be removed in v3.0.0            │
│  Please migrate to the new APIs as soon as possible.           │
│                                                                 │
│  Migration guide:                                              │
│  https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md  │
└─────────────────────────────────────────────────────────────────┘
`)

// Convex Auth - Deprecated authentication methods
export { setUser, clearUser, getCurrentUserMetadata } from './convex-auth.js'

// Filesystem - Deprecated filesystem utilities
export { useTempDirectoryWithResourceManager } from './filesystem.js'

// Containers - Deprecated container utilities
export {
  type ContainerConfig,
  createTestContainer,
  containerConfigs,
  containerConfigsProxy,
} from './containers.js'

// MSW - Deprecated MSW utilities
export { setupMSWLegacy, createMockHandler } from './msw.js'

// SQLite - Deprecated SQLite utilities
export { createSimpleMemoryUrl } from './sqlite.js'

/**
 * Helper to check if user is trying to use legacy APIs
 * This can be used in tests to detect and warn about legacy usage
 */
export function isUsingLegacyAPIs(): boolean {
  console.warn(
    'isUsingLegacyAPIs() detected legacy API usage. Please migrate to modern alternatives.',
  )
  return true
}

/**
 * Migration helper that provides guidance for specific deprecated functions
 */
export function getMigrationGuide(deprecatedFunction: string): string {
  const guides: Record<string, string> = {
    setUser: 'Replace setUser(harness, identity) with harness.auth.withUser(identity)',
    clearUser: 'Replace clearUser(harness) with harness.auth.withoutAuth()',
    getCurrentUserMetadata: 'Use fluent API instances instead of metadata checking',
    useTempDirectoryWithResourceManager:
      'Replace with createTempDirectoryWithResourceManager from @orchestr8/testkit/fs',
    createTestContainer: 'Replace with createMySQLContext or specific database helpers',
    containerConfigs: 'Replace with MySQLPresets or specific database presets',
    setupMSWLegacy: 'Replace with setupMSW from @orchestr8/testkit/msw',
    createMockHandler: 'Replace with http.get/post/etc and createSuccessResponse',
    createSimpleMemoryUrl:
      'Replace with createMemoryUrl(format, { identifier }) from @orchestr8/testkit/sqlite',
  }

  const guide = guides[deprecatedFunction]
  if (!guide) {
    return `No migration guide found for '${deprecatedFunction}'. Check the full migration guide at: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md`
  }

  return guide
}
