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

/**
 * Global registry of temporary directories for cleanup
 */
class TempDirectoryRegistry {
  private directories = new Set<TempDirectory>()
  private isGlobalCleanupRegistered = false

  register(tempDir: TempDirectory): void {
    this.directories.add(tempDir)
    this.ensureGlobalCleanup()
  }

  unregister(tempDir: TempDirectory): void {
    this.directories.delete(tempDir)
  }

  async cleanup(tempDir: TempDirectory): Promise<void> {
    try {
      await tempDir.cleanup()
    } finally {
      this.unregister(tempDir)
    }
  }

  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.directories).map((dir) =>
      this.cleanup(dir).catch((error) => {
        console.warn('Failed to cleanup temp directory:', error)
      }),
    )

    await Promise.allSettled(cleanupPromises)
    this.directories.clear()
  }

  private ensureGlobalCleanup(): void {
    if (this.isGlobalCleanupRegistered) return

    this.isGlobalCleanupRegistered = true

    // Register global cleanup for unexpected test exits
    afterAll(async () => {
      await this.cleanupAll()
    })

    // Handle process exit events
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

    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('uncaughtException', cleanup)
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
      throw new Error(
        "useTempDirectory: No temp directory available. Make sure you're in a test context.",
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
    currentTempDirs = await Promise.all(promises)
    currentTempDirs.forEach((dir) => registry.register(dir))
  })

  afterEach(async () => {
    await Promise.allSettled(currentTempDirs.map((dir) => registry.cleanup(dir)))
    currentTempDirs = []
  })

  return () => {
    if (currentTempDirs.length === 0) {
      throw new Error(
        "useMultipleTempDirectories: No temp directories available. Make sure you're in a test context.",
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
 * Scoped temporary directory manager
 *
 * Creates a scope where temp directories are isolated and automatically
 * cleaned up when the scope ends.
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

  const createTemp = async (options?: TempDirectoryOptions): Promise<TempDirectory> => {
    const tempDir = await createTempDirectory(options)
    scopedDirs.push(tempDir)
    return tempDir
  }

  try {
    return await fn(createTemp)
  } finally {
    // Clean up all directories created in this scope
    await Promise.allSettled(scopedDirs.map((dir) => dir.cleanup()))
  }
}
