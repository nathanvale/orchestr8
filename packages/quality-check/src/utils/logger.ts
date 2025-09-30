/**
 * Enhanced Logger with Pino - End-to-End Observability
 * Provides structured logging with correlation IDs and pretty printing
 * Now with dual output support and JSON error reporting
 */

import pino from 'pino'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, writeFile, readdir, unlink, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { OutputFormatter } from '../services/OutputFormatter.js'

// Global correlation ID for request tracing
let globalCorrelationId: string | null = null

// Log levels for quality check operations
export enum LogLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}

// Structured log context
export interface LogContext {
  correlationId?: string
  operation?: string
  filePath?: string
  duration?: number
  issues?: number
  action?: string
  phase?: string
  component?: string
  [key: string]: unknown
}

// Logger configuration for dual output support
export interface LoggerConfig {
  console: boolean // Enable/disable console output
  file: boolean // Enable/disable file logging
  silent: boolean // Silent mode for automated tools
  colored: boolean // Enable ANSI colors for console
  outputFormat?: 'minimal' | 'basic' // Console output format style
  logDir?: string // Directory for log files
  retentionPolicy?: {
    errorReports: number // Number of error reports to keep per tool
    debugLogs: number // Number of debug logs to keep
  }
}

// Error report structure for JSON output
export interface ErrorReport {
  timestamp: string
  tool: 'eslint' | 'typescript' | 'prettier'
  status: 'error' | 'warning' | 'success'
  summary: {
    totalErrors: number
    totalWarnings: number
    filesAffected: number
  }
  details: {
    files: Array<{
      path: string
      errors: Array<{
        line: number
        column: number
        message: string
        ruleId?: string
        severity: 'error' | 'warning'
      }>
    }>
  }
  raw: string // Original tool output for debugging
}

class QualityLogger {
  private logger: pino.Logger
  private debugMode: boolean
  private logFile?: string

  constructor() {
    this.debugMode = process.env.CLAUDE_HOOK_DEBUG === 'true'
    this.logFile = process.env.CLAUDE_HOOK_LOG_FILE

    // Enhanced environment detection for noise reduction
    const isCI = process.env.CI === 'true'
    const isVitestSilent = process.env.VITEST_SILENT === 'true'
    const isNodeTest = process.env.NODE_ENV === 'test'
    const isClaudeSilent = process.env.CLAUDE_HOOK_SILENT === 'true'

    // Automatic silencing based on environment
    const shouldBeSilent =
      isClaudeSilent ||
      isVitestSilent ||
      (isNodeTest && !this.debugMode) ||
      (isCI && !this.debugMode)

    // Configure pino with simple setup
    const pinoConfig: pino.LoggerOptions = {
      level: shouldBeSilent ? 'silent' : this.debugMode ? 'debug' : 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    }

    this.logger = pino(pinoConfig)
  }

  private async writeToFile(data: string): Promise<void> {
    if (!this.logFile) return

    try {
      const dir = dirname(this.logFile)
      try {
        await stat(dir)
      } catch {
        await mkdir(dir, { recursive: true })
      }
      await appendFile(this.logFile, data)
    } catch (error) {
      console.error('Failed to write log file:', error)
    }
  }

  private buildContext(context: LogContext = {}): LogContext {
    return {
      correlationId: globalCorrelationId || this.generateCorrelationId(),
      component: 'quality-check',
      ...context,
    }
  }

  private generateCorrelationId(): string {
    if (!globalCorrelationId) {
      globalCorrelationId = randomUUID().slice(0, 8)
    }
    return globalCorrelationId
  }

  // Set correlation ID for request tracing
  setCorrelationId(id?: string): string {
    globalCorrelationId = id || randomUUID().slice(0, 8)
    return globalCorrelationId
  }

  // Get current correlation ID
  getCorrelationId(): string {
    return globalCorrelationId || this.generateCorrelationId()
  }

  // Hook lifecycle logging
  hookStarted(operation: string, filePath: string): void {
    const context = this.buildContext({
      operation,
      filePath,
      phase: 'hook-start',
    })

    const message = `Hook triggered: ${operation} on ${filePath}`
    this.logger.info(context, message)
    this.logToFile('info', message, context)
  }

