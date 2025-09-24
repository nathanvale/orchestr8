/**
 * File-based SQLite helpers with managed temp directories
 *
 * @module sqlite/file
 *
 * Provides utilities for creating file-based SQLite databases in temporary directories
 * for integration testing scenarios that require persistence or concurrent access.
 *
 * ## Best Practices
 *
 * ### Cleanup Order
 * Always close database connections before calling cleanup:
 * ```typescript
 * const db = await createFileDatabase()
 * const conn = await connect(db.url)
 * try {
 *   // Use connection
 * } finally {
 *   await conn.close()  // Close connection first
 *   await db.cleanup()  // Then cleanup temp directory
 * }
 * ```
 *
 * ### Concurrency Safety
 * Each database gets its own unique temporary directory, ensuring
 * test isolation even when running tests in parallel.
 *
 * ### Automatic Cleanup
 * When using `createManagedTempDirectory`, cleanup is automatically
 * registered with the cleanup registry for test frameworks.
 */

import { createManagedTempDirectory, type TempDirectory } from '../fs/index.js'

export interface FileDatabase {
  /** SQLite file URL (file:/path/to/db.sqlite) */
  url: string
  /** Directory containing the database file */
  dir: string
  /** Full path to the database file */
  path: string
  /** Cleanup function to remove temp directory */
  cleanup: () => Promise<void>
}

/**
 * Create a file-backed SQLite database in a managed temp directory.
 *
 * @param name - Database file name (default: 'db.sqlite')
 * @returns Database information with URL, paths, and cleanup function
 *
 * @example
 * ```typescript
 * const db = await createFileDatabase('test.db')
 * const conn = await sqlite3.open(db.url)
 * // ... use database
 * await conn.close()
 * await db.cleanup()
 * ```
 *
 * @remarks
 * - Each call creates a unique temporary directory
 * - The cleanup function removes the entire temp directory
 * - Safe for concurrent test execution
 * - The returned URL is compatible with SQLite connection strings
 */
export async function createFileDatabase(name = 'db.sqlite'): Promise<FileDatabase> {
  const temp: TempDirectory = await createManagedTempDirectory({ prefix: 'sqlite-' })
  const dbPath = temp.getPath(name)
  const url = `file:${dbPath}`

  return {
    url,
    dir: temp.path,
    path: dbPath,
    cleanup: async () => {
      await temp.cleanup()
    },
  }
}

/**
 * Alias for createFileDatabase to match naming conventions
 * @alias createFileDatabase
 */
export const createFileSQLiteDatabase = createFileDatabase
