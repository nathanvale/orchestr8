/**
 * Legacy Convex Authentication Methods
 *
 * ⚠️ DEPRECATED: These methods will be removed in v3.0.0
 *
 * This module contains deprecated authentication methods that only update metadata
 * and do NOT affect actual Convex operations. Use the fluent API instead.
 *
 * Migration guide:
 * - Replace setUser() with auth.withUser()
 * - Replace clearUser() with auth.withoutAuth()
 * - Replace getCurrentUserMetadata() with fluent API instances
 *
 * @deprecated All methods in this module will be removed in v3.0.0
 */

import type { UserIdentity } from 'convex/server'

/**
 * Legacy harness type with deprecated auth methods
 * @deprecated Will be removed in v3.0.0
 */
interface LegacyConvexTestHarness {
  auth?: {
    setUser?: (identity: Partial<UserIdentity>) => void
    clearUser?: () => void
    getCurrentUserMetadata?: () => Partial<UserIdentity> | null
  }
}

/**
 * Sets the current user in harness state for convenience tracking.
 * ⚠️ IMPORTANT: This ONLY updates metadata and does NOT affect Convex operations.
 * To make authenticated calls, use withUser(), switchUser(), or withAuth() instead.
 *
 * @deprecated Will be removed in v3.0.0. Use auth.withUser() instead
 *
 * @example
 * // ❌ DEPRECATED: This does NOT authenticate calls
 * setUser(harness, { subject: 'user123' })
 * await harness.convex.query(api.private.data) // Still runs as anonymous!
 *
 * // ✅ NEW: Use fluent API instead
 * const asUser = harness.auth.withUser({ subject: 'user123' })
 * await asUser.query(api.private.data) // Runs authenticated
 */
export function setUser(harness: LegacyConvexTestHarness, identity: Partial<UserIdentity>): void {
  console.error(`
⚠️  [DEPRECATED] setUser() will be removed in v3.0.0

This method only updates metadata and does NOT affect Convex operations.
Use the fluent API instead:

  // Replace this:
  setUser(harness, { subject: 'user123' })
  await harness.convex.query(api.private.data)

  // With this:
  const asUser = harness.auth.withUser({ subject: 'user123' })
  await asUser.query(api.private.data)

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  // Check if harness supports the deprecated config
  if (harness.auth?.setUser) {
    try {
      harness.auth.setUser(identity)
    } catch (error) {
      // If setUser throws because allowMutatingAuth is false, provide helpful guidance
      if (String(error).includes('allowMutatingAuth')) {
        throw new Error(`
setUser() is deprecated and disabled by default. 

To temporarily enable during migration, set allowMutatingAuth: true in your harness config:

  const harness = createConvexTestHarness({
    allowMutatingAuth: true, // Temporary for migration
    // ... other config
  })

However, we strongly recommend migrating to the fluent API:

  const asUser = harness.auth.withUser({ subject: 'user123' })
  await asUser.query(api.private.data)
`)
      }
      throw error
    }
  } else {
    throw new Error(
      'Legacy setUser() requires a compatible test harness. Consider upgrading to the fluent API.',
    )
  }
}

/**
 * Clears the current user from harness state.
 * ⚠️ IMPORTANT: This ONLY updates metadata and does NOT affect Convex operations.
 * To make anonymous calls, use withoutAuth() or asAnonymous() instead.
 *
 * @deprecated Will be removed in v3.0.0. Use auth.withoutAuth() instead
 *
 * @example
 * // ❌ DEPRECATED: This does NOT remove authentication
 * clearUser(harness)
 * await harness.convex.query(api.private.data) // May still run with previous identity!
 *
 * // ✅ NEW: Use fluent API instead
 * const anon = harness.auth.withoutAuth()
 * await anon.query(api.public.data) // Runs anonymously
 */
export function clearUser(harness: LegacyConvexTestHarness): void {
  console.error(`
⚠️  [DEPRECATED] clearUser() will be removed in v3.0.0

This method only updates metadata and does NOT affect Convex operations.
Use the fluent API instead:

  // Replace this:
  clearUser(harness)
  await harness.convex.query(api.public.data)

  // With this:
  const anon = harness.auth.withoutAuth()
  await anon.query(api.public.data)

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  if (harness.auth?.clearUser) {
    try {
      harness.auth.clearUser()
    } catch (error) {
      // If clearUser throws because allowMutatingAuth is false, provide helpful guidance
      if (String(error).includes('allowMutatingAuth')) {
        throw new Error(`
clearUser() is deprecated and disabled by default.

To temporarily enable during migration, set allowMutatingAuth: true in your harness config:

  const harness = createConvexTestHarness({
    allowMutatingAuth: true, // Temporary for migration
    // ... other config
  })

However, we strongly recommend migrating to the fluent API:

  const anon = harness.auth.withoutAuth()
  await anon.query(api.public.data)
`)
      }
      throw error
    }
  } else {
    throw new Error(
      'Legacy clearUser() requires a compatible test harness. Consider upgrading to the fluent API.',
    )
  }
}

/**
 * Get the last user identity set via metadata (does not reflect actual auth context).
 * This only returns metadata from setUser() and does NOT indicate which identity is
 * being used for actual Convex operations. Use the fluent API for real auth state.
 *
 * @deprecated Will be removed in v3.0.0. Use fluent API instances for actual authentication state
 *
 * @example
 * // ❌ DEPRECATED: This only shows metadata, not actual auth state
 * const user = getCurrentUserMetadata(harness)
 *
 * // ✅ NEW: Use fluent API for actual authenticated operations
 * const asUser = harness.auth.withUser({ subject: 'user123' })
 * await asUser.query(api.private.userProfile) // This actually uses the identity
 */
export function getCurrentUserMetadata(
  harness: LegacyConvexTestHarness,
): Partial<UserIdentity> | null {
  console.warn(`
⚠️  [DEPRECATED] getCurrentUserMetadata() will be removed in v3.0.0

This method only returns metadata and does NOT reflect actual authentication state.
Use the fluent API for real auth operations:

  // Instead of checking metadata:
  const user = getCurrentUserMetadata(harness)
  
  // Use authenticated instances directly:
  const asUser = harness.auth.withUser({ subject: 'user123' })
  await asUser.query(api.private.data)

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  if (harness.auth?.getCurrentUserMetadata) {
    return harness.auth.getCurrentUserMetadata()
  } else {
    throw new Error(
      'Legacy getCurrentUserMetadata() requires a compatible test harness. Consider upgrading to the fluent API.',
    )
  }
}