  hookCompleted(operation: string, filePath: string, duration: number, success: boolean): void {
    const context = this.buildContext({
      operation,
      filePath,
      phase: 'hook-complete',
      duration,
      success,
    })

    const message = `Hook completed: ${success ? 'success' : 'failed'} in ${duration}ms`
    this.logger.info(context, message)
    this.logToFile('info', message, context)
  }

  // Quality check phase logging
  qualityCheckStarted(filePath: string): void {
    const context = this.buildContext({
      filePath,
      phase: 'quality-check-start',
      component: 'checker',
    })

    const message = 'Starting quality check'
    this.logger.debug(context, message)
    this.logToFile('debug', message, context)
  }

  qualityCheckCompleted(filePath: string, issues: number, duration: number): void {
    const context = this.buildContext({
      filePath,
      phase: 'quality-check-complete',
      component: 'checker',
      issues,
      duration,
    })

    const message = `Quality check completed: ${issues} issues found in ${duration}ms`
    this.logger.info(context, message)
    this.logToFile('info', message, context)
  }

  // Autopilot decision logging
  autopilotDecision(filePath: string, action: string, issues: number, reasoning?: string): void {
    const context = this.buildContext({
      filePath,
      phase: 'autopilot-decision',
      component: 'autopilot',
      action,
      issues,
      reasoning,
    })

    const message = `Autopilot decision: ${action} for ${issues} issues`
    this.logger.info(context, message)
    this.logToFile('info', message, context)
  }

  // Auto-fix logging
  autoFixStarted(filePath: string): void {
    const context = this.buildContext({
      filePath,
      phase: 'auto-fix-start',
      component: 'fixer',
    })

    const message = 'Starting auto-fix'
    this.logger.debug(context, message)
    this.logToFile('debug', message, context)
  }

  autoFixCompleted(filePath: string, fixedCount: number, remainingCount: number): void {
    const context = this.buildContext({
      filePath,
      phase: 'auto-fix-complete',
      component: 'fixer',
      fixedCount,
      remainingCount,
    })

    const message = `Auto-fix completed: ${fixedCount} fixed, ${remainingCount} remaining`
    this.logger.info(context, message)
    this.logToFile('info', message, context)
  }

  // Tool execution logging
  toolExecution(tool: string, args: string[], duration: number, exitCode: number): void {
    const context = this.buildContext({
      phase: 'tool-execution',
      component: 'tool-runner',
      tool,
      args,
      duration,
      exitCode,
      success: exitCode === 0,
    })

    const message = `Tool executed: ${tool} (exit: ${exitCode}) in ${duration}ms`
    this.logger.debug(context, message)
    this.logToFile('debug', message, context)
  }

  // Error logging with stack traces
  error(message: string, error?: Error, context: LogContext = {}): void {
    const fullContext = this.buildContext({
      ...context,
      phase: 'error',
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    })

    this.logger.error(fullContext, message)
    this.logToFile('error', message, fullContext)
  }

  // Warn logging
  warn(message: string, context: LogContext = {}): void {
    const fullContext = this.buildContext(context)
    this.logger.warn(fullContext, message)
    this.logToFile('warn', message, fullContext)
  }

  // Info logging
  info(message: string, context: LogContext = {}): void {
    const fullContext = this.buildContext(context)
    this.logger.info(fullContext, message)
    this.logToFile('info', message, fullContext)
  }

  // Debug logging
  debug(message: string, context: LogContext = {}): void {
    const fullContext = this.buildContext(context)
    this.logger.debug(fullContext, message)
    this.logToFile('debug', message, fullContext)
  }

  // Performance timing helper
  time(label: string): () => void {
    const start = Date.now()
    return () => {
      const duration = Date.now() - start
      this.debug(`Timer ${label}`, { duration, phase: 'performance' })
      return duration
    }
  }

  // Payload logging for debugging
  payloadReceived(payload: unknown): void {
    const context = this.buildContext({
      phase: 'payload-received',
      payloadType: typeof payload,
      payloadSize: JSON.stringify(payload).length,
    })

    this.logger.debug(context, 'Payload received')
    this.logToFile('debug', 'Payload received', context)
  }

