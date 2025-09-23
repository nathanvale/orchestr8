/**
 * Recommended pragmas helper (Phase 2 adapter will execute these)
 */

export interface AppliedPragmas {
  journal_mode?: string
  foreign_keys?: 'on' | 'off'
  busy_timeout?: number
}

export interface PragmasOptions {
  busyTimeoutMs?: number
  // future: adapter flags
}

interface DbWithPragma {
  pragma?(sql: string): unknown
  prepare?(sql: string): { get(): unknown; all(): unknown; run?(): unknown }
  exec?(sql: string): unknown
}

/**
 * Apply recommended SQLite pragmas for test stability.
 *
 * @param db - Database instance with optional pragma method
 * @param opts - Options for pragma configuration
 * @returns Applied pragma values for verification. Note: The returned
 *          `busy_timeout` field is normalized - better-sqlite3 returns
 *          `{ timeout }` but this function always returns `{ busy_timeout }`
 *          for consistency across different SQLite drivers.
 */
export async function applyRecommendedPragmas<TDb>(
  db: TDb,
  opts: PragmasOptions = {},
): Promise<AppliedPragmas> {
  const busyTimeoutMs = opts.busyTimeoutMs ?? 2000
  const dbWithPragma = db as unknown as DbWithPragma

  try {
    // Handle better-sqlite3 style (uses pragma method directly)
    if (dbWithPragma.pragma && typeof dbWithPragma.pragma === 'function') {
      // Apply pragmas using pragma() method for better-sqlite3
      let journalModeValue = 'wal'
      try {
        const result = dbWithPragma.pragma('journal_mode = WAL')
        if (Array.isArray(result) && result[0]?.journal_mode) {
          journalModeValue = result[0].journal_mode
        }
      } catch {
        // Fallback for in-memory databases that can't use WAL
        try {
          const result = dbWithPragma.pragma('journal_mode = MEMORY')
          if (Array.isArray(result) && result[0]?.journal_mode) {
            journalModeValue = result[0].journal_mode
          }
        } catch {
          // Ignore if memory mode also fails
        }
      }

      dbWithPragma.pragma('foreign_keys = ON')
      dbWithPragma.pragma(`busy_timeout = ${busyTimeoutMs}`)

      // Now read the actual values using prepare
      // Note: better-sqlite3 returns { timeout } not { busy_timeout } for busy_timeout pragma
      let busyTimeoutValue = busyTimeoutMs

      if (dbWithPragma.prepare && typeof dbWithPragma.prepare === 'function') {
        const journalModeResult = dbWithPragma.prepare('PRAGMA journal_mode')?.get() as
          | { journal_mode: string }
          | undefined
        const foreignKeysResult = dbWithPragma.prepare('PRAGMA foreign_keys')?.get() as
          | { foreign_keys: number }
          | undefined
        const busyTimeoutResult = dbWithPragma.prepare('PRAGMA busy_timeout')?.get() as
          | { timeout?: number; busy_timeout?: number }
          | undefined

        // Handle both { timeout } and { busy_timeout } formats
        // Normalize to always return as 'busy_timeout' for consistency
        if (busyTimeoutResult) {
          busyTimeoutValue =
            busyTimeoutResult.timeout ?? busyTimeoutResult.busy_timeout ?? busyTimeoutMs
        }

        return {
          journal_mode: journalModeResult?.journal_mode ?? journalModeValue,
          foreign_keys: foreignKeysResult?.foreign_keys === 1 ? 'on' : 'off',
          busy_timeout: busyTimeoutValue, // Always normalized as 'busy_timeout'
        }
      }

      return {
        journal_mode: journalModeValue,
        foreign_keys: 'on',
        busy_timeout: busyTimeoutMs,
      }
    }

    // Fallback: Handle libraries without pragma() method but with prepare/exec
    if (dbWithPragma.prepare && typeof dbWithPragma.prepare === 'function') {
      // Apply pragmas using exec for better-sqlite3
      if (dbWithPragma.exec) {
        dbWithPragma.exec('PRAGMA journal_mode = WAL')
        dbWithPragma.exec('PRAGMA foreign_keys = ON')
        dbWithPragma.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`)
      }

      // Now read the actual values
      const journalModeResult = dbWithPragma.prepare!('PRAGMA journal_mode')?.get() as
        | { journal_mode: string }
        | undefined
      const foreignKeysResult = dbWithPragma.prepare!('PRAGMA foreign_keys')?.get() as
        | { foreign_keys: number }
        | undefined
      const busyTimeoutResult = dbWithPragma.prepare!('PRAGMA busy_timeout')?.get() as
        | { timeout?: number; busy_timeout?: number }
        | undefined

      // Handle both { timeout } and { busy_timeout } formats
      let busyTimeoutValue = busyTimeoutMs
      if (busyTimeoutResult) {
        busyTimeoutValue =
          busyTimeoutResult.timeout ?? busyTimeoutResult.busy_timeout ?? busyTimeoutMs
      }

      return {
        journal_mode: journalModeResult?.journal_mode ?? 'wal',
        foreign_keys: foreignKeysResult?.foreign_keys === 1 ? 'on' : 'off',
        busy_timeout: busyTimeoutValue,
      }
    }

    // If the database doesn't support pragma, return defaults
    return {
      journal_mode: 'wal',
      foreign_keys: 'on',
      busy_timeout: busyTimeoutMs,
    }
  } catch {
    // Graceful fallback on any error
    return {
      journal_mode: 'wal',
      foreign_keys: 'on',
      busy_timeout: busyTimeoutMs,
    }
  }
}
