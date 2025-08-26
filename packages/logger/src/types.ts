/**
 * Core logging types for @orchestr8/logger
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export interface LogFields {
  [key: string]: unknown
}

export interface Logger {
  /**
   * Create a child logger with additional context fields
   */
  child(bindings: LogFields): Logger

  /**
   * Log at trace level (most verbose)
   */
  trace(msg: string, fields?: LogFields): void

  /**
   * Log at debug level
   */
  debug(msg: string, fields?: LogFields): void

  /**
   * Log at info level (default)
   */
  info(msg: string, fields?: LogFields): void

  /**
   * Log at warn level
   */
  warn(msg: string, fields?: LogFields): void

  /**
   * Log at error level (least verbose)
   */
  error(msg: string, fields?: LogFields): void
}

export interface LoggerOptions {
  /**
   * Logger name/component identifier
   */
  name?: string

  /**
   * Minimum log level to output
   * @default 'info'
   */
  level?: LogLevel

  /**
   * Pretty print logs (for development)
   * @default false
   */
  pretty?: boolean

  /**
   * Format nested objects with indented JSON (requires pretty: true)
   * @default false
   */
  prettyJson?: boolean

  /**
   * Additional fields to redact from logs
   * @default []
   */
  redactKeys?: string[]

  /**
   * Maximum size for any field value (bytes)
   * @default 10000
   */
  maxFieldSize?: number

  /**
   * Default context fields for all log entries
   */
  defaultFields?: LogFields

  /**
   * Custom output stream (defaults to process.stderr)
   */
  stream?: NodeJS.WritableStream // eslint-disable-line no-undef
}

export interface LogEntry {
  /**
   * ISO timestamp
   */
  timestamp: string

  /**
   * Log level
   */
  level: LogLevel

  /**
   * Log message
   */
  msg: string

  /**
   * Logger name/component
   */
  name?: string

  /**
   * Additional structured fields
   */
  fields?: LogFields
}

/**
 * Common orchestration event fields
 */
export interface OrchestrationLogFields extends LogFields {
  executionId?: string
  workflowId?: string
  stepId?: string
  agentId?: string
  correlationId?: string
  durationMs?: number
  code?: string
  retryable?: boolean
  attempt?: number
  maxAttempts?: number
  originalSize?: number
  retainedBytes?: number
  truncated?: boolean
}

/**
 * MCP-specific event fields
 */
export interface MCPLogFields extends LogFields {
  tool?: string
  uri?: string
  method?: string
  executionId?: string
  correlationId?: string
  progress?: number
  phase?: string
  eta?: string
  cached?: boolean
  durationMs?: number
  code?: string
  retryable?: boolean
}
