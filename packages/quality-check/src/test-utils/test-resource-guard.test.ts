/**
 * Tests for TestResourceGuard
 * Ensures proper resource tracking and cleanup functionality
 */

import { ChildProcess, spawn } from 'child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TestResourceGuard } from './test-resource-guard.js'

describe('TestResourceGuard', () => {
  let guard: TestResourceGuard
  let testTempDir: string

  beforeEach(() => {
    guard = new TestResourceGuard()
    testTempDir = mkdtempSync(join(tmpdir(), 'resource-guard-test-'))
  })

  afterEach(async () => {
    await guard.cleanup()
    // Clean up test temp dir
    if (existsSync(testTempDir)) {
      await rm(testTempDir, { recursive: true, force: true })
    }
  })

  describe('cleanup function registration', () => {
    test('should register and execute cleanup functions', async () => {
      // Arrange
      const cleanupMock = vi.fn()
      const cleanupMock2 = vi.fn()

      // Act
      guard.registerCleanup('test-cleanup', cleanupMock)
      guard.registerCleanup('test-cleanup-2', cleanupMock2)
      await guard.cleanup()

      // Assert
      expect(cleanupMock).toHaveBeenCalledOnce()
      expect(cleanupMock2).toHaveBeenCalledOnce()
    })

    test('should execute cleanup functions in priority order', async () => {
      // Arrange
      const executionOrder: string[] = []
      const lowPriority = vi.fn(() => executionOrder.push('low'))
      const highPriority = vi.fn(() => executionOrder.push('high'))
      const mediumPriority = vi.fn(() => executionOrder.push('medium'))

      // Act
      guard.registerCleanup('low', lowPriority, 1)
      guard.registerCleanup('high', highPriority, 100)
      guard.registerCleanup('medium', mediumPriority, 50)
      await guard.cleanup()

      // Assert
      expect(executionOrder).toEqual(['high', 'medium', 'low'])
    })

    test('should handle async cleanup functions', async () => {
      // Arrange
      const asyncCleanup = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      // Act
      guard.registerCleanup('async-cleanup', asyncCleanup)
      await guard.cleanup()

      // Assert
      expect(asyncCleanup).toHaveBeenCalledOnce()
    })

    test('should handle cleanup function errors gracefully', async () => {
      // Arrange
      const errorCleanup = vi.fn(() => {
        throw new Error('Cleanup failed')
      })
      const successCleanup = vi.fn()

      // Act
      guard.registerCleanup('error-cleanup', errorCleanup)
      guard.registerCleanup('success-cleanup', successCleanup)
      await guard.cleanup()

      // Assert
      expect(errorCleanup).toHaveBeenCalledOnce()
      expect(successCleanup).toHaveBeenCalledOnce()
      const stats = guard.getStats()
      expect(stats.errors).toHaveLength(1)
      expect(stats.errors[0]).toContain('Cleanup failed')
    })

    test('should not allow registration during cleanup', async () => {
      // Arrange
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const cleanupMock = vi.fn()

      // Act
      guard.registerCleanup('first', () => {
        guard.registerCleanup('during-cleanup', cleanupMock)
      })
      await guard.cleanup()

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "⚠️ Cannot register cleanup 'during-cleanup' during cleanup phase",
      )
      expect(cleanupMock).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('process tracking', () => {
    test('should track and kill processes on cleanup', async () => {
      // Arrange - Spawn a long-running process
      const proc = spawn('sleep', ['1'], { stdio: 'ignore' })
      expect(proc.pid).toBeDefined()

      // Act
      guard.trackProcess(proc, 'sleep 1')
      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.processesTracked).toBe(1)
      expect(stats.processesKilled).toBe(1)
      expect(guard.getActiveProcesses()).toHaveLength(0)
    })

    test('should handle process that exits naturally', async () => {
      // Arrange - Spawn a quick process
      const proc = spawn('echo', ['test'], { stdio: 'ignore' })
      expect(proc.pid).toBeDefined()

      // Act
      guard.trackProcess(proc, 'echo test')

      // Wait for natural exit
      await new Promise((resolve) => {
        proc.on('exit', resolve)
      })

      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.processesTracked).toBe(1)
      expect(stats.processesKilled).toBe(0) // Exited naturally
    })

    test('should handle process timeout', async () => {
      // Arrange
      const proc = spawn('sleep', ['10'], { stdio: 'ignore' })
      expect(proc.pid).toBeDefined()
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Act
      guard.trackProcess(proc, 'sleep 10', 100) // 100ms timeout

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeded timeout, terminating'),
      )

      consoleWarnSpy.mockRestore()
    })

    test('should not track process without PID', () => {
      // Arrange
      const mockProc = { pid: undefined } as ChildProcess
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Act
      guard.trackProcess(mockProc, 'mock process')

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️ Cannot track process without PID: mock process',
      )
      const stats = guard.getStats()
      expect(stats.processesTracked).toBe(0)

      consoleWarnSpy.mockRestore()
    })
  })

  describe('timer tracking', () => {
    test('should track and clear timeouts', async () => {
      // Arrange
      const timer = setTimeout(() => {}, 1000)

      // Act
      guard.trackTimer(timer)
      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.timersCleared).toBe(1)
    })

    test('should track and clear intervals', async () => {
      // Arrange
      const interval = setInterval(() => {}, 100)

      // Act
      guard.trackInterval(interval)
      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.timersCleared).toBe(1)
    })

    test('should return tracked timer', () => {
      // Arrange
      const timer = setTimeout(() => {}, 1000)

      // Act
      const returnedTimer = guard.trackTimer(timer)

      // Assert
      expect(returnedTimer).toBe(timer)
    })
  })

  describe('temporary directory tracking', () => {
    test('should track and remove temporary directories', async () => {
      // Arrange
      const tempFile = join(testTempDir, 'test.txt')
      writeFileSync(tempFile, 'test content')
      expect(existsSync(testTempDir)).toBe(true)

      // Act
      guard.trackTempDir(testTempDir)
      await guard.cleanup()

      // Assert
      expect(existsSync(testTempDir)).toBe(false)
      const stats = guard.getStats()
      expect(stats.tempDirsRemoved).toBe(1)
    })

    test('should handle non-existent directory gracefully', async () => {
      // Arrange
      const nonExistentDir = join(testTempDir, 'does-not-exist')

      // Act
      guard.trackTempDir(nonExistentDir)
      await guard.cleanup()

      // Assert - Should not error
      const stats = guard.getStats()
      expect(stats.tempDirsRemoved).toBe(0)
    })
  })

  describe('file handle tracking', () => {
    test('should track and close file handles with close method', async () => {
      // Arrange
      const closeMock = vi.fn()
      const handle = { close: closeMock }

      // Act
      guard.trackFileHandle(handle)
      await guard.cleanup()

      // Assert
      expect(closeMock).toHaveBeenCalledOnce()
    })

    test('should track and destroy file handles with destroy method', async () => {
      // Arrange
      const destroyMock = vi.fn()
      const handle = { destroy: destroyMock }

      // Act
      guard.trackFileHandle(handle)
      await guard.cleanup()

      // Assert
      expect(destroyMock).toHaveBeenCalledOnce()
    })

    test('should handle file handle errors gracefully', async () => {
      // Arrange
      const handle = {
        close: vi.fn(() => {
          throw new Error('Close failed')
        }),
      }

      // Act
      guard.trackFileHandle(handle)
      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.errors).toHaveLength(1)
      expect(stats.errors[0]).toContain('Close failed')
    })
  })

  describe('cleanup coordination', () => {
    test('should prevent duplicate cleanup calls', async () => {
      // Arrange
      const cleanupMock = vi.fn()
      guard.registerCleanup('test', cleanupMock)
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Act
      const cleanup1 = guard.cleanup()
      const cleanup2 = guard.cleanup()
      await Promise.all([cleanup1, cleanup2])

      // Assert
      expect(cleanupMock).toHaveBeenCalledOnce()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️ Cleanup already in progress, skipping duplicate call',
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('statistics and reporting', () => {
    test('should track comprehensive statistics', async () => {
      // Arrange
      const proc = spawn('echo', ['test'], { stdio: 'ignore' })
      const timer = setTimeout(() => {}, 1000)
      const interval = setInterval(() => {}, 100)
      const handle = { close: vi.fn() }

      // Act
      guard.trackProcess(proc, 'echo test')
      guard.trackTimer(timer)
      guard.trackInterval(interval)
      guard.trackTempDir(testTempDir)
      guard.trackFileHandle(handle)
      guard.registerCleanup('test', vi.fn())

      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.processesTracked).toBe(1)
      expect(stats.timersCleared).toBe(2) // timer + interval
      expect(stats.tempDirsRemoved).toBe(1)
      expect(stats.customCleanups).toBe(1)
      expect(stats.errors).toEqual([])
    })

    test('should generate comprehensive report', () => {
      // Arrange
      const proc = spawn('echo', ['test'], { stdio: 'ignore' })
      guard.trackProcess(proc, 'echo test')

      // Act
      const report = guard.generateReport()

      // Assert
      expect(report).toContain('🛡️ TestResourceGuard Report')
      expect(report).toContain('Processes Tracked: 1')
      expect(report).toContain('Active Processes: 1')
      expect(report).toContain(`PID ${proc.pid}: echo test`)
    })
  })

  describe('reset functionality', () => {
    test('should reset all state and statistics', async () => {
      // Arrange
      const proc = spawn('echo', ['test'], { stdio: 'ignore' })
      guard.trackProcess(proc, 'echo test')
      guard.registerCleanup('test', vi.fn())

      // Act
      await guard.reset()

      // Assert
      const stats = guard.getStats()
      expect(stats.processesTracked).toBe(0)
      expect(stats.processesKilled).toBe(0)
      expect(stats.timersCleared).toBe(0)
      expect(stats.tempDirsRemoved).toBe(0)
      expect(stats.customCleanups).toBe(0)
      expect(stats.errors).toEqual([])
      expect(guard.getActiveProcesses()).toHaveLength(0)
    })
  })
})
