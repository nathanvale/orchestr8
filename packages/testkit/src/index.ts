/**
 * @template/testkit - Shared testing utilities and helpers for the monorepo
 *
 * This package provides a comprehensive testing toolkit for all packages in the monorepo,
 * including utilities for MSW, test containers, Convex testing, environment management,
 * and general testing utilities.
 */

// Re-export all utility modules
export * from './register.js'
export * from './msw/index.js'
export * from './containers/index.js'
export * from './convex/index.js'
export * from './env/index.js'
export * from './utils/index.js'

// Export types for external consumption
export type { TestEnvironment, TestConfig, TestKit } from './types.js'
