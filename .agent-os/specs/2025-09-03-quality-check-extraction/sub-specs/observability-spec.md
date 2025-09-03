# Observability Specification

This is the observability specification for the spec detailed in
@.agent-os/specs/2025-09-03-quality-check-extraction/spec.md

> Created: 2025-09-03  
> Version: 2.0.0

## Correlation ID System

### ID Generation Strategy

```typescript
export class CorrelationIdGenerator {
  private readonly prefix = 'qc'
  private readonly nodeId = process.pid.toString(36)

  generate(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `${this.prefix}-${this.nodeId}-${timestamp}-${random}`
  }

  validate(id: string): boolean {
    const pattern = /^qc-[a-z0-9]+-[a-z0-9]+-[a-z0-9]{5}$/
    return pattern.test(id)
  }
}
```

### Context Propagation

```typescript
export class CorrelationContext {
  private static readonly storage = new AsyncLocalStorage<Context>()

  static run<T>(correlationId: string, fn: () => T): T {
    const context: Context = {
      correlationId,
      startTime: Date.now(),
      metadata: new Map(),
    }

    return this.storage.run(context, fn)
  }

  static get(): Context | undefined {
    return this.storage.getStore()
  }

  static addMetadata(key: string, value: any): void {
    const context = this.get()
    if (context) {
      context.metadata.set(key, value)
    }
  }
}

interface Context {
  correlationId: string
  startTime: number
  metadata: Map<string, any>
}
```

## Structured Logging

### Logger Implementation (@orchestr8/logger Integration)

```typescript
import { createLogger as createOrchestLogger } from '@orchestr8/logger'

export function createLogger(component: string) {
  const baseLogger = createOrchestLogger({
    service: 'quality-check',
    component,
    format: 'json',
    level: process.env.LOG_LEVEL || 'info',
  })

  return {
    debug: (message: string, data?: any) => {
      const context = CorrelationContext.get()
      baseLogger.debug(message, {
        ...data,
        correlationId: context?.correlationId,
        component,
      })
    },

    info: (message: string, data?: any) => {
      const context = CorrelationContext.get()
      baseLogger.info(message, {
        ...data,
        correlationId: context?.correlationId,
        component,
      })
    },

    warn: (message: string, data?: any) => {
      const context = CorrelationContext.get()
      baseLogger.warn(message, {
        ...data,
        correlationId: context?.correlationId,
        component,
      })
    },

    error: (message: string, error?: Error, data?: any) => {
      const context = CorrelationContext.get()
      baseLogger.error(message, {
        ...data,
        correlationId: context?.correlationId,
        component,
        error: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      })
    },
  }
}
```

### Log Format Specification

```typescript
interface LogEntry {
  timestamp: string // ISO 8601 format
  level: LogLevel // debug, info, warn, error
  service: string // 'quality-check'
  component: string // Specific component name
  correlationId: string // Unique request ID
  message: string // Human-readable message
  data?: Record<string, any> // Additional structured data
  error?: {
    message: string
    stack?: string
    name: string
  }
  performance?: {
    duration: number // Milliseconds
    memory: number // Bytes
  }
}

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}
```

## Performance Metrics

### Metric Collection

```typescript
export class PerformanceMetrics {
  private readonly metrics = new Map<string, Metric>()

  startTimer(name: string): () => void {
    const start = performance.now()
    const startMemory = process.memoryUsage()

    return () => {
      const duration = performance.now() - start
      const endMemory = process.memoryUsage()

      this.recordMetric(name, {
        duration,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        timestamp: Date.now(),
      })
    }
  }

  recordMetric(name: string, metric: Metric): void {
    this.metrics.set(name, metric)

    // Log metric for observability
    const logger = createLogger('metrics')
    logger.info('Performance metric recorded', {
      metric: name,
      duration: `${metric.duration.toFixed(2)}ms`,
      memory: `${(metric.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
    })
  }

  getMetrics(): Record<string, Metric> {
    return Object.fromEntries(this.metrics)
  }

  reset(): void {
    this.metrics.clear()
  }
}

interface Metric {
  duration: number // Milliseconds
  memoryDelta: number // Bytes
  timestamp: number // Unix timestamp
}
```

### Key Performance Indicators

```typescript
export class QualityCheckMetrics {
  private readonly kpis = {
    totalExecutionTime: 0,
    eslintTime: 0,
    prettierTime: 0,
    typescriptTime: 0,
    fileOperationTime: 0,
    cacheHitRate: 0,
    fixesApplied: 0,
    errorsFound: 0,
    warningsFound: 0,
  }

