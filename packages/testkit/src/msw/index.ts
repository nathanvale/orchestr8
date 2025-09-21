/**
 * MSW (Mock Service Worker) utilities for API mocking in tests
 *
 * This module provides a complete MSW setup for testing environments with:
 * - Singleton server pattern for efficient resource usage
 * - Environment-aware configuration
 * - Common handlers and response builders
 * - Lifecycle management for various testing frameworks
 */

// Re-export configuration
export type { MSWConfig } from './config'
export { defaultMSWConfig, createMSWConfig, validateMSWConfig } from './config'

// Re-export server management
export {
  createMSWServer,
  getMSWServer,
  startMSWServer,
  stopMSWServer,
  resetMSWHandlers,
  addMSWHandlers,
  restoreMSWHandlers,
  disposeMSWServer,
  getMSWConfig,
  updateMSWConfig,
} from './server'

// Re-export setup utilities
export {
  setupMSW,
  setupMSWGlobal,
  setupMSWManual,
  quickSetupMSW,
  setupMSWForEnvironment,
  createTestScopedMSW,
} from './setup'

// Re-export handlers and utilities
export {
  HTTP_STATUS,
  COMMON_HEADERS,
  createSuccessResponse,
  createErrorResponse,
  createDelayedResponse,
  createUnreliableHandler,
  createPaginatedHandler,
  createAuthHandlers,
  createCRUDHandlers,
  createNetworkIssueHandler,
  defaultHandlers,
} from './handlers'

// Re-export example handlers
export { viteDemoHandlers } from './example-handlers/vite-demo'

// Convenience re-exports from MSW
export { http, HttpResponse, delay } from 'msw'
export type { RequestHandler } from 'msw'

/**
 * Backward compatibility - legacy function names
 * @deprecated Use setupMSW instead
 */
export { setupMSW as setupMSWLegacy } from './setup'

/**
 * Backward compatibility - create mock handler
 * @deprecated Use createSuccessResponse with http.get/post/etc instead
 */
export function createMockHandler(endpoint: string, response: unknown) {
  console.warn(
    'createMockHandler is deprecated. Use http handlers with createSuccessResponse instead.',
  )
  return {
    endpoint,
    response,
  }
}
