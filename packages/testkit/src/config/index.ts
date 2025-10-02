/**
 * Vitest Configuration Utilities
 *
 * This module provides configuration utilities and helpers for setting up
 * Vitest in packages across the monorepo.
 */

// Export all configuration functions and types
export * from './vitest.base.js'

// Export commonly used configuration presets for convenience
export {
  createBaseVitestConfig as createVitestConfig,
  createWallabyOptimizedConfig as createWallabyConfig,
  createCIOptimizedConfig as createCIConfig,
  baseVitestConfig as defaultConfig,
} from './vitest.base.js'

// Export resource management integration for vitest
export {
  setupResourceCleanup,
  enableResourceCleanup,
  enableResourceCleanupWithDebugging,
  useResourceManager,
  bridgeLegacyCleanup,
  type VitestResourceOptions,
} from './vitest-resources.js'

// Re-export resource manager types and functions for convenience
export {
  ResourceCategory,
  ResourcePriority,
  ResourceEvent,
  type CleanupOptions,
  type ResourceLeak,
  type ResourceStats,
} from '../resources/index.js'
