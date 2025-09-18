/**
 * Error handling types and interfaces for API endpoints
 */

export type ErrorType =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'JSON_PARSE_ERROR'
  | 'CRITICAL'

export type RecoveryAction = 'RETRY' | 'FALLBACK' | 'NONE_AVAILABLE' | 'USER_ACTION_REQUIRED'

export type ExecutionStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'HALTED'

export interface ApiError {
  timestamp: string
  errorType: ErrorType
  errorMessage: string
  statusCode: number
  correlationId?: string
  recoveryAction: RecoveryAction
  executionStatus: ExecutionStatus
  metadata?: Record<string, unknown>
  stack?: string
}

export interface ErrorResponse {
  error: {
    type: ErrorType
    message: string
    code: string
    correlationId?: string
    timestamp: string
    details?: Record<string, unknown>
  }
  success: false
}

export interface ErrorContext {
  correlationId: string
  userId?: string
  endpoint: string
  method: string
  userAgent?: string
  ip?: string
}

export interface ErrorHandlerOptions {
  logErrors?: boolean
  includeStack?: boolean
  sanitizeResponse?: boolean
  correlationIdHeader?: string
}
