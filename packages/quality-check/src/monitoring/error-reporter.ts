import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export interface ErrorContext {
  correlationId: string
  file: string
  operation: string
  timestamp: string
  error: {
    message: string
    stack?: string
    code?: string
  }
  metadata?: Record<string, unknown>
}

export interface ErrorSummary {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByOperation: Record<string, number>
  recentErrors: ErrorContext[]
  commonPatterns: Array<{
    pattern: string
    count: number
    lastSeen: string
  }>
}

/**
 * Enhanced error reporting with correlation ID tracking and debug logging
 */
export class ErrorReporter {
  private static instance: ErrorReporter
  private errorLog: ErrorContext[] = []
  private errorLogPath: string
  private debugLogPath: string
  private readonly maxErrorsInMemory = 100
  private readonly maxErrorsOnDisk = 10000

  private constructor() {
    const homeDir = os.homedir()
    const logsDir = path.join(homeDir, '.claude', 'quality-check', 'logs')
    this.errorLogPath = path.join(logsDir, 'errors.jsonl')
    this.debugLogPath = path.join(logsDir, 'debug.log')
  }

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  /**
   * Log an error with full context
   */
  async logError(context: Omit<ErrorContext, 'timestamp'>): Promise<void> {
    const errorContext: ErrorContext = {
      ...context,
      timestamp: new Date().toISOString(),
    }

    // Add to in-memory log
    this.errorLog.push(errorContext)
    if (this.errorLog.length > this.maxErrorsInMemory) {
      this.errorLog.shift()
    }

    // Persist to disk
    await this.persistError(errorContext)

    // Log to debug file if in debug mode
    if (process.env.CLAUDE_HOOK_DEBUG === 'true') {
      await this.logDebug(errorContext)
    }
  }

  /**
   * Log debug information
   */
  async logDebug(data: unknown): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.debugLogPath), { recursive: true })

      const debugEntry = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        data: typeof data === 'object' ? data : { message: String(data) },
      }

      await fs.appendFile(this.debugLogPath, JSON.stringify(debugEntry) + '\n')
    } catch {
      // Ignore debug logging failures
    }
  }

  /**
   * Get error summary for reporting
   */
  async getErrorSummary(): Promise<ErrorSummary> {
    const allErrors = await this.loadAllErrors()

    // Count errors by type
    const errorsByType: Record<string, number> = {}
    const errorsByOperation: Record<string, number> = {}
    const errorPatterns: Map<string, { count: number; lastSeen: string }> = new Map()

    for (const error of allErrors) {
      // Count by error code or message prefix
      const errorType = error.error.code || error.error.message.split(':')[0]
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1

      // Count by operation
      errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1

      // Track patterns
      const pattern = this.extractPattern(error.error.message)
      const existing = errorPatterns.get(pattern)
      if (existing) {
        existing.count++
        existing.lastSeen = error.timestamp
      } else {
        errorPatterns.set(pattern, {
          count: 1,
          lastSeen: error.timestamp,
        })
      }
    }

    // Get common patterns
    const commonPatterns = Array.from(errorPatterns.entries())
      .map(([pattern, data]) => ({ pattern, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalErrors: allErrors.length,
      errorsByType,
      errorsByOperation,
      recentErrors: allErrors.slice(-10),
      commonPatterns,
    }
  }

  /**
   * Get errors for a specific correlation ID
   */
  async getErrorsByCorrelationId(correlationId: string): Promise<ErrorContext[]> {
    const allErrors = await this.loadAllErrors()
    return allErrors.filter((e) => e.correlationId === correlationId)
  }

  /**
   * Clear old error logs
   */
  async cleanupOldLogs(daysToKeep = 7): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const allErrors = await this.loadAllErrors()
    const recentErrors = allErrors.filter((e) => new Date(e.timestamp) > cutoffDate)

    // Rewrite the error log with only recent errors
    try {
      await fs.mkdir(path.dirname(this.errorLogPath), { recursive: true })
      await fs.writeFile(this.errorLogPath, recentErrors.map((e) => JSON.stringify(e)).join('\n'))
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }

  /**
   * Generate an error report
   */
  async generateErrorReport(): Promise<string> {
    const summary = await this.getErrorSummary()

    const report = `
# Error Report
Generated: ${new Date().toISOString()}

## Summary
- Total Errors: ${summary.totalErrors}

## Errors by Type
${Object.entries(summary.errorsByType)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

## Errors by Operation
${Object.entries(summary.errorsByOperation)
  .sort((a, b) => b[1] - a[1])
  .map(([op, count]) => `- ${op}: ${count}`)
  .join('\n')}

## Common Error Patterns
${summary.commonPatterns
  .map((p) => `- "${p.pattern}": ${p.count} occurrences (last: ${p.lastSeen})`)
  .join('\n')}

## Recent Errors
${summary.recentErrors
  .map((e) => `- [${e.timestamp}] ${e.operation}: ${e.error.message}`)
  .join('\n')}
`

    return report
  }

  /**
   * Extract a pattern from an error message
   */
  private extractPattern(message: string): string {
    // Remove specific values to find common patterns
    return message
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/['"][^'"]+['"]/g, 'STRING') // Replace quoted strings
      .replace(/\/[^/\s]+/g, '/PATH') // Replace paths
      .substring(0, 100) // Limit pattern length
  }

  /**
   * Persist an error to disk
   */
  private async persistError(error: ErrorContext): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.errorLogPath), { recursive: true })
      await fs.appendFile(this.errorLogPath, JSON.stringify(error) + '\n')

      // Rotate log if it gets too large
      await this.rotateLogIfNeeded()
    } catch (err) {
      console.error('Failed to persist error:', err)
    }
  }

  /**
   * Load all errors from disk
   */
  private async loadAllErrors(): Promise<ErrorContext[]> {
    try {
      const data = await fs.readFile(this.errorLogPath, 'utf-8')
      return data
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line) as ErrorContext
          } catch {
            return null
          }
        })
        .filter((e): e is ErrorContext => e !== null)
    } catch {
      return []
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.errorLogPath)

      // Rotate if file is larger than 10MB
      if (stats.size > 10 * 1024 * 1024) {
        const allErrors = await this.loadAllErrors()

        // Keep only the most recent errors
        const recentErrors = allErrors.slice(-this.maxErrorsOnDisk)

        // Archive old log
        const archivePath = this.errorLogPath.replace('.jsonl', `-${Date.now()}.jsonl`)
        await fs.rename(this.errorLogPath, archivePath)

        // Write recent errors to new file
        await fs.writeFile(this.errorLogPath, recentErrors.map((e) => JSON.stringify(e)).join('\n'))
      }
    } catch {
      // Ignore rotation errors
    }
  }
}

/**
 * Create a correlation ID for tracking requests
 */
export function createCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Format error for output with context
 */
export function formatErrorWithContext(error: Error, context: Record<string, unknown>): string {
  const lines = [`Error: ${error.message}`, `Context: ${JSON.stringify(context, null, 2)}`]

  if (error.stack) {
    lines.push(`Stack:\n${error.stack}`)
  }

  return lines.join('\n')
}
