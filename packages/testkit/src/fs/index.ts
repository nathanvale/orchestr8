/**
 * File system test utilities
 *
 * Comprehensive utilities for testing file system operations, including
 * temporary directory management, automatic cleanup, and sandboxed operations.
 */

// Temp directory management
export {
  createTempDirectory,
  createNamedTempDirectory,
  createMultipleTempDirectories,
  cleanupMultipleTempDirectories,
  type TempDirectory,
  type TempDirectoryOptions,
  type DirectoryStructure,
} from './temp.js'

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
