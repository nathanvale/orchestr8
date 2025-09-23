/**
 * better-sqlite3 adapter (stub for Phase 2)
 */

export interface BetterSqlite3DbLike {
  // minimal shape; real type comes from dependency when enabled
  pragma?(sql: string): unknown
  prepare?(sql: string): {
    run: (...args: unknown[]) => unknown
    all: (...args: unknown[]) => unknown
  }
  transaction?<T>(fn: () => T): () => T
}

export interface BetterSqlite3Adapter<TDb extends BetterSqlite3DbLike, TTx = TDb> {
  begin(db: TDb): Promise<TTx>
  commit(tx: TTx): Promise<void>
  rollback(tx: TTx): Promise<void>
  pragma(db: TDb, sql: string): unknown
}

export const betterSqlite3Adapter: BetterSqlite3Adapter<BetterSqlite3DbLike> = {
  async begin(db) {
    // For better-sqlite3, a common pattern is using db.transaction
    // In a full implementation, return a transactional context/handle
    return db
  },
  async commit(_tx) {
    // No-op stub
  },
  async rollback(_tx) {
    // No-op stub
  },
  pragma(db, sql) {
    // Execute pragma if db supports it
    if (db.pragma && typeof db.pragma === 'function') {
      return db.pragma(sql)
    }
    // Return empty result for databases without pragma support
    return []
  },
}
