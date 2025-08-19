import type { LogFields, LogLevel, Logger, LoggerOptions } from './types.js'

/**
 * Default keys to redact from logs
 */
export const DEFAULT_REDACT_KEYS = [
  'authorization',
  'apiKey',
  'token',
  'password',
  'secret',
  'headers.authorization',
  'api_key',
  'access_token',
  'refresh_token',
  'private_key',
  'client_secret',
]

/**
 * Map log levels to numeric values for comparison
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
}

/**
 * Base logger implementation with common functionality
 */
export abstract class BaseLogger implements Logger {
  protected readonly name?: string
  protected readonly level: LogLevel
  protected readonly pretty: boolean
  protected readonly redactKeys: Set<string>
  protected readonly maxFieldSize: number
  protected readonly defaultFields: LogFields
  protected readonly bindings: LogFields

  constructor(options: LoggerOptions = {}, bindings: LogFields = {}) {
    this.name = options.name
    this.level = options.level || 'info'
    this.pretty = options.pretty || false
    this.maxFieldSize = options.maxFieldSize || 10000
    this.defaultFields = options.defaultFields || {}
    this.bindings = bindings

    // Combine default and custom redact keys
    this.redactKeys = new Set([
      ...DEFAULT_REDACT_KEYS,
      ...(options.redactKeys || []),
    ])
  }

  abstract child(bindings: LogFields): Logger

  trace(msg: string, fields?: LogFields): void {
    this.log('trace', msg, fields)
  }

  debug(msg: string, fields?: LogFields): void {
    this.log('debug', msg, fields)
  }

  info(msg: string, fields?: LogFields): void {
    this.log('info', msg, fields)
  }

  warn(msg: string, fields?: LogFields): void {
    this.log('warn', msg, fields)
  }

  error(msg: string, fields?: LogFields): void {
    this.log('error', msg, fields)
  }

  protected shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  protected redactFields(fields: LogFields): LogFields {
    const redacted: LogFields = {}

    for (const [key, value] of Object.entries(fields)) {
      if (this.shouldRedact(key)) {
        redacted[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects
        redacted[key] = this.redactFields(value as LogFields)
      } else if (
        typeof value === 'string' &&
        value.length > this.maxFieldSize
      ) {
        // Truncate large strings
        redacted[key] =
          value.substring(0, this.maxFieldSize) + '... [TRUNCATED]'
      } else {
        redacted[key] = value
      }
    }

    return redacted
  }

  protected shouldRedact(key: string): boolean {
    // Check exact match
    if (this.redactKeys.has(key)) {
      return true
    }

    // Check case-insensitive match for common sensitive keys
    const lowerKey = key.toLowerCase()
    for (const redactKey of this.redactKeys) {
      if (lowerKey.includes(redactKey.toLowerCase())) {
        return true
      }
    }

    return false
  }

  protected mergeFields(fields?: LogFields): LogFields {
    return {
      ...this.defaultFields,
      ...this.bindings,
      ...(fields || {}),
    }
  }

  protected abstract log(level: LogLevel, msg: string, fields?: LogFields): void
}

/**
 * Get log level from environment variable
 */
export function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel
  }
  return 'info'
}

/**
 * Check if pretty printing is enabled from environment
 */
export function getPrettyFromEnv(): boolean {
  return process.env.LOG_PRETTY === 'true'
}

/**
 * Get additional redact keys from environment
 */
export function getRedactKeysFromEnv(): string[] {
  const envRedact = process.env.LOG_REDACT
  if (!envRedact) {
    return []
  }
  return envRedact.split(',').map((key) => key.trim())
}

/**
 * Get max field size from environment
 */
export function getMaxFieldSizeFromEnv(): number {
  const envSize = process.env.LOG_MAX_FIELD_SIZE
  if (envSize) {
    const size = parseInt(envSize, 10)
    if (!isNaN(size) && size > 0) {
      return size
    }
  }
  return 10000
}
