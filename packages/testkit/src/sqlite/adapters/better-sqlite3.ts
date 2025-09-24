/**
 * better-sqlite3 adapter with real transaction semantics and pragma helpers
 *
 * This adapter provides a standardized interface for working with better-sqlite3
 * databases, including proper transaction management and pragma utilities.
 */

/**
 * Extended better-sqlite3 database interface with all required methods
 */
export interface BetterSqlite3DbLike {
  /** Execute pragma statements - returns pragma result */
  pragma(sql: string): unknown
  /** Prepare SQL statements */
  prepare(sql: string): {
    run: (...args: unknown[]) => {
      changes: number
      lastInsertRowid: number | bigint
    }
    all: (...args: unknown[]) => unknown[]
    get: (...args: unknown[]) => unknown
  }
  /** Create transaction function */
  transaction<T>(fn: () => T): () => T
  /** Execute SQL directly (better-sqlite3 specific) */
  exec(sql: string): void
  /** Close database connection */
  close(): void
  /** Check if database is open */
  open: boolean
  /** Database memory usage (if available) */
  memory?: {
    used: number
    highwater: number
  }
}

/**
 * Transaction context for better-sqlite3
 *
 * In better-sqlite3, transactions are managed via transaction functions
 * rather than explicit begin/commit/rollback commands.
 */
export interface BetterSqlite3Transaction {
  /** Original database instance */
  db: BetterSqlite3DbLike
  /** Transaction function that will be executed */
  txFn: <T>(work: () => T) => T
  /** Whether this transaction is active */
  active: boolean
  /** Whether this transaction has been executed */
  executed: boolean
  /** Execute work within this transaction */
  execute<T>(work: () => T): T
}

/**
 * Adapter interface for better-sqlite3 databases
 */
export interface BetterSqlite3Adapter<TDb extends BetterSqlite3DbLike> {
  /** Begin a new transaction */
  begin(db: TDb): Promise<BetterSqlite3Transaction>
  /** Commit a transaction (no-op for better-sqlite3 - handled automatically) */
  commit(tx: BetterSqlite3Transaction): Promise<void>
  /** Rollback a transaction (throws error to trigger rollback) */
  rollback(tx: BetterSqlite3Transaction): Promise<void>
  /** Execute pragma statement */
  pragma(db: TDb, sql: string): unknown
  /** Execute SQL statement */
  exec(db: TDb, sql: string): void
  /** Check database health */
  isHealthy(db: TDb): boolean
  /** Get database statistics */
  getStats(db: TDb): {
    memoryUsed?: number
    memoryHighwater?: number
    isOpen: boolean
    pragmaSettings: Record<string, unknown>
  }
}

/**
 * Error thrown to trigger transaction rollback in better-sqlite3
 */
export class TransactionRollbackError extends Error {
  constructor(message: string = 'Transaction rollback requested') {
    super(message)
    this.name = 'TransactionRollbackError'
  }
}

/**
 * SQLite pragma constants and configurations
 */
export const SQLITE_PRAGMA_CONFIG = {
  /** Common pragma names for querying database state */
  QUERY_PRAGMAS: [
    'journal_mode',
    'synchronous',
    'foreign_keys',
    'case_sensitive_like',
    'page_size',
    'cache_size',
  ] as const,

  /** Testing environment pragma settings (optimized for speed) */
  TESTING_PRAGMAS: {
    journal_mode: 'MEMORY',
    synchronous: 'OFF',
    foreign_keys: 'ON',
    temp_store: 'MEMORY',
  } as const,

  /** Production environment pragma settings (optimized for safety) */
  PRODUCTION_PRAGMAS: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: 'ON',
    temp_store: 'FILE',
  } as const,

  /** Development environment pragma settings (balanced) */
  DEVELOPMENT_PRAGMAS: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: 'ON',
    temp_store: 'MEMORY',
  } as const,
} as const

/**
 * Environment type for pragma configuration
 */
export type SqliteEnvironment = 'testing' | 'production' | 'development'

/**
 * Convert pragma object to SQL statements
 */
function pragmaObjectToStatements(pragmas: Record<string, string>): string[] {
  return Object.entries(pragmas).map(([key, value]) => `${key} = ${value}`)
}

/**
 * Normalize pragma name (remove underscores, lowercase)
 */
function normalizePragmaName(pragma: string): string {
  return pragma.toLowerCase().replace(/_/g, '')
}

/**
 * Apply pragma configuration for specific environment
 */
function applyPragmaConfig(
  db: BetterSqlite3DbLike,
  environment: SqliteEnvironment,
  customPragmas: Record<string, string> = {},
): void {
  const envConfig = {
    testing: SQLITE_PRAGMA_CONFIG.TESTING_PRAGMAS,
    production: SQLITE_PRAGMA_CONFIG.PRODUCTION_PRAGMAS,
    development: SQLITE_PRAGMA_CONFIG.DEVELOPMENT_PRAGMAS,
  }[environment]

  // Merge environment config with custom overrides
  const finalConfig = { ...envConfig, ...customPragmas }
  const pragmaStatements = pragmaObjectToStatements(finalConfig)

  for (const pragma of pragmaStatements) {
    try {
      betterSqlite3Adapter.pragma(db, pragma)
    } catch (error) {
      console.warn(`Failed to set pragma '${pragma}' for ${environment} environment:`, error)
    }
  }
}

/**
 * Better-sqlite3 adapter implementation with proper transaction semantics
 */
