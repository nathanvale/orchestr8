/**
 * Convex testing utilities
 */

// Export only implemented types from context
export type {
  ConvexTestContext,
  ConvexTestConfig,
  ConvexDatabaseContext,
  ConvexAuthContext,
  ConvexStorageContext,
  ConvexSchedulerContext,
  ConvexLifecycleContext,
  ConvexTestFactory,
  ConvexSeedConfig,
  // MutationResult is referenced in context but not implemented yet
  MutationResult,
} from './context.js'

// Export all functions from harness
export * from './harness.js'

// Re-export key classes
export {
  ConvexTestError,
  ConvexAuthError,
  ConvexDataError,
  ConvexTestTimeoutError,
} from './context.js'

// Note: The following types are defined in context.ts but not yet implemented:
// - QueryAssertion, MutationAssertion: Assertion DSL for queries/mutations
// - expectQuery, expectMutation, executeQueries: Helper methods for testing
// These will be added in a future release when the implementation is ready
