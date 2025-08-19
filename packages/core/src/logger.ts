/**
 * Logger compatibility layer and exports
 * This file provides a bridge between the core Logger interface and @orchestr8/logger
 */

import {
  NoopLogger as BaseNoopLogger,
  MemoryLogger as BaseMemoryLogger,
  type Logger as LoggerPackageLogger,
  type LogFields,
} from '@orchestr8/logger'

import type { Logger, LogLevel } from './types.js'

/**
 * Adapter to make @orchestr8/logger compatible with core's Logger interface
 */
class LoggerAdapter implements Logger {
  constructor(private readonly logger: LoggerPackageLogger) {}

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const fields = data as LogFields | undefined
    switch (level) {
      case 'trace':
        this.logger.trace(message, fields)
        break
      case 'debug':
        this.logger.debug(message, fields)
        break
      case 'info':
        this.logger.info(message, fields)
        break
      case 'warn':
        this.logger.warn(message, fields)
        break
      case 'error':
        this.logger.error(message, fields)
        break
    }
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.trace(message, data as LogFields | undefined)
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(message, data as LogFields | undefined)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(message, data as LogFields | undefined)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(message, data as LogFields | undefined)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(message, data as LogFields | undefined)
  }

  child(context: Record<string, unknown>): Logger {
    return new LoggerAdapter(this.logger.child(context as LogFields))
  }
}

/**
 * No-op logger that discards all log entries
 * Used as default when no logger is provided to the orchestration engine
 */
export class NoOpLogger extends LoggerAdapter {
  constructor() {
    super(new BaseNoopLogger())
  }
}

/**
 * Memory logger that stores log entries in memory for testing
 * Used in tests to verify logging behavior
 */
export class MemoryLogger extends LoggerAdapter {
  public memoryLogger: BaseMemoryLogger

  constructor(
    context: Record<string, unknown> = {},
    baseLogger?: BaseMemoryLogger,
  ) {
    const memLogger = baseLogger || new BaseMemoryLogger(context as LogFields)
    super(memLogger)
    this.memoryLogger = memLogger
  }

  /**
   * Get all log entries
   */
  getEntries(): Array<{
    level: LogLevel
    message: string
    data?: Record<string, unknown>
    timestamp: string
  }> {
    return this.memoryLogger.getEntries().map((entry) => ({
      level: entry.level,
      message: entry.message,
      data: entry.fields || {},
      timestamp: entry.timestamp,
    }))
  }

  /**
   * Get log entries filtered by level
   */
  getEntriesByLevel(level: LogLevel): Array<{
    level: LogLevel
    message: string
    data?: Record<string, unknown>
    timestamp: string
  }> {
    return this.memoryLogger.getEntriesByLevel(level).map((entry) => ({
      level: entry.level,
      message: entry.message,
      data: entry.fields || {},
      timestamp: entry.timestamp,
    }))
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.memoryLogger.clear()
  }

  /**
   * Get number of log entries
   */
  count(): number {
    return this.memoryLogger.count()
  }

  child(context: Record<string, unknown>): MemoryLogger {
    const childLogger = this.memoryLogger.child(
      context as LogFields,
    ) as BaseMemoryLogger
    return new MemoryLogger(context, childLogger)
  }
}
