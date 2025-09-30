/**
 * Legacy MSW (Mock Service Worker) Utilities
 *
 * ⚠️ DEPRECATED: These utilities will be removed in v3.0.0
 *
 * This module contains deprecated MSW utilities that have been replaced
 * with more modern MSW patterns and response helpers.
 *
 * Migration guide:
 * - Replace setupMSWLegacy with setupMSW
 * - Replace createMockHandler() with http handlers and createSuccessResponse()
 *
 * @deprecated All methods in this module will be removed in v3.0.0
 */

import { http } from 'msw'

/**
 * Backward compatibility - legacy function names
 * @deprecated Will be removed in v3.0.0. Use setupMSW instead
 *
 * @example
 * // ❌ DEPRECATED:
 * import { setupMSWLegacy } from '@orchestr8/testkit/legacy'
 * setupMSWLegacy()
 *
 * // ✅ NEW:
 * import { setupMSW } from '@orchestr8/testkit/msw'
 * setupMSW()
 */
export async function setupMSWLegacy(_handlers: unknown[] = []) {
  console.error(`
⚠️  [DEPRECATED] setupMSWLegacy() will be removed in v3.0.0

Use setupMSW instead:

  // Replace this:
  import { setupMSWLegacy } from '@orchestr8/testkit/legacy'
  setupMSWLegacy()

  // With this:
  import { setupMSW } from '@orchestr8/testkit/msw'
  setupMSW()

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  // Re-export the actual implementation
  const { setupMSW } = await import('../msw/setup.js')
  return setupMSW()
}

/**
 * Backward compatibility - create mock handler
 * @deprecated Will be removed in v3.0.0. Use createSuccessResponse with http.get/post/etc instead
 *
 * @example
 * // ❌ DEPRECATED:
 * const handler = createMockHandler('/api/users', { users: [] })
 *
 * // ✅ NEW:
 * import { http } from 'msw'
 * import { createSuccessResponse } from '@orchestr8/testkit/msw'
 * const handler = http.get('/api/users', () => createSuccessResponse({ users: [] }))
 */
export function createMockHandler(endpoint: string, response: unknown) {
  console.error(`
⚠️  [DEPRECATED] createMockHandler() will be removed in v3.0.0

Use http handlers with createSuccessResponse instead:

  // Replace this:
  import { createMockHandler } from '@orchestr8/testkit/legacy'
  const handler = createMockHandler('${endpoint}', response)

  // With this:
  import { http } from 'msw'
  import { createSuccessResponse } from '@orchestr8/testkit/msw'
  const handler = http.get('${endpoint}', () => createSuccessResponse(response))

For other HTTP methods:
  - http.post('${endpoint}', () => createSuccessResponse(response))
  - http.put('${endpoint}', () => createSuccessResponse(response))
  - http.delete('${endpoint}', () => createSuccessResponse(response))

Migration guide: https://github.com/yourorg/testkit/blob/main/packages/testkit/MIGRATION.md
`)

  // Create a simple GET handler for backward compatibility
  return http.get(endpoint, () => {
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })
}
