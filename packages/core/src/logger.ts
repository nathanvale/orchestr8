/**
 * Logger implementations and utilities
 */

import type { Logger, LogLevel } from './types.js'

/**
 * No-op logger that discards all log entries
 * Used as default when no logger is provided to the orchestration engine
 */
export class NoOpLogger implements Logger {
  log(
    _level: LogLevel,
    _message: string,
    _data?: Record<string, unknown>,
  ): void {
    // No-op: discard all log entries
  }

  trace(_message: string, _data?: Record<string, unknown>): void {
    // No-op
  }

  debug(_message: string, _data?: Record<string, unknown>): void {
    // No-op
  }

  info(_message: string, _data?: Record<string, unknown>): void {
    // No-op
  }

  warn(_message: string, _data?: Record<string, unknown>): void {
    // No-op
  }

  error(_message: string, _data?: Record<string, unknown>): void {
    // No-op
  }

  child(_context: Record<string, unknown>): Logger {
    // Return same no-op logger
    return this
  }
}

/**
 * Memory logger that stores log entries in memory for testing
 * Used in tests to verify logging behavior
 */
export class MemoryLogger implements Logger {
  private entries: Array<{
    level: LogLevel
    message: string
    data?: Record<string, unknown>
    timestamp: string
  }>

  private context: Record<string, unknown> = {}

  constructor(
    context: Record<string, unknown> = {},
    sharedEntries?: Array<{
      level: LogLevel
      message: string
      data?: Record<string, unknown>
      timestamp: string
    }>,
  ) {
    this.context = { ...context }
    this.entries = sharedEntries ?? []
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.entries.push({
      level,
      message,
      data: data ? { ...this.context, ...data } : { ...this.context },
      timestamp: new Date().toISOString(),
    })
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.log('trace', message, data)
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data)
  }

  child(context: Record<string, unknown>): Logger {
    return new MemoryLogger({ ...this.context, ...context }, this.entries)
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
    return [...this.entries]
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
    return this.entries.filter((entry) => entry.level === level)
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries = []
  }

  /**
   * Get number of log entries
   */
  count(): number {
    return this.entries.length
  }
}
