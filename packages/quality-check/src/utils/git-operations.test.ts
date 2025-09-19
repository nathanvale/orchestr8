/**
 * Git Operations Tests
 * Tests for git file modification detection and staging functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, statSync, openSync, closeSync } from 'node:fs'
import { GitOperations } from './git-operations.js'
import { SecureGitOperations } from './secure-git-operations.js'

// Mock SecureGitOperations
vi.mock('./secure-git-operations.js', () => ({
  SecureGitOperations: {
    addFiles: vi.fn(),
    getDiffCached: vi.fn(),
    getDiff: vi.fn(),
    getGitDir: vi.fn(),
    getStatus: vi.fn(),
    isGitRepository: vi.fn(),
  },
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  openSync: vi.fn(),
  closeSync: vi.fn(),
}))

describe('GitOperations', () => {
  let gitOps: GitOperations
  let mockExistsSync: ReturnType<typeof vi.fn>
  let mockReadFileSync: ReturnType<typeof vi.fn>
  let mockStatSync: ReturnType<typeof vi.fn>
  let mockOpenSync: ReturnType<typeof vi.fn>
  let mockCloseSync: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gitOps = new GitOperations()
    mockExistsSync = vi.mocked(existsSync)
    mockReadFileSync = vi.mocked(readFileSync)
    mockStatSync = vi.mocked(statSync)
    mockOpenSync = vi.mocked(openSync)
    mockCloseSync = vi.mocked(closeSync)

    // Reset all mocks
    vi.clearAllMocks()

    // Reset SecureGitOperations mocks
    vi.mocked(SecureGitOperations.addFiles).mockReset()
    vi.mocked(SecureGitOperations.getDiffCached).mockReset()
    vi.mocked(SecureGitOperations.getDiff).mockReset()
    vi.mocked(SecureGitOperations.getGitDir).mockReset()
    vi.mocked(SecureGitOperations.getStatus).mockReset()
    vi.mocked(SecureGitOperations.isGitRepository).mockReset()
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
    it('should stage files successfully', async () => {
      vi.mocked(SecureGitOperations.addFiles).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const result = await gitOps.stageFiles(['file1.ts', 'file2.ts'])

      expect(result.success).toBe(true)
      expect(vi.mocked(SecureGitOperations.addFiles)).toHaveBeenCalledWith(['file1.ts', 'file2.ts'])
    })

    it('should handle empty file list', async () => {
      const result = await gitOps.stageFiles([])

      expect(result.success).toBe(true)
    })

    it('should retry on index.lock error', async () => {
      let attempts = 0
      vi.mocked(SecureGitOperations.addFiles).mockImplementation(() => {
        attempts++
        if (attempts === 1) {
          return Promise.resolve({
            success: false,
            stderr: 'fatal: Unable to create .git/index.lock',
            exitCode: 1,
            timedOut: false,
          })
        }
        return Promise.resolve({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })
      })

      vi.useFakeTimers()
      const result = await gitOps.stageFiles(['file.ts'])
      vi.runAllTimers()
      vi.useRealTimers()

      expect(result.success).toBe(true)
      expect(vi.mocked(SecureGitOperations.addFiles)).toHaveBeenCalledTimes(2)
    })

    it('should provide helpful error for permission denied', async () => {
      vi.mocked(SecureGitOperations.addFiles).mockResolvedValue({
        success: false,
        stderr: 'Permission denied',
        exitCode: 1,
        timedOut: false,
      })

      const result = await gitOps.stageFiles(['file.ts'])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })

    it('should handle pathspec errors', async () => {
      vi.mocked(SecureGitOperations.addFiles).mockResolvedValue({
        success: false,
        stderr: "pathspec 'nonexistent.ts' did not match any files",
        exitCode: 1,
        timedOut: false,
      })

      const result = await gitOps.stageFiles(['nonexistent.ts'])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Some files could not be found')
    })
  })

  describe('hasPartialStaging', () => {
    it('should detect partial staging', async () => {
      vi.mocked(SecureGitOperations.getDiffCached).mockResolvedValue({
        success: true,
        stdout: 'file.ts\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      vi.mocked(SecureGitOperations.getDiff).mockResolvedValue({
        success: true,
        stdout: 'file.ts\nother.ts\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const result = await gitOps.hasPartialStaging('file.ts')

      expect(result).toBe(true)
      expect(vi.mocked(SecureGitOperations.getDiffCached)).toHaveBeenCalledWith(['file.ts'])
      expect(vi.mocked(SecureGitOperations.getDiff)).toHaveBeenCalledWith(['file.ts'])
    })

    it('should return false for fully staged files', async () => {
      vi.mocked(SecureGitOperations.getDiffCached).mockResolvedValue({
        success: true,
        stdout: 'file.ts\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      vi.mocked(SecureGitOperations.getDiff).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const result = await gitOps.hasPartialStaging('file.ts')

      expect(result).toBe(false)
    })

    it('should handle git command errors', async () => {
      vi.mocked(SecureGitOperations.getDiffCached).mockResolvedValue({
        success: false,
        stderr: 'Not a git repository',
        exitCode: 128,
        timedOut: false,
      })
      vi.mocked(SecureGitOperations.getDiff).mockResolvedValue({
        success: false,
        stderr: 'Not a git repository',
        exitCode: 128,
        timedOut: false,
      })

      const result = await gitOps.hasPartialStaging('file.ts')

      expect(result).toBe(false)
    })
  })

  describe('getRepositoryState', () => {
    it('should detect rebase state', async () => {
      vi.mocked(SecureGitOperations.getGitDir).mockResolvedValue({
        success: true,
        stdout: '/path/to/.git',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      vi.mocked(SecureGitOperations.getStatus).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      mockExistsSync.mockImplementation((path) => path.includes('rebase-merge'))

      const state = await gitOps.getRepositoryState()

      expect(state.inRebase).toBe(true)
      expect(state.hasConflicts).toBe(false)
      expect(state.isMerging).toBe(false)
    })

    it('should detect merge conflicts', async () => {
      vi.mocked(SecureGitOperations.getGitDir).mockResolvedValue({
        success: true,
        stdout: '/path/to/.git',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      vi.mocked(SecureGitOperations.getStatus).mockResolvedValue({
        success: true,
        stdout: 'UU file.ts',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      mockExistsSync.mockReturnValue(false)

      const state = await gitOps.getRepositoryState()

      expect(state.hasConflicts).toBe(true)
    })

    it('should detect merge state', async () => {
      vi.mocked(SecureGitOperations.getGitDir).mockResolvedValue({
        success: true,
        stdout: '/path/to/.git',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      vi.mocked(SecureGitOperations.getStatus).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
      mockExistsSync.mockImplementation((path) => path.includes('MERGE_HEAD'))

      const state = await gitOps.getRepositoryState()

      expect(state.isMerging).toBe(true)
    })

    it('should handle non-git directories', async () => {
      vi.mocked(SecureGitOperations.getGitDir).mockRejectedValue(new Error('Not a git repository'))

      const state = await gitOps.getRepositoryState()

      expect(state.inRebase).toBe(false)
      expect(state.hasConflicts).toBe(false)
      expect(state.isMerging).toBe(false)
    })
  })

  describe('handleEdgeCases', () => {
    it('should filter out non-existent files', () => {
      mockExistsSync.mockImplementation((file) => file === 'exists.ts')
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
      mockStatSync.mockReturnValue({ isDirectory: () => true })

      const result = gitOps.handleEdgeCases(['some-dir'])

      expect(result.readableFiles).toEqual([])
      expect(result.skippedFiles).toEqual(['some-dir'])
      expect(result.reasons.get('some-dir')).toBe('Path is a directory')
    })

    it('should detect locked files', () => {
      mockExistsSync.mockReturnValue(true)
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
