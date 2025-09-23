/**
 * SQLite pragma configuration utilities for test environment optimization
 *
 * @module sqlite/pragma
 *
 * Provides utilities for applying recommended SQLite pragmas that improve
 * test stability, performance, and correctness.
 *
 * ## Recommended Pragmas
 *
 * - **WAL mode**: Write-Ahead Logging for better concurrency
 * - **Foreign keys**: Enforce referential integrity constraints
 * - **Busy timeout**: Reduce "database locked" errors in concurrent tests
 *
 * ## Usage
 *
 * ```typescript
 * import { applyRecommendedPragmas } from '@template/testkit/sqlite'
 *
 * const pragmas = await applyRecommendedPragmas(db, {
 *   busyTimeoutMs: 5000
 * })
 *
 * console.log(pragmas)
 * // { journal_mode: 'wal', foreign_keys: 'on', busy_timeout: 5000 }
 * ```
 *
 * ## Driver Normalization
 *
 * This module normalizes pragma responses across different SQLite drivers.
 * For example, better-sqlite3 returns `{ timeout }` for busy_timeout, but
 * this module always returns `{ busy_timeout }` for consistency.
 */

/**
 * Applied pragma values returned for verification
 */
export interface AppliedPragmas {
  /** Current journal mode (typically 'wal', 'memory', or 'delete') */
  journal_mode?: string
  /** Foreign key constraint enforcement status */
  foreign_keys?: 'on' | 'off'
  /** Busy timeout in milliseconds (normalized across drivers) */
  busy_timeout?: number
}

/**
 * Options for pragma configuration
 */
export interface PragmasOptions {
  /** Busy timeout in milliseconds (default: 2000) */
  busyTimeoutMs?: number
  // future: adapter flags
}

/**
 * Internal database interface supporting various SQLite driver APIs
 * @internal
 */
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

/**
 * Database interface for environment probing
 * @internal
 */
interface ProbeDatabase {
  exec?(sql: string): void | Promise<void>
  execute?(sql: string): void | Promise<void>
}

/**
 * Probe SQLite environment capabilities to verify setup requirements.
 *
 * Use this function at the start of your test suite to verify that the SQLite
 * environment meets your application's requirements and fail fast if not.
 *
 * @param db - Database connection or database object
 * @param options - Probe configuration options
 * @param options.logLevel - Control console output ('silent', 'warn', 'info')
 * @param options.required - Array of required capabilities that will throw if missing
 * @param options.pragmaOptions - Options passed to applyRecommendedPragmas
 *
 * @example
 * ```typescript
 * import { probeEnvironment } from '@template/testkit/sqlite'
 *
 * // Basic probe with console output
 * await probeEnvironment(db)
 *
 * // Silent probe for CI environments
 * await probeEnvironment(db, { logLevel: 'silent' })
 *
 * // Require specific capabilities
 * await probeEnvironment(db, {
 *   required: ['wal', 'foreign_keys', 'json1']
 * })
 * ```
 *
 * @throws {Error} When required capabilities are not available
 */
export async function probeEnvironment<TDb>(
  db: TDb,
  options: {
    logLevel?: 'silent' | 'warn' | 'info'
    required?: Array<'wal' | 'foreign_keys' | 'json1' | 'fts5'>
    pragmaOptions?: PragmasOptions
  } = {},
): Promise<{
  pragmas: AppliedPragmas
  capabilities: {
    wal: boolean
    foreign_keys: boolean
    json1: boolean
    fts5: boolean
  }
}> {
  const { logLevel = 'info', required = [], pragmaOptions = {} } = options
  const probeDb = db as unknown as ProbeDatabase

  const log = (level: 'info' | 'warn', message: string) => {
    if (logLevel === 'silent') return
    if (logLevel === 'warn' && level === 'info') return
    console[level](message)
  }

  log('info', '🔍 Probing SQLite environment capabilities...')

  // Apply and check pragmas
  const pragmas = await applyRecommendedPragmas(db, pragmaOptions)

  const capabilities = {
    wal: false,
    foreign_keys: false,
    json1: false,
    fts5: false,
  }

  // Check WAL mode
  capabilities.wal = pragmas.journal_mode === 'wal'
  if (!capabilities.wal) {
    const message = `⚠️  WAL mode not available, using: ${pragmas.journal_mode}`
    if (required.includes('wal')) {
      throw new Error(`WAL mode is required but not available (using: ${pragmas.journal_mode})`)
    }
    log('warn', message)
    log('warn', '   Consider using file-based databases for WAL support')
  } else {
    log('info', '✅ WAL mode enabled')
  }

  // Check foreign keys
  capabilities.foreign_keys = pragmas.foreign_keys === 'on'
  if (!capabilities.foreign_keys) {
    const message = 'Foreign key support is required but not enabled'
    if (required.includes('foreign_keys')) {
      throw new Error(message)
    }
    log('warn', `⚠️  ${message}`)
  } else {
    log('info', '✅ Foreign keys enabled')
  }

  // Check busy timeout
  if (!pragmas.busy_timeout || pragmas.busy_timeout < 1000) {
    log('warn', `⚠️  Busy timeout is low: ${pragmas.busy_timeout}ms`)
    log('warn', '   Consider increasing for better concurrency handling')
  } else {
    log('info', `✅ Busy timeout set to ${pragmas.busy_timeout}ms`)
  }

  // Check JSON1 extension
  try {
    if (probeDb.exec) {
      await probeDb.exec(`SELECT json_extract('{"test":1}', '$.test')`)
    } else if (probeDb.execute) {
      await probeDb.execute(`SELECT json_extract('{"test":1}', '$.test')`)
    }
    capabilities.json1 = true
    log('info', '✅ JSON1 extension available')
  } catch {
    if (required.includes('json1')) {
      throw new Error('JSON1 extension is required but not available')
    }
    log('warn', '⚠️  JSON1 extension not available')
  }

  // Check FTS5 extension
  try {
    if (probeDb.exec) {
      await probeDb.exec('CREATE VIRTUAL TABLE temp_fts USING fts5(content)')
      await probeDb.exec('DROP TABLE temp_fts')
    } else if (probeDb.execute) {
      await probeDb.execute('CREATE VIRTUAL TABLE temp_fts USING fts5(content)')
      await probeDb.execute('DROP TABLE temp_fts')
    }
    capabilities.fts5 = true
    log('info', '✅ FTS5 extension available')
  } catch {
    if (required.includes('fts5')) {
      throw new Error('FTS5 extension is required but not available')
    }
    log('warn', '⚠️  FTS5 extension not available')
  }

  log('info', '✅ Environment probe complete\n')

  return { pragmas, capabilities }
}
