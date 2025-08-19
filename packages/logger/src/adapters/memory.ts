/**
 * Memory logger adapter for testing
 */

import type { LogFields, LogLevel, Logger } from '../types.js'

export interface MemoryLogEntry {
  level: LogLevel
  message: string
  fields?: LogFields
  timestamp: string
}

/**
 * Memory logger that stores log entries in memory for testing
 * Used in tests to verify logging behavior
 */
export class MemoryLogger implements Logger {
  private entries: MemoryLogEntry[]
  private context: LogFields

  constructor(context: LogFields = {}, sharedEntries?: MemoryLogEntry[]) {
    this.context = { ...context }
    this.entries = sharedEntries ?? []
  }

  private log(level: LogLevel, message: string, fields?: LogFields): void {
    const entry: MemoryLogEntry = {
      level,
      message,
      fields: fields ? { ...this.context, ...fields } : { ...this.context },
      timestamp: new Date().toISOString(),
    }

    // Only add fields if there are any
    if (!entry.fields || Object.keys(entry.fields).length === 0) {
      delete entry.fields
    }

    this.entries.push(entry)
  }

  trace(message: string, fields?: LogFields): void {
    this.log('trace', message, fields)
  }

  debug(message: string, fields?: LogFields): void {
    this.log('debug', message, fields)
  }

  info(message: string, fields?: LogFields): void {
    this.log('info', message, fields)
  }

  warn(message: string, fields?: LogFields): void {
    this.log('warn', message, fields)
  }

  error(message: string, fields?: LogFields): void {
    this.log('error', message, fields)
  }

  child(bindings: LogFields): Logger {
    return new MemoryLogger({ ...this.context, ...bindings }, this.entries)
  }

  /**
   * Get all log entries
   */
  getEntries(): MemoryLogEntry[] {
    return [...this.entries]
  }

  /**
   * Get log entries filtered by level
   */
  getEntriesByLevel(level: LogLevel): MemoryLogEntry[] {
    return this.entries.filter((entry) => entry.level === level)
  }

  /**
   * Clear all log entries
   */
  clear(): void {
    this.entries.length = 0
  }

  /**
   * Get number of log entries
   */
  count(): number {
    return this.entries.length
  }
}

/**
 * Create a new MemoryLogger instance
 */
export function createMemoryLogger(context?: LogFields): MemoryLogger {
  return new MemoryLogger(context)
}
