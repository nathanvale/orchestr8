/**
 * @template/testkit - Shared testing utilities and helpers for the monorepo
 *
 * This package provides a comprehensive testing toolkit for all packages in the monorepo,
 * including utilities for MSW, test containers, Convex testing, environment management,
 * and general testing utilities.
 */

// Re-export all utility modules
export * from './cli/index.js'
export * from './config/index.js'
export * from './containers/index.js'
export * from './convex/index.js'
export * from './env/index.js'
export * from './fs/index.js'
export * from './sqlite/index.js'

// MSW exports - handle delay conflict by aliasing
export {
  COMMON_HEADERS,
  // Constants
  HTTP_STATUS,
  HttpResponse,
  addMSWHandlers,
  createAuthHandlers,
  createCRUDHandlers,
  createDelayedResponse,
  createErrorResponse,
  // Configuration
  createMSWConfig,
  createMSWServer,
  createNetworkIssueHandler,
  createPaginatedHandler,
  // Handlers
  createSuccessResponse,
  createTestScopedMSW,
  createUnreliableHandler,
  defaultHandlers,
  defaultMSWConfig,
  disposeMSWServer,
  getMSWConfig,
  // Server management
  getMSWServer,
  // Direct MSW re-exports (except delay which conflicts with utils)
  http,
  quickSetupMSW,
  resetMSWHandlers,
  restoreMSWHandlers,
  // Setup functions
  setupMSW,
  setupMSWForEnvironment,
  setupMSWGlobal,
  setupMSWManual,
  startMSWServer,
  stopMSWServer,
  updateMSWConfig,
  validateMSWConfig,
} from './msw/index.js'

export * from './register.js'

// Utils exports - includes the general delay function
export * from './utils/index.js'

// Export types for external consumption
export type { TestConfig, TestEnvironment, TestKit } from './types.js'
