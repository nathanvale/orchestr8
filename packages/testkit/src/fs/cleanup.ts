/**
 * Automatic cleanup utilities for temporary directories in tests
 *
 * Provides Vitest lifecycle integration to ensure zero temp directory leaks.
 * Supports per-test isolation and global cleanup mechanisms.
 */

import { rmSync } from 'node:fs'
import { afterEach, afterAll, beforeEach } from 'vitest'
import type { TempDirectory } from './temp.js'
import { createTempDirectory, type TempDirectoryOptions } from './temp.js'
import { registerResource, ResourceCategory } from '../resources/index.js'
import { createExitHandler } from '../utils/process-listeners.js'
import { FileSystemError, ErrorCode } from '../errors/index.js'
import { fileOperationsManager, resourceCleanupManager } from '../utils/concurrency.js'

/**
 * Global registry of temporary directories for cleanup
 */
class TempDirectoryRegistry {
  private directories = new Set<TempDirectory>()
  private isGlobalCleanupRegistered = false
  private removeProcessListeners?: () => void

  register(tempDir: TempDirectory): void {
    this.directories.add(tempDir)
    this.ensureGlobalCleanup()

    // Also register with the resource manager for integrated cleanup
    const resourceId = `temp-dir-${tempDir.path}`
    registerResource(resourceId, () => tempDir.cleanup(), {
      category: ResourceCategory.FILE,
      description: `Temporary directory: ${tempDir.path}`,
    })
  }

  unregister(tempDir: TempDirectory): void {
    this.directories.delete(tempDir)
    // Note: Resource manager cleanup is handled automatically
    // when the cleanup function is called
  }

  async cleanup(tempDir: TempDirectory): Promise<void> {
    try {
      await tempDir.cleanup()
    } finally {
      this.unregister(tempDir)
    }
  }

  async cleanupAll(): Promise<void> {
    const cleanupFunctions = Array.from(this.directories).map((dir) => () => dir.cleanup())
    await resourceCleanupManager.batch(cleanupFunctions, (fn) => fn())
    this.directories.clear()
  }

  private ensureGlobalCleanup(): void {
    if (this.isGlobalCleanupRegistered) return

    this.isGlobalCleanupRegistered = true

    // Register global cleanup for unexpected test exits
    afterAll(async () => {
      await this.cleanupAll()
      // Clean up process listeners when tests are done
      if (this.removeProcessListeners) {
        this.removeProcessListeners()
        this.removeProcessListeners = undefined
      }
    })

    // Handle process exit events using ProcessListenerManager
    const cleanup = () => {
      // Synchronous cleanup for process exit
      this.directories.forEach((dir) => {
        try {
          // Note: Using sync fs operations as async won't work in exit handlers
          rmSync(dir.path, { recursive: true, force: true })
        } catch (error) {
          console.warn(`Failed to cleanup temp directory ${dir.path}:`, error)
        }
      })
    }

    // Use ProcessListenerManager to prevent memory leaks
    this.removeProcessListeners = createExitHandler(cleanup, {
      events: ['exit', 'SIGINT', 'SIGTERM', 'uncaughtException'],
      description: 'TempDirectoryRegistry cleanup',
      timeout: 5000,
    })
  }

  size(): number {
    return this.directories.size
  }
}

// Global registry instance
const registry = new TempDirectoryRegistry()

/**
 * Hook for using a temporary directory with automatic cleanup in tests
 *
 * Creates a new temp directory before each test and cleans it up after.
 * Returns a function that provides access to the current temp directory.
 * The directory is registered with both the legacy registry and resource manager.
 *
 * @example
 * ```typescript
 * const getTempDir = useTempDirectory()
 *
 * it('should work with temp directory', async () => {
 *   const tempDir = getTempDir()
 *   await tempDir.writeFile('test.txt', 'content')
 *   // Cleanup happens automatically after test
 * })
 * ```
 */
export function useTempDirectory(options: TempDirectoryOptions = {}): () => TempDirectory {
  let currentTempDir: TempDirectory | null = null

  beforeEach(async () => {
    currentTempDir = await createTempDirectory(options)
    registry.register(currentTempDir)
  })

  afterEach(async () => {
    if (currentTempDir) {
      await registry.cleanup(currentTempDir)
      currentTempDir = null
    }
  })

  return () => {
    if (!currentTempDir) {
      throw new FileSystemError(
        ErrorCode.TEMP_FILE_CREATION_FAILED,
        "useTempDirectory: No temp directory available. Make sure you're in a test context.",
        { operation: 'get_temp_directory' },
      )
    }
    return currentTempDir
  }
}

/**
 * Hook for using multiple temporary directories with automatic cleanup
 *
 * @example
 * ```typescript
 * const getTempDirs = useMultipleTempDirectories(3)
 *
 * it('should work with multiple temp directories', async () => {
 *   const [dir1, dir2, dir3] = getTempDirs()
 *   await dir1.writeFile('file1.txt', 'content1')
 *   await dir2.writeFile('file2.txt', 'content2')
 *   // All cleanup happens automatically
 * })
 * ```
 */
export function useMultipleTempDirectories(
  count: number,
  options: TempDirectoryOptions = {},
): () => TempDirectory[] {
  let currentTempDirs: TempDirectory[] = []

  beforeEach(async () => {
    const promises = Array.from({ length: count }, () => createTempDirectory(options))
    const promiseFunctions = promises.map((p) => () => p)
    currentTempDirs = await fileOperationsManager.batch(promiseFunctions, (fn) => fn())
    currentTempDirs.forEach((dir) => registry.register(dir))
  })

  afterEach(async () => {
    const cleanupFunctions = currentTempDirs.map((dir) => () => registry.cleanup(dir))
    await resourceCleanupManager.batch(cleanupFunctions, (fn) => fn())
    currentTempDirs = []
  })

  return () => {
    if (currentTempDirs.length === 0) {
      throw new FileSystemError(
        ErrorCode.TEMP_FILE_CREATION_FAILED,
        "useMultipleTempDirectories: No temp directories available. Make sure you're in a test context.",
        { operation: 'get_multiple_temp_directories' },
      )
    }
    return currentTempDirs
  }
}

