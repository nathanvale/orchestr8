/**
 * Error codes for execution failures
 */
export const ExecutionErrorCode = {
  TIMEOUT: 'TIMEOUT',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  /** @deprecated Use CIRCUIT_BREAKER_OPEN instead */
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  CANCELLED: 'CANCELLED',
  VALIDATION: 'VALIDATION',
  RETRYABLE: 'RETRYABLE',
  UNKNOWN: 'UNKNOWN',
} as const

export type ExecutionErrorCodeType =
  (typeof ExecutionErrorCode)[keyof typeof ExecutionErrorCode]

/**
 * Standard error structure for workflow execution failures
 * Based on spec requirements at lines 105-119
 */
export interface ExecutionError {
  /**
   * Error classification code
   */
  code: ExecutionErrorCodeType

  /**
   * Human-readable error message
   */
  message: string

  /**
   * Step ID where the error occurred
   */
  stepId?: string

  /**
   * Attempt number when the error occurred (for retries)
   */
  attempt?: number

  /**
   * Underlying cause if this error wraps another
   */
  cause?: Error | ExecutionError

  /**
   * Additional context data for debugging
   */
  context?: Record<string, unknown>

  /**
   * Timestamp when error occurred
   */
  timestamp: string
}

/**
 * Create an ExecutionError with proper structure
 */
export function createExecutionError(
  code: ExecutionErrorCodeType,
  message: string,
  options?: {
    stepId?: string
    attempt?: number
    cause?: Error | ExecutionError
    context?: Record<string, unknown>
  },
): ExecutionError {
  return {
    code,
    message,
    stepId: options?.stepId,
    attempt: options?.attempt,
    cause: options?.cause,
    context: options?.context,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Type guard to check if an error is an ExecutionError
 */
export function isExecutionError(error: unknown): error is ExecutionError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error &&
    Object.values(ExecutionErrorCode).includes((error as ExecutionError).code)
  )
}
