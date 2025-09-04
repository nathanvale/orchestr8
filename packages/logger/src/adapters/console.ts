import type { LogFields, LogLevel, Logger, LoggerOptions } from '../types.js'

import { BaseLogger } from '../logger.js'

/**
 * ANSI color codes for pretty printing
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const

/**
 * Level colors for pretty printing
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: COLORS.gray,
  debug: COLORS.cyan,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
}

/**
 * Level labels for pretty printing
 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
}

/**
 * Console logger implementation using console methods.
 * Supports both JSON and pretty-printed output.
 */
export class ConsoleLogger extends BaseLogger {
  private readonly stream: NodeJS.WritableStream // eslint-disable-line no-undef

  constructor(options: LoggerOptions = {}, bindings: LogFields = {}) {
    super(options, bindings)
    this.stream = options.stream || process.stderr
  }

  child(bindings: LogFields): Logger {
    return new ConsoleLogger(
      {
        name: this.name,
        level: this.level,
        pretty: this.pretty,
        prettyJson: this.prettyJson,
        redactKeys: Array.from(this.redactKeys),
        maxFieldSize: this.maxFieldSize,
        defaultFields: this.defaultFields,
        stream: this.stream,
      },
      { ...this.bindings, ...bindings },
    )
  }

  protected log(level: LogLevel, msg: string, fields?: LogFields): void {
    if (!this.shouldLog(level)) {
      return
    }

    const mergedFields = this.mergeFields(fields)
    const redactedFields = this.redactFields(mergedFields)

    if (this.pretty) {
      this.logPretty(level, msg, redactedFields)
    } else {
      this.logJSON(level, msg, redactedFields)
    }
  }

  private logJSON(level: LogLevel, msg: string, fields: LogFields): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      msg,
      ...(this.name && { name: this.name }),
      ...fields,
    }

    // Handle circular references with a replacer function
    const seen = new WeakSet()
    const json = JSON.stringify(entry, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      return value
    })

    this.stream.write(json + '\n')
  }

  private logPretty(level: LogLevel, msg: string, fields: LogFields): void {
    const timestamp = new Date().toISOString()
    const levelColor = LEVEL_COLORS[level]
    const levelLabel = LEVEL_LABELS[level]

    // Build the log line
    let line = `${COLORS.gray}${timestamp}${COLORS.reset} `
    line += `${levelColor}${levelLabel}${COLORS.reset} `

    if (this.name) {
      line += `${COLORS.magenta}[${this.name}]${COLORS.reset} `
    }

    line += `${COLORS.bright}${msg}${COLORS.reset}`

    // Add fields if present
    if (Object.keys(fields).length > 0) {
      line += ' ' + this.formatFields(fields)
    }

    this.stream.write(line + '\n')
  }

  private formatFields(fields: LogFields): string {
    const entries: string[] = []

    for (const [key, value] of Object.entries(fields)) {
      if (value === null || value === undefined) {
        entries.push(
          `${COLORS.blue}${key}${COLORS.reset}=${COLORS.gray}${value}${COLORS.reset}`,
        )
      } else if (typeof value === 'string') {
        // Quote strings if they contain spaces
        const displayValue = value.includes(' ') ? `"${value}"` : value
        entries.push(`${COLORS.blue}${key}${COLORS.reset}=${displayValue}`)
      } else if (typeof value === 'number') {
        entries.push(
          `${COLORS.blue}${key}${COLORS.reset}=${COLORS.yellow}${value}${COLORS.reset}`,
        )
      } else if (typeof value === 'boolean') {
        const color = value ? COLORS.green : COLORS.red
        entries.push(
          `${COLORS.blue}${key}${COLORS.reset}=${color}${value}${COLORS.reset}`,
        )
      } else if (typeof value === 'object') {
        // For nested objects, respect prettyJson setting
        try {
          if (this.prettyJson) {
            // Always use pretty formatting when prettyJson is enabled
            const prettyJson = JSON.stringify(value, null, 2)
            if (prettyJson.includes('\n')) {
              // Multi-line object - add newlines and indentation
              entries.push(
                `${COLORS.blue}${key}${COLORS.reset}=\n${prettyJson}`,
              )
            } else {
              // Single-line objects stay inline
              entries.push(`${COLORS.blue}${key}${COLORS.reset}=${prettyJson}`)
            }
          } else {
            // Original logic: inline if small, otherwise multi-line
            const json = JSON.stringify(value)
            if (json.length < 50) {
              entries.push(`${COLORS.blue}${key}${COLORS.reset}=${json}`)
            } else {
              entries.push(
                `${COLORS.blue}${key}${COLORS.reset}=${JSON.stringify(value, null, 2)}`,
              )
            }
          }
        } catch {
          // Handle circular references
          entries.push(`${COLORS.blue}${key}${COLORS.reset}=[Circular]`)
        }
      } else {
        entries.push(`${COLORS.blue}${key}${COLORS.reset}=${value}`)
      }
    }

    return entries.join(' ')
  }
}

/**
 * Create a console logger instance with environment-based configuration
 */
export function createConsoleLogger(options?: LoggerOptions): Logger {
  return new ConsoleLogger({
    level: options?.level || (process.env.LOG_LEVEL as LogLevel) || 'info',
    pretty: options?.pretty ?? process.env.LOG_PRETTY === 'true',
    prettyJson: options?.prettyJson ?? process.env.LOG_PRETTY_JSON === 'true',
    ...options,
  })
}
