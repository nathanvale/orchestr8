/**
 * SQL seed helpers for test data management
 *
 * @module sqlite/seed
 *
 * Provides utilities for seeding SQLite databases with test data using SQL files
 * or direct SQL strings. Supports deterministic seeding for reliable test outcomes.
 *
 * ## Features
 *
 * - **Direct SQL execution** via seedWithSql
 * - **File-based seeding** via seedWithFiles in lexicographic order
 * - **Idempotent patterns** support (INSERT OR IGNORE, etc.)
 * - **Error context** includes filename in error messages with original error cause
 * - **Deterministic behavior** for reproducible tests
 * - **UTF-8 encoding** required for all .sql files
 *
 * ## Usage
 *
 * ```typescript
 * import { seedWithSql, seedWithFiles } from '@template/testkit/sqlite'
 *
 * // Direct SQL seeding
 * await seedWithSql(db, 'INSERT INTO users (name) VALUES ("test");')
 *
 * // File-based seeding
 * await seedWithFiles(db, { dir: './seeds' })
 * ```
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { type MigrationDatabase } from './migrate.js'

export interface SeedFilesOptions {
  /** Directory containing seed files */
  dir: string
}

/**
 * Execute SQL string directly for seeding data.
 *
 * @param db - Database connection or database object
 * @param sql - SQL string to execute
 *
 * @example
 * ```typescript
 * const sql = `
 *   INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
 *   INSERT INTO posts (title, user_id) VALUES ('First Post', 1);
 * `
 * await seedWithSql(db, sql)
 * ```
 *
 * @remarks
 * - Executes SQL directly without transaction wrapping
 * - Skips empty or whitespace-only SQL strings
 * - Supports multi-statement SQL
 * - Provides error context for debugging
 */
export async function seedWithSql<TDb extends MigrationDatabase>(
  db: TDb,
  sql: string,
): Promise<void> {
  // Skip empty or whitespace-only SQL
  if (!sql.trim()) {
    return
  }

  try {
    await executeSeed(db, sql)
  } catch (err) {
    // Add context to error while preserving original cause
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to execute seed SQL: ${message}`, { cause: err as Error })
  }
}

/**
 * Execute SQL files from a directory in lexicographic order for seeding data.
 *
 * @param db - Database connection or database object
 * @param options - Seeding options including directory path
 *
 * @example
 * ```typescript
 * await seedWithFiles(db, { dir: './seeds' })
 * ```
 *
 * @remarks
 * - Files are executed in lexicographic order (001_xxx.sql before 002_xxx.sql)
 * - Only .sql files are processed
 * - Empty files are skipped
 * - Errors include filename for context with original error cause preserved
 * - Each file's contents are executed via a single call (may contain multiple SQL statements)
 * - Files must be UTF-8 encoded (BOM not supported)
 */
export async function seedWithFiles<TDb extends MigrationDatabase>(
  db: TDb,
  options: SeedFilesOptions,
): Promise<void> {
  const { dir } = options

  // Validate directory exists
  try {
    const stats = await stat(dir)
    if (!stats.isDirectory()) {
      throw new Error(`Seed path is not a directory: ${dir}`)
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Seed directory does not exist: ${dir}`)
    }
    throw err
  }

  // Read directory contents
  const files = await readdir(dir)

  // Filter and sort seed files
  const seedFiles = files.filter((file) => extname(file).toLowerCase() === '.sql').sort() // Lexicographic sort

  // Execute each seed file
  for (const filename of seedFiles) {
    const filepath = join(dir, filename)

    try {
      const sql = await readFile(filepath, 'utf-8')

      // Skip empty files
      if (!sql.trim()) {
        continue
      }

      // Execute seed SQL directly (no transaction wrapping like migrations)
      await executeSeed(db, sql)
    } catch (err) {
      // Add filename context to error while preserving original cause
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Seed failed in file '${filename}': ${message}`, { cause: err as Error })
    }
  }
}

/**
 * Execute a seed SQL statement using the appropriate database method.
 */
async function executeSeed<TDb extends MigrationDatabase>(db: TDb, sql: string): Promise<void> {
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
