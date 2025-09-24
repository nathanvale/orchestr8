/**
 * SQLite pragma configuration utilities for test environment optimization
 *
 * @module sqlite/pragma
 *
 * Provides utilities for applying recommended SQLite pragmas that improve
 * test stability, performance, and correctness.
 *
 * NOTE: Logging behavior adjusted (2025-09-24) to remove unconditional
 * logger.info calls so silent/warn log levels produce zero info output.
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

import type { Logger } from './migrate.js'
import { consoleLogger } from './migrate.js'
import { PragmaError } from './errors.js'

// Re-export PragmaError for backward compatibility
export { PragmaError }

/**
 * Applied pragma values returned for verification
 */
export interface AppliedPragmas {
  /** Current journal mode (typically 'wal', 'memory', or 'delete') */
  journal_mode?: string
  /** Foreign key constraint enforcement status */
  foreign_keys?: 'on' | 'off' | 'unknown'
  /** Busy timeout in milliseconds (normalized across drivers) */
  busy_timeout?: number
}

/**
 * Detailed error information for pragma operations
 */
export interface PragmaErrorInfo {
  /** Error type classification */
  type: 'driver_limitation' | 'pragma_unsupported' | 'execution_failure'
  /** Human-readable error message */
  message: string
  /** Specific pragma that failed */
  pragma?: string
  /** Original error from database driver */
  cause?: Error
}

/**
 * Options for pragma configuration
 */
