/**
 * SQL-first migration runner for SQLite databases
 *
 * @module sqlite/migrate
 *
 * Provides utilities for applying SQL migration files in lexicographic order
 * with proper transaction isolation and error handling.
 *
 * ## Features
 *
 * - **SQL file-based migrations** sorted by filename
 * - **Per-file transactions** for atomic operations
 * - **Error context** includes filename in error messages
 * - **Lexicographic ordering** for predictable execution
 * - **Reset utilities** for test teardown
 *
 * ## ⚠️ Security Warning
 *
 * **These APIs execute arbitrary SQL without sandboxing and are intended for testing only.**
 * - Never use with user-supplied content or in production environments
 * - SQL files should only contain trusted migration scripts
 * - All SQL is executed with full database privileges
 * - No validation or sanitization is performed on SQL content
 *
 * ## Usage
 *
 * ```typescript
 * import { applyMigrations, resetDatabase } from '@orchestr8/testkit/sqlite'
 *
 * // Apply migrations from directory
 * await applyMigrations(db, { dir: './migrations' })
 *
 * // Apply with custom glob pattern
 * await applyMigrations(db, { dir: './migrations', glob: '*.sql' })
 *
 * // Reset database for tests
 * await resetDatabase(db)
 * ```
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { extname, join } from 'node:path'

/**
 * Logger interface for customizable logging in SQLite operations
 */
export interface Logger {
  /** Log informational messages */
  info(message: string): void
  /** Log warning messages */
  warn(message: string): void
  /** Log error messages */
  error(message: string): void
}

/**
 * Default console logger implementation
 */
export const consoleLogger: Logger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
}

/**
 * Silent logger that discards all messages
 */
export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
}

export interface MigrationOptions {
  /** Directory containing migration files */
  dir: string
  /** Glob pattern(s) to match files (default: '*.sql') - supports arrays and advanced patterns */
  glob?: string | string[]
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSizeBytes?: number
  /** Custom logger (default: consoleLogger) */
  logger?: Logger
  /** Enable checksum validation to prevent modified migrations (default: false) */
  validateChecksums?: boolean
  /** Directory to store migration checksum records (default: same as migration dir) */
  checksumDir?: string
}

/**
 * Database interface for migrations - supports any database object with an exec method
 * This interface is flexible to work with different SQLite drivers and database objects
 */
export interface MigrationDatabase {
  /** Execute SQL statement(s) - common in many SQLite drivers */
  exec?: (sql: string) => void | Promise<void>
  /** Alternative execution method */
  execute?: (sql: string) => void | Promise<void>
  /** Query method that returns results - used for resetDatabase enumeration */
  all?: (
    sql: string,
  ) => Array<{ name: string; type: string }> | Promise<Array<{ name: string; type: string }>>
  /** URL property for file databases */
  url?: string
}

/**
 * Apply SQL migration files from a directory in lexicographic order.
 *
 * @param db - Database connection or database object
 * @param options - Migration options including directory and glob pattern
 *
 * @example
 * ```typescript
 * const db = await createFileDatabase()
 * await applyMigrations(db, { dir: './migrations' })
 * ```
 *
 * @remarks
 * - Files are executed in lexicographic order (001_xxx.sql before 002_xxx.sql)
 * - Each file runs in its own transaction
 * - Errors include the filename for context
 * - Only .sql files are processed by default
 */
