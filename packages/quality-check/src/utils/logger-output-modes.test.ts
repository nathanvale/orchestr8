/**
 * Tests for Enhanced Logger Dual Output Modes
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
    isoTime: () => () => new Date().toISOString()
  }
  
  return {
    default: mockPino,
    stdTimeFunctions: {
      isoTime: () => () => new Date().toISOString()
    }
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

describe('Dual Output Modes', () => {
  it('should write to both console and file when both enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: true,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir
    })
    
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'eslint' as const,
      status: 'error' as const,
      summary: {
        totalErrors: 2,
        totalWarnings: 0,
        filesAffected: 1
      },
      details: {
        files: []
      },
      raw: ''
    }
    
    await logger.logErrorReport(report)
    
    // Check console output
    expect(consoleSpy).toHaveBeenCalled()
    
    // Check file output
    const errorsDir = path.join(tempDir, 'logs', 'errors')
    const files = fs.readdirSync(errorsDir)
    expect(files.some(f => f.startsWith('eslint-'))).toBe(true)
  })

  it('should only write to file when console disabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir: tempDir
    })
    
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'typescript' as const,
      status: 'success' as const,
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        filesAffected: 0
      },
      details: {
        files: []
      },
      raw: ''
    }
    
    await logger.logErrorReport(report)
    
    // Console should not be called
    expect(consoleSpy).not.toHaveBeenCalled()
    
    // File should exist
    const errorsDir = path.join(tempDir, 'logs', 'errors')
    const files = fs.readdirSync(errorsDir)
    expect(files.some(f => f.startsWith('typescript-'))).toBe(true)
  })

  it('should suppress all output in silent mode', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: true,
      file: true,
      silent: true,
      colored: false,
      logDir: tempDir
    })
    
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'prettier' as const,
      status: 'warning' as const,
      summary: {
        totalErrors: 0,
        totalWarnings: 1,
        filesAffected: 1
      },
      details: {
        files: []
      },
      raw: ''
    }
    
    await logger.logErrorReport(report)
    
    // Console should not be called
    expect(consoleSpy).not.toHaveBeenCalled()
    
    // File should still be written (for later access)
    const errorsDir = path.join(tempDir, 'logs', 'errors')
    const files = fs.readdirSync(errorsDir)
    expect(files.some(f => f.startsWith('prettier-'))).toBe(true)
  })
})

describe('Enhanced Logger Methods', () => {
  it('should log error reports with summary', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: true,
      file: false,
      silent: false,
      colored: false
    })
    
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'eslint' as const,
      status: 'error' as const,
      summary: {
        totalErrors: 3,
        totalWarnings: 1,
        filesAffected: 2
      },
      details: {
        files: []
      },
      raw: ''
    }
    
    await logger.logErrorReport(report)
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ESLint: 3 errors, 1 warnings in 2 files')
    )
  })

  it('should handle success reports differently', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: true,
      file: false,
      silent: false,
      colored: false
    })
    
    const report = {
      timestamp: new Date().toISOString(),
      tool: 'typescript' as const,
      status: 'success' as const,
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        filesAffected: 0
      },
      details: {
        files: []
      },
      raw: ''
    }
    
    await logger.logErrorReport(report)
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('TypeScript: ✓ No issues found')
    )
  })
})