export interface PragmasOptions {
  /** Busy timeout in milliseconds (default: 2000) */
  busyTimeoutMs?: number
  /** Custom logger (default: consoleLogger) */
  logger?: Logger
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
 * Apply pragmas using better-sqlite3 style pragma() method
 * @internal
 */
async function applyPragmasUsingPragmaMethod(
  db: DbWithPragma,
  busyTimeoutMs: number,
): Promise<AppliedPragmas> {
  if (!db.pragma) {
    throw new PragmaError({
      type: 'driver_limitation',
      message: 'Database pragma method is not available',
    })
  }

  try {
    // Apply pragmas
    db.pragma(`journal_mode = WAL`)
    db.pragma(`foreign_keys = ON`)
    db.pragma(`busy_timeout = ${busyTimeoutMs}`)

    // Verify and return applied values
    const journalMode = db.pragma('journal_mode')
    const foreignKeys = db.pragma('foreign_keys')
    const busyTimeout = db.pragma('busy_timeout')

    return {
      journal_mode: extractPragmaValue(journalMode, 'string') as string | undefined,
      foreign_keys: normalizeForeignKeys(foreignKeys),
      busy_timeout: normalizeBusyTimeout(busyTimeout),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new PragmaError({
      type: 'execution_failure',
      message: `Failed to apply pragmas using pragma() method: ${message}`,
      cause: err as Error,
    })
  }
}

/**
 * Apply pragmas using prepare() method for other SQLite drivers
 * @internal
 */
async function applyPragmasUsingPrepareMethod(
  db: DbWithPragma,
  busyTimeoutMs: number,
): Promise<AppliedPragmas> {
  if (!db.prepare) {
    throw new PragmaError({
      type: 'driver_limitation',
      message: 'Database prepare method is not available',
    })
  }

  try {
    // Apply pragmas using prepare/run
    const setPragmas = [
      `PRAGMA journal_mode = WAL`,
      `PRAGMA foreign_keys = ON`,
      `PRAGMA busy_timeout = ${busyTimeoutMs}`,
    ]

    for (const pragma of setPragmas) {
      const stmt = db.prepare(pragma)
      if (stmt.run) {
        stmt.run()
      } else {
        // Some drivers might only support get()
        stmt.get()
      }
    }

    // Verify applied values
    const journalMode = db.prepare('PRAGMA journal_mode').get()
    const foreignKeys = db.prepare('PRAGMA foreign_keys').get()
    const busyTimeout = db.prepare('PRAGMA busy_timeout').get()

    return {
      journal_mode: extractPragmaValue(journalMode, 'string') as string | undefined,
      foreign_keys: normalizeForeignKeys(foreignKeys),
      busy_timeout: normalizeBusyTimeout(busyTimeout),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new PragmaError({
      type: 'execution_failure',
      message: `Failed to apply pragmas using prepare() method: ${message}`,
      cause: err as Error,
    })
  }
}

/**
 * Extract pragma value from various driver response formats
 * @internal
 */
function extractPragmaValue(
  result: unknown,
  expectedType: 'string' | 'number',
): string | number | 'unknown' {
  if (result === null || result === undefined) {
    return 'unknown'
  }

  // Handle array responses (some drivers return arrays)
  if (Array.isArray(result) && result.length > 0) {
    const firstItem = result[0]
    if (typeof firstItem === 'object' && firstItem !== null) {
      // Extract first value from object
      const values = Object.values(firstItem)
      if (values.length > 0) {
        result = values[0]
      }
    } else {
      result = firstItem
    }
  }

  // Handle object responses (better-sqlite3 style)
  if (typeof result === 'object' && result !== null) {
    const values = Object.values(result)
    if (values.length > 0) {
      result = values[0]
    }
  }

  // Validate type
  if (expectedType === 'string' && typeof result === 'string') {
    return result.toLowerCase()
  }
  if (expectedType === 'number' && typeof result === 'number') {
    return result
  }
  if (expectedType === 'string' && typeof result === 'number') {
    return String(result)
  }
  if (expectedType === 'number' && typeof result === 'string') {
    const parsed = parseInt(result, 10)
    return isNaN(parsed) ? 'unknown' : parsed
  }

  return 'unknown'
}

/**
 * Normalize foreign keys pragma value across different driver response formats
 * @internal
 */
function normalizeForeignKeys(result: unknown): 'on' | 'off' | 'unknown' {
  const raw = extractPragmaValue(result, 'string')

  if (raw === 'unknown') {
    return 'unknown'
  }

  // Handle numeric values (SQLite native: 1 = on, 0 = off)
  if (raw === '1' || raw === 'true' || raw === 'on') {
    return 'on'
  }

  if (raw === '0' || raw === 'false' || raw === 'off') {
    return 'off'
  }

  return 'unknown'
}

/**
 * Normalize busy timeout across different driver response formats
 * @internal
 */
function normalizeBusyTimeout(result: unknown): number | undefined {
  if (result === null || result === undefined) {
    return undefined
  }

  // Handle better-sqlite3 format: { timeout: number }
  if (
    typeof result === 'object' &&
    result !== null &&
    'timeout' in result &&
    typeof (result as { timeout: unknown }).timeout === 'number'
  ) {
    return (result as { timeout: number }).timeout
  }

  // Handle direct number
  if (typeof result === 'number') {
    return result
  }

  // Handle string number
  if (typeof result === 'string') {
    const parsed = parseInt(result, 10)
    return isNaN(parsed) ? undefined : parsed
  }

  // Handle array format
  if (Array.isArray(result) && result.length > 0) {
    return normalizeBusyTimeout(result[0])
  }

  return undefined
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
 * @throws {PragmaError} When pragma operations fail with detailed error information
 */
export async function applyRecommendedPragmas<TDb>(
  db: TDb,
  opts: PragmasOptions = {},
): Promise<AppliedPragmas> {
  const busyTimeoutMs = opts.busyTimeoutMs ?? 2000
  const logger = opts.logger ?? consoleLogger
  const dbWithPragma = db as unknown as DbWithPragma

  // Check for driver limitations first
  if (!dbWithPragma.pragma && !dbWithPragma.prepare && !dbWithPragma.exec) {
    logger.error(
      'Database object lacks pragma(), prepare(), and exec() methods - cannot apply pragmas',
    )
    throw new PragmaError({
      type: 'driver_limitation',
      message:
        'Database object lacks pragma(), prepare(), and exec() methods - cannot apply pragmas',
    })
  }

  try {
    // Handle better-sqlite3 style (uses pragma method directly)
    if (dbWithPragma.pragma && typeof dbWithPragma.pragma === 'function') {
      return await applyPragmasUsingPragmaMethod(dbWithPragma, busyTimeoutMs)
    }

    // Fallback: Handle libraries without pragma() method but with prepare/exec
    if (dbWithPragma.prepare && typeof dbWithPragma.prepare === 'function') {
      return await applyPragmasUsingPrepareMethod(dbWithPragma, busyTimeoutMs)
    }

    // If we get here, the database doesn't support any pragma operations
    throw new PragmaError({
      type: 'driver_limitation',
      message:
        'Database object lacks pragma() and prepare() methods - cannot apply or verify pragmas',
    })
  } catch (err) {
    if (err instanceof PragmaError) {
      throw err
    }

    // Convert unknown errors to structured format
    const message = err instanceof Error ? err.message : String(err)
    throw new PragmaError({
      type: 'execution_failure',
      message: `Failed to apply recommended pragmas: ${message}`,
      cause: err as Error,
    })
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
 * @param options.logger - Custom logger (default: consoleLogger)
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
    logger?: Logger
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
  const { logLevel = 'info', required = [], pragmaOptions = {}, logger = consoleLogger } = options
  const probeDb = db as unknown as ProbeDatabase

  const log = (level: 'info' | 'warn', message: string) => {
    if (logLevel === 'silent') return
    if (logLevel === 'warn' && level === 'info') return
    if (level === 'info') {
      logger.info(message)
    } else {
      logger.warn(message)
    }
  }

  // Only emit banner when not silent; guard explicitly instead of relying on log helper
  if (logLevel !== 'silent') {
    log('info', '🔍 Probing SQLite environment capabilities...')
  }

  // Apply and check pragmas
  // Apply and check pragmas with filtered logger
  const filteredLogger = {
    info: (msg: string) => log('info', msg),
    warn: (msg: string) => log('warn', msg),
    error: logger.error, // Error logging always passes through
  }
  const pragmas = await applyRecommendedPragmas(db, { ...pragmaOptions, logger: filteredLogger })
  const capabilities = {
    wal: false,
    foreign_keys: false,
    json1: false,
    fts5: false,
  }

  // Check WAL mode
  capabilities.wal = pragmas.journal_mode === 'wal'
  if (pragmas.journal_mode === 'unknown') {
    const message = '⚠️  WAL mode status unknown (pragma support unavailable)'
    if (required.includes('wal')) {
      throw new Error('WAL mode is required but pragma support is unavailable to verify')
    }
    log('warn', message)
    log('warn', '   Database object may lack pragma() or prepare() methods')
  } else if (!capabilities.wal) {
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
  if (pragmas.foreign_keys === 'unknown') {
    const message = 'Foreign key status unknown (pragma support unavailable)'
    if (required.includes('foreign_keys')) {
      throw new Error('Foreign keys are required but pragma support is unavailable to verify')
    }
    log('warn', `⚠️  ${message}`)
  } else if (!capabilities.foreign_keys) {
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

  if (logLevel !== 'silent') {
    log('info', '✅ Environment probe complete\n')
  }

  return { pragmas, capabilities }
}
