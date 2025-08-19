import type { LogFields, Logger, LoggerOptions } from '../types.js'

import { DEFAULT_REDACT_KEYS } from '../logger.js'

/**
 * Type definitions for Pino (when available as peer dependency)
 */
interface PinoLogger {
  child(bindings: Record<string, unknown>): PinoLogger
  trace(obj: Record<string, unknown>, msg?: string): void
  trace(msg: string): void
  debug(obj: Record<string, unknown>, msg?: string): void
  debug(msg: string): void
  info(obj: Record<string, unknown>, msg?: string): void
  info(msg: string): void
  warn(obj: Record<string, unknown>, msg?: string): void
  warn(msg: string): void
  error(obj: Record<string, unknown>, msg?: string): void
  error(msg: string): void
}

interface PinoOptions {
  name?: string
  level?: string
  redact?: {
    paths: string[]
    censor?: string | ((value: unknown, path: string[]) => unknown)
  }
  transport?: {
    target: string
    options?: Record<string, unknown>
  }
  formatters?: {
    level?: (label: string, number: number) => Record<string, unknown>
    bindings?: (bindings: Record<string, unknown>) => Record<string, unknown>
    log?: (log: Record<string, unknown>) => Record<string, unknown>
  }
  serializers?: Record<string, (value: unknown) => unknown>
  base?: Record<string, unknown> | null
  timestamp?: boolean | (() => string)
}

/**
 * Pino adapter for the Logger interface.
 * Requires 'pino' to be installed as a peer dependency.
 */
export class PinoAdapter implements Logger {
  private readonly pino: PinoLogger

  constructor(pino: PinoLogger) {
    this.pino = pino
  }

  child(bindings: LogFields): Logger {
    return new PinoAdapter(this.pino.child(bindings))
  }

  trace(msg: string, fields?: LogFields): void {
    if (fields) {
      this.pino.trace(fields, msg)
    } else {
      this.pino.trace(msg)
    }
  }

  debug(msg: string, fields?: LogFields): void {
    if (fields) {
      this.pino.debug(fields, msg)
    } else {
      this.pino.debug(msg)
    }
  }

  info(msg: string, fields?: LogFields): void {
    if (fields) {
      this.pino.info(fields, msg)
    } else {
      this.pino.info(msg)
    }
  }

  warn(msg: string, fields?: LogFields): void {
    if (fields) {
      this.pino.warn(fields, msg)
    } else {
      this.pino.warn(msg)
    }
  }

  error(msg: string, fields?: LogFields): void {
    if (fields) {
      this.pino.error(fields, msg)
    } else {
      this.pino.error(msg)
    }
  }
}

/**
 * Create Pino options from LoggerOptions
 */
export function createPinoOptions(options: LoggerOptions = {}): PinoOptions {
  const redactPaths = [...DEFAULT_REDACT_KEYS, ...(options.redactKeys || [])]

  const pinoOptions: PinoOptions = {
    name: options.name,
    level: options.level || 'info',
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    base: options.defaultFields ? { ...options.defaultFields } : undefined,
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  }

  // Add pretty printing transport if enabled
  if (options.pretty) {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  }

  // Add custom serializers for truncation
  if (options.maxFieldSize) {
    pinoOptions.serializers = {
      // Truncate large strings
      ...createTruncationSerializers(options.maxFieldSize),
    }
  }

  return pinoOptions
}

/**
 * Create serializers for truncating large values
 */
function createTruncationSerializers(
  maxSize: number,
): Record<string, (value: unknown) => unknown> {
  const truncate = (value: unknown): unknown => {
    if (typeof value === 'string' && value.length > maxSize) {
      return value.substring(0, maxSize) + '... [TRUNCATED]'
    }
    if (typeof value === 'object' && value !== null) {
      const json = JSON.stringify(value)
      if (json.length > maxSize) {
        return {
          __truncated: true,
          __originalSize: json.length,
          __preview: json.substring(0, Math.min(100, maxSize)) + '...',
        }
      }
    }
    return value
  }

  // Apply truncation to common field names that might have large values
  return {
    data: truncate,
    payload: truncate,
    body: truncate,
    response: truncate,
    request: truncate,
    output: truncate,
    input: truncate,
    result: truncate,
    error: truncate,
    stack: truncate,
  }
}

/**
 * Create a Pino logger instance
 * @throws {Error} If pino is not installed
 */
export async function createPinoLogger(
  options?: LoggerOptions,
): Promise<Logger> {
  try {
    // Dynamically import pino (peer dependency)
    const pinoModule = await import('pino')
    const pino = pinoModule.default || pinoModule.pino

    if (!pino) {
      throw new Error('Failed to import pino')
    }

    const pinoOptions = createPinoOptions(options)
    const pinoLogger = pino(pinoOptions)

    return new PinoAdapter(pinoLogger)
  } catch (error) {
    throw new Error(
      'pino is not installed. Please install it as a dependency: pnpm add pino',
      { cause: error },
    )
  }
}

/**
 * Check if Pino is available
 */
export async function isPinoAvailable(): Promise<boolean> {
  try {
    await import('pino')
    return true
  } catch {
    return false
  }
}
