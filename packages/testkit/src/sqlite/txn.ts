/**
 * Transaction utilities for SQLite test isolation
 *
 * @module sqlite/txn
 *
 * Provides adapter-based transaction management utilities for SQLite databases,
 * enabling test isolation through commit/rollback patterns. Driver-agnostic design
 * allows integration with any SQLite library through the adapter interface.
 *
 * ## Transaction-Per-Test Pattern
 *
 * The recommended pattern for test isolation:
 *
 * ```typescript
 * import { beforeEach, afterEach, it } from 'vitest'
 * import { withTransaction } from '@orchestr8/testkit/sqlite'
 * import { createAdapter } from './your-adapter'
 *
 * let tx: Transaction
 *
 * beforeEach(async () => {
 *   const db = await connectToDatabase()
 *   tx = await adapter.begin(db)
 * })
 *
 * afterEach(async () => {
 *   // Always rollback to ensure test isolation
 *   await adapter.rollback(tx)
 * })
 *
 * it('should modify data in isolation', async () => {
 *   // All changes here are rolled back after test
 *   await tx.execute('INSERT INTO users ...')
 * })
 * ```
 *
 * ## Anti-Flake Best Practices
 *
 * 1. **Single Database Per Test File**: Avoid concurrent database tests in a single file
 * 2. **Always Rollback**: Even successful tests should rollback for isolation
 * 3. **Unique Test Data**: Use unique identifiers to prevent conflicts
 * 4. **Explicit Transactions**: Prefer explicit transaction boundaries over auto-commit
 *
 * ## Adapter Implementation Guide
 *
 * ```typescript
 * class BetterSqliteAdapter implements TransactionAdapter<Database, Database> {
 *   async begin(db: Database): Promise<Database> {
 *     db.exec('BEGIN')
 *     return db
 *   }
 *
 *   async commit(db: Database): Promise<void> {
 *     db.exec('COMMIT')
 *   }
 *
 *   async rollback(db: Database): Promise<void> {
 *     db.exec('ROLLBACK')
 *   }
 * }
 * ```
 */

/**
 * Transaction adapter interface for database drivers.
 *
 * @typeParam DatabaseConnection - Database connection type
 * @typeParam TransactionContext - Transaction object type
 */
export interface TransactionAdapter<DatabaseConnection, TransactionContext> {
  /** Begin a new transaction */
  begin(db: DatabaseConnection): Promise<TransactionContext>
  /** Commit the transaction */
  commit(tx: TransactionContext): Promise<void>
  /** Rollback the transaction */
  rollback(tx: TransactionContext): Promise<void>
}

/**
 * Execute a function within a transaction with automatic commit/rollback.
 *
 * @typeParam Result - The return type of the transaction function
 * @typeParam DatabaseConnection - Database connection type
 * @typeParam TransactionContext - Transaction object type
 * @param db - Database connection
 * @param adapter - Transaction adapter for the database driver
 * @param fn - Function to execute within the transaction
 * @returns Promise resolving to the function's return value
 *
 * @example
 * ```typescript
 * const result = await withTransaction(db, adapter, async (tx) => {
 *   await tx.execute('INSERT INTO users (name) VALUES (?)', ['Alice'])
 *   return tx.lastInsertRowId
 * })
 * // Transaction is committed if successful, rolled back on error
 * ```
 *
 * @remarks
 * - Automatically commits on success
 * - Automatically rolls back on error
 * - Rollback failures are silently caught to preserve original error
 * - Original error is always rethrown
 */
export async function withTransaction<Result, DatabaseConnection, TransactionContext>(
  db: DatabaseConnection,
  adapter: TransactionAdapter<DatabaseConnection, TransactionContext>,
  fn: (tx: TransactionContext) => Promise<Result>,
): Promise<Result> {
  const tx = await adapter.begin(db)
  try {
    const result = await fn(tx)
    await adapter.commit(tx)
    return result
  } catch (err) {
    // Rollback silently catches errors to preserve original error
    await Promise.resolve(adapter.rollback(tx)).catch(() => {})
    throw err
  }
}
