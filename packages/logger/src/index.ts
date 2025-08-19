/**
 * @orchestr8/logger - Structured logging with redaction and correlation support
 */

export { ConsoleLogger, createConsoleLogger } from './adapters/console.js'

// Adapters
export { MemoryLogger, createMemoryLogger } from './adapters/memory.js'
export type { MemoryLogEntry } from './adapters/memory.js'
export { NoopLogger, createNoopLogger } from './adapters/noop.js'

export {
  PinoAdapter,
  createPinoLogger,
  isPinoAvailable,
  createPinoOptions,
} from './adapters/pino.js'
// Utilities
export {
  generateCorrelationId,
  extractCorrelationId,
  CorrelationContext,
} from './correlation.js'
// Logger implementations
export { BaseLogger, DEFAULT_REDACT_KEYS } from './logger.js'

// Re-export env helpers
export {
  getLogLevelFromEnv,
  getPrettyFromEnv,
  getRedactKeysFromEnv,
  getMaxFieldSizeFromEnv,
} from './logger.js'

export { redactString, deepRedact, truncateValue } from './redaction.js'

// Core types and interfaces
export type {
  LogLevel,
  LogFields,
  Logger,
  LoggerOptions,
  LogEntry,
  OrchestrationLogFields,
  MCPLogFields,
} from './types.js'

import type { Logger, LoggerOptions } from './types.js'

import { createConsoleLogger } from './adapters/console.js'
import { createNoopLogger } from './adapters/noop.js'
import { createPinoLogger, isPinoAvailable } from './adapters/pino.js'
import {
  getLogLevelFromEnv,
  getPrettyFromEnv,
  getRedactKeysFromEnv,
  getMaxFieldSizeFromEnv,
} from './logger.js'

/**
 * Create a logger instance with automatic adapter selection.
 *
 * Selection order:
 * 1. If LOG_LEVEL=none or silent, returns NoopLogger
 * 2. If pino is available and not explicitly disabled, uses PinoAdapter
 * 3. Falls back to ConsoleLogger
 *
 * @param options - Logger configuration options
 * @returns Logger instance
 */
export async function createLogger(options?: LoggerOptions): Promise<Logger> {
  // Merge environment configuration with provided options
  const mergedOptions: LoggerOptions = {
    level: options?.level || getLogLevelFromEnv(),
    pretty: options?.pretty ?? getPrettyFromEnv(),
    redactKeys: [...(options?.redactKeys || []), ...getRedactKeysFromEnv()],
    maxFieldSize: options?.maxFieldSize || getMaxFieldSizeFromEnv(),
    ...options,
  }

  // Check if logging is disabled
  const level = mergedOptions.level || 'info'
  if ((level as string) === 'none' || (level as string) === 'silent') {
    return createNoopLogger()
  }

  // Check if we should force console logger
  if (process.env.LOG_ADAPTER === 'console') {
    return createConsoleLogger(mergedOptions)
  }

  // Try to use Pino if available
  if (process.env.LOG_ADAPTER !== 'noop' && (await isPinoAvailable())) {
    try {
      return await createPinoLogger(mergedOptions)
    } catch (error) {
      // Fall back to console if Pino fails
      console.warn(
        'Failed to create Pino logger, falling back to console:',
        error,
      )
      return createConsoleLogger(mergedOptions)
    }
  }

  // Default to console logger
  return createConsoleLogger(mergedOptions)
}

/**
 * Create a logger instance synchronously (console or noop only).
 * Use this when async initialization is not possible.
 */
export function createLoggerSync(options?: LoggerOptions): Logger {
  // Merge environment configuration with provided options
  const mergedOptions: LoggerOptions = {
    level: options?.level || getLogLevelFromEnv(),
    pretty: options?.pretty ?? getPrettyFromEnv(),
    redactKeys: [...(options?.redactKeys || []), ...getRedactKeysFromEnv()],
    maxFieldSize: options?.maxFieldSize || getMaxFieldSizeFromEnv(),
    ...options,
  }

  // Check if logging is disabled
  const level = mergedOptions.level || 'info'
  if ((level as string) === 'none' || (level as string) === 'silent') {
    return createNoopLogger()
  }

  // Return console logger for sync creation
  return createConsoleLogger(mergedOptions)
}

// Default export
export default {
  createLogger,
  createLoggerSync,
  createConsoleLogger,
  createNoopLogger,
  createPinoLogger,
}
