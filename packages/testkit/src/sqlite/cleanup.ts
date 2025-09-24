/**
 * Automatic cleanup utilities for SQLite databases in tests
 *
 * Provides Vitest lifecycle integration to ensure zero database leaks.
 * Supports per-test isolation and global cleanup mechanisms.
 */

import { afterEach, afterAll } from 'vitest'
import type { FileDatabase } from './file.js'

/**
 * Generic cleanup function type for any database or resource
 */
export type CleanupFunction = () => void | Promise<void>

/**
 * Database-like interface with cleanup method
 */
export interface DatabaseLike {
  cleanup(): void | Promise<void>
}

/**
 * Global registry for SQLite database cleanup functions
 */
class SqliteCleanupRegistry {
  private cleanupFunctions = new Set<CleanupFunction>()
  private databases = new Set<DatabaseLike>()
  private isGlobalCleanupRegistered = false

  /**
   * Register a generic cleanup function
   */
  register(cleanupFn: CleanupFunction): void {
    this.cleanupFunctions.add(cleanupFn)
    this.ensureGlobalCleanup()
  }

  /**
   * Register a database object with a cleanup method
   */
  registerDatabase(db: DatabaseLike): void {
    this.databases.add(db)
    this.ensureGlobalCleanup()
  }

  /**
   * Unregister a cleanup function
   */
  unregister(cleanupFn: CleanupFunction): void {
    this.cleanupFunctions.delete(cleanupFn)
  }

  /**
   * Unregister a database object
   */
  unregisterDatabase(db: DatabaseLike): void {
    this.databases.delete(db)
  }

  /**
   * Execute and unregister a specific cleanup function
   */
  async cleanup(cleanupFn: CleanupFunction): Promise<void> {
    try {
      await cleanupFn()
    } finally {
      this.unregister(cleanupFn)
    }
  }

  /**
   * Execute and unregister a specific database cleanup
   */
  async cleanupDatabase(db: DatabaseLike): Promise<void> {
    try {
      await db.cleanup()
    } finally {
      this.unregisterDatabase(db)
    }
  }

  /**
   * Execute all registered cleanup functions and clear the registry
   */
  async cleanupAll(): Promise<void> {
    const errors: Error[] = []

    // Clean up database objects first
    const databaseCleanups = Array.from(this.databases).map(async (db) => {
      try {
        await this.cleanupDatabase(db)
      } catch (error) {
        const cleanupError = error instanceof Error ? error : new Error(String(error))
        errors.push(
          new Error(`Database cleanup failed: ${cleanupError.message}`, { cause: cleanupError }),
        )
        console.warn('Failed to cleanup SQLite database:', cleanupError)
      }
    })

    // Clean up generic functions second
    const functionCleanups = Array.from(this.cleanupFunctions).map(async (fn) => {
      try {
        await this.cleanup(fn)
      } catch (error) {
        const cleanupError = error instanceof Error ? error : new Error(String(error))
        errors.push(
          new Error(`Cleanup function failed: ${cleanupError.message}`, { cause: cleanupError }),
        )
        console.warn('Failed to execute SQLite cleanup function:', cleanupError)
      }
    })

    await Promise.allSettled([...databaseCleanups, ...functionCleanups])

    this.cleanupFunctions.clear()
    this.databases.clear()

    // If there were any cleanup errors, collect them but don't throw
    // This allows the registry to be properly cleared while still reporting issues
    if (errors.length > 0) {
      console.warn(
        `SQLite cleanup completed with ${errors.length} error(s). Registry has been cleared.`,
      )
    }
  }

