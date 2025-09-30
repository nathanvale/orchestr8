/**
 * Unified error handling system for @orchestr8/testkit
 *
 * Provides structured error types with consistent categorization, error codes,
 * and metadata for better debugging and error handling across all modules.
 *
 * @module errors
 */

/**
 * Error categories for organizing different types of errors
 */
export enum ErrorCategory {
  SECURITY = 'security',
  RESOURCE = 'resource',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  PROCESS = 'process',
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  NETWORK = 'network',
  TIMER = 'timer',
  EVENT = 'event',
}

/**
 * Standardized error codes for different error types
 */
export enum ErrorCode {
  // Security errors
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  UNSAFE_OPERATION = 'UNSAFE_OPERATION',

  // Resource errors
  RESOURCE_LEAK = 'RESOURCE_LEAK',
  CLEANUP_FAILED = 'CLEANUP_FAILED',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',

  // Database errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  SEED_FAILED = 'SEED_FAILED',
  PRAGMA_FAILED = 'PRAGMA_FAILED',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY',
  TEMP_FILE_CREATION_FAILED = 'TEMP_FILE_CREATION_FAILED',
  CLEANUP_FAILED_FS = 'CLEANUP_FAILED_FS',

  // Process errors
  PROCESS_SPAWN_FAILED = 'PROCESS_SPAWN_FAILED',
  PROCESS_EXIT_NONZERO = 'PROCESS_EXIT_NONZERO',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
  PROCESS_KILLED = 'PROCESS_KILLED',

  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_DEPENDENCY = 'MISSING_DEPENDENCY',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',

  // Validation errors
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  TYPE_MISMATCH = 'TYPE_MISMATCH',

  // Network errors
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  REQUEST_FAILED = 'REQUEST_FAILED',

  // Timer errors
  TIMER_CREATION_FAILED = 'TIMER_CREATION_FAILED',

  // Event errors
  LISTENER_REGISTRATION_FAILED = 'LISTENER_REGISTRATION_FAILED',
  EVENT_EMISSION_FAILED = 'EVENT_EMISSION_FAILED',
}

/**
 * Metadata that can be attached to errors for debugging
 */
export interface ErrorMetadata {
  /** Additional context about the error */
  context?: Record<string, unknown>
  /** Stack trace when the error was created */
  stack?: string
  /** Timestamp when the error occurred */
  timestamp?: number
  /** Source file where the error occurred */
  source?: string
  /** Operation that was being performed when the error occurred */
  operation?: string
  /** Recovery suggestions */
  suggestions?: string[]
}

/**
 * Base class for all testkit errors
 *
 * Provides structured error information with category, code, and metadata
 * for better error handling and debugging.
 */
export abstract class TestkitError extends Error {
  public abstract readonly category: ErrorCategory
  public abstract readonly code: ErrorCode
  public readonly metadata: ErrorMetadata
  public override readonly cause?: Error

  constructor(message: string, metadata: ErrorMetadata = {}, cause?: Error) {
    super(message)
    this.metadata = {
      timestamp: Date.now(),
      stack: this.stack,
      ...metadata,
    }
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

  /**
   * Serializes the error to a plain object for logging or transport
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      metadata: this.metadata,
      cause: this.cause?.message,
      stack: this.stack,
    }
  }

  /**
   * Returns a formatted string representation of the error
   */
  override toString(): string {
    const parts = [
      `${this.name}: ${this.message}`,
      `Category: ${this.category}`,
      `Code: ${this.code}`,
    ]

    if (this.metadata.operation) {
      parts.push(`Operation: ${this.metadata.operation}`)
    }

    if (this.cause) {
      parts.push(`Caused by: ${this.cause.message}`)
    }

    return parts.join('\n')
  }
}

/**
 * Error for file system operations
 */
export class FileSystemError extends TestkitError {
  public readonly category = ErrorCategory.FILE_SYSTEM
  public readonly code: ErrorCode
  public readonly path?: string
  public readonly operation?: string

  constructor(
    code: ErrorCode,
    message: string,
    context?: { path?: string; operation?: string },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.path = context?.path
    this.operation = context?.operation
  }
}

/**
 * Error for process operations
 */
export class ProcessError extends TestkitError {
  public readonly category = ErrorCategory.PROCESS
  public readonly code: ErrorCode
  public readonly command?: string
  public readonly exitCode?: number
  public readonly signal?: NodeJS.Signals

  constructor(
    code: ErrorCode,
    message: string,
    context?: { command?: string; exitCode?: number; signal?: NodeJS.Signals },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.command = context?.command
    this.exitCode = context?.exitCode
    this.signal = context?.signal
  }
}

/**
 * Error for resource management operations
 */
export class ResourceError extends TestkitError {
  public readonly category = ErrorCategory.RESOURCE
  public readonly code: ErrorCode
  public readonly resourceId?: string
  public readonly resourceType?: string

  constructor(
    code: ErrorCode,
    message: string,
    context?: { resourceId?: string; resourceType?: string },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.resourceId = context?.resourceId
    this.resourceType = context?.resourceType
  }
}

/**
 * Error for configuration operations
 */
export class ConfigurationError extends TestkitError {
  public readonly category = ErrorCategory.CONFIGURATION
  public readonly code: ErrorCode
  public readonly configKey?: string
  public readonly expectedType?: string

