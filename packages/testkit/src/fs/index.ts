/**
 * File system test utilities
 *
 * Comprehensive utilities for testing file system operations, including
 * temporary directory management, automatic cleanup, and sandboxed operations.
 */

// Re-export all core fs utilities
export * from './core.js'

// Automatic cleanup and test lifecycle integration
export {
  useTempDirectory,
  useMultipleTempDirectories,
  createManagedTempDirectory,
  cleanupTempDirectory,
  cleanupAllTempDirectories,
  getTempDirectoryCount,
  withTempDirectoryScope,
} from './cleanup.js'
