/**
 * Enhanced Logger with Pino - End-to-End Observability
 * Provides structured logging with correlation IDs and pretty printing
 */

import pino from 'pino'
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Global correlation ID for request tracing
let globalCorrelationId: string | null = null

// Log levels for quality check operations
export enum LogLevel {
  TRACE = 10,
  DEBUG = 20, 
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60
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

class QualityLogger {
  private logger: pino.Logger
  private debugMode: boolean
  private logFile?: string

  constructor() {
    this.debugMode = process.env.CLAUDE_HOOK_DEBUG === 'true'
    this.logFile = process.env.CLAUDE_HOOK_LOG_FILE

    // Configure pino with simple setup
    const pinoConfig: pino.LoggerOptions = {
      level: this.debugMode ? 'debug' : 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label })
      }
    }

    this.logger = pino(pinoConfig)
  }

  private writeToFile(data: string): void {
    if (!this.logFile) return
    
    try {
      const dir = dirname(this.logFile)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      appendFileSync(this.logFile, data)
    } catch (error) {
      console.error('Failed to write log file:', error)
    }
  }

  private buildContext(context: LogContext = {}): LogContext {
    return {
      correlationId: globalCorrelationId || this.generateCorrelationId(),
      component: 'quality-check',
      ...context
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
      phase: 'hook-start'
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
      success
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
      component: 'checker'
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
      duration
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
      reasoning
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
      component: 'fixer'
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
      remainingCount
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
      success: exitCode === 0
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
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
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
      payloadSize: JSON.stringify(payload).length
    })
    
    this.logger.debug(context, 'Payload received')
    this.logToFile('debug', 'Payload received', context)
  }

  payloadValidation(valid: boolean, errors?: string[]): void {
    const context = this.buildContext({
      phase: 'payload-validation',
      valid,
      errors
    })
    
    const message = `Payload validation: ${valid ? 'valid' : 'invalid'}`
    this.logger.debug(context, message)
    this.logToFile('debug', message, context)
  }

  private logToFile(level: string, message: string, context: LogContext): void {
    if (!this.logFile) return
    
    const timestamp = new Date().toISOString()
    const logEntry = `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(context)}\n`
    this.writeToFile(logEntry)
  }
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
    }
  }
}