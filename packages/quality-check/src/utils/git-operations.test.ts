/**
 * Git Operations Tests
 * Tests for git file modification detection and staging functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { GitOperations } from './git-operations.js'

// Mock node modules
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    accessSync: vi.fn(),
    openSync: vi.fn(),
    closeSync: vi.fn(),
    constants: { R_OK: 4 },
  },
}))

import { execSync } from 'node:child_process'

describe('GitOperations', () => {
  let gitOps: GitOperations
  let mockExecSync: ReturnType<typeof vi.fn>
  let mockExistsSync: ReturnType<typeof vi.fn>
  let mockReadFileSync: ReturnType<typeof vi.fn>
  let mockStatSync: ReturnType<typeof vi.fn>
  let mockAccessSync: ReturnType<typeof vi.fn>
  let mockOpenSync: ReturnType<typeof vi.fn>
  let mockCloseSync: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gitOps = new GitOperations()
    mockExecSync = vi.mocked(execSync)
    mockExistsSync = vi.mocked(fs.existsSync)
    mockReadFileSync = vi.mocked(fs.readFileSync)
    mockStatSync = vi.mocked(fs.statSync)
    mockAccessSync = vi.mocked(fs.accessSync)
    mockOpenSync = vi.mocked(fs.openSync)
    mockCloseSync = vi.mocked(fs.closeSync)

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('captureFileStates', () => {
    it('should capture file states for existing files', () => {
      const files = ['file1.ts', 'file2.ts']
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockImplementation((file) => `content of ${file}`)

      gitOps.captureFileStates(files)

      expect(mockExistsSync).toHaveBeenCalledTimes(2)
      expect(mockReadFileSync).toHaveBeenCalledTimes(2)
    })

    it('should skip non-existent files', () => {
      const files = ['exists.ts', 'missing.ts']
      mockExistsSync.mockImplementation((file) => file === 'exists.ts')
      mockReadFileSync.mockReturnValue('content')

      gitOps.captureFileStates(files)

      expect(mockReadFileSync).toHaveBeenCalledTimes(1)
      expect(mockReadFileSync).toHaveBeenCalledWith('exists.ts', 'utf-8')
    })

    it('should handle read errors gracefully', () => {
      const files = ['file.ts']
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      // Should not throw
      expect(() => gitOps.captureFileStates(files)).not.toThrow()
    })
  })

  describe('detectModifiedFiles', () => {
    it('should detect modified files', () => {
      const files = ['file1.ts', 'file2.ts']
      mockExistsSync.mockReturnValue(true)

      // First capture with original content
      mockReadFileSync.mockImplementation((file) => `original content of ${file}`)
      gitOps.captureFileStates(files)

      // Then mock changed content for file1
      mockReadFileSync.mockImplementation((file) =>
        file === 'file1.ts' ? 'modified content' : `original content of ${file}`,
      )

      const result = gitOps.detectModifiedFiles()

      expect(result.modifiedFiles).toEqual(['file1.ts'])
      expect(result.errors).toEqual([])
    })

    it('should skip deleted files', () => {
      const files = ['file1.ts', 'file2.ts']
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('content')
      gitOps.captureFileStates(files)

      // Mock file2 as deleted
      mockExistsSync.mockImplementation((file) => file === 'file1.ts')

      const result = gitOps.detectModifiedFiles()

      expect(result.modifiedFiles).not.toContain('file2.ts')
    })

    it('should handle read errors and report them', () => {
      const files = ['file.ts']
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('original')
      gitOps.captureFileStates(files)

      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error')
      })

      const result = gitOps.detectModifiedFiles()

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Error checking file.ts')
    })
  })

  describe('stageFiles', () => {
    it('should stage files successfully', () => {
      mockExecSync.mockReturnValue('')

      const result = gitOps.stageFiles(['file1.ts', 'file2.ts'])

      expect(result.success).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith('git add "file1.ts" "file2.ts"', {
        encoding: 'utf-8',
      })
    })

    it('should handle empty file list', () => {
      const result = gitOps.stageFiles([])

      expect(result.success).toBe(true)
      expect(mockExecSync).not.toHaveBeenCalled()
    })

    it('should retry on index.lock error', () => {
      let attempts = 0
      mockExecSync.mockImplementation(() => {
        attempts++
        if (attempts === 1) {
          const error = new Error('fatal: Unable to create .git/index.lock')
          throw error
        }
        return ''
      })

      vi.useFakeTimers()
      const result = gitOps.stageFiles(['file.ts'])
      vi.runAllTimers()
      vi.useRealTimers()

      expect(result.success).toBe(true)
    })

    it('should provide helpful error for permission denied', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = gitOps.stageFiles(['file.ts'])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })

    it('should handle pathspec errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("pathspec 'nonexistent.ts' did not match any files")
      })

      const result = gitOps.stageFiles(['nonexistent.ts'])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Some files could not be found')
    })
  })

  describe('hasPartialStaging', () => {
    it('should detect partial staging', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('--cached')) {
          return 'file.ts\n'
        }
        if (cmd.includes('git diff --name-only')) {
          return 'file.ts\nother.ts\n'
        }
        return ''
      })

      const result = gitOps.hasPartialStaging('file.ts')

      expect(result).toBe(true)
    })

    it('should return false for fully staged files', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('--cached')) {
          return 'file.ts\n'
        }
        return ''
      })

      const result = gitOps.hasPartialStaging('file.ts')

      expect(result).toBe(false)
    })

    it('should handle git command errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      const result = gitOps.hasPartialStaging('file.ts')

      expect(result).toBe(false)
    })
  })

  describe('getRepositoryState', () => {
    it('should detect rebase state', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('git status')) return ''
        if (cmd.includes('git rev-parse')) return '/path/to/.git'
        return ''
      })
      mockExistsSync.mockImplementation((path) => path.includes('rebase-merge'))

      const state = gitOps.getRepositoryState()

      expect(state.inRebase).toBe(true)
      expect(state.hasConflicts).toBe(false)
      expect(state.isMerging).toBe(false)
    })

    it('should detect merge conflicts', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('git status')) return 'UU file.ts'
        if (cmd.includes('git rev-parse')) return '/path/to/.git'
        return ''
      })
      mockExistsSync.mockReturnValue(false)

      const state = gitOps.getRepositoryState()

      expect(state.hasConflicts).toBe(true)
    })

    it('should detect merge state', () => {
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('git status')) return ''
        if (cmd.includes('git rev-parse')) return '/path/to/.git'
        return ''
      })
      mockExistsSync.mockImplementation((path) => path.includes('MERGE_HEAD'))

      const state = gitOps.getRepositoryState()

      expect(state.isMerging).toBe(true)
    })

    it('should handle non-git directories', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      const state = gitOps.getRepositoryState()

      expect(state.inRebase).toBe(false)
      expect(state.hasConflicts).toBe(false)
      expect(state.isMerging).toBe(false)
    })
  })

  describe('handleEdgeCases', () => {
    it('should filter out non-existent files', () => {
      mockExistsSync.mockImplementation((file) => file === 'exists.ts')
      mockAccessSync.mockReturnValue(undefined)
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockOpenSync.mockReturnValue(1)
      mockCloseSync.mockReturnValue(undefined)

      const result = gitOps.handleEdgeCases(['exists.ts', 'missing.ts'])

      expect(result.readableFiles).toEqual(['exists.ts'])
      expect(result.skippedFiles).toEqual(['missing.ts'])
      expect(result.reasons.get('missing.ts')).toBe('File does not exist')
    })

    it('should filter out directories', () => {
      mockExistsSync.mockReturnValue(true)
      mockAccessSync.mockReturnValue(undefined)
      mockStatSync.mockReturnValue({ isDirectory: () => true })

      const result = gitOps.handleEdgeCases(['some-dir'])

      expect(result.readableFiles).toEqual([])
      expect(result.skippedFiles).toEqual(['some-dir'])
      expect(result.reasons.get('some-dir')).toBe('Path is a directory')
    })

    it('should detect locked files', () => {
      mockExistsSync.mockReturnValue(true)
      mockAccessSync.mockReturnValue(undefined)
      mockStatSync.mockReturnValue({ isDirectory: () => false })
      mockOpenSync.mockImplementation(() => {
        throw new Error('EACCES')
      })

      const result = gitOps.handleEdgeCases(['locked.ts'])

      expect(result.readableFiles).toEqual([])
      expect(result.skippedFiles).toEqual(['locked.ts'])
      expect(result.reasons.get('locked.ts')).toBe('File is locked or in use')
    })
  })

  describe('clearFileStates', () => {
    it('should clear captured file states', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('content')

      gitOps.captureFileStates(['file.ts'])
      gitOps.clearFileStates()

      // After clearing, no files should be detected as modified
      // since there's no baseline to compare against
      const result = gitOps.detectModifiedFiles(['file.ts'])

      expect(result.modifiedFiles).toEqual([])
    })
  })
})
