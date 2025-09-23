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
 * ## ⚠️ Security Warning
 *
 * **These APIs execute arbitrary SQL without sandboxing and are intended for testing only.**
 * - Never use with user-supplied content or in production environments
 * - SQL should only contain trusted seed data scripts
 * - All SQL is executed with full database privileges
 * - No validation or sanitization is performed on SQL content
 * - Ensure seed files are from trusted sources only
 *
 * ## Usage
 *
 * ```typescript
 * import { seedWithSql, seedWithFiles, consoleLogger } from '@template/testkit/sqlite'
 *
 * // Direct SQL seeding
 * await seedWithSql(db, 'INSERT INTO users (name) VALUES ("test");')
 *
 * // File-based seeding
 * await seedWithFiles(db, { dir: './seeds' })
 *
 * // With custom logger
 * await seedWithFiles(db, { dir: './seeds', logger: consoleLogger })
 * ```
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { type MigrationDatabase, type Logger, consoleLogger } from './migrate.js'

export interface SeedFilesOptions {
  /** Directory containing seed files */
  dir: string
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSizeBytes?: number
  /** Custom logger (default: consoleLogger) */
  logger?: Logger
}

/**
 * Batch seeding operation configuration
 */
export interface BatchSeedOperation {
  /** SQL statement to execute */
  sql: string
  /** Optional label for logging/error reporting */
  label?: string
  /** Whether to ignore errors for this operation (default: false) */
  ignoreErrors?: boolean
}

/**
 * Options for batch seeding operations
 */
export interface BatchSeedOptions {
  /** Custom logger (default: consoleLogger) */
  logger?: Logger
  /** Use transaction wrapper for atomic batch execution (default: true) */
  useTransaction?: boolean
  /** Continue processing on individual operation errors (default: false) */
  continueOnError?: boolean
  /** Maximum batch size for chunked execution (default: no limit) */
  maxBatchSize?: number
}

/**
 * Execute SQL string directly for seeding data.
 *
 * @param db - Database connection or database object
 * @param sql - SQL string to execute
 * @param logger - Logger instance (default: consoleLogger)
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
  logger: Logger = consoleLogger,
): Promise<void> {
  // Security warning for production environments
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    logger.warn(
      '⚠️  WARNING: seedWithSql called in production environment!\n' +
        '   This function executes arbitrary SQL and should only be used in testing.\n' +
        '   Set NODE_ENV to "test" or "development" for testing scenarios.',
    )
  }

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
 *
 * // With custom logger
 * await seedWithFiles(db, { dir: './seeds', logger: customLogger })
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
  const { dir, maxFileSizeBytes = 10 * 1024 * 1024, logger = consoleLogger } = options

  // Security warning for production environments
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    logger.warn(
      '⚠️  WARNING: seedWithFiles called in production environment!\n' +
        '   This function executes arbitrary SQL and should only be used in testing.\n' +
        '   Set NODE_ENV to "test" or "development" for testing scenarios.',
    )
  }

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
      // Check file size before reading
      const fileStats = await stat(filepath)
      if (fileStats.size > maxFileSizeBytes) {
        const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2)
        const limitMB = (maxFileSizeBytes / (1024 * 1024)).toFixed(2)
        logger.warn(
          `⚠️  Large seed file detected: ${filename} (${sizeMB}MB)\n` +
            `   File size exceeds recommended limit of ${limitMB}MB.\n` +
            `   Consider splitting large seed files into smaller files for better performance.`,
        )
      }

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
 * Execute multiple seeding operations in batches with transaction support.
 *
 * @param db - Database connection or database object
 * @param operations - Array of seed operations to execute
 * @param options - Batch execution options
 *
 * @example
 * ```typescript
 * const operations = [
 *   { sql: 'INSERT INTO users (name) VALUES ("Alice")', label: 'Create Alice' },
 *   { sql: 'INSERT INTO users (name) VALUES ("Bob")', label: 'Create Bob' },
 *   { sql: 'INSERT INTO posts (title, user_id) VALUES ("First Post", 1)', label: 'Create post' }
 * ]
 *
 * // Atomic batch execution (default)
 * await seedWithBatch(db, operations)
 *
 * // Continue on errors, chunked execution
 * await seedWithBatch(db, operations, {
 *   continueOnError: true,
 *   maxBatchSize: 10
 * })
 * ```
 *
 * @remarks
 * - Uses transactions by default for atomic execution
 * - Supports chunked execution for large datasets
 * - Provides detailed error context with operation labels
 * - Can continue processing despite individual operation failures
 */
