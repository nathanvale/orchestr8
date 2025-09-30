/**
 * Core temporary directory management utilities without vitest dependencies
 *
 * This module provides the basic temp directory functionality that doesn't
 * require vitest cleanup hooks or test lifecycle integration.
 */

import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, relative } from 'node:path'
import { validatePath } from '../security/index.js'
import { FileSystemError, ErrorCode } from '../errors/index.js'
import { fileOperationsManager, resourceCleanupManager } from '../utils/concurrency.js'

/**
 * Interface for a temporary directory with helper methods
 */
export interface TempDirectory {
  /** Absolute path to the temporary directory */
  readonly path: string

  /** Clean up the temporary directory and all its contents */
  cleanup(): Promise<void>

  /** Write a file to the temp directory */
  writeFile(relativePath: string, content: string | Buffer): Promise<string>

  /** Create a subdirectory in the temp directory */
  mkdir(relativePath: string): Promise<string>

  /** Get the absolute path for a file/directory in the temp */
  getPath(relativePath: string): string

  /** Read a file from the temp directory */
  readFile(relativePath: string): Promise<string>

  /** Check if a file/directory exists in the temp directory */
  exists(relativePath: string): Promise<boolean>

  /** List contents of a directory in the temp directory */
  readdir(relativePath?: string): Promise<string[]>

  /** Copy a file from outside into the temp directory */
  copyFileIn(sourcePath: string, destRelativePath: string): Promise<string>

  /** Create a nested directory structure */
  createStructure(structure: DirectoryStructure): Promise<void>
}

/**
 * Directory structure for batch creation
 */
export interface DirectoryStructure {
  [name: string]: string | DirectoryStructure
}

/**
 * Options for temporary directory creation
 */
export interface TempDirectoryOptions {
  /** Prefix for the temp directory name */
  prefix?: string
  /** Whether to use a random suffix */
  randomSuffix?: boolean
  /** Parent directory (defaults to os.tmpdir()) */
  parent?: string
}

/**
 * Create a temporary directory with helper methods
 */
export async function createTempDirectory(
  options: TempDirectoryOptions = {},
): Promise<TempDirectory> {
  const { prefix = 'test-', randomSuffix = true, parent = tmpdir() } = options

  // Validate parent directory if it's a custom path (for security)
  let validatedParent = parent
  if (parent !== tmpdir()) {
    // For custom parent directories, ensure they're safe by normalizing them
    // and checking they don't contain path traversal patterns
    const normalizedParent = dirname(resolve(parent))
    const relativePath = relative(normalizedParent, parent)
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      throw new FileSystemError(
        ErrorCode.PATH_TRAVERSAL,
        'Invalid parent directory path: contains dangerous patterns',
        { path: parent, operation: 'validate_parent_directory' },
      )
    }
    validatedParent = parent
  }

  let basePath: string

  if (randomSuffix) {
    basePath = await fs.mkdtemp(join(validatedParent, prefix))
  } else {
    basePath = join(validatedParent, prefix + Date.now())
    await fs.mkdir(basePath, { recursive: true })
  }

  return {
    path: basePath,

    async cleanup(): Promise<void> {
      try {
        await fs.rm(basePath, { recursive: true, force: true })
      } catch (error) {
        // Log but don't throw - cleanup should be resilient
        console.warn(`Failed to cleanup temp directory ${basePath}:`, error)
      }
    },

    async writeFile(relativePath: string, content: string | Buffer): Promise<string> {
      const filePath = validatePath(basePath, relativePath)
      const dirPath = dirname(filePath)

      // Ensure parent directory exists
      await fs.mkdir(dirPath, { recursive: true })
      await fs.writeFile(filePath, content)

      return filePath
    },

    async mkdir(relativePath: string): Promise<string> {
      const dirPath = validatePath(basePath, relativePath)
      await fs.mkdir(dirPath, { recursive: true })
      return dirPath
    },

    getPath(relativePath: string): string {
      return validatePath(basePath, relativePath)
    },

    async readFile(relativePath: string): Promise<string> {
      const filePath = validatePath(basePath, relativePath)
      return await fs.readFile(filePath, 'utf-8')
    },

    async exists(relativePath: string): Promise<boolean> {
      try {
        const filePath = validatePath(basePath, relativePath)
        await fs.access(filePath)
        return true
      } catch (error) {
        // Re-throw security validation errors
        if (error instanceof Error && error.name === 'SecurityValidationError') {
          throw error
        }
        // Return false for legitimate file system errors (file doesn't exist, etc.)
        return false
      }
    },

    async readdir(relativePath = ''): Promise<string[]> {
      const dirPath = validatePath(basePath, relativePath)
      return await fs.readdir(dirPath)
    },

    async copyFileIn(sourcePath: string, destRelativePath: string): Promise<string> {
      const destPath = validatePath(basePath, destRelativePath)
      const destDir = dirname(destPath)

      // Ensure parent directory exists
      await fs.mkdir(destDir, { recursive: true })
      await fs.copyFile(sourcePath, destPath)

      return destPath
    },

    async createStructure(structure: DirectoryStructure): Promise<void> {
      await createDirectoryStructure(basePath, structure)
    },
  }
}

/**
 * Create a nested directory structure from an object
 */
async function createDirectoryStructure(
  basePath: string,
  structure: DirectoryStructure,
): Promise<void> {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = validatePath(basePath, name)

    if (typeof content === 'string') {
      // It's a file
      const dirPath = dirname(fullPath)
      await fs.mkdir(dirPath, { recursive: true })
      await fs.writeFile(fullPath, content)
    } else {
      // It's a directory
      await fs.mkdir(fullPath, { recursive: true })
      await createDirectoryStructure(fullPath, content)
    }
  }
}

/**
 * Create a temporary directory with a specific name (for debugging)
 */
export async function createNamedTempDirectory(name: string): Promise<TempDirectory> {
  return createTempDirectory({
    prefix: `test-${name}-`,
    randomSuffix: true,
  })
}

/**
 * Create multiple temporary directories at once
 */
export async function createMultipleTempDirectories(
  count: number,
  options: TempDirectoryOptions = {},
): Promise<TempDirectory[]> {
  const promises = Array.from({ length: count }, () => () => createTempDirectory(options))
  return fileOperationsManager.batch(promises, (fn) => fn())
}

/**
 * Clean up multiple temporary directories
 */
export async function cleanupMultipleTempDirectories(tempDirs: TempDirectory[]): Promise<void> {
  const cleanupFunctions = tempDirs.map((dir) => () => dir.cleanup())
  await resourceCleanupManager.batch(cleanupFunctions, (fn) => fn())
}