  payloadValidation(valid: boolean, errors?: string[]): void {
    const context = this.buildContext({
      phase: 'payload-validation',
      valid,
      errors,
    })

    const message = `Payload validation: ${valid ? 'valid' : 'invalid'}`
    this.logger.debug(context, message)
    this.logToFile('debug', message, context)
  }

  private logToFile(level: string, message: string, context: LogContext): void {
    if (!this.logFile) return

    const timestamp = new Date().toISOString()
    const logEntry = `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(context)}\n`
    // Fire-and-forget async operation to avoid breaking sync interface
    this.writeToFile(logEntry).catch((error) => {
      console.error('Failed to write to log file:', error)
    })
  }
}

// Enhanced Logger with dual output support
export class EnhancedLogger extends QualityLogger {
  public config: LoggerConfig
  private logDir: string

  constructor(config?: Partial<LoggerConfig>) {
    super()
    this.config = {
      console: config?.console ?? true,
      file: config?.file ?? false,
      silent: config?.silent ?? this.isEnvironmentSilent(),
      colored: config?.colored ?? true,
      outputFormat: config?.outputFormat ?? 'basic',
      logDir: config?.logDir ?? join(process.cwd(), 'packages', 'quality-check'),
      retentionPolicy: {
        errorReports:
          config?.retentionPolicy?.errorReports ??
          (Number(process.env.LOG_RETENTION_ERROR_REPORTS) || 10),
        debugLogs:
          config?.retentionPolicy?.debugLogs ?? (Number(process.env.LOG_RETENTION_DEBUG_LOGS) || 5),
      },
    }
    this.logDir = this.config.logDir!
  }

  // Ensure log directories exist
  async ensureLogDirectories(): Promise<void> {
    const errorsDir = join(this.logDir, 'logs', 'errors')
    const debugDir = join(this.logDir, 'logs', 'debug')

    try {
      await stat(errorsDir)
    } catch {
      await mkdir(errorsDir, { recursive: true })
    }

    try {
      await stat(debugDir)
    } catch {
      await mkdir(debugDir, { recursive: true })
    }
  }

  // Write error report to JSON file
  async writeErrorReport(report: ErrorReport): Promise<string> {
    await this.ensureLogDirectories()

    // Keep colons in timestamp for consistency
    const filename = `${report.tool}-${report.timestamp}.json`
    const filePath = join(this.logDir, 'logs', 'errors', filename)

    await writeFile(filePath, JSON.stringify(report, null, 2))
    return filePath
  }

  // Write debug log to JSON file
  async writeDebugLog(type: 'run' | 'performance', data: unknown): Promise<string> {
    await this.ensureLogDirectories()

    // Keep colons in timestamp for consistency
    const timestamp = new Date().toISOString()
    const filename = `${type}-${timestamp}.json`
    const filePath = join(this.logDir, 'logs', 'debug', filename)

    await writeFile(filePath, JSON.stringify(data, null, 2))
    return filePath
  }

  // Clean up old logs beyond retention limit
  async cleanupOldLogs(tool: 'eslint' | 'typescript' | 'prettier'): Promise<void> {
    const errorsDir = join(this.logDir, 'logs', 'errors')
    try {
      await stat(errorsDir)
    } catch {
      return // Directory doesn't exist
    }

    const fileList = await readdir(errorsDir)
    const fileStats = await Promise.all(
      fileList
        .filter((f) => f.startsWith(`${tool}-`))
        .map(async (f) => {
          const filePath = join(errorsDir, f)
          const stats = await stat(filePath)
          return {
            name: f,
            path: filePath,
            time: stats.mtime.getTime(),
          }
        }),
    )

    const files = fileStats.sort((a, b) => b.time - a.time)
    const maxReports = this.config.retentionPolicy!.errorReports

    if (files.length > maxReports) {
      const filesToDelete = files.slice(maxReports)
      await Promise.allSettled(filesToDelete.map((f) => unlink(f.path)))
    }
  }