  /**
   * Register global cleanup hooks with Vitest (called only once)
   */
  private ensureGlobalCleanup(): void {
    if (this.isGlobalCleanupRegistered) return

    this.isGlobalCleanupRegistered = true

    // Register Vitest global cleanup
    afterAll(async () => {
      await this.cleanupAll()
    })

    // Handle process exit events for emergency cleanup
    const emergencyCleanup = () => {
      // Synchronous cleanup for process exit - best effort only
      this.databases.forEach((db) => {
        try {
          const result = db.cleanup()
          // Handle sync vs async cleanup methods
          if (result && typeof result === 'object' && 'then' in result) {
            // Async cleanup - can't wait in exit handler, just log
            console.warn(
              'Warning: Async SQLite database cleanup detected during process exit - may not complete',
            )
          }
        } catch (error) {
          console.warn('Emergency SQLite database cleanup failed:', error)
        }
      })

      this.cleanupFunctions.forEach((fn) => {
        try {
          const result = fn()
          // Handle sync vs async cleanup functions
          if (result && typeof result === 'object' && 'then' in result) {
            console.warn(
              'Warning: Async SQLite cleanup function detected during process exit - may not complete',
            )
          }
        } catch (error) {
          console.warn('Emergency SQLite cleanup function failed:', error)
        }
      })
    }

    // Register emergency cleanup for various exit scenarios
    process.on('exit', emergencyCleanup)
    process.on('SIGINT', emergencyCleanup)
    process.on('SIGTERM', emergencyCleanup)
    process.on('uncaughtException', emergencyCleanup)
  }

  /**
   * Get the total number of registered cleanup items
   */
  size(): number {
    return this.cleanupFunctions.size + this.databases.size
  }

  /**
   * Get the number of registered cleanup functions
   */
  functionsSize(): number {
    return this.cleanupFunctions.size
  }

  /**
   * Get the number of registered databases
   */
  databasesSize(): number {
    return this.databases.size
  }

  /**
   * Get a copy of registered databases as an array
   */
  getDatabases(): DatabaseLike[] {
    return Array.from(this.databases)
  }

  /**
   * Get a copy of registered cleanup functions as an array
   */
  getCleanupFunctions(): CleanupFunction[] {
    return Array.from(this.cleanupFunctions)
  }

  /**
   * Check if a cleanup function is registered
   */
  hasCleanupFunction(cleanupFn: CleanupFunction): boolean {
    return this.cleanupFunctions.has(cleanupFn)
  }

  /**
   * Check if a database is registered
   */
  hasDatabase(db: DatabaseLike): boolean {
    return this.databases.has(db)
  }
}

// Global registry instance
const registry = new SqliteCleanupRegistry()

/**
 * Register a cleanup function to be called during test teardown
 *
 * @param cleanupFn - Function to call during cleanup
 *
 * @example
 * ```typescript
 * const db = await createSqliteDatabase()
 * registerCleanup(() => db.close())
 *
 * // Or with a database object
 * registerDatabaseCleanup(db)
 * ```
 */
export function registerCleanup(cleanupFn: CleanupFunction): void {
  registry.register(cleanupFn)
}

/**
 * Register a database object for automatic cleanup
 *
 * The database object must have a cleanup() method.
 *
 * @param db - Database object with cleanup method
 */
export function registerDatabaseCleanup(db: DatabaseLike): void {
  registry.registerDatabase(db)
}

/**
 * Manually execute and unregister a specific cleanup function
 *
 * @param cleanupFn - Cleanup function to execute and remove from registry
 * @returns Promise<boolean> - true if cleanup was executed, false if not registered
 */
export async function executeCleanup(cleanupFn: CleanupFunction): Promise<boolean> {
  if (!registry.hasCleanupFunction(cleanupFn)) {
    return false
  }
  await registry.cleanup(cleanupFn)
  return true
}

/**
 * Manually execute and unregister a specific database cleanup
 *
 * @param db - Database object to cleanup and remove from registry
 * @returns Promise<boolean> - true if cleanup was executed, false if not registered
 */
export async function executeDatabaseCleanup(db: DatabaseLike): Promise<boolean> {
  if (!registry.hasDatabase(db)) {
    return false
  }
  await registry.cleanupDatabase(db)
  return true
}

/**
 * Execute all registered cleanup functions immediately
 *
 * Useful for manual cleanup or emergency situations.
 * All cleanup functions are removed from the registry after execution.
 */
export async function cleanupAllSqlite(): Promise<void> {
  await registry.cleanupAll()
}

/**
 * Get the number of currently registered cleanup items
 *
 * Useful for debugging and ensuring proper cleanup registration.
 */
export function getCleanupCount(): number {
  return registry.size()
}

/**
 * Get detailed cleanup counts
 *
 * @returns Object with counts of functions and databases
 */
export function getDetailedCleanupCount(): { functions: number; databases: number; total: number } {
  const functions = registry.functionsSize()
  const databases = registry.databasesSize()
  return {
    functions,
    databases,
    total: functions + databases,
  }
}