  recordValidation(checker: string, result: ValidationResult): void {
    const duration = result.endTime - result.startTime

    switch (checker) {
      case 'eslint':
        this.kpis.eslintTime += duration
        break
      case 'prettier':
        this.kpis.prettierTime += duration
        break
      case 'typescript':
        this.kpis.typescriptTime += duration
        break
    }

    this.kpis.errorsFound += result.errors
    this.kpis.warningsFound += result.warnings
    this.kpis.fixesApplied += result.fixes
  }

  recordCacheHit(hit: boolean): void {
    // Rolling average calculation
    const alpha = 0.1 // Smoothing factor
    const hitValue = hit ? 1 : 0
    this.kpis.cacheHitRate =
      alpha * hitValue + (1 - alpha) * this.kpis.cacheHitRate
  }

  getSummary(): KPISummary {
    return {
      ...this.kpis,
      cacheHitRate: Math.round(this.kpis.cacheHitRate * 100),
      avgCheckerTime:
        (this.kpis.eslintTime +
          this.kpis.prettierTime +
          this.kpis.typescriptTime) /
        3,
    }
  }
}
```

## Debug Mode

### Debug Logger Configuration

```typescript
export class DebugLogger {
  private readonly enabled: boolean
  private readonly verbose: boolean
  private readonly traceFile?: string

  constructor() {
    this.enabled =
      process.env.DEBUG === 'true' || process.env.DEBUG === 'quality-check'
    this.verbose = process.env.VERBOSE === 'true'
    this.traceFile = process.env.QUALITY_CHECK_TRACE_FILE

    if (this.traceFile) {
      this.initTraceFile()
    }
  }

  private initTraceFile(): void {
    const header = `# Quality Check Trace Log
# Started: ${new Date().toISOString()}
# PID: ${process.pid}
# Node: ${process.version}
${'='.repeat(60)}

`
    fs.writeFileSync(this.traceFile!, header)
  }

  trace(category: string, message: string, data?: any): void {
    if (!this.enabled) return

    const timestamp = new Date().toISOString()
    const correlationId = CorrelationContext.get()?.correlationId

    const logLine = {
      timestamp,
      correlationId,
      category,
      message,
      data,
    }

    // Console output for immediate feedback
    if (this.verbose) {
      console.debug(
        `[${timestamp}] [${category}] ${message}`,
        data ? JSON.stringify(data, null, 2) : '',
      )
    }

    // File output for analysis
    if (this.traceFile) {
      fs.appendFileSync(this.traceFile, JSON.stringify(logLine) + '\n')
    }
  }

  startSection(name: string): () => void {
    this.trace('section', `Starting: ${name}`)
    const start = performance.now()

    return () => {
      const duration = performance.now() - start
      this.trace('section', `Completed: ${name}`, {
        duration: `${duration.toFixed(2)}ms`,
      })
    }
  }
}
```

### Debug Categories

```typescript
export enum DebugCategory {
  CONFIG = 'config', // Configuration resolution
  CACHE = 'cache', // Cache operations
  CHECKER = 'checker', // Individual checker execution
  FILE_OP = 'file_op', // File operations
  PARSER = 'parser', // JSON/input parsing
  PERF = 'performance', // Performance measurements
  MEMORY = 'memory', // Memory usage tracking
  ERROR = 'error', // Error details
  GIT = 'git', // Git operations
  SECURITY = 'security', // Security validations
}
```

## Event Tracking

### Event System

```typescript
export class EventTracker {
  private readonly events: Event[] = []
  private readonly maxEvents = 1000

  track(type: EventType, data: any): void {
    const event: Event = {
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      correlationId: CorrelationContext.get()?.correlationId,
      data,
    }

    this.events.push(event)

    // Circular buffer behavior
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }

    // Emit to logger
    const logger = createLogger('events')
    logger.debug(`Event: ${type}`, data)
  }

  getEvents(correlationId?: string): Event[] {
    if (correlationId) {
      return this.events.filter((e) => e.correlationId === correlationId)
    }
    return [...this.events]
  }

  getEventStats(): EventStats {
    const stats: EventStats = {}

    for (const event of this.events) {
      stats[event.type] = (stats[event.type] || 0) + 1
    }

    return stats
  }
}

