/**
 * Tests for Enhanced Logger File Operations
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

describe('JSON File Writing', () => {
  it('should write ErrorReport to JSON file', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir,
    })

    const report = {
      timestamp: new Date().toISOString(),
      tool: 'eslint' as const,
      status: 'error' as const,
      summary: {
        totalErrors: 2,
        totalWarnings: 1,
        filesAffected: 1,
      },
      details: {
        files: [],
      },
      raw: 'test output',
    }

    const filePath = await logger.writeErrorReport(report)

    expect(fs.existsSync(filePath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    expect(content.tool).toBe('eslint')
    expect(content.summary.totalErrors).toBe(2)
  })

  it('should use correct file naming convention', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir,
    })

    const report = {
      timestamp: '2025-09-09T10:30:00.000Z',
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

    const filePath = await logger.writeErrorReport(report)
    const filename = path.basename(filePath)

    expect(filename).toMatch(/^typescript-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\.json$/)
  })

  it('should write to errors subdirectory', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir,
    })

    const report = {
      timestamp: new Date().toISOString(),
      tool: 'prettier' as const,
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

    const filePath = await logger.writeErrorReport(report)

    expect(filePath).toContain(path.join('logs', 'errors'))
    expect(fs.existsSync(path.dirname(filePath))).toBe(true)
  })
})

describe('Log Directory Management', () => {
  it('should create .quality-check/logs directory structure', async () => {
    const logDir = path.join(tempDir, '.quality-check')
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir,
    })

    await logger.ensureLogDirectories()

    expect(fs.existsSync(path.join(logDir, 'logs', 'errors'))).toBe(true)
    expect(fs.existsSync(path.join(logDir, 'logs', 'debug'))).toBe(true)
  })

  it('should handle existing directories gracefully', async () => {
    const logDir = path.join(tempDir, '.quality-check')
    fs.mkdirSync(path.join(logDir, 'logs', 'errors'), { recursive: true })

    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir,
    })

    await expect(logger.ensureLogDirectories()).resolves.not.toThrow()
  })
})

describe('Debug Log Writing', () => {
  it('should write debug execution traces', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir,
    })

    const debugData = {
      timestamp: new Date().toISOString(),
      phase: 'execution',
      tool: 'eslint',
      command: 'eslint src/**/*.ts',
      exitCode: 0,
      duration: 1234,
    }

    const filePath = await logger.writeDebugLog('run', debugData)

    expect(fs.existsSync(filePath)).toBe(true)
    expect(filePath).toContain(path.join('logs', 'debug'))
    expect(path.basename(filePath)).toMatch(/^run-.*\.json$/)
  })

  it('should write performance logs', async () => {
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir,
    })

    const perfData = {
      timestamp: new Date().toISOString(),
      measurements: {
        eslint: 1234,
        typescript: 2345,
        prettier: 456,
        total: 4035,
      },
    }

    const filePath = await logger.writeDebugLog('performance', perfData)

    expect(fs.existsSync(filePath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    expect(content.measurements.total).toBe(4035)
  })
})
