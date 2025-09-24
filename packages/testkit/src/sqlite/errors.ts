/**
 * Structured error types for SQLite testkit operations
 *
 * @module sqlite/errors
 *
 * Provides a unified error taxonomy for better error handling and debugging
 * across all SQLite helper operations.
 */

/**
 * Base class for all SQLite testkit errors
 *
 * Provides structured error information with a kind discriminant
 * for better error handling and debugging.
 */
export abstract class SqliteTestkitError extends Error {
  public abstract readonly kind: string
  public override readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message)
    this.cause = cause

    // Set the error name properly
    Object.defineProperty(this, 'name', {
      value: this.constructor.name,
      configurable: true,
    })

    // Maintain proper stack trace (for V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Error for pragma operation failures
 */
export class PragmaError extends SqliteTestkitError {
  public readonly kind = 'pragma_error' as const
  public readonly type: 'driver_limitation' | 'pragma_unsupported' | 'execution_failure'
  public readonly pragma?: string

  constructor(info: {
    type: 'driver_limitation' | 'pragma_unsupported' | 'execution_failure'
    message: string
    pragma?: string
    cause?: Error
  }) {
    super(info.message, info.cause)
    this.type = info.type
    this.pragma = info.pragma
  }
}

/**
 * Error for migration operation failures
 */
export class MigrationError extends SqliteTestkitError {
  public readonly kind = 'migration_error' as const
  public readonly migrationFile?: string

  constructor(message: string, migrationFile?: string, cause?: Error) {
    super(message, cause)
    this.migrationFile = migrationFile
  }
}

/**
 * Error for seed operation failures
 */
export class SeedError extends SqliteTestkitError {
  public readonly kind = 'seed_error' as const
  public readonly seedFile?: string
  public readonly operation?: string

  constructor(message: string, context?: { seedFile?: string; operation?: string }, cause?: Error) {
    super(message, cause)
    this.seedFile = context?.seedFile
    this.operation = context?.operation
  }
}

/**
 * Error for batch seed operation failures
 */
export class BatchSeedError extends SqliteTestkitError {
  public readonly kind = 'batch_seed_error' as const
  public readonly operationIndex?: number
  public readonly operationLabel?: string
  public readonly operationErrors?: Array<{
    operation: { sql: string; label?: string }
    error: Error
    chunkIndex: number
    operationIndex: number
  }>

  constructor(
    message: string,
    context?: {
      operationIndex?: number
      operationLabel?: string
      operationErrors?: Array<{
        operation: { sql: string; label?: string }
        error: Error
        chunkIndex: number
        operationIndex: number
      }>
    },
    cause?: Error,
  ) {
    super(message, cause)
    this.operationIndex = context?.operationIndex
    this.operationLabel = context?.operationLabel
    this.operationErrors = context?.operationErrors
  }
}

/**
 * Error for database reset operation failures
 */
export class ResetError extends SqliteTestkitError {
  public readonly kind = 'reset_error' as const

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

/**
 * Error for file database operation failures
 */
export class FileDbError extends SqliteTestkitError {
  public readonly kind = 'file_db_error' as const
  public readonly operation: 'create' | 'cleanup' | 'access'
  public readonly path?: string

  constructor(
    message: string,
    operation: 'create' | 'cleanup' | 'access',
    path?: string,
    cause?: Error,
  ) {
    super(message, cause)
    this.operation = operation
    this.path = path
  }
}

/**
 * Type guard to check if an error is a SQLite testkit error
 */
export function isSqliteTestkitError(error: unknown): error is SqliteTestkitError {
  return error instanceof SqliteTestkitError
}

/**
 * Type guard to check if an error is a specific kind of SQLite testkit error
 */
export function isSqliteErrorOfKind<T extends SqliteTestkitError['kind']>(
  error: unknown,
  kind: T,
): error is Extract<SqliteTestkitError, { kind: T }> {
  return isSqliteTestkitError(error) && error.kind === kind
}

/**
 * Utility to create standardized error messages with context
 */
export function createSqliteError(
  kind: SqliteTestkitError['kind'],
  message: string,
  context?: Record<string, unknown>,
  cause?: Error,
): SqliteTestkitError {
  switch (kind) {
    case 'pragma_error':
      return new PragmaError({
        type: (context?.type as PragmaError['type']) || 'execution_failure',
        message,
        pragma: context?.pragma as string,
        cause,
      })
    case 'migration_error':
      return new MigrationError(message, context?.migrationFile as string, cause)
    case 'seed_error':
      return new SeedError(
        message,
        {
          seedFile: context?.seedFile as string,
          operation: context?.operation as string,
        },
        cause,
      )
    case 'batch_seed_error':
      return new BatchSeedError(
        message,
        {
          operationIndex: context?.operationIndex as number,
          operationLabel: context?.operationLabel as string,
          operationErrors: context?.operationErrors as BatchSeedError['operationErrors'],
        },
        cause,
      )
    case 'reset_error':
      return new ResetError(message, cause)
    case 'file_db_error':
      return new FileDbError(
        message,
        (context?.operation as FileDbError['operation']) || 'access',
        context?.path as string,
        cause,
      )
    default:
      // Fallback to generic error
      throw new Error(`Unknown SQLite error kind: ${kind}`)
  }
}
