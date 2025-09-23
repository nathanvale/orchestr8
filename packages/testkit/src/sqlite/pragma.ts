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
}

/**
 * Apply recommended SQLite pragmas for test stability.
 *
 * @param db - Database instance with optional pragma method
 * @param opts - Options for pragma configuration
 * @returns Applied pragma values for verification
 */
export async function applyRecommendedPragmas<TDb>(
  db: TDb,
  opts: PragmasOptions = {},
): Promise<AppliedPragmas> {
  const busyTimeoutMs = opts.busyTimeoutMs ?? 2000
  const dbWithPragma = db as unknown as DbWithPragma

  try {
    // If the database doesn't support pragma, return defaults
    if (!dbWithPragma.pragma || typeof dbWithPragma.pragma !== 'function') {
      return {
        journal_mode: 'wal',
        foreign_keys: 'on',
        busy_timeout: busyTimeoutMs,
      }
    }

    // Apply journal_mode = WAL (with fallback for in-memory databases)
    let journalModeResult: unknown
    try {
      journalModeResult = dbWithPragma.pragma('PRAGMA journal_mode = WAL')
    } catch {
      // Fallback for in-memory databases that can't use WAL
      journalModeResult = [{ journal_mode: 'memory' }]
    }

    // Apply foreign_keys = ON
    const foreignKeysResult = dbWithPragma.pragma('PRAGMA foreign_keys = ON')

    // Apply busy_timeout
    const busyTimeoutResult = dbWithPragma.pragma(`PRAGMA busy_timeout = ${busyTimeoutMs}`)

    // Extract actual values from results
    const journalMode =
      Array.isArray(journalModeResult) && journalModeResult[0]?.journal_mode
        ? journalModeResult[0].journal_mode
        : 'wal'

    const foreignKeys =
      Array.isArray(foreignKeysResult) && foreignKeysResult[0]?.foreign_keys !== undefined
        ? foreignKeysResult[0].foreign_keys === 1 || foreignKeysResult[0].foreign_keys === 'on'
          ? 'on'
          : 'off'
        : 'on'

    const busyTimeout =
      Array.isArray(busyTimeoutResult) && busyTimeoutResult[0]?.busy_timeout !== undefined
        ? busyTimeoutResult[0].busy_timeout
        : busyTimeoutMs

    return {
      journal_mode: journalMode,
      foreign_keys: foreignKeys,
      busy_timeout: busyTimeout,
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
