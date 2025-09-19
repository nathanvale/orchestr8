/**
 * Secure Git Operations Tests
 * Tests for secure spawn-based git command execution with proper security measures
 */

import { afterEach, beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { SecureGitOperations } from './secure-git-operations.js'

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  killed = false
  exitCode: number | null = 0
  pid = 12345
  kill = vi.fn((_signal?: string) => {
    this.killed = true
    this.emit('close', this.exitCode)
    return true
  })
}

describe('SecureGitOperations', () => {
  let mockSpawn: MockedFunction<typeof spawn>
  let mockChild: MockChildProcess

  beforeEach(() => {
    mockSpawn = vi.mocked(spawn)
    mockChild = new MockChildProcess()
    mockSpawn.mockReturnValue(mockChild as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('path normalization', () => {
    it('should handle absolute paths correctly', async () => {
      const absolutePaths = ['/Users/test/file.ts', '/home/user/project/file.js']

      // Test with addFiles which uses path normalization
      const promise = SecureGitOperations.addFiles(absolutePaths)

      // Simulate successful command
      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['add', '--', ...absolutePaths],
        expect.any(Object),
      )
    })

    it('should resolve relative paths against cwd', async () => {
      const cwd = '/Users/test/project'
      const relativePaths = ['src/file1.ts', 'lib/file2.js']

      const promise = SecureGitOperations.addFiles(relativePaths, { cwd })

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['add', '--', '/Users/test/project/src/file1.ts', '/Users/test/project/lib/file2.js'],
        expect.objectContaining({ cwd }),
      )
    })

    it('should sanitize paths with null bytes', async () => {
      const maliciousPaths = ['file\0.ts', 'test\0\0.js']

      const promise = SecureGitOperations.addFiles(maliciousPaths)

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      // Should have removed null bytes
      const expectedPaths = maliciousPaths.map((p) => p.replace(/\0/g, ''))
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['add', '--', ...expectedPaths.map((p) => expect.stringContaining(p.replace(/\0/g, '')))],
        expect.any(Object),
      )
    })

    it('should reject empty file paths', async () => {
      await expect(SecureGitOperations.addFiles(['', 'valid.ts'])).rejects.toThrow(
        'File path cannot be empty',
      )
    })
  })

  describe('command execution security', () => {
    it('should use -- separator to prevent option injection', async () => {
      const filesWithDashes = ['--help', '-f', 'normal-file.ts']

      const promise = SecureGitOperations.addFiles(filesWithDashes)

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        [
          'add',
          '--',
          expect.stringContaining('--help'),
          expect.stringContaining('-f'),
          expect.stringContaining('normal-file.ts'),
        ],
        expect.any(Object),
      )
    })

    it('should validate git references to prevent injection', async () => {
      const maliciousRefs = [
        'main; rm -rf /',
        'main && echo "pwned"',
        'main | cat /etc/passwd',
        '../../../etc/passwd',
      ]

      for (const ref of maliciousRefs) {
        await expect(SecureGitOperations.getChangedFiles(ref)).rejects.toThrow(
          'Invalid git reference format',
        )
      }
    })

    it('should accept valid git references', async () => {
      const validRefs = ['main', 'develop', 'feature-branch', 'v1.2.3', 'HEAD~1', 'abc123def']

      for (const ref of validRefs) {
        const promise = SecureGitOperations.getChangedFiles(ref)

        mockChild.exitCode = 0
        process.nextTick(() => {
          mockChild.stdout.emit('data', 'file1.ts\nfile2.js\n')
          mockChild.emit('close', 0)
        })

        const result = await promise
        expect(result.success).toBe(true)
      }
    })
  })

  describe('timeout handling', () => {
    it('should timeout long-running commands', async () => {
      vi.useFakeTimers()

      const promise = SecureGitOperations.getStagedFiles({ timeout: 100 })

      // Don't emit close event to simulate a long-running command
      // Advance timers to trigger timeout
      vi.advanceTimersByTime(150)

      // Now emit close to complete the promise after timeout
      process.nextTick(() => mockChild.emit('close', 0))

      await vi.runAllTimersAsync()

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.timedOut).toBe(true)
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM')

      vi.useRealTimers()
    })

    it('should use default timeout when not specified', async () => {
      const promise = SecureGitOperations.getStagedFiles()

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      // Should not timeout immediately
      expect(mockChild.killed).toBe(false)
    })

    it('should complete before timeout for fast commands', async () => {
      const promise = SecureGitOperations.getStagedFiles({ timeout: 5000 })

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'file1.ts\nfile2.js\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.timedOut).toBe(false)
      expect(result.stdout).toBe('file1.ts\nfile2.js')
    })
  })

  describe('error handling', () => {
    it('should handle spawn errors', async () => {
      const promise = SecureGitOperations.getStagedFiles()

      process.nextTick(() => {
        mockChild.emit('error', new Error('Command not found'))
      })

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.stderr).toBe('Command not found')
      expect(result.exitCode).toBe(null)
    })

    it('should handle non-zero exit codes', async () => {
      const promise = SecureGitOperations.getStagedFiles()

      mockChild.exitCode = 128
      process.nextTick(() => {
        mockChild.stderr.emit('data', 'fatal: not a git repository\n')
        mockChild.emit('close', 128)
      })

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(128)
      expect(result.stderr).toBe('fatal: not a git repository')
    })

    it('should capture both stdout and stderr', async () => {
      const promise = SecureGitOperations.getStatus()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'M  file.ts\n')
        mockChild.stderr.emit('data', 'warning: LF will be replaced by CRLF\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('M  file.ts')
      expect(result.stderr).toBe('warning: LF will be replaced by CRLF')
    })
  })

  describe('addFiles', () => {
    it('should handle empty file list', async () => {
      const result = await SecureGitOperations.addFiles([])

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('')
      expect(mockSpawn).not.toHaveBeenCalled()
    })

    it('should stage multiple files', async () => {
      const files = ['src/file1.ts', 'lib/file2.js', 'docs/readme.md']
      const promise = SecureGitOperations.addFiles(files)

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      const result = await promise

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['add', '--', ...files.map((f) => expect.stringContaining(f))],
        expect.any(Object),
      )
    })
  })

  describe('getStagedFiles', () => {
    it('should get staged files successfully', async () => {
      const promise = SecureGitOperations.getStagedFiles()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'src/file1.ts\nlib/file2.js\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('src/file1.ts\nlib/file2.js')
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['diff', '--cached', '--name-only', '--diff-filter=ACM'],
        expect.any(Object),
      )
    })
  })

  describe('getChangedFiles', () => {
    it('should get files changed since reference', async () => {
      const promise = SecureGitOperations.getChangedFiles('main')

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'src/modified.ts\nlib/new.js\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('src/modified.ts\nlib/new.js')
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['diff', 'main...HEAD', '--name-only', '--diff-filter=ACM'],
        expect.any(Object),
      )
    })

    it('should reject empty git reference', async () => {
      await expect(SecureGitOperations.getChangedFiles('')).rejects.toThrow(
        'Git reference must be a non-empty string',
      )
    })
  })

  describe('getStatus', () => {
    it('should get git status without files', async () => {
      const promise = SecureGitOperations.getStatus()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'M  file1.ts\nA  file2.js\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('M  file1.ts\nA  file2.js')
      expect(mockSpawn).toHaveBeenCalledWith('git', ['status', '--porcelain'], expect.any(Object))
    })

    it('should get git status for specific files', async () => {
      const files = ['src/file1.ts', 'lib/file2.js']
      const promise = SecureGitOperations.getStatus(files)

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'M  src/file1.ts\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['status', '--porcelain', '--', ...files.map((f) => expect.stringContaining(f))],
        expect.any(Object),
      )
    })
  })

  describe('isGitRepository', () => {
    it('should return true for valid git repository', async () => {
      const promise = SecureGitOperations.isGitRepository()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', '.git\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result).toBe(true)
    })

    it('should return false for non-git directory', async () => {
      const promise = SecureGitOperations.isGitRepository()

      mockChild.exitCode = 128
      process.nextTick(() => {
        mockChild.stderr.emit('data', 'fatal: not a git repository\n')
        mockChild.emit('close', 128)
      })

      const result = await promise

      expect(result).toBe(false)
    })
  })

  describe('getGitDir', () => {
    it('should get git directory path', async () => {
      const promise = SecureGitOperations.getGitDir()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', '/path/to/project/.git\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('/path/to/project/.git')
    })
  })

  describe('getDiffCached', () => {
    it('should get cached diff without files', async () => {
      const promise = SecureGitOperations.getDiffCached()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'file1.ts\nfile2.js\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['diff', '--cached', '--name-only'],
        expect.any(Object),
      )
    })

    it('should get cached diff for specific files', async () => {
      const files = ['src/file1.ts']
      const promise = SecureGitOperations.getDiffCached(files)

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'src/file1.ts\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['diff', '--cached', '--name-only', '--', expect.stringContaining('src/file1.ts')],
        expect.any(Object),
      )
    })
  })

  describe('getDiff', () => {
    it('should get working tree diff', async () => {
      const promise = SecureGitOperations.getDiff()

      mockChild.exitCode = 0
      process.nextTick(() => {
        mockChild.stdout.emit('data', 'modified.ts\n')
        mockChild.emit('close', 0)
      })

      const result = await promise

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', '--name-only'], expect.any(Object))
    })
  })

  describe('environment options', () => {
    it('should pass custom environment variables', async () => {
      const customEnv = { GIT_CONFIG_GLOBAL: '/dev/null' }
      const promise = SecureGitOperations.getStagedFiles({ env: customEnv })

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining(customEnv),
        }),
      )
    })

    it('should respect captureOutput option', async () => {
      const promise = SecureGitOperations.getStagedFiles({ captureOutput: false })

      mockChild.exitCode = 0
      process.nextTick(() => mockChild.emit('close', 0))

      await promise

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.objectContaining({
          stdio: ['ignore', 'ignore', 'pipe'],
          shell: false,
          windowsHide: true,
        }),
      )
    })
  })
})