/**
 * Manually create and register a temporary directory for cleanup
 *
 * Use this when you need more control over when the temp directory is created.
 * Still ensures automatic cleanup but doesn't tie to beforeEach/afterEach.
 * The directory is registered with both the legacy registry and the resource manager.
 *
 * @example
 * ```typescript
 * it('should work with manual temp directory', async () => {
 *   const tempDir = await createManagedTempDirectory()
 *   await tempDir.writeFile('test.txt', 'content')
 *   // Cleanup happens automatically at test suite end
 * })
 * ```
 */
export async function createManagedTempDirectory(
  options: TempDirectoryOptions = {},
): Promise<TempDirectory> {
  const tempDir = await createTempDirectory(options)
  registry.register(tempDir)
  return tempDir
}

/**
 * Create a temporary directory with resource manager integration
 *
 * This function creates a temp directory and registers it directly with the resource manager
 * without using the legacy registry. Use this for new code that wants to use the resource
 * manager exclusively.
 *
 * @param options - Options for temp directory creation
 * @returns Promise resolving to the created temp directory
 *
 * @example
 * ```typescript
 * import { createTempDirectoryWithResourceManager } from '@orchestr8/testkit/fs'
 *
 * it('should work with resource manager', async () => {
 *   const tempDir = await createTempDirectoryWithResourceManager()
 *   await tempDir.writeFile('test.txt', 'content')
 *   // Cleanup happens via resource manager
 * })
 * ```
 */
export async function createTempDirectoryWithResourceManager(
  options: TempDirectoryOptions = {},
): Promise<TempDirectory> {
  const tempDir = await createTempDirectory(options)

  // Register directly with resource manager (no legacy registry)
  const resourceId = `temp-dir-${tempDir.path}`
  registerResource(resourceId, () => tempDir.cleanup(), {
    category: ResourceCategory.FILE,
    description: `Temporary directory: ${tempDir.path}`,
  })

  return tempDir
}

/**
 * Manually cleanup a specific temporary directory
 *
 * Removes the directory from the registry and cleans it up immediately.
 */
export async function cleanupTempDirectory(tempDir: TempDirectory): Promise<void> {
  await registry.cleanup(tempDir)
}

/**
 * Clean up all registered temporary directories immediately
 *
 * Useful for emergency cleanup or test teardown.
 */
export async function cleanupAllTempDirectories(): Promise<void> {
  await registry.cleanupAll()
}

/**
 * Get the number of currently registered temporary directories
 *
 * Useful for debugging and ensuring proper cleanup.
 */
export function getTempDirectoryCount(): number {
  return registry.size()
}

/**
 * Bridge function to register existing temp directory cleanup with resource manager
 *
 * This function allows existing code using the legacy temp directory system
 * to also benefit from resource manager features like leak detection.
 *
 * @example
 * ```typescript
 * import { bridgeTempDirectoryCleanup } from '@orchestr8/testkit/fs'
 * import { cleanupAllTempDirectories } from '@orchestr8/testkit/fs'
 *
 * // Bridge existing cleanup with resource manager
 * bridgeTempDirectoryCleanup()
 * ```
 */
export function bridgeTempDirectoryCleanup(): void {
  // Register the legacy cleanup function with the resource manager
  registerResource('legacy-temp-directory-cleanup', () => cleanupAllTempDirectories(), {
    category: ResourceCategory.FILE,
    description: 'Legacy temporary directory cleanup bridge',
  })
}

/**
 * Scoped temporary directory manager
 *
 * Creates a scope where temp directories are isolated and automatically
 * cleaned up when the scope ends. Directories are registered with the resource manager.
 *
 * @example
 * ```typescript
 * await withTempDirectoryScope(async (createTemp) => {
 *   const dir1 = await createTemp()
 *   const dir2 = await createTemp({ prefix: 'special-' })
 *
 *   await dir1.writeFile('test1.txt', 'content1')
 *   await dir2.writeFile('test2.txt', 'content2')
 *
 *   // Both directories are automatically cleaned up when this scope ends
 * })
 * ```
 */
export async function withTempDirectoryScope<T>(
  fn: (createTemp: (options?: TempDirectoryOptions) => Promise<TempDirectory>) => Promise<T>,
): Promise<T> {
  const scopedDirs: TempDirectory[] = []
  const resourceIds: string[] = []

  const createTemp = async (options?: TempDirectoryOptions): Promise<TempDirectory> => {
    const tempDir = await createTempDirectory(options)
    scopedDirs.push(tempDir)

    // Register with resource manager
    const resourceId = `scoped-temp-dir-${tempDir.path}`
    resourceIds.push(resourceId)
    registerResource(resourceId, () => tempDir.cleanup(), {
      category: ResourceCategory.FILE,
      description: `Scoped temporary directory: ${tempDir.path}`,
    })

    return tempDir
  }

  try {
    return await fn(createTemp)
  } finally {
    // Clean up all directories created in this scope
    const cleanupFunctions = scopedDirs.map((dir) => () => dir.cleanup())
    await resourceCleanupManager.batch(cleanupFunctions, (fn) => fn())
  }
}