  // Clean up debug logs
  async cleanupDebugLogs(): Promise<void> {
    const debugDir = join(this.logDir, 'logs', 'debug')
    try {
      await stat(debugDir)
    } catch {
      return // Directory doesn't exist
    }

    const fileList = await readdir(debugDir)
    const fileStats = await Promise.all(
      fileList.map(async (f) => {
        const filePath = join(debugDir, f)
        const stats = await stat(filePath)
        return {
          name: f,
          path: filePath,
          time: stats.mtime.getTime(),
        }
      }),
    )

    const files = fileStats.sort((a, b) => b.time - a.time)

    const maxLogs = this.config.retentionPolicy!.debugLogs
    if (files.length > maxLogs) {
      const filesToDelete = files.slice(maxLogs)
      await Promise.allSettled(filesToDelete.map((f) => unlink(f.path)))
    }
  }

  // Log error report with dual output
  async logErrorReport(report: ErrorReport): Promise<void> {
    // Write to file if enabled (even in silent mode for later access)
    if (this.config.file) {
      await this.writeErrorReport(report)
      await this.cleanupOldLogs(report.tool)
    }

    // Write to console if enabled and not in silent mode
    if (this.config.console && !this.config.silent) {
      // Additional check for CI - only show errors
      if (process.env.CI === 'true' && report.status === 'success') {
        return // Skip successful reports in CI
      }
      const summary = this.formatSummary(report)
      console.log(summary)
    }
  }

  // Helper to detect if environment should be silent
  private isEnvironmentSilent(): boolean {
    const isCI = process.env.CI === 'true'
    const isVitestSilent = process.env.VITEST_SILENT === 'true'
    const isNodeTest = process.env.NODE_ENV === 'test'
    const isClaudeSilent = process.env.CLAUDE_HOOK_SILENT === 'true'
    const isDebug = process.env.CLAUDE_HOOK_DEBUG === 'true' || process.env.DEBUG === 'true'

    // Automatic silencing based on environment (unless debug mode)
    return isClaudeSilent || isVitestSilent || (isNodeTest && !isDebug) || (isCI && !isDebug)
  }

  // Format summary for console output
  private formatSummary(report: ErrorReport): string {
    const options = {
      silent: this.config.silent,
      colored: this.config.colored,
    }

    // Use minimal format if configured, otherwise use basic format
    if (this.config.outputFormat === 'minimal') {
      return OutputFormatter.formatMinimalConsole(report, options)
    }

    // Basic format
    const toolNameMap: Record<string, string> = {
      eslint: 'ESLint',
      typescript: 'TypeScript',
      prettier: 'Prettier',
    }
    const toolName = toolNameMap[report.tool] || report.tool

    if (report.status === 'success') {
      return `${toolName}: ✓ No issues found`
    }

    // Handle case where summary might be undefined (e.g., in tests)
    if (!report.summary) {
      return `${toolName}: Error occurred (summary unavailable)`
    }

    const { totalErrors, totalWarnings, filesAffected } = report.summary
    return `${toolName}: ${totalErrors} errors, ${totalWarnings} warnings in ${filesAffected} files`
  }
}

// Helper functions for creating and validating error reports
export function createErrorReport(partial: Omit<ErrorReport, 'timestamp'>): ErrorReport {
  return {
    timestamp: new Date().toISOString(),
    ...partial,
  }
}

export function validateErrorReport(report: unknown): report is ErrorReport {
  if (!report || typeof report !== 'object') return false

  const r = report as Record<string, unknown>

  return (
    typeof r.timestamp === 'string' &&
    ['eslint', 'typescript', 'prettier'].includes(r.tool as string) &&
    ['error', 'warning', 'success'].includes(r.status as string) &&
    typeof r.summary === 'object' &&
    r.summary !== null &&
    typeof (r.summary as Record<string, unknown>).totalErrors === 'number' &&
    typeof (r.summary as Record<string, unknown>).totalWarnings === 'number' &&
    typeof (r.summary as Record<string, unknown>).filesAffected === 'number' &&
    typeof r.details === 'object' &&
    r.details !== null &&
    Array.isArray((r.details as Record<string, unknown>).files)
  )
}

// Export singleton instance
export const logger = new QualityLogger()

// Export timer utility for performance measurement
export function createTimer(label: string) {
  const start = Date.now()
  return {
    end: () => {
      const duration = Date.now() - start
      logger.debug(`Timer: ${label}`, { duration, phase: 'timing' })
      return duration
    },
  }
}
