import type { LogFields, Logger, LoggerOptions } from '../types.js'

/**
 * No-op logger that discards all log messages.
 * Useful for testing or when logging should be disabled.
 */
export class NoopLogger implements Logger {
  private readonly bindings: LogFields

  constructor(_options?: LoggerOptions, bindings: LogFields = {}) {
    this.bindings = bindings
  }

  child(bindings: LogFields): Logger {
    return new NoopLogger(undefined, { ...this.bindings, ...bindings })
  }

  trace(_msg: string, _fields?: LogFields): void {
    // No-op
  }

  debug(_msg: string, _fields?: LogFields): void {
    // No-op
  }

  info(_msg: string, _fields?: LogFields): void {
    // No-op
  }

  warn(_msg: string, _fields?: LogFields): void {
    // No-op
  }

  error(_msg: string, _fields?: LogFields): void {
    // No-op
  }
}

/**
 * Create a no-op logger instance
 */
export function createNoopLogger(): Logger {
  return new NoopLogger()
}