  constructor(
    code: ErrorCode,
    message: string,
    context?: { configKey?: string; expectedType?: string },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.configKey = context?.configKey
    this.expectedType = context?.expectedType
  }
}

/**
 * Error for database operations (extends existing SQLite error system)
 */
export class DatabaseError extends TestkitError {
  public readonly category = ErrorCategory.DATABASE
  public readonly code: ErrorCode
  public readonly database?: string
  public readonly query?: string

  constructor(
    code: ErrorCode,
    message: string,
    context?: { database?: string; query?: string },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.database = context?.database
    this.query = context?.query
  }
}

/**
 * Error for security operations
 */
export class SecurityError extends TestkitError {
  public readonly category = ErrorCategory.SECURITY
  public readonly code: ErrorCode
  public readonly input?: string
  public readonly violationType?: string

  constructor(
    code: ErrorCode,
    message: string,
    context?: { input?: string; violationType?: string },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.input = context?.input
    this.violationType = context?.violationType
  }
}

/**
 * Error for validation operations
 */
export class ValidationError extends TestkitError {
  public readonly category = ErrorCategory.VALIDATION
  public readonly code: ErrorCode
  public readonly field?: string
  public readonly value?: unknown
  public readonly expectedType?: string

  constructor(
    code: ErrorCode,
    message: string,
    context?: { field?: string; value?: unknown; expectedType?: string },
    metadata: ErrorMetadata = {},
    cause?: Error,
  ) {
    super(message, { ...metadata, context }, cause)
    this.code = code
    this.field = context?.field
    this.value = context?.value
    this.expectedType = context?.expectedType
  }
}

/**
 * Type guard to check if an error is a testkit error
 */
export function isTestkitError(error: unknown): error is TestkitError {
  return error instanceof TestkitError
}

/**
 * Type guard to check if an error is a specific category of testkit error
 */
export function isTestkitErrorOfCategory<T extends ErrorCategory>(
  error: unknown,
  category: T,
): error is Extract<TestkitError, { category: T }> {
  return isTestkitError(error) && error.category === category
}

/**
 * Type guard to check if an error is a specific code of testkit error
 */
export function isTestkitErrorOfCode<T extends ErrorCode>(
  error: unknown,
  code: T,
): error is Extract<TestkitError, { code: T }> {
  return isTestkitError(error) && error.code === code
}

/**
 * Factory function to create appropriate error instances
 */
export function createTestkitError(
  category: ErrorCategory,
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>,
  metadata?: ErrorMetadata,
  cause?: Error,
): TestkitError {
  switch (category) {
    case ErrorCategory.FILE_SYSTEM:
      return new FileSystemError(
        code,
        message,
        context as { path?: string; operation?: string },
        metadata,
        cause,
      )
    case ErrorCategory.PROCESS:
      return new ProcessError(
        code,
        message,
        context as { command?: string; exitCode?: number; signal?: NodeJS.Signals },
        metadata,
        cause,
      )
    case ErrorCategory.RESOURCE:
      return new ResourceError(
        code,
        message,
        context as { resourceId?: string; resourceType?: string },
        metadata,
        cause,
      )
    case ErrorCategory.CONFIGURATION:
      return new ConfigurationError(
        code,
        message,
        context as { configKey?: string; expectedType?: string },
        metadata,
        cause,
      )
    case ErrorCategory.DATABASE:
      return new DatabaseError(
        code,
        message,
        context as { database?: string; query?: string },
        metadata,
        cause,
      )
    case ErrorCategory.SECURITY:
      return new SecurityError(
        code,
        message,
        context as { input?: string; violationType?: string },
        metadata,
        cause,
      )
    case ErrorCategory.VALIDATION:
      return new ValidationError(
        code,
        message,
        context as { field?: string; value?: unknown; expectedType?: string },
        metadata,
        cause,
      )
    default:
      throw new Error(`Unsupported error category: ${category}`)
  }
}

/**
 * Wraps an existing error in a testkit error
 */
export function wrapError(
  originalError: Error,
  category: ErrorCategory,
  code: ErrorCode,
  additionalMessage?: string,
  context?: Record<string, unknown>,
  metadata?: ErrorMetadata,
): TestkitError {
  const message = additionalMessage
    ? `${additionalMessage}: ${originalError.message}`
    : originalError.message

  return createTestkitError(category, code, message, context, metadata, originalError)
}

/**
 * Error formatter for consistent error messages
 */
export class ErrorFormatter {
  /**
   * Formats an error for user-friendly display
   */
  static formatForUser(error: TestkitError): string {
    const parts = [error.message]

    if (error.metadata.suggestions?.length) {
      parts.push('\nSuggestions:')
      error.metadata.suggestions.forEach((suggestion) => {
        parts.push(`- ${suggestion}`)
      })
    }

    return parts.join('\n')
  }

  /**
   * Formats an error for logging/debugging
   */
  static formatForLogging(error: TestkitError): string {
    return JSON.stringify(error.toJSON(), null, 2)
  }

  /**
   * Creates a concise error summary
   */
  static createSummary(error: TestkitError): string {
    return `[${error.category}:${error.code}] ${error.message}`
  }
}