/**
 * Hook for automatic SQLite database cleanup in tests
 *
 * Creates databases with automatic cleanup registration.
 * Use this when you want databases to be automatically cleaned up after each test.
 *
 * @param createDb - Function that creates a database
 * @returns Function that creates and registers a database for cleanup
 *
 * @example
 * ```typescript
 * const useDatabase = useSqliteCleanup(async () => createFileDatabase())
 *
 * it('should work with auto cleanup', async () => {
 *   const db = await useDatabase()
 *   // Database is automatically cleaned up after this test
 * })
 * ```
 */
export function useSqliteCleanup<T extends DatabaseLike>(
  createDb: () => T | Promise<T>,
): () => Promise<T> {
  let databases: T[] = []

  // Register afterEach hook to clean up databases created in this test
  afterEach(async () => {
    await Promise.allSettled(
      databases.map((db) =>
        executeDatabaseCleanup(db).catch((error) => {
          console.warn('Failed to cleanup database in afterEach:', error)
        }),
      ),
    )
    databases = []
  })

  return async () => {
    const db = await createDb()
    databases.push(db)
    registerDatabaseCleanup(db)
    return db
  }
}

/**
 * Scoped SQLite cleanup manager
 *
 * Creates a scope where databases and cleanup functions are isolated
 * and automatically cleaned up when the scope ends.
 *
 * @param fn - Function to execute within the cleanup scope
 * @returns The return value of the scoped function
 *
 * @example
 * ```typescript
 * await withSqliteCleanupScope(async () => {
 *   const db1 = await createFileDatabase()
 *   const db2 = await createMemoryDatabase()
 *
 *   registerDatabaseCleanup(db1)
 *   registerDatabaseCleanup(db2)
 *   registerCleanup(() => console.log('Custom cleanup'))
 *
 *   // All registered cleanups are executed when this scope ends
 * })
 * ```
 */
export async function withSqliteCleanupScope<T>(fn: () => T | Promise<T>): Promise<T> {
  const scopedDatabases: DatabaseLike[] = []
  const scopedCleanups: CleanupFunction[] = []

  // Save original registry state
  const originalDatabases = registry.getDatabases()
  const originalCleanups = registry.getCleanupFunctions()

  let result: T
  let error: unknown = undefined

  try {
    // Execute the scoped function
    result = await fn()
  } catch (err) {
    error = err
  }

  // Find items added during scope execution (whether it succeeded or failed)
  const currentDatabases = registry.getDatabases()
  const currentCleanups = registry.getCleanupFunctions()

  const addedDatabases = currentDatabases.filter(
    (db: DatabaseLike) => !originalDatabases.includes(db),
  )
  const addedCleanups = currentCleanups.filter(
    (fn: CleanupFunction) => !originalCleanups.includes(fn),
  )

  // Move added items to scoped arrays
  scopedDatabases.push(...addedDatabases)
  scopedCleanups.push(...addedCleanups)

  // Remove from global registry (they'll be cleaned up below)
  addedDatabases.forEach((db: DatabaseLike) => {
    registry.unregisterDatabase(db)
  })

  addedCleanups.forEach((fn: CleanupFunction) => {
    registry.unregister(fn)
  })

  // Clean up scoped resources directly (they're already unregistered from global registry)
  await Promise.allSettled([
    ...scopedDatabases.map((db) => db.cleanup()),
    ...scopedCleanups.map((fn) => fn()),
  ])

  // Re-throw error if the scoped function failed
  if (error !== undefined) {
    throw error
  }

  return result!
}

/**
 * Create a file database with automatic cleanup registration
 *
 * This is a convenience function that combines database creation with cleanup registration.
 *
 * @param createDb - Function that creates a file database
 * @returns Promise resolving to the created database (automatically registered for cleanup)
 */
export async function createCleanableFileDatabase<T extends FileDatabase>(
  createDb: () => T | Promise<T>,
): Promise<T> {
  const db = await createDb()
  registerDatabaseCleanup(db)
  return db
}

/**
 * Create any database with automatic cleanup registration
 *
 * Generic version that works with any database-like object with a cleanup method.
 *
 * @param createDb - Function that creates a database
 * @returns Promise resolving to the created database (automatically registered for cleanup)
 */
export async function createCleanableDatabase<T extends DatabaseLike>(
  createDb: () => T | Promise<T>,
): Promise<T> {
  const db = await createDb()
  registerDatabaseCleanup(db)
  return db
}
