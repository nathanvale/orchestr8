/**
 * Custom error types for Quality Checker
 */

/**
 * Base error class for all Quality Checker errors
 */
export abstract class QualityCheckError extends Error {
  abstract readonly code: string
  abstract readonly exitCode: number

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Error thrown when a required tool is missing
 */
export class ToolMissingError extends QualityCheckError {
  readonly code = 'TOOL_MISSING'
  readonly exitCode = 2

  constructor(
    public readonly tool: string,
    message?: string,
  ) {
    super(message ?? `Required tool '${tool}' is not installed or not found in PATH`)
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends QualityCheckError {
  readonly code = 'CONFIG_ERROR'
  readonly exitCode = 2

  constructor(
    message: string,
    public readonly configPath?: string,
  ) {
    super(message)
  }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends QualityCheckError {
  readonly code = 'TIMEOUT'
  readonly exitCode = 2

  constructor(
    public readonly timeoutMs: number,
    public readonly operation?: string,
  ) {
    super(
      operation
        ? `Operation '${operation}' timed out after ${timeoutMs}ms`
        : `Operation timed out after ${timeoutMs}ms`,
    )
  }
}

/**
 * Error thrown for internal/unexpected errors
 */
export class InternalError extends QualityCheckError {
  readonly code = 'INTERNAL_ERROR'
  readonly exitCode = 2

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileError extends QualityCheckError {
  readonly code = 'FILE_ERROR'
  readonly exitCode = 2

  constructor(
    message: string,
    public readonly path?: string,
  ) {
    super(message)
  }
}

/**
 * Exit codes for the Quality Checker
 */
export const ExitCodes = {
  /** Success - no issues found */
  SUCCESS: 0,
  /** Issues found during check */
  ISSUES_FOUND: 1,
  /** Error occurred during execution */
  ERROR: 2,
} as const

export type ExitCode = (typeof ExitCodes)[keyof typeof ExitCodes]

/**
 * Maps error types to their appropriate exit codes
 */
export function getExitCode(error: unknown): ExitCode {
  if (error instanceof QualityCheckError) {
    return error.exitCode as ExitCode
  }
  return ExitCodes.ERROR
}

/**
 * Formats error messages for CLI output
 * Ensures stable, terse messages
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof QualityCheckError) {
    return `[${error.code}] ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

/**
 * Type guard to check if an error is a QualityCheckError
 */
export function isQualityCheckError(error: unknown): error is QualityCheckError {
  return error instanceof QualityCheckError
}

/**
 * Type guard to check if an error is recoverable (warning)
 */
export function isRecoverableError(error: unknown): boolean {
  return error instanceof ToolMissingError
}
