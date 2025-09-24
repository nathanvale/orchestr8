/**
 * Browser-only MSW utilities for app bundles
 *
 * This entry avoids importing any node-specific MSW APIs (like 'msw/node').
 * Use this from browser code (e.g., Vite app) to access handlers and helpers
 * without triggering conditional exports for Node.
 */

// Convenience re-exports from MSW (browser-safe)
export { HttpResponse, delay, http } from 'msw'
export type { RequestHandler } from 'msw'

// Re-export handlers and utilities that are browser-safe
export {
  COMMON_HEADERS,
  HTTP_STATUS,
  createAuthHandlers,
  createCRUDHandlers,
  createDelayedResponse,
  createErrorResponse,
  createNetworkIssueHandler,
  createPaginatedHandler,
  createSuccessResponse,
  createUnreliableHandler,
  defaultHandlers,
} from './handlers.js'

// Re-export example handlers
export { viteDemoHandlers } from './example-handlers/vite-demo.js'
