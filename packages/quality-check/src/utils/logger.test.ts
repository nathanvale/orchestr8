/**
 * Tests for Enhanced Logger Configuration and Interfaces
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

// Mock pino before importing logger
vi.mock('pino', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  }

  const mockPino = vi.fn(() => mockLogger) as any
  mockPino.stdTimeFunctions = {
    isoTime: () => () => new Date().toISOString(),
  }

  return {
    default: mockPino,
    stdTimeFunctions: {
      isoTime: () => () => new Date().toISOString(),
    },
  }
})

let tempDir: string
let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  // Save original env
  originalEnv = { ...process.env }

  // Create temp directory for test logs
  tempDir = mkdtempSync(path.join(tmpdir(), 'logger-test-'))

  // Clear all mocks
  vi.clearAllMocks()

  // Reset modules to get fresh logger instance
  vi.resetModules()
})

afterEach(() => {
  // Restore original env
  process.env = originalEnv

  // Clean up temp directory
  if (fs.existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

describe('LoggerConfig Interface', () => {
  it('should support console output configuration', async () => {
    process.env.CLAUDE_HOOK_CONSOLE = 'true'
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: true,
      file: false,
      silent: false,
      colored: false,
    })

    expect(logger.config.console).toBe(true)
    expect(logger.config.file).toBe(false)
  })

  it('should support file output configuration', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir,
    })

    expect(logger.config.file).toBe(true)
    expect(logger.config.console).toBe(false)
  })

  it('should support silent mode configuration', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: false,
      silent: true,
      colored: false,
    })

    expect(logger.config.silent).toBe(true)
  })

  it('should support colored output configuration', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: true,
      file: false,
      silent: false,
      colored: true,
    })

    expect(logger.config.colored).toBe(true)
  })
})

describe('ErrorReport Interface', () => {
  it('should create valid ErrorReport structure', async () => {
    const { createErrorReport } = await import('./logger')

    const report = createErrorReport({
      tool: 'eslint',
      status: 'error',
      summary: {
        totalErrors: 5,
        totalWarnings: 2,
        filesAffected: 3,
      },
      details: {
        files: [
          {
            path: 'src/example.ts',
            errors: [
              {
                line: 42,
                column: 10,
                message: 'Missing semicolon',
                ruleId: 'semi',
                severity: 'error',
              },
            ],
          },
        ],
      },
      raw: '<!-- Original ESLint output -->',
    })

    expect(report.timestamp).toBeDefined()
    expect(report.tool).toBe('eslint')
    expect(report.status).toBe('error')
    expect(report.summary.totalErrors).toBe(5)
    expect(report.details.files).toHaveLength(1)
  })

  it('should validate ErrorReport schema', async () => {
    const { validateErrorReport } = await import('./logger')

    const validReport = {
      timestamp: new Date().toISOString(),
      tool: 'typescript' as const,
      status: 'error' as const,
      summary: {
        totalErrors: 1,
        totalWarnings: 0,
        filesAffected: 1,
      },
      details: {
        files: [],
      },
      raw: '',
    }

    expect(validateErrorReport(validReport)).toBe(true)
  })

  it('should reject invalid ErrorReport schema', async () => {
    const { validateErrorReport } = await import('./logger')

    const invalidReport = {
      tool: 'invalid-tool',
      status: 'unknown',
      summary: {},
    }

    expect(validateErrorReport(invalidReport)).toBe(false)
  })
})

describe('Backward Compatibility', () => {
  it('should maintain existing logger methods', async () => {
    const { logger } = await import('./logger')

    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.hookStarted).toBe('function')
    expect(typeof logger.hookCompleted).toBe('function')
    expect(typeof logger.qualityCheckStarted).toBe('function')
    expect(typeof logger.qualityCheckCompleted).toBe('function')
  })

  it('should support existing LogContext interface', async () => {
    const { logger } = await import('./logger')

    const context = {
      correlationId: 'test-123',
      operation: 'test-op',
      filePath: '/test/file.ts',
      duration: 100,
      issues: 5,
    }

    expect(() => logger.info('Test message', context)).not.toThrow()
  })
})
