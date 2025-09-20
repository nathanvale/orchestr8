/**
 * @template/testkit - Shared testing utilities and helpers for the monorepo
 *
 * This package provides a comprehensive testing toolkit for all packages in the monorepo,
 * including utilities for MSW, test containers, Convex testing, environment management,
 * and general testing utilities.
 */

// Re-export all utility modules
export * from './cli/index.js'
export * from './containers/index.js'
export * from './convex/index.js'
export * from './env/index.js'
export * from './fs/index.js'

// MSW exports - handle delay conflict by aliasing
export {
  // Setup functions
  setupMSW,
  setupMSWGlobal,
  setupMSWManual,
  setupMSWForEnvironment,
  createTestScopedMSW,
  quickSetupMSW,
  // Server management
  getMSWServer,
  createMSWServer,
  startMSWServer,
  stopMSWServer,
  resetMSWHandlers,
  addMSWHandlers,
  restoreMSWHandlers,
  disposeMSWServer,
  // Configuration
  createMSWConfig,
  getMSWConfig,
  updateMSWConfig,
  validateMSWConfig,
  defaultMSWConfig,
  // Handlers
  createSuccessResponse,
  createErrorResponse,
  createDelayedResponse,
  createAuthHandlers,
  createCRUDHandlers,
  createPaginatedHandler,
  createNetworkIssueHandler,
  createUnreliableHandler,
  defaultHandlers,
  // Constants
  HTTP_STATUS,
  COMMON_HEADERS,
  // Direct MSW re-exports (except delay which conflicts with utils)
  http,
  HttpResponse,
  // delay as mswDelay, // Alias MSW's delay to avoid conflict
} from './msw/index.js'

export * from './register.js'

// Utils exports - includes the general delay function
export * from './utils/index.js'

// Export types for external consumption
export type { TestConfig, TestEnvironment, TestKit } from './types.js'
