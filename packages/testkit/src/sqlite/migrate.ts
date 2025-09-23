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
 * ## Usage
 *
 * ```typescript
 * import { applyMigrations, resetDatabase } from '@template/testkit/sqlite'
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

import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'

export interface MigrationOptions {
  /** Directory containing migration files */
  dir: string
  /** Glob pattern to match files (default: '*.sql') */
  glob?: string
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
  const { dir, glob = '*.sql' } = options

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
      // Use glob pattern if specified, otherwise default to .sql files
      if (glob !== '*.sql') {
        return simpleGlobMatch(file, glob)
      }
      return extname(file).toLowerCase() === '.sql'
    })
    .sort() // Lexicographic sort

  // Apply each migration file in its own transaction
  for (const filename of migrationFiles) {
    const filepath = join(dir, filename)

    try {
      const sql = await readFile(filepath, 'utf-8')

      // Skip empty files
      if (!sql.trim()) {
        continue
      }

      // Check if the file already contains transaction commands
      const hasTransactionCommands = /\b(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)

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
 *
 * @example
 * ```typescript
 * const db = await createFileDatabase()
 * await resetDatabase(db)
 * ```
 *
 * @remarks
 * - Uses safe enumeration approach (not PRAGMA writable_schema)
 * - Only drops user objects, not system objects
 * - Safe to call on empty databases
 * - Useful for test teardown only - enforces NODE_ENV=test
 * - Drops objects in safe order: triggers → views → indexes → tables
 */
export async function resetDatabase<
  TDb extends MigrationDatabase & { all?: (sql: string) => Array<{ name: string; type: string }> },
>(db: TDb): Promise<void> {
  // Safety guard: only allow in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetDatabase is only allowed in test environment (NODE_ENV=test)')
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
      objects = db.all(query)
    } else {
      // If no all method, we can't safely enumerate objects
      // This is a limitation but prevents unsafe operations
      console.warn('Database object lacks all() method - cannot safely reset database')
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

      const resetSql = `
        BEGIN;
        ${dropStatements.join('\n        ')}
        COMMIT;
        VACUUM;
      `

      await executeMigration(db, resetSql)
    }
  } catch (err) {
    // Add context about the reset operation
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Database reset failed: ${message}`)
  }
}

/**
 * Simple glob matching for basic patterns like '*.sql' or 'migration_*.sql'
 */
function simpleGlobMatch(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*/g, '.*') // Convert * to .*
    .replace(/\?/g, '.') // Convert ? to .

  const regex = new RegExp(`^${regexPattern}$`)
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