export async function applyMigrations<TDb extends MigrationDatabase>(
  db: TDb,
  options: MigrationOptions,
): Promise<void> {
  const {
    dir,
    glob = '*.sql',
    maxFileSizeBytes = 10 * 1024 * 1024,
    logger = consoleLogger,
  } = options

  // Security warning for production environments
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    logger.warn(
      '⚠️  WARNING: applyMigrations called in production environment!\n' +
        '   This function executes arbitrary SQL and should only be used in testing.\n' +
        '   Set NODE_ENV to "test" or "development" for testing scenarios.',
    )
  }

  // Validate directory exists
  try {
    const stats = await stat(dir)
    if (!stats.isDirectory()) {
      throw new Error(`Migration path is not a directory: ${dir}`)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Migration directory does not exist: ${dir}`)
    }
    throw err
  }

  // Read directory contents
  const files = await readdir(dir)

  // Filter and sort migration files
  const migrationFiles = files
    .filter((file) => {
      // Use enhanced glob matching for all patterns
      if (typeof glob === 'string' && glob === '*.sql') {
        // Fast path for default pattern
        return extname(file).toLowerCase() === '.sql'
      }
      return simpleGlobMatch(file, glob)
    })
    .sort() // Lexicographic sort

  // Apply each migration file in its own transaction
  for (const filename of migrationFiles) {
    const filepath = join(dir, filename)

    try {
      // Check file size before reading
      const fileStats = await stat(filepath)
      if (fileStats.size > maxFileSizeBytes) {
        const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2)
        const limitMB = (maxFileSizeBytes / (1024 * 1024)).toFixed(2)
        logger.warn(
          `⚠️  Large migration file detected: ${filename} (${sizeMB}MB)\n` +
            `   File size exceeds recommended limit of ${limitMB}MB.\n` +
            `   Consider splitting large migrations into smaller files for better performance.`,
        )
      }

      const sql = await readFile(filepath, 'utf-8')

      // Skip empty files
      if (!sql.trim()) {
        continue
      }

      // Validate checksum if enabled
      if (options.validateChecksums) {
        await validateMigrationChecksum(filename, sql, options.checksumDir || dir, logger)
      }

      // Check if the file already contains explicit transaction management
      // Look for both BEGIN and COMMIT to ensure proper transaction pairing
      const hasBegin = /\bBEGIN\b/i.test(sql)
      const hasCommit = /\bCOMMIT\b/i.test(sql)
      const hasTransactionCommands = hasBegin && hasCommit

      let transactionalSql: string
      if (hasTransactionCommands) {
        // File already manages its own transactions - execute as-is
        transactionalSql = sql
      } else {
        // Wrap in transaction for atomic execution
        transactionalSql = `BEGIN; -- ${filename}\n${sql}\nCOMMIT;`
      }

      await executeMigration(db, transactionalSql)
    } catch (err) {
      // Best-effort rollback if a transaction is open
      await tryRollback(db)
      // Add filename context to error
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Migration failed in file '${filename}': ${message}`)
    }
  }
}

/**
 * Reset database by safely dropping all user tables, views, triggers, and indexes.
 *
 * @param db - Database connection or database object with all method
 * @param options - Reset options including explicit allowReset flag and optional logger
 *
 * @example
 * ```typescript
 * const db = await createFileDatabase()
 * await resetDatabase(db)
 *
 * // In CI environments or when NODE_ENV is not set:
 * await resetDatabase(db, { allowReset: true })
 * ```
 *
 * @remarks
 * - Uses safe enumeration approach (not PRAGMA writable_schema)
 * - Only drops user objects, not system objects
 * - Safe to call on empty databases
 * - Useful for test teardown only - enforces NODE_ENV=test OR explicit allowReset flag
 * - Drops objects in safe order: triggers → views → indexes → tables
 *
 * @throws {Error} When called outside test environment without explicit allowReset flag
 */
export async function resetDatabase<
  TDb extends MigrationDatabase & { all?: (sql: string) => Array<{ name: string; type: string }> },
