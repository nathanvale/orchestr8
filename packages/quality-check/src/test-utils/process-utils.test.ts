/**
 * Tests for process execution utilities
 * Validates safe process execution and timeout handling
 */

import { spawn } from 'child_process'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { TestResourceGuard } from './test-resource-guard.js'
import {
  TestProcessManager,
  execSyncQuiet,
  execSyncSafe,
  execSyncTest,
  execWithRetry,
  execWithTimeout,
  isCommandAvailable,
  spawnSafe,
} from './process-utils.js'

describe('Process Utils', () => {
  let guard: TestResourceGuard
  let _testTempDir: string

  beforeEach(() => {
    guard = new TestResourceGuard()
    _testTempDir = mkdtempSync(join(tmpdir(), 'process-utils-test-'))
  })

  afterEach(async () => {
    await guard.cleanup()
  })

  describe('execSyncSafe', () => {
    test('should execute command successfully', () => {
      // Act
      const result = execSyncSafe('echo "test"')

      // Assert
      expect(result.toString().trim()).toBe('test')
    })

    test('should apply timeout option', () => {
      // Act & Assert
      expect(() => {
        execSyncSafe('sleep 2', { timeout: 100 })
      }).toThrow()
    })

    test('should use custom kill signal', () => {
      // Act & Assert
      expect(() => {
        execSyncSafe('sleep 2', { timeout: 100, killSignal: 'SIGKILL' })
      }).toThrow()
    })

    test('should respect maxBuffer option', () => {
      // Act & Assert
      expect(() => {
        execSyncSafe('yes | head -c 100000', { maxBuffer: 1024 })
      }).toThrow()
    })

    test('should not throw when throwOnError is false', () => {
      // Act
      const result = execSyncSafe('exit 1', { throwOnError: false })

      // Assert
      expect(result).toEqual(Buffer.alloc(0))
    })

    test('should pass through other options', () => {
      // Act
      const result = execSyncSafe('echo "test"', { encoding: 'utf8' })

      // Assert
      expect(typeof result).toBe('string')
      expect(result.trim()).toBe('test')
    })
  })

  describe('spawnSafe', () => {
    test('should spawn process successfully', () => {
      // Act
      const child = spawnSafe('echo', ['test'])

      // Assert
      expect(child).toBeDefined()
      expect(child.pid).toBeDefined()

      // Cleanup
      guard.trackProcess(child, 'echo test')
    })

    test('should track process with guard when provided', () => {
      // Act
      const child = spawnSafe('echo', ['test'], { guard })

      // Assert
      expect(child).toBeDefined()
      const activeProcesses = guard.getActiveProcesses()
      expect(activeProcesses).toHaveLength(1)
      expect(activeProcesses[0].command).toBe('echo test')
    })

    test('should use custom timeout when provided', () => {
      // Act
      const child = spawnSafe('sleep', ['1'], { timeout: 5000, guard })

      // Assert
      expect(child).toBeDefined()
      const activeProcesses = guard.getActiveProcesses()
      expect(activeProcesses).toHaveLength(1)
    })

    test('should pass spawn options correctly', () => {
      // Act
      const child = spawnSafe('echo', ['test'], { stdio: 'pipe' })

      // Assert
      expect(child).toBeDefined()
      expect(child.stdout).toBeDefined()
      expect(child.stderr).toBeDefined()

      guard.trackProcess(child, 'echo test')
    })
  })

  describe('execWithTimeout', () => {
    test('should execute command and return output', async () => {
      // Act
      const result = await execWithTimeout('echo', ['test'])

      // Assert
      expect(result.stdout).toBe('test')
      expect(result.stderr).toBe('')
      expect(result.exitCode).toBe(0)
    })

    test('should capture stderr output', async () => {
      // Act
      const result = await execWithTimeout('node', ['-e', 'console.error("error")'])

      // Assert
      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('error')
      expect(result.exitCode).toBe(0)
    })

    test('should timeout long-running commands', async () => {
      // Act & Assert
      await expect(execWithTimeout('sleep', ['10'], 100)).rejects.toThrow(
        'Process timed out after 100ms',
      )
    })

    test('should track process with guard when provided', async () => {
      // Arrange
      const trackProcessSpy = vi.spyOn(guard, 'trackProcess')

      // Act
      await execWithTimeout('echo', ['test'], 5000, guard)

      // Assert
      expect(trackProcessSpy).toHaveBeenCalledWith(expect.anything(), 'echo test', 5000)
    })

    test('should handle process errors', async () => {
      // Act & Assert
      await expect(execWithTimeout('nonexistent-command', [])).rejects.toThrow(
        'Process execution failed',
      )
    })

    test('should handle non-zero exit codes', async () => {
      // Act
      const result = await execWithTimeout('node', ['-e', 'process.exit(1)'])

      // Assert
      expect(result.exitCode).toBe(1)
    })
  })

  describe('execSyncTest', () => {
    test('should execute command and return string output', () => {
      // Act
      const result = execSyncTest('echo "test"')

      // Assert
      expect(typeof result).toBe('string')
      expect(result.trim()).toBe('test')
    })

    test('should use default options for test execution', () => {
      // Act
      const result = execSyncTest('echo "test"')

      // Assert
      expect(result).toBe('test\n')
    })

    test('should accept custom options', () => {
      // Act
      const result = execSyncTest('echo "test"', { timeout: 1000 })

      // Assert
      expect(result.trim()).toBe('test')
    })
  })

  describe('execSyncQuiet', () => {
    test('should return true for successful commands', () => {
      // Act
      const result = execSyncQuiet('echo "test"')

      // Assert
      expect(result).toBe(true)
    })

    test('should return false for failed commands', () => {
      // Act
      const result = execSyncQuiet('exit 1')

      // Assert
      expect(result).toBe(false)
    })

    test('should suppress output completely', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Act
      const result = execSyncQuiet('echo "should not see this"')

      // Assert
      expect(result).toBe(true)
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('isCommandAvailable', () => {
    test('should return true for available commands', () => {
      // Act
      const result = isCommandAvailable('echo')

      // Assert
      expect(result).toBe(true)
    })

    test('should return false for unavailable commands', () => {
      // Act
      const result = isCommandAvailable('definitely-not-a-real-command-12345')

      // Assert
      expect(result).toBe(false)
    })

    test('should handle timeout for slow commands', () => {
      // Act
      const result = isCommandAvailable('echo')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('execWithRetry', () => {
    test('should succeed on first attempt for successful commands', async () => {
      // Act
      const result = await execWithRetry('echo', ['test'])

      // Assert
      expect(result.stdout).toBe('test')
      expect(result.exitCode).toBe(0)
    })

    test('should retry failed commands', async () => {
      // Arrange
      let attempts = 0
      const _mockSpawn = vi.fn(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Mock failure')
        }
        return spawn('echo', ['success'])
      })

      // Act & Assert
      await expect(
        execWithRetry('failing-command', [], { retries: 2, retryDelay: 10 }),
      ).rejects.toThrow()
    })

    test('should use custom retry options', async () => {
      // Act & Assert
      await expect(
        execWithRetry('exit', ['1'], { retries: 1, retryDelay: 10, timeout: 100 }),
      ).rejects.toThrow()
    })

    test('should track process with guard when provided', async () => {
      // Act
      await execWithRetry('echo', ['test'], { guard })

      // Assert - Process should have been tracked and cleaned up
      const stats = guard.getStats()
      expect(stats.processesTracked).toBeGreaterThanOrEqual(1)
    })
  })

  describe('TestProcessManager', () => {
    let manager: TestProcessManager

    beforeEach(() => {
      manager = new TestProcessManager(guard)
    })

    test('should create manager without guard', () => {
      // Act
      const managerWithoutGuard = new TestProcessManager()

      // Assert
      expect(managerWithoutGuard).toBeDefined()
      expect(managerWithoutGuard.execSync).toBeInstanceOf(Function)
    })

    test('should execute sync commands', () => {
      // Act
      const result = manager.execSync('echo "test"')

      // Assert
      expect(result.trim()).toBe('test')
    })

    test('should execute quiet commands', () => {
      // Act
      const result = manager.execQuiet('echo "test"')

      // Assert
      expect(result).toBe(true)
    })

    test('should execute async commands', async () => {
      // Act
      const result = await manager.exec('echo', ['test'])

      // Assert
      expect(result.stdout).toBe('test')
      expect(result.exitCode).toBe(0)
    })

    test('should spawn processes with guard tracking', () => {
      // Act
      const child = manager.spawn('echo', ['test'])

      // Assert
      expect(child).toBeDefined()
      expect(child.pid).toBeDefined()
      const activeProcesses = guard.getActiveProcesses()
      expect(activeProcesses).toHaveLength(1)
    })

    test('should check command availability', () => {
      // Act
      const available = manager.isAvailable('echo')
      const unavailable = manager.isAvailable('definitely-not-a-command')

      // Assert
      expect(available).toBe(true)
      expect(unavailable).toBe(false)
    })

    test('should pass options to spawn', () => {
      // Act
      const child = manager.spawn('echo', ['test'], { stdio: 'pipe' })

      // Assert
      expect(child.stdout).toBeDefined()
      expect(child.stderr).toBeDefined()
    })

    test('should pass timeout to exec', async () => {
      // Act
      const result = await manager.exec('echo', ['test'], 1000)

      // Assert
      expect(result.stdout).toBe('test')
    })
  })

  describe('error handling and edge cases', () => {
    test('should handle empty command arrays', async () => {
      // Act
      const result = await execWithTimeout('echo', [])

      // Assert
      expect(result.stdout).toBe('')
      expect(result.exitCode).toBe(0)
    })

    test('should handle commands with special characters', () => {
      // Act
      const result = execSyncTest('echo "hello & world"')

      // Assert
      expect(result.trim()).toBe('hello & world')
    })

    test('should handle large output within buffer limits', () => {
      // Act
      const result = execSyncSafe('echo "' + 'x'.repeat(1000) + '"', {
        maxBuffer: 2000,
      })

      // Assert
      expect(result.toString().trim()).toBe('x'.repeat(1000))
    })

    test('should handle process cleanup on timeout', async () => {
      // Arrange
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      // Act & Assert
      await expect(execWithTimeout('sleep', ['5'], 100)).rejects.toThrow('timed out')

      killSpy.mockRestore()
    })

    test('should handle process exit events properly', async () => {
      // Act
      const result = await execWithTimeout('echo', ['exit-test'])

      // Assert
      expect(result.stdout).toBe('exit-test')
      expect(result.exitCode).toBe(0)
    })
  })

  describe('integration with TestResourceGuard', () => {
    test('should track multiple processes simultaneously', () => {
      // Act
      const _child1 = spawnSafe('echo', ['test1'], { guard })
      const _child2 = spawnSafe('echo', ['test2'], { guard })

      // Assert
      const activeProcesses = guard.getActiveProcesses()
      expect(activeProcesses).toHaveLength(2)
    })

    test('should clean up all tracked processes', async () => {
      // Arrange
      const _child1 = spawnSafe('sleep', ['1'], { guard })
      const _child2 = spawnSafe('sleep', ['1'], { guard })

      // Act
      await guard.cleanup()

      // Assert
      const stats = guard.getStats()
      expect(stats.processesKilled).toBe(2)
      expect(guard.getActiveProcesses()).toHaveLength(0)
    })

    test('should handle process manager with guard properly', async () => {
      // Arrange
      const manager = new TestProcessManager(guard)

      // Act
      manager.spawn('echo', ['test1'])
      manager.spawn('echo', ['test2'])
      await manager.exec('echo', ['test3'])

      // Assert
      const stats = guard.getStats()
      expect(stats.processesTracked).toBeGreaterThanOrEqual(2)
    })
  })
})
