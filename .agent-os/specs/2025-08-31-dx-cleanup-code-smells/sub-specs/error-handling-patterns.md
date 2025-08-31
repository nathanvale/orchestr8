# Error Handling Patterns

> Standardized error handling patterns for consistent debugging and recovery
> Version: 1.0.0 Created: 2025-08-31

## Overview

This guide establishes consistent error handling patterns across the codebase,
focusing on the scripts that currently have inconsistent or missing error
handling.

## Files Requiring Error Handling Improvements

### Critical Scripts

1. `/scripts/validate-pre-release.ts` - Missing structured error handling
2. `/scripts/security-scan.ts` - Inconsistent error propagation
3. `/scripts/pre-release-guardrails.ts` - Silent failures possible
4. `/scripts/coverage-gate.ts` - Basic error handling only
5. `/scripts/test-guardrails.ts` - Needs error context

## Pattern 1: Custom Error Classes

### Base Error Classes

**File:** `/scripts/lib/errors.ts` (to be created)

```typescript
/**
 * Base error class for all custom errors in the application
 */
export class BaseError extends Error {
  public readonly timestamp: Date
  public readonly context?: Record<string, unknown>

  constructor(
    message: string,
    public readonly code: string,
    options?: ErrorOptions & { context?: Record<string, unknown> },
  ) {
    super(message, options)
    this.name = this.constructor.name
    this.timestamp = new Date()
    this.context = options?.context

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    }
  }
}

/**
 * Error class for validation failures
 */
export class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string,
    options?: ErrorOptions & { context?: Record<string, unknown> },
  ) {
    super(message, 'VALIDATION_ERROR', options)
  }
}

/**
 * Error class for script execution failures
 */
export class ScriptExecutionError extends BaseError {
  constructor(
    message: string,
    public readonly script: string,
    public readonly exitCode?: number,
    options?: ErrorOptions & { context?: Record<string, unknown> },
  ) {
    super(message, 'SCRIPT_EXECUTION_ERROR', options)
  }
}

/**
 * Error class for file system operations
 */
export class FileSystemError extends BaseError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: 'read' | 'write' | 'delete' | 'create',
    options?: ErrorOptions & { context?: Record<string, unknown> },
  ) {
    super(message, 'FILE_SYSTEM_ERROR', options)
  }
}

/**
 * Error class for network/API failures
 */
export class NetworkError extends BaseError {
  constructor(
    message: string,
    public readonly url: string,
    public readonly statusCode?: number,
    options?: ErrorOptions & { context?: Record<string, unknown> },
  ) {
    super(message, 'NETWORK_ERROR', options)
  }
}

/**
 * Error class for configuration issues
 */
export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    public readonly configFile?: string,
    options?: ErrorOptions & { context?: Record<string, unknown> },
  ) {
    super(message, 'CONFIGURATION_ERROR', options)
  }
}
```

## Pattern 2: Error Handling in Scripts

### Example 1: Script Execution with Proper Error Handling

**File:** `/scripts/validate-pre-release.ts` (to be updated)

```typescript
// ❌ BEFORE - Basic error handling
try {
  execSync('pnpm test')
} catch (error) {
  console.error('Tests failed')
  process.exit(1)
}

// ✅ AFTER - Comprehensive error handling
import { ScriptExecutionError } from './lib/errors'
import { logger } from './lib/logger'

async function runTests(): Promise<void> {
  try {
    const result = execSync('pnpm test', {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300000, // 5 minutes
    })

    logger.info('Tests passed successfully', {
      output: result.substring(0, 500), // Log first 500 chars
    })
  } catch (error) {
    if (isExecError(error)) {
      throw new ScriptExecutionError(
        `Test execution failed with exit code ${error.status}`,
        'pnpm test',
        error.status ?? undefined,
        {
          cause: error,
          context: {
            stdout: error.stdout?.toString().substring(0, 1000),
            stderr: error.stderr?.toString().substring(0, 1000),
            signal: error.signal,
          },
        },
      )
    }
    throw error
  }
}

// Type guard for exec errors
function isExecError(error: unknown): error is ExecException {
  return error instanceof Error && 'status' in error
}
```

### Example 2: File Operations with Error Context

**File:** `/scripts/coverage-gate.ts` (to be updated)

```typescript
// ❌ BEFORE - Basic file reading
const coverage = JSON.parse(
  fs.readFileSync('coverage/coverage-summary.json', 'utf-8'),
)

// ✅ AFTER - Robust file handling with context
import { FileSystemError, ValidationError } from './lib/errors'

interface CoverageSummary {
  total: {
    lines: { pct: number }
    branches: { pct: number }
    functions: { pct: number }
    statements: { pct: number }
  }
}

async function readCoverageSummary(path: string): Promise<CoverageSummary> {
  try {
    // Check file exists first
    await fs.promises.access(path, fs.constants.R_OK)

    const content = await fs.promises.readFile(path, 'utf-8')

    if (!content.trim()) {
      throw new ValidationError('Coverage file is empty', path, {
        context: { path },
      })
    }

    const data = JSON.parse(content) as unknown

    // Validate structure
    if (!isCoverageSummary(data)) {
      throw new ValidationError('Invalid coverage summary format', path, {
        context: { actualKeys: Object.keys(data as object) },
      })
    }

    return data
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error
    }

    if (isNodeError(error)) {
      if (error.code === 'ENOENT') {
        throw new FileSystemError(
          'Coverage file not found. Run tests with coverage first.',
          path,
          'read',
          { cause: error },
        )
      }
      if (error.code === 'EACCES') {
        throw new FileSystemError(
          'Permission denied reading coverage file',
          path,
          'read',
          { cause: error },
        )
      }
    }

    if (error instanceof SyntaxError) {
      throw new ValidationError('Coverage file contains invalid JSON', path, {
        cause: error,
      })
    }

    throw error
  }
}

function isCoverageSummary(value: unknown): value is CoverageSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'total' in value &&
    typeof (value as any).total === 'object'
  )
}
```

