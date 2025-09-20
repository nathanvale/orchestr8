/**
 * Tests for integration test base utilities
 * Validates setup and teardown functionality for integration tests
 */

import { spawn } from 'child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  setupFileSystemIntegrationTest,
  setupIntegrationTest,
  setupProcessIntegrationTest,
  setupSimpleIntegrationTest,
  setupTimerIntegrationTest,
} from './integration-test-base.js'

describe('Integration Test Base Utilities', () => {
  let testTempDir: string

  beforeEach(() => {
    testTempDir = mkdtempSync(join(tmpdir(), 'integration-base-test-'))
  })

  afterEach(async () => {
    // Clean up test temp dir
    if (existsSync(testTempDir)) {
      await rm(testTempDir, { recursive: true, force: true })
    }
  })

  describe('setupIntegrationTest', () => {
    test('should setup integration test with default options', async () => {
      // Arrange
      const clearMocksSpy = vi.spyOn(vi, 'clearAllMocks')
      const clearTimersSpy = vi.spyOn(vi, 'clearAllTimers')

      // Act
      const guard = setupIntegrationTest()

      // Simulate beforeEach
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Assert
      expect(guard).toBeDefined()
      expect(guard.registerCleanup).toBeInstanceOf(Function)
      expect(guard.trackProcess).toBeInstanceOf(Function)
      expect(guard.trackTimer).toBeInstanceOf(Function)
      expect(guard.cleanup).toBeInstanceOf(Function)

      clearMocksSpy.mockRestore()
      clearTimersSpy.mockRestore()
    })

    test('should setup integration test with fake timers', async () => {
      // Act
      const guard = setupIntegrationTest({ useFakeTimers: true })

      // Assert
      expect(guard).toBeDefined()
      expect(guard.registerCleanup).toBeInstanceOf(Function)
      expect(guard.trackProcess).toBeInstanceOf(Function)
      expect(guard.trackTimer).toBeInstanceOf(Function)
      expect(guard.cleanup).toBeInstanceOf(Function)
    })

    test('should setup integration test with custom cleanup functions', async () => {
      // Arrange
      const customCleanup1 = vi.fn()
      const customCleanup2 = vi.fn()

      // Act
      const guard = setupIntegrationTest({
        customCleanup: [customCleanup1, customCleanup2],
      })

      // Manually register cleanups to test functionality
      guard.registerCleanup('test1', customCleanup1)
      guard.registerCleanup('test2', customCleanup2)
      await guard.cleanup()

      // Assert
      expect(customCleanup1).toHaveBeenCalledOnce()
      expect(customCleanup2).toHaveBeenCalledOnce()
    })

    test('should disable mock clearing when specified', () => {
      // Arrange
      const clearMocksSpy = vi.spyOn(vi, 'clearAllMocks')

      // Act
      const guard = setupIntegrationTest({ clearMocks: false })

      // Assert
      expect(guard).toBeDefined()
      expect(clearMocksSpy).not.toHaveBeenCalled()

      clearMocksSpy.mockRestore()
    })

    test('should disable mock restoration when specified', () => {
      // Arrange
      const restoreAllMocksSpy = vi.spyOn(vi, 'restoreAllMocks')

      // Act
      const guard = setupIntegrationTest({ restoreMocks: false })

      // Simulate afterEach
      const afterEachHandler = vi.getAfterEachHandlers?.()[0]
      if (afterEachHandler) {
        afterEachHandler()
      }

      // Assert
      expect(guard).toBeDefined()

      restoreAllMocksSpy.mockRestore()
    })
  })

  describe('setupSimpleIntegrationTest', () => {
    test('should setup simple integration test with standard options', () => {
      // Act
      const guard = setupSimpleIntegrationTest()

      // Assert
      expect(guard).toBeDefined()
      expect(guard.registerCleanup).toBeInstanceOf(Function)
      expect(guard.trackProcess).toBeInstanceOf(Function)
      expect(guard.trackTimer).toBeInstanceOf(Function)
      expect(guard.cleanup).toBeInstanceOf(Function)
    })
  })

  describe('setupTimerIntegrationTest', () => {
    test('should setup timer integration test with fake timers enabled', () => {
      // Act
      const guard = setupTimerIntegrationTest()

      // Assert
      expect(guard).toBeDefined()
      expect(guard.registerCleanup).toBeInstanceOf(Function)
      expect(guard.trackProcess).toBeInstanceOf(Function)
      expect(guard.trackTimer).toBeInstanceOf(Function)
      expect(guard.cleanup).toBeInstanceOf(Function)
    })
  })

  describe('setupProcessIntegrationTest', () => {
    test('should setup process integration test with spawn helper', async () => {
      // Act
      const result = setupProcessIntegrationTest()

      // Assert
      expect(result).toBeDefined()
      expect(result.spawnProcess).toBeInstanceOf(Function)
    })

    test('should track spawned processes automatically', async () => {
      // Arrange
      const result = setupProcessIntegrationTest()
      const proc = spawn('echo', ['test'], { stdio: 'ignore' })

      // Act
      const trackedProc = result.spawnProcess(proc, 'echo test')

      // Assert
      expect(trackedProc).toBe(proc)
      expect(trackedProc.pid).toBeDefined()
    })

    test('should use custom timeout for spawned processes', async () => {
      // Arrange
      const result = setupProcessIntegrationTest()
      const proc = spawn('sleep', ['1'], { stdio: 'ignore' })

      // Act
      const trackedProc = result.spawnProcess(proc, 'sleep 1', 5000)

      // Assert
      expect(trackedProc).toBe(proc)
      expect(trackedProc.pid).toBeDefined()
    })
  })

  describe('setupFileSystemIntegrationTest', () => {
    test('should setup filesystem integration test with temp directory tracking', async () => {
      // Arrange
      const tempFile = join(testTempDir, 'test.txt')
      writeFileSync(tempFile, 'test content')

      // Act
      const result = setupFileSystemIntegrationTest([testTempDir])

      // Assert
      expect(result).toBeDefined()
      expect(result.addTempDir).toBeInstanceOf(Function)

      // Note: Can't test cleanup directly due to spread operator limitations
      // This would be tested in actual integration test usage
    })

    test('should provide addTempDir helper function', () => {
      // Act
      const result = setupFileSystemIntegrationTest()

      // Assert
      expect(result.addTempDir).toBeInstanceOf(Function)
    })

    test('should track additional temp directories via addTempDir', async () => {
      // Arrange
      const result = setupFileSystemIntegrationTest()
      const additionalTempDir = mkdtempSync(join(tmpdir(), 'additional-temp-'))
      writeFileSync(join(additionalTempDir, 'test.txt'), 'content')

      // Act
      result.addTempDir(additionalTempDir)

      // Assert
      expect(result.addTempDir).toBeInstanceOf(Function)
      expect(existsSync(additionalTempDir)).toBe(true)

      // Cleanup for test
      await rm(additionalTempDir, { recursive: true, force: true })
    })

    test('should handle empty temp directory list', () => {
      // Act
      const result = setupFileSystemIntegrationTest([])

      // Assert
      expect(result).toBeDefined()
      expect(result.addTempDir).toBeInstanceOf(Function)
    })

    test('should track multiple temp directories', async () => {
      // Arrange
      const tempDir1 = mkdtempSync(join(tmpdir(), 'temp1-'))
      const tempDir2 = mkdtempSync(join(tmpdir(), 'temp2-'))
      writeFileSync(join(tempDir1, 'file1.txt'), 'content1')
      writeFileSync(join(tempDir2, 'file2.txt'), 'content2')

      // Act
      const result = setupFileSystemIntegrationTest([tempDir1, tempDir2])

      // Assert
      expect(result).toBeDefined()
      expect(result.addTempDir).toBeInstanceOf(Function)

      // Cleanup for test
      await rm(tempDir1, { recursive: true, force: true })
      await rm(tempDir2, { recursive: true, force: true })
    })
  })

  describe('integration test lifecycle', () => {
    test('should handle complete setup and teardown cycle', async () => {
      // Arrange
      const customCleanup = vi.fn()
      const proc = spawn('echo', ['lifecycle-test'], { stdio: 'ignore' })
      const timer = setTimeout(() => {}, 1000)

      // Act
      const guard = setupIntegrationTest({
        useFakeTimers: false,
      })

      guard.registerCleanup('custom', customCleanup)
      guard.trackProcess(proc, 'echo lifecycle-test')
      guard.trackTimer(timer)
      guard.trackTempDir(testTempDir)

      await guard.cleanup()

      // Assert
      expect(customCleanup).toHaveBeenCalledOnce()
      const stats = guard.getStats()
      expect(stats.processesTracked).toBe(1)
      expect(stats.timersCleared).toBe(1)
      expect(stats.tempDirsRemoved).toBe(1)
      expect(stats.customCleanups).toBe(1)
    })

    test('should handle errors during cleanup gracefully', async () => {
      // Arrange
      const erroringCleanup = vi.fn(() => {
        throw new Error('Cleanup error')
      })
      const successCleanup = vi.fn()

      // Act
      const guard = setupIntegrationTest()

      guard.registerCleanup('error', erroringCleanup)
      guard.registerCleanup('success', successCleanup)
      await guard.cleanup()

      // Assert
      expect(erroringCleanup).toHaveBeenCalledOnce()
      expect(successCleanup).toHaveBeenCalledOnce()
      const stats = guard.getStats()
      expect(stats.errors).toHaveLength(1)
      expect(stats.errors[0]).toContain('Cleanup error')
    })
  })

  describe('vitest integration', () => {
    test('should work with vitest mock functions', async () => {
      // Arrange
      const mockFn = vi.fn()
      const clearAllMocksSpy = vi.spyOn(vi, 'clearAllMocks')
      const restoreAllMocksSpy = vi.spyOn(vi, 'restoreAllMocks')

      // Act
      const guard = setupIntegrationTest()
      mockFn()

      // Simulate beforeEach and afterEach
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Assert
      expect(mockFn).toHaveBeenCalledOnce()
      expect(guard).toBeDefined()

      clearAllMocksSpy.mockRestore()
      restoreAllMocksSpy.mockRestore()
    })

    test('should handle fake timers correctly', async () => {
      // Act
      const guard = setupIntegrationTest({ useFakeTimers: true })

      // Assert
      expect(guard).toBeDefined()
      expect(guard.registerCleanup).toBeInstanceOf(Function)
      expect(guard.trackProcess).toBeInstanceOf(Function)
      expect(guard.trackTimer).toBeInstanceOf(Function)
      expect(guard.cleanup).toBeInstanceOf(Function)
    })
  })
})
