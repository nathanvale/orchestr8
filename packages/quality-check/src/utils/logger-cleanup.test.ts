/**
 * Tests for Enhanced Logger Cleanup Operations
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

describe('Automatic Log Cleanup', () => {
  it('should clean up old error reports beyond retention limit', async () => {
    const logDir = path.join(tempDir, '.quality-check')
    const errorsDir = path.join(logDir, 'logs', 'errors')
    fs.mkdirSync(errorsDir, { recursive: true })
    
    // Create 15 old eslint log files
    for (let i = 0; i < 15; i++) {
      const timestamp = new Date(Date.now() - i * 3600000).toISOString()
      const filename = `eslint-${timestamp}.json`
      fs.writeFileSync(path.join(errorsDir, filename), JSON.stringify({ test: i }))
    }
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir,
      retentionPolicy: {
        errorReports: 10,
        debugLogs: 5
      }
    })
    
    await logger.cleanupOldLogs('eslint')
    
    const remainingFiles = fs.readdirSync(errorsDir).filter(f => f.startsWith('eslint-'))
    expect(remainingFiles).toHaveLength(10)
  })

  it('should keep most recent logs when cleaning up', async () => {
    const logDir = path.join(tempDir, '.quality-check')
    const errorsDir = path.join(logDir, 'logs', 'errors')
    fs.mkdirSync(errorsDir, { recursive: true })
    
    const timestamps: string[] = []
    // Create 12 typescript log files with known timestamps
    for (let i = 0; i < 12; i++) {
      const timestamp = new Date(Date.now() - i * 3600000).toISOString()
      timestamps.push(timestamp)
      const filename = `typescript-${timestamp}.json`
      const filePath = path.join(errorsDir, filename)
      fs.writeFileSync(filePath, JSON.stringify({ index: i }))
      
      // Set the file's mtime to match the timestamp for proper testing
      const fileTime = new Date(Date.now() - i * 3600000)
      fs.utimesSync(filePath, fileTime, fileTime)
    }
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir,
      retentionPolicy: {
        errorReports: 10,
        debugLogs: 5
      }
    })
    
    await logger.cleanupOldLogs('typescript')
    
    const remainingFiles = fs.readdirSync(errorsDir).filter(f => f.startsWith('typescript-'))
    expect(remainingFiles).toHaveLength(10)
    
    // Verify the most recent 10 are kept
    expect(remainingFiles).toContain(`typescript-${timestamps[0]}.json`)
    expect(remainingFiles).toContain(`typescript-${timestamps[9]}.json`)
    expect(remainingFiles).not.toContain(`typescript-${timestamps[10]}.json`)
    expect(remainingFiles).not.toContain(`typescript-${timestamps[11]}.json`)
  })

  it('should clean up debug logs separately', async () => {
    const logDir = path.join(tempDir, '.quality-check')
    const debugDir = path.join(logDir, 'logs', 'debug')
    fs.mkdirSync(debugDir, { recursive: true })
    
    // Create 8 debug log files
    for (let i = 0; i < 8; i++) {
      const timestamp = new Date(Date.now() - i * 3600000).toISOString()
      const filename = `run-${timestamp}.json`
      fs.writeFileSync(path.join(debugDir, filename), JSON.stringify({ debug: i }))
    }
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir,
      retentionPolicy: {
        errorReports: 10,
        debugLogs: 5
      }
    })
    
    await logger.cleanupDebugLogs()
    
    const remainingFiles = fs.readdirSync(debugDir)
    expect(remainingFiles).toHaveLength(5)
  })

  it('should respect configurable retention via environment variables', async () => {
    process.env.LOG_RETENTION_ERROR_REPORTS = '3'
    process.env.LOG_RETENTION_DEBUG_LOGS = '2'
    
    const logDir = path.join(tempDir, '.quality-check')
    const errorsDir = path.join(logDir, 'logs', 'errors')
    fs.mkdirSync(errorsDir, { recursive: true })
    
    // Create 5 prettier log files
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date(Date.now() - i * 3600000).toISOString()
      const filename = `prettier-${timestamp}.json`
      fs.writeFileSync(path.join(errorsDir, filename), JSON.stringify({ test: i }))
    }
    
    const { EnhancedLogger } = await import('./logger')
    const logger = new EnhancedLogger({
      console: false,
      file: true,
      silent: false,
      colored: false,
      logDir
    })
    
    await logger.cleanupOldLogs('prettier')
    
    const remainingFiles = fs.readdirSync(errorsDir).filter(f => f.startsWith('prettier-'))
    expect(remainingFiles).toHaveLength(3)
  })
})