enum EventType {
  VALIDATION_START = 'validation_start',
  VALIDATION_END = 'validation_end',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  ERROR_FOUND = 'error_found',
  FIX_APPLIED = 'fix_applied',
  CONFIG_LOADED = 'config_loaded',
}

interface Event {
  id: string
  type: EventType
  timestamp: number
  correlationId?: string
  data: any
}

type EventStats = Record<EventType, number>
```

## Error Classification

### Error Categorization

```typescript
export class ErrorClassifier {
  classify(error: Error): ErrorClassification {
    const classification: ErrorClassification = {
      category: this.getCategory(error),
      severity: this.getSeverity(error),
      recoverable: this.isRecoverable(error),
      userAction: this.getUserAction(error),
      correlationId: CorrelationContext.get()?.correlationId,
    }

    // Log classified error
    const logger = createLogger('error-classifier')
    logger.error('Error classified', error, classification)

    return classification
  }

  private getCategory(error: Error): ErrorCategory {
    if (error.message.includes('ENOENT')) {
      return ErrorCategory.FILE_NOT_FOUND
    }
    if (error.message.includes('EACCES')) {
      return ErrorCategory.PERMISSION_DENIED
    }
    if (error.message.includes('timeout')) {
      return ErrorCategory.TIMEOUT
    }
    if (error.message.includes('syntax')) {
      return ErrorCategory.SYNTAX_ERROR
    }
    if (error.message.includes('config')) {
      return ErrorCategory.CONFIGURATION
    }
    return ErrorCategory.UNKNOWN
  }

  private getSeverity(error: Error): ErrorSeverity {
    const category = this.getCategory(error)

    switch (category) {
      case ErrorCategory.FILE_NOT_FOUND:
      case ErrorCategory.PERMISSION_DENIED:
        return ErrorSeverity.CRITICAL
      case ErrorCategory.TIMEOUT:
        return ErrorSeverity.WARNING
      case ErrorCategory.SYNTAX_ERROR:
        return ErrorSeverity.ERROR
      case ErrorCategory.CONFIGURATION:
        return ErrorSeverity.ERROR
      default:
        return ErrorSeverity.INFO
    }
  }

  private isRecoverable(error: Error): boolean {
    const category = this.getCategory(error)
    return (
      category === ErrorCategory.TIMEOUT ||
      category === ErrorCategory.SYNTAX_ERROR
    )
  }

  private getUserAction(error: Error): string {
    const category = this.getCategory(error)

    switch (category) {
      case ErrorCategory.FILE_NOT_FOUND:
        return 'Check file path and ensure file exists'
      case ErrorCategory.PERMISSION_DENIED:
        return 'Check file permissions'
      case ErrorCategory.TIMEOUT:
        return 'Retry operation or increase timeout'
      case ErrorCategory.SYNTAX_ERROR:
        return 'Fix syntax errors in file'
      case ErrorCategory.CONFIGURATION:
        return 'Check configuration file format'
      default:
        return 'Check logs for details'
    }
  }
}

enum ErrorCategory {
  FILE_NOT_FOUND = 'file_not_found',
  PERMISSION_DENIED = 'permission_denied',
  TIMEOUT = 'timeout',
  SYNTAX_ERROR = 'syntax_error',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown',
}

enum ErrorSeverity {
  CRITICAL = 'critical',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

interface ErrorClassification {
  category: ErrorCategory
  severity: ErrorSeverity
  recoverable: boolean
  userAction: string
  correlationId?: string
}
```

## Output Formatting

### Claude Code Integration Output

```typescript
export class OutputFormatter {
  private readonly isClaudeCode: boolean
  private readonly correlationId: string

  constructor(correlationId: string) {
    this.correlationId = correlationId
    this.isClaudeCode = process.env.CLAUDE_PROJECT_DIR !== undefined
  }

  formatResult(result: QualityCheckResult): void {
    if (this.isClaudeCode) {
      this.formatForClaude(result)
    } else {
      this.formatForCLI(result)
    }

    // Always log structured result
    const logger = createLogger('output')
    logger.info('Quality check completed', {
      correlationId: this.correlationId,
      errors: result.errorCount,
      warnings: result.warningCount,
      fixes: result.fixCount,
      duration: result.duration,
    })
  }