>(
  db: TDb,
  options: {
    /**
     * Explicitly allow reset operation outside test environment.
     * Use with caution - only set to true in controlled test scenarios.
     */
    allowReset?: boolean
    /** Custom logger (default: consoleLogger) */
    logger?: Logger
    /**
     * Temporarily disable foreign key constraints during reset operation.
     * When true (default), wraps drop statements with `PRAGMA foreign_keys=OFF/ON`
     * to safely handle complex FK relationships that might otherwise cause drop failures.
     *
     * This helps avoid errors when:
     * - FK constraints form cycles between tables
     * - Parent tables are dropped before their children
     * - Complex multi-table FK relationships prevent clean teardown
     *
     * Foreign key state is automatically restored after the operation,
     * even if the reset operation fails. (default: true)
     */
    disableForeignKeys?: boolean
  } = {},
): Promise<void> {
  const { allowReset = false, logger = consoleLogger, disableForeignKeys = true } = options

  // Enhanced safety guard: require test environment OR explicit allowReset flag
  const isTestEnv = process.env.NODE_ENV === 'test'
  if (!isTestEnv && !allowReset) {
    const currentEnv = process.env.NODE_ENV || 'undefined'
    throw new Error(
      `resetDatabase is only allowed in test environment or with explicit allowReset flag.\n` +
        `Current NODE_ENV: "${currentEnv}"\n` +
        `Solutions:\n` +
        `  1. Set NODE_ENV=test in your environment\n` +
        `  2. Pass { allowReset: true } as second parameter (use with caution)\n` +
        `  3. For CI: ensure NODE_ENV=test is set in your test configuration`,
    )
  }

  try {
    // Get all user objects from sqlite_master
    const query = `
      SELECT name, type FROM sqlite_master
      WHERE type IN ('table', 'view', 'trigger', 'index')
      AND name NOT LIKE 'sqlite_%'
      ORDER BY
        CASE type
          WHEN 'trigger' THEN 1
          WHEN 'view' THEN 2
          WHEN 'index' THEN 3
          WHEN 'table' THEN 4
        END
    `

    let objects: Array<{ name: string; type: string }> = []

    // Try to get objects using the all method if available
    if (typeof db.all === 'function') {
      const result = db.all(query)
      objects = result instanceof Promise ? await result : result
    } else {
      // If no all method, we can't safely enumerate objects
      // This is a limitation but prevents unsafe operations
      logger.warn('Database object lacks all() method - cannot safely reset database')
      return
    }

    // Drop objects in safe order within a transaction
    if (objects.length > 0) {
      const dropStatements = objects.map((obj) => {
        switch (obj.type) {
          case 'trigger':
            return `DROP TRIGGER IF EXISTS "${obj.name}";`
          case 'view':
            return `DROP VIEW IF EXISTS "${obj.name}";`
          case 'index':
            return `DROP INDEX IF EXISTS "${obj.name}";`
          case 'table':
            return `DROP TABLE IF EXISTS "${obj.name}";`
          default:
            return `-- Unknown type: ${obj.type} ${obj.name}`
        }
      })

      if (disableForeignKeys) {
        // Temporarily disable foreign keys with proper restoration handling
        try {
          // Disable foreign keys outside transaction to persist through rollbacks
          await executeMigration(db, 'PRAGMA foreign_keys=OFF;')

          // Execute drop statements in transaction
          const resetSql = `
            BEGIN;
            ${dropStatements.join('\n            ')}
            COMMIT;
            VACUUM;
          `
          await executeMigration(db, resetSql)
        } finally {
          // Always restore foreign key constraints, even if operation failed
          try {
            await executeMigration(db, 'PRAGMA foreign_keys=ON;')
          } catch (restoreErr) {
            // Log restoration error but don't override original error
            logger.warn(
              `Failed to restore foreign key constraints: ${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}`,
            )
          }
        }
      } else {
        // Standard reset without foreign key constraint handling
        const resetSql = `
          BEGIN;
          ${dropStatements.join('\n          ')}
          COMMIT;
          VACUUM;
        `
        await executeMigration(db, resetSql)
      }
    }
  } catch (err) {
    // Add context about the reset operation
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Database reset failed: ${message}`)
  }
}

/**
 * Enhanced glob matching supporting common patterns used in migration files
 *
 * Supports:
 * - Basic wildcards: `*.sql`, `migration_*.sql`
 * - Character ranges: `[0-9]*.sql`
 * - Alternation: `{migration,seed}_*.sql`
 * - Negation: `!test_*.sql` (returns false for matches)
 * - Multiple patterns: `['*.sql', '!test_*.sql']`
 */
function simpleGlobMatch(filename: string, pattern: string | string[]): boolean {
  // Handle array of patterns
  if (Array.isArray(pattern)) {
    let matches = false
    const negations: string[] = []

    for (const p of pattern) {
      if (p.startsWith('!')) {
        negations.push(p.slice(1))
      } else if (matchSinglePattern(filename, p)) {
        matches = true
      }
    }

    // Check negations
    for (const neg of negations) {
      if (matchSinglePattern(filename, neg)) {
        return false
      }
    }

    return matches
  }

  // Handle single pattern
  if (pattern.startsWith('!')) {
    return !matchSinglePattern(filename, pattern.slice(1))
  }

  return matchSinglePattern(filename, pattern)
}

/**
 * Match a single glob pattern against a filename
 * @internal
 */
function matchSinglePattern(filename: string, pattern: string): boolean {
  // Handle alternation: {a,b,c}
  const alternationMatch = pattern.match(/^(.*?)\{([^}]+)\}(.*)$/)
  if (alternationMatch) {
    const [, prefix, alternatives, suffix] = alternationMatch
    const alts = alternatives.split(',')
    return alts.some((alt) => matchSinglePattern(filename, prefix + alt + suffix))
  }

  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*/g, '.*') // Convert * to .*
    .replace(/\?/g, '.') // Convert ? to .

  // Handle character ranges [abc] or [a-z]
  regexPattern = regexPattern.replace(/\[([^\]]+)\]/g, '[$1]')

  const regex = new RegExp(`^${regexPattern}$`, 'i') // Case insensitive
  return regex.test(filename)
}

/**
 * Execute a migration SQL statement using the appropriate database method.
 */
async function executeMigration<TDb extends MigrationDatabase>(
  db: TDb,
  sql: string,
): Promise<void> {
  // Try different execution methods based on what's available
  if (typeof db.exec === 'function') {
    await db.exec(sql)
  } else if (typeof db.execute === 'function') {
    await db.execute(sql)
  } else {
    // If no execution method is available, we can't proceed
    throw new Error('Database object must have an exec() or execute() method')
  }
}

/**
 * Attempt to rollback the current transaction, ignoring any errors
 * (e.g., if no transaction is active).
 */
async function tryRollback<TDb extends MigrationDatabase>(db: TDb): Promise<void> {
  try {
    await executeMigration(db, 'ROLLBACK;')
  } catch {
    // ignore
  }
}

/**
 * Calculate SHA-256 checksum of migration file content
 */
function calculateMigrationChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * Validate migration file checksum against stored checksum
 * @param filename - Migration filename
 * @param content - Migration file content
 * @param checksumDir - Directory containing checksum files
 * @param logger - Logger instance
 */
async function validateMigrationChecksum(
  filename: string,
  content: string,
  checksumDir: string,
  logger: Logger,
): Promise<void> {
  const checksumFilename = `${filename}.checksum`
  const checksumPath = join(checksumDir, checksumFilename)
  const currentChecksum = calculateMigrationChecksum(content)

  try {
    // Try to read existing checksum
    const storedChecksum = await readFile(checksumPath, 'utf-8')
    const trimmedStoredChecksum = storedChecksum.trim()

    if (currentChecksum !== trimmedStoredChecksum) {
      throw new Error(
        `Migration file '${filename}' has been modified after initial application.\n` +
          `Expected checksum: ${trimmedStoredChecksum}\n` +
          `Actual checksum: ${currentChecksum}\n` +
          `Modifying applied migrations can lead to inconsistent database states.`,
      )
    }

    logger.info(`✓ Checksum validated for migration: ${filename}`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Checksum file doesn't exist - create it
      try {
        await writeFile(checksumPath, currentChecksum)
        logger.info(`✓ Created checksum for new migration: ${filename}`)
      } catch (writeErr) {
        logger.warn(
          `⚠️  Failed to create checksum file for ${filename}: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
        )
      }
    } else {
      // Re-throw validation errors
      throw err
    }
  }
}