export const betterSqlite3Adapter: BetterSqlite3Adapter<BetterSqlite3DbLike> = {
  /**
   * Begin a transaction
   *
   * In better-sqlite3, we create a transaction function but don't execute it yet.
   * The transaction will run when the returned transaction object's execute method is called.
   */
  async begin(db: BetterSqlite3DbLike): Promise<BetterSqlite3Transaction> {
    if (!db.open) {
      throw new Error('Cannot begin transaction on closed database')
    }

    // Create a transaction function that will be executed later
    // better-sqlite3 transaction functions are created for specific work
    const txFn = <T>(work: () => T): T => {
      const workTxFn = db.transaction(work)
      return workTxFn()
    }

    const transaction: BetterSqlite3Transaction = {
      db,
      txFn,
      active: true,
      executed: false,
      execute<T>(work: () => T): T {
        if (!transaction.active) {
          throw new Error('Cannot execute on inactive transaction')
        }

        transaction.executed = true
        return transaction.txFn(work)
      },
    }

    return transaction
  },

  /**
   * Commit a transaction
   *
   * In better-sqlite3, commits are automatic when the transaction function
   * completes successfully. This is mostly a no-op but marks the transaction as inactive.
   */
  async commit(tx: BetterSqlite3Transaction): Promise<void> {
    if (!tx.active) {
      throw new Error('Cannot commit inactive transaction')
    }
    tx.active = false
  },

  /**
   * Rollback a transaction
   *
   * In better-sqlite3, rollbacks happen automatically when the transaction function throws an error.
   * This method just marks the transaction as inactive - the actual rollback is handled by better-sqlite3.
   */
  async rollback(tx: BetterSqlite3Transaction): Promise<void> {
    if (!tx.active) {
      throw new Error('Cannot rollback inactive transaction')
    }
    tx.active = false
    // Throw TransactionRollbackError to indicate rollback requested
    throw new TransactionRollbackError('Transaction rollback requested')
  },
  /**
   * Execute a pragma statement
   */
  pragma(db: BetterSqlite3DbLike, sql: string): unknown {
    if (!db.open) {
      throw new Error('Cannot execute pragma on closed database')
    }

    if (typeof db.pragma !== 'function') {
      throw new Error('Database does not support pragma statements')
    }

    try {
      return db.pragma(sql)
    } catch (error) {
      throw new Error(
        `Pragma execution failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  },

  /**
   * Execute SQL statement directly
   */
  exec(db: BetterSqlite3DbLike, sql: string): void {
    if (!db.open) {
      throw new Error('Cannot execute SQL on closed database')
    }

    if (typeof db.exec !== 'function') {
      throw new Error('Database does not support exec method')
    }

    try {
      db.exec(sql)
    } catch (error) {
      throw new Error(
        `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  },

  /**
   * Check if database is healthy and ready for operations
   */
  isHealthy(db: BetterSqlite3DbLike): boolean {
    try {
      return Boolean(db.open && db.pragma && typeof db.pragma === 'function')
    } catch {
      return false
    }
  },

  /**
   * Get database statistics and configuration
   */
  getStats(db: BetterSqlite3DbLike): {
    memoryUsed?: number
    memoryHighwater?: number
    isOpen: boolean
    pragmaSettings: Record<string, unknown>
  } {
    const stats = {
      isOpen: Boolean(db.open),
      pragmaSettings: {} as Record<string, unknown>,
      memoryUsed: undefined as number | undefined,
      memoryHighwater: undefined as number | undefined,
    }

    if (!db.open) {
      return stats
    }

    // Get memory usage if available
    if (db.memory) {
      stats.memoryUsed = db.memory.used
      stats.memoryHighwater = db.memory.highwater
    }

    // Get common pragma settings (safely)
    try {
      for (const pragma of SQLITE_PRAGMA_CONFIG.QUERY_PRAGMAS) {
        try {
          const normalizedKey = normalizePragmaName(pragma)
          stats.pragmaSettings[normalizedKey] = this.pragma(db, pragma)
        } catch {
          // Skip pragmas that fail
        }
      }
    } catch {
      // If pragma access fails entirely, continue with empty settings
    }

    return stats
  },
}

/**
 * Utility functions for working with better-sqlite3 databases
 */
export const betterSqlite3Utils = {
  /**
   * Execute work within a transaction, with automatic rollback on errors
   */
  async withTransaction<T>(
    db: BetterSqlite3DbLike,
    work: (tx: BetterSqlite3Transaction) => T | Promise<T>,
  ): Promise<T> {
    const tx = await betterSqlite3Adapter.begin(db)
    try {
      const result = tx.execute(() => {
        return work(tx)
      })

      await betterSqlite3Adapter.commit(tx)
      return result
    } catch (error) {
      // Transaction function already handled rollback - just mark as inactive
      tx.active = false
      throw error
    }
  },

  /**
   * Execute multiple SQL statements safely
   */
  execMultiple(db: BetterSqlite3DbLike, sqlStatements: string[]): void {
    for (const sql of sqlStatements) {
      if (sql.trim()) {
        betterSqlite3Adapter.exec(db, sql)
      }
    }
  },

  /**
   * Set recommended pragma settings for testing
   */
  setTestingPragmas(db: BetterSqlite3DbLike): void {
    applyPragmaConfig(db, 'testing')
  },

  /**
   * Set recommended pragma settings for production
   */
  setProductionPragmas(db: BetterSqlite3DbLike): void {
    applyPragmaConfig(db, 'production')
  },

  /**
   * Optimize database for performance
   */
  optimize(db: BetterSqlite3DbLike): void {
    try {
      betterSqlite3Adapter.exec(db, 'PRAGMA optimize')
    } catch (error) {
      console.warn('Failed to optimize database:', error)
    }
  },

  /**
   * Vacuum database to reclaim space
   */
  vacuum(db: BetterSqlite3DbLike): void {
    try {
      betterSqlite3Adapter.exec(db, 'VACUUM')
    } catch (error) {
      console.warn('Failed to vacuum database:', error)
    }
  },
}
