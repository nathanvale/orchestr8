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
  defineVitestConfig,
  createWallabyOptimizedConfig as createWallabyConfig,
  createCIOptimizedConfig as createCIConfig,
  baseVitestConfig as defaultConfig,
} from './vitest.base.js'