export async function seedWithBatch<TDb extends MigrationDatabase>(
  db: TDb,
  operations: BatchSeedOperation[],
  options: BatchSeedOptions = {},
): Promise<void> {
  const {
    logger = consoleLogger,
    useTransaction = true,
    continueOnError = false,
    maxBatchSize,
  } = options

  // Security warning for production environments
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    logger.warn(
      '⚠️  WARNING: seedWithBatch called in production environment!\n' +
        '   This function executes arbitrary SQL and should only be used in testing.\n' +
        '   Set NODE_ENV to "test" or "development" for testing scenarios.',
    )
  }

  if (operations.length === 0) {
    logger.info('No seed operations provided, skipping batch execution')
    return
  }

  // Split into chunks if maxBatchSize is specified
  const chunks = maxBatchSize ? chunkArray(operations, maxBatchSize) : [operations]

  logger.info(`Executing ${operations.length} seed operations in ${chunks.length} batch(es)`)

  const errors: Array<{
    operation: BatchSeedOperation
    error: Error
    chunkIndex: number
    operationIndex: number
  }> = []

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]

    try {
      await executeBatchChunk(db, chunk, chunkIndex, {
        useTransaction,
        continueOnError,
        logger,
      })
    } catch (err) {
      if (err instanceof BatchExecutionError) {
        errors.push(...err.operationErrors)
        if (!continueOnError) {
          break
        }
      } else {
        // Unexpected error
        throw err
      }
    }
  }

  // Report summary
  const successCount = operations.length - errors.length
  logger.info(`Batch seeding completed: ${successCount}/${operations.length} operations successful`)

  if (errors.length > 0 && !continueOnError) {
    const firstError = errors[0]
    const operation = firstError.operation
    const label = operation.label ? ` (${operation.label})` : ''
    throw new Error(
      `Batch seeding failed at operation ${firstError.operationIndex}${label}: ${firstError.error.message}`,
      { cause: firstError.error },
    )
  }
}

/**
 * Custom error class for batch execution failures
 */
class BatchExecutionError extends Error {
  constructor(
    public readonly operationErrors: Array<{
      operation: BatchSeedOperation
      error: Error
      chunkIndex: number
      operationIndex: number
    }>,
  ) {
    super(`Batch execution failed with ${operationErrors.length} operation errors`)
    this.name = 'BatchExecutionError'
  }
}

/**
 * Execute a single batch chunk with optional transaction wrapper
 * @internal
 */
async function executeBatchChunk<TDb extends MigrationDatabase>(
  db: TDb,
  operations: BatchSeedOperation[],
  chunkIndex: number,
  options: {
    useTransaction: boolean
    continueOnError: boolean
    logger: Logger
  },
): Promise<void> {
  const { useTransaction, continueOnError, logger } = options
  const errors: Array<{
    operation: BatchSeedOperation
    error: Error
    chunkIndex: number
    operationIndex: number
  }> = []

  if (useTransaction) {
    // Execute chunk in transaction
    const transactionSql = operations
      .map((op, _index) => {
        const label = op.label ? ` -- ${op.label}` : ''
        return `${op.sql};${label}`
      })
      .join('\n')

    const wrappedSql = `BEGIN;\n${transactionSql}\nCOMMIT;`

    try {
      await executeSeed(db, wrappedSql)
      logger.info(
        `✓ Batch chunk ${chunkIndex + 1} completed successfully (${operations.length} operations)`,
      )
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`✗ Batch chunk ${chunkIndex + 1} failed: ${error.message}`)

      // Try to rollback
      try {
        await executeSeed(db, 'ROLLBACK;')
      } catch {
        // Ignore rollback errors
      }

      // If we can't continue on error, throw immediately
      if (!continueOnError) {
        throw new BatchExecutionError([
          {
            operation: operations[0], // Best guess at which operation failed
            error,
            chunkIndex,
            operationIndex: 0,
          },
        ])
      }

      // If continuing on error, mark all operations in chunk as failed
      operations.forEach((operation, index) => {
        errors.push({
          operation,
          error,
          chunkIndex,
          operationIndex: index,
        })
      })
    }
  } else {
    // Execute operations individually
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i]
      const label = operation.label ? ` (${operation.label})` : ''

      try {
        await executeSeed(db, operation.sql)
        logger.info(`✓ Operation ${i + 1}${label} completed successfully`)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        logger.error(`✗ Operation ${i + 1}${label} failed: ${error.message}`)

        if (operation.ignoreErrors) {
          logger.info(`  Ignoring error for operation ${i + 1} as requested`)
          continue
        }

        errors.push({
          operation,
          error,
          chunkIndex,
          operationIndex: i,
        })

        if (!continueOnError) {
          break
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new BatchExecutionError(errors)
  }
}

/**
 * Split array into chunks of specified size
 * @internal
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
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
