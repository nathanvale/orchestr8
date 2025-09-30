/**
 * Automatic cleanup utilities for SQLite databases in tests
 *
 * Provides Vitest lifecycle integration to ensure zero database leaks.
 * Supports per-test isolation and global cleanup mechanisms.
 */

import { afterEach, afterAll } from 'vitest'
import type { FileDatabase } from './file.js'
import { registerResource, ResourceCategory } from '../resources/index.js'
import { resourceCleanupManager } from '../utils/concurrency.js'
import { createExitHandler } from '../utils/process-listeners.js'

/**
 * Generic cleanup function type for any database or resource
 */
export type CleanupFunction = () => void | Promise<void>

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
  /** Timeout in milliseconds for cleanup operations (default: 5000ms) */
  timeoutMs?: number
}

/**
 * Default cleanup timeout in milliseconds
 */
export const DEFAULT_CLEANUP_TIMEOUT = 5000

/**
 * Timeout error for cleanup operations
 */
export class CleanupTimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message)
    this.name = 'CleanupTimeoutError'
  }
}

/**
 * Execute a cleanup operation with timeout support
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new CleanupTimeoutError(`${operation} timed out after ${timeoutMs}ms`, timeoutMs))
      }, timeoutMs)
    }),
  ])
}

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
  private isProcessListenersRegistered = false
  private removeProcessListeners?: () => void

  /**
   * Register a generic cleanup function
   */
  register(cleanupFn: CleanupFunction): void {
    this.cleanupFunctions.add(cleanupFn)
    this.ensureGlobalCleanup()

    // Also register with the resource manager
    const resourceId = `sqlite-cleanup-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    registerResource(resourceId, cleanupFn, {
      category: ResourceCategory.DATABASE,
      description: 'SQLite cleanup function',
    })
  }

  /**
   * Register a database object with a cleanup method
   */
  registerDatabase(db: DatabaseLike): void {
    this.databases.add(db)
    this.ensureGlobalCleanup()

    // Also register with the resource manager
    const resourceId = `sqlite-database-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    registerResource(resourceId, () => db.cleanup(), {
      category: ResourceCategory.DATABASE,
      description: 'SQLite database object',
    })
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
  async cleanup(cleanupFn: CleanupFunction, options: CleanupOptions = {}): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_CLEANUP_TIMEOUT
    try {
      await withTimeout(Promise.resolve(cleanupFn()), timeoutMs, 'Cleanup function')
    } finally {
      this.unregister(cleanupFn)
    }
  }

  /**
   * Execute and unregister a specific database cleanup
   */
  async cleanupDatabase(db: DatabaseLike, options: CleanupOptions = {}): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_CLEANUP_TIMEOUT
    try {
      await withTimeout(Promise.resolve(db.cleanup()), timeoutMs, 'Database cleanup')
    } finally {
      this.unregisterDatabase(db)
    }
  }

  /**
   * Execute all registered cleanup functions and clear the registry
   */
  async cleanupAll(options: CleanupOptions = {}): Promise<void> {
    const errors: Error[] = []

    // Clean up database objects first
    const databaseCleanups = Array.from(this.databases).map(async (db) => {
      try {
        await this.cleanupDatabase(db, options)
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
        await this.cleanup(fn, options)
      } catch (error) {
        const cleanupError = error instanceof Error ? error : new Error(String(error))
        errors.push(
          new Error(`Cleanup function failed: ${cleanupError.message}`, { cause: cleanupError }),
        )
        console.warn('Failed to execute SQLite cleanup function:', cleanupError)
      }
    })

    const allCleanupPromises = [...databaseCleanups, ...functionCleanups]
    await Promise.allSettled(allCleanupPromises)

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

    // Register process exit event listeners only once
    this.ensureProcessListeners()
  }

  /**
   * Register process event listeners for emergency cleanup (called only once)
   */
  private ensureProcessListeners(): void {
    if (this.isProcessListenersRegistered) return

    this.isProcessListenersRegistered = true

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

    // Use ProcessListenerManager to prevent memory leaks
    this.removeProcessListeners = createExitHandler(emergencyCleanup, {
      events: ['exit', 'SIGINT', 'SIGTERM', 'uncaughtException'],
      description: 'SQLite emergency cleanup',
    })
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

  /**
   * Cleanup process listeners and reset the registry
   */
  destroy(): void {
    if (this.removeProcessListeners) {
      this.removeProcessListeners()
      this.removeProcessListeners = undefined
    }
    this.isProcessListenersRegistered = false
    this.isGlobalCleanupRegistered = false
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
 * @param options - Cleanup options including timeout
 * @returns Promise<boolean> - true if cleanup was executed, false if not registered
 */
export async function executeCleanup(
  cleanupFn: CleanupFunction,
  options: CleanupOptions = {},
): Promise<boolean> {
  if (!registry.hasCleanupFunction(cleanupFn)) {
    return false
  }
  await registry.cleanup(cleanupFn, options)
  return true
}

/**
 * Manually execute and unregister a specific database cleanup
 *
 * @param db - Database object to cleanup and remove from registry
 * @param options - Cleanup options including timeout
 * @returns Promise<boolean> - true if cleanup was executed, false if not registered
 */
export async function executeDatabaseCleanup(
  db: DatabaseLike,
  options: CleanupOptions = {},
): Promise<boolean> {
  if (!registry.hasDatabase(db)) {
    return false
  }
  await registry.cleanupDatabase(db, options)
  return true
}

/**
 * Unregister a cleanup function without executing it
 *
 * @param cleanupFn - Cleanup function to remove from registry
 * @returns boolean - true if function was registered and removed, false if not found
 *
 * @example
 * ```typescript
 * const cleanup = () => console.log('cleanup')
 * registerCleanup(cleanup)
 * const removed = unregisterCleanup(cleanup) // true
 * ```
 */
export function unregisterCleanup(cleanupFn: CleanupFunction): boolean {
  if (!registry.hasCleanupFunction(cleanupFn)) {
    return false
  }
  registry.unregister(cleanupFn)
  return true
}

/**
 * Unregister a database cleanup without executing it
 *
 * @param db - Database object to remove from registry
 * @returns boolean - true if database was registered and removed, false if not found
 *
 * @example
 * ```typescript
 * const db = await createFileDatabase()
 * registerDatabaseCleanup(db)
 * const removed = unregisterDatabaseCleanup(db) // true
 * ```
 */
export function unregisterDatabaseCleanup(db: DatabaseLike): boolean {
  if (!registry.hasDatabase(db)) {
    return false
  }
  registry.unregisterDatabase(db)
  return true
}

/**
 * Execute all registered cleanup functions immediately
 *
 * Useful for manual cleanup or emergency situations.
 * All cleanup functions are removed from the registry after execution.
 * Note: This only cleans up items in the legacy SQLite registry.
 * For comprehensive cleanup including resource manager, use cleanupAllResources.
 *
 * @param options - Cleanup options including timeout
 */
export async function cleanupAllSqlite(options: CleanupOptions = {}): Promise<void> {
  await registry.cleanupAll(options)
}

/**
 * Get the number of currently registered cleanup items
 *
 * Useful for debugging and ensuring proper cleanup registration.
 * Note: This only counts items in the legacy SQLite registry, not the resource manager.
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
    const cleanupFunctions = databases.map(
      (db) => () =>
        executeDatabaseCleanup(db).catch((error) => {
          console.warn('Failed to cleanup database in afterEach:', error)
        }),
    )
    await resourceCleanupManager.batch(cleanupFunctions, (fn) => fn())
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
  const allScopedCleanups = [
    ...scopedDatabases.map((db) => () => Promise.resolve(db.cleanup())),
    ...scopedCleanups.map((fn) => () => Promise.resolve(fn())),
  ]
  await resourceCleanupManager.batch(allScopedCleanups, (fn) => fn())

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
 * The database is registered with both the legacy SQLite registry and the resource manager.
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
 * Create a database with resource manager integration
 *
 * This function creates a database and registers it directly with the resource manager
 * without using the legacy SQLite registry. Use this for new code that wants to use
 * the resource manager exclusively.
 *
 * @param createDb - Function that creates a database
 * @param description - Description for the resource
 * @returns Promise resolving to the created database
 *
 * @example
 * ```typescript
 * import { createDatabaseWithResourceManager } from '@orchestr8/testkit/sqlite'
 * import { createFileDatabase } from '@orchestr8/testkit/sqlite'
 *
 * const db = await createDatabaseWithResourceManager(
 *   () => createFileDatabase('test.db'),
 *   'Test file database'
 * )
 * ```
 */
export async function createDatabaseWithResourceManager<T extends DatabaseLike>(
  createDb: () => T | Promise<T>,
  description: string = 'SQLite database',
): Promise<T> {
  const db = await createDb()

  // Register directly with resource manager (no legacy registry)
  const resourceId = `sqlite-rm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  registerResource(resourceId, () => db.cleanup(), {
    category: ResourceCategory.DATABASE,
    description,
  })

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

/**
 * Bridge function to register existing SQLite cleanup with resource manager
 *
 * This function allows existing code using the legacy SQLite cleanup system
 * to also benefit from resource manager features like leak detection.
 *
 * @example
 * ```typescript
 * import { bridgeSqliteCleanup } from '@orchestr8/testkit/sqlite'
 *
 * // Bridge existing SQLite cleanup with resource manager
 * bridgeSqliteCleanup()
 * ```
 */
export function bridgeSqliteCleanup(): void {
  // Register the legacy cleanup function with the resource manager
  registerResource('legacy-sqlite-cleanup', () => cleanupAllSqlite(), {
    category: ResourceCategory.DATABASE,
    description: 'Legacy SQLite cleanup bridge',
  })
}
