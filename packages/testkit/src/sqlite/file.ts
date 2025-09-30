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
import { registerResource, ResourceCategory } from '../resources/index.js'
import { type SQLiteConnectionPool } from './pool.js'

export interface FileDatabase {
  /** SQLite file URL (file:/path/to/db.sqlite) */
  url: string
  /** Directory containing the database file */
  dir: string
  /** Full path to the database file */
  path: string
  /** Cleanup function to remove temp directory */
  cleanup: () => Promise<void>
  /** Optional connection pool for this database */
  pool?: SQLiteConnectionPool
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

  const database = {
    url,
    dir: temp.path,
    path: dbPath,
    cleanup: async () => {
      await temp.cleanup()
    },
  }

  // Register the database with the resource manager
  const resourceId = `file-database-${dbPath}`
  registerResource(resourceId, () => database.cleanup(), {
    category: ResourceCategory.DATABASE,
    description: `File SQLite database: ${dbPath}`,
  })

  return database
}

/**
 * Create a file-backed SQLite database with optional connection pooling.
 *
 * @param name - Database file name (default: 'db.sqlite')
 * @param poolOptions - Optional pool configuration for connection pooling
 * @returns Database information with URL, paths, optional pool, and cleanup function
 *
 * @example
 * ```typescript
 * // Create database with connection pool
 * const db = await createFileDBWithPool('test.db', {
 *   maxConnections: 5,
 *   minConnections: 1,
 *   idleTimeout: 30000
 * })
 *
 * // Use pool to acquire connections
 * const conn = await db.pool!.acquire()
 * try {
 *   conn.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)')
 * } finally {
 *   await db.pool!.release(conn)
 * }
 *
 * // Cleanup
 * await db.cleanup()
 * ```
 */
export async function createFileDBWithPool(
  name = 'db.sqlite',
  poolOptions?: Partial<import('./pool.js').PoolOptions>,
): Promise<FileDatabase> {
  const { SQLiteConnectionPool } = await import('./pool.js')

  const db = await createFileDatabase(name)

  if (poolOptions) {
    const pool = new SQLiteConnectionPool(db.path, poolOptions)

    // Update cleanup to also drain the pool
    const originalCleanup = db.cleanup
    db.cleanup = async () => {
      await pool.drain()
      await originalCleanup()
    }

    return {
      ...db,
      pool,
    }
  }

  return db
}

/**
 * Alias for createFileDatabase to match naming conventions
 * @alias createFileDatabase
 */
export const createFileSQLiteDatabase = createFileDatabase