## Pattern 3: Structured Logging

### Logger Implementation

**File:** `/scripts/lib/logger.ts` (to be created)

```typescript
import chalk from 'chalk'

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private level: LogLevel = LogLevel.INFO

  constructor(level?: LogLevel) {
    if (level !== undefined) {
      this.level = level
    } else if (process.env.LOG_LEVEL) {
      this.level =
        LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] ??
        LogLevel.INFO
    }
  }

  private formatMessage(
    level: string,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level}] ${message}${contextStr}`
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.level >= LogLevel.ERROR) {
      const errorContext =
        error instanceof Error
          ? {
              ...context,
              error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
              },
            }
          : context

      console.error(
        chalk.red(this.formatMessage('ERROR', message, errorContext)),
      )
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(chalk.yellow(this.formatMessage('WARN', message, context)))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.INFO) {
      console.info(chalk.cyan(this.formatMessage('INFO', message, context)))
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(chalk.gray(this.formatMessage('DEBUG', message, context)))
    }
  }

  trace(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.TRACE) {
      console.debug(chalk.gray(this.formatMessage('TRACE', message, context)))
    }
  }

  success(message: string, context?: LogContext): void {
    console.log(
      chalk.green(`✅ ${message}`),
      context ? chalk.gray(JSON.stringify(context)) : '',
    )
  }

  failure(message: string, context?: LogContext): void {
    console.log(
      chalk.red(`❌ ${message}`),
      context ? chalk.gray(JSON.stringify(context)) : '',
    )
  }
}

export const logger = new Logger()
```

## Pattern 4: Error Recovery Strategies

### Retry with Exponential Backoff

**File:** `/scripts/lib/retry.ts` (to be created)

```typescript
import { logger } from './logger'

interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  factor?: number
  onRetry?: (error: Error, attempt: number) => void
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry,
  } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxAttempts}`)
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxAttempts) {
        logger.error(`All ${maxAttempts} attempts failed`, lastError, {
          finalAttempt: attempt,
        })
        break
      }

      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay,
      )

      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        nextAttempt: attempt + 1,
        delay,
      })

      if (onRetry) {
        onRetry(lastError, attempt)
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError ?? new Error('Retry failed')
}
```

### Network Request with Retry

**File:** `/scripts/security-scan.ts` (to be updated)

```typescript
// ❌ BEFORE - No retry logic
const response = await fetch(url)
if (!response.ok) {
  throw new Error(`Failed to fetch: ${response.status}`)
}

// ✅ AFTER - Retry with proper error handling
import { retry } from './lib/retry'
import { NetworkError } from './lib/errors'

async function fetchWithRetry(url: string): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000), // 30s timeout
      })

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          url,
          response.status,
          {
            context: {
              headers: Object.fromEntries(response.headers.entries()),
            },
          },
        )
      }

      return response
    },
    {
      maxAttempts: 3,
      onRetry: (error, attempt) => {
        logger.warn(`Network request failed, attempt ${attempt}`, {
          url,
          error: error.message,
        })
      },
    },
  )
}
```

## Pattern 5: Error Boundaries for React

### React Error Boundary

**File:** `/apps/app/src/components/ErrorBoundary.tsx` (to be created)

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../lib/logger'

interface Props {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    })

    this.setState({ errorInfo })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!)
      }

      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Pattern 6: Global Error Handler

### Process Error Handler

**File:** `/scripts/lib/process-handler.ts` (to be created)

```typescript
import { logger } from './logger'

export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error, {
      type: 'uncaughtException',
      fatal: true,
    })
    process.exit(1)
  })

  // Handle unhandled promise rejections
  process.on(
    'unhandledRejection',
    (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Promise Rejection', reason, {
        type: 'unhandledRejection',
        promise: String(promise),
      })
      process.exit(1)
    },
  )

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully')
    process.exit(0)
  })

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully')
    process.exit(0)
  })
}
```

## Implementation Checklist

### Phase 1: Infrastructure

- [ ] Create error class hierarchy
- [ ] Implement structured logger
- [ ] Add retry utilities
- [ ] Setup global handlers

### Phase 2: Script Updates

- [ ] Update validate-pre-release.ts
- [ ] Update security-scan.ts
- [ ] Update coverage-gate.ts
- [ ] Update all other scripts

### Phase 3: Application Updates

- [ ] Add React error boundaries
- [ ] Update API error handling
- [ ] Add error tracking

## Testing Error Handling

```typescript
// Test custom errors
describe('Error Handling', () => {
  test('should capture context in custom errors', () => {
    const error = new ValidationError('Invalid input', 'email', {
      context: { value: 'not-an-email' },
    })

    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.field).toBe('email')
    expect(error.context).toEqual({ value: 'not-an-email' })
  })

  test('should retry on failure', async () => {
    let attempts = 0
    const fn = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('Temporary failure')
      }
      return 'success'
    })

    const result = await retry(fn, { maxAttempts: 3 })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
```

## Benefits

1. **Consistent Error Messages** - All errors follow the same format
2. **Better Debugging** - Context and stack traces preserved
3. **Graceful Recovery** - Retry logic for transient failures
4. **Actionable Errors** - Clear messages with suggested fixes
5. **Comprehensive Logging** - Structured logs for analysis