  private formatForClaude(result: QualityCheckResult): void {
    // Minimal output for Claude Code
    if (result.errorCount > 0) {
      console.error(`❌ ${result.errorCount} errors found`)
      result.errors.forEach((err) => {
        console.error(`  ${err.file}:${err.line} - ${err.message}`)
      })
    }

    if (result.fixCount > 0) {
      console.log(`✅ ${result.fixCount} fixes applied`)
    }

    // Include correlation ID for debugging
    console.log(`[${this.correlationId}]`)
  }

  private formatForCLI(result: QualityCheckResult): void {
    // Rich output for direct CLI usage
    console.log('\n' + '='.repeat(60))
    console.log('Quality Check Results')
    console.log('='.repeat(60))

    console.log(`\nCorrelation ID: ${this.correlationId}`)
    console.log(`Duration: ${result.duration}ms`)
    console.log(`Cache Hit Rate: ${result.cacheHitRate}%`)

    if (result.errorCount > 0) {
      console.log('\n❌ Errors:')
      result.errors.forEach((err) => {
        console.log(`  ${err.file}:${err.line}:${err.column}`)
        console.log(`    ${err.rule}: ${err.message}`)
      })
    }

    if (result.warningCount > 0) {
      console.log('\n⚠️  Warnings:')
      result.warnings.forEach((warn) => {
        console.log(`  ${warn.file}:${warn.line}:${warn.column}`)
        console.log(`    ${warn.rule}: ${warn.message}`)
      })
    }

    if (result.fixCount > 0) {
      console.log(`\n✅ ${result.fixCount} fixes applied successfully`)
    }

    console.log('\n' + '='.repeat(60))
  }
}
```

## Telemetry (Optional)

### Anonymous Usage Metrics

```typescript
export class Telemetry {
  private readonly enabled: boolean
  private readonly endpoint?: string
  private readonly buffer: TelemetryEvent[] = []
  private readonly flushInterval = 60000 // 1 minute

  constructor() {
    this.enabled = process.env.QUALITY_CHECK_TELEMETRY === 'true'
    this.endpoint = process.env.QUALITY_CHECK_TELEMETRY_ENDPOINT

    if (this.enabled && this.endpoint) {
      this.startFlushing()
    }
  }

  private startFlushing(): void {
    setInterval(() => {
      void this.flush()
    }, this.flushInterval)
  }

  record(event: string, properties?: Record<string, any>): void {
    if (!this.enabled) return

    const telemetryEvent: TelemetryEvent = {
      event,
      timestamp: Date.now(),
      properties: {
        ...properties,
        version: process.env.npm_package_version,
        node: process.version,
        platform: process.platform,
      },
    }

    this.buffer.push(telemetryEvent)
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.endpoint) return

    const events = [...this.buffer]
    this.buffer.length = 0

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      })
    } catch (error) {
      // Silently fail - never interrupt user flow
      const logger = createLogger('telemetry')
      logger.debug('Telemetry flush failed', { error })
    }
  }
}

interface TelemetryEvent {
  event: string
  timestamp: number
  properties?: Record<string, any>
}
```

## Environment Variables

### Observability Configuration

```typescript
export const OBSERVABILITY_ENV = {
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: process.env.LOG_FORMAT || 'json',
  LOG_FILE: process.env.QUALITY_CHECK_LOG_FILE,

  // Debug
  DEBUG: process.env.DEBUG === 'true',
  VERBOSE: process.env.VERBOSE === 'true',
  TRACE_FILE: process.env.QUALITY_CHECK_TRACE_FILE,

  // Metrics
  METRICS_ENABLED: process.env.QUALITY_CHECK_METRICS !== 'false',
  METRICS_FILE: process.env.QUALITY_CHECK_METRICS_FILE,

  // Telemetry (opt-in)
  TELEMETRY: process.env.QUALITY_CHECK_TELEMETRY === 'true',
  TELEMETRY_ENDPOINT: process.env.QUALITY_CHECK_TELEMETRY_ENDPOINT,

  // Performance
  PERF_TRACKING: process.env.QUALITY_CHECK_PERF !== 'false',
  MEMORY_TRACKING: process.env.QUALITY_CHECK_MEMORY === 'true',
}
```
