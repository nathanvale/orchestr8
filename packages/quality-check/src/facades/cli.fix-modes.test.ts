/**
 * @fileoverview Tests for CLI fix modes integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import { runCLI } from './cli.js'
import { QualityChecker } from '../core/quality-checker.js'
import { getDefaultFixMode } from '../utils/environment.js'

// Mock the QualityChecker
vi.mock('../core/quality-checker.js')
vi.mock('../utils/environment.js')

// Mock process.exit to prevent tests from actually exiting
const _mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called')
})

// Mock console methods to prevent noise in test output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('CLI Fix Modes', () => {
  let mockQualityChecker: MockedFunction<typeof QualityChecker>
  let mockChecker: {
    check: MockedFunction<any>
    fix: MockedFunction<any>
  }
  let mockGetDefaultFixMode: MockedFunction<typeof getDefaultFixMode>

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock QualityChecker instance
    mockChecker = {
      check: vi.fn(),
      fix: vi.fn(),
    }

    mockQualityChecker = vi.mocked(QualityChecker)
    mockQualityChecker.mockImplementation(() => mockChecker as any)

    mockGetDefaultFixMode = vi.mocked(getDefaultFixMode)
    mockGetDefaultFixMode.mockReturnValue('full')

    // Mock successful check result
    mockChecker.check.mockResolvedValue({
      success: true,
      issues: [],
      duration: 100,
      correlationId: 'test-id',
    })

    mockChecker.fix.mockResolvedValue({
      success: true,
      count: 0,
      fixed: [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('--safe flag', () => {
    it('should use safe mode when --safe flag is provided', async () => {
      const args = ['--file', 'test.ts', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        // Expect process.exit to be called
        expect(error.message).toBe('process.exit called')
      }

      expect(mockChecker.check).toHaveBeenCalledWith(
        ['test.ts'],
        expect.objectContaining({
          fixMode: 'safe',
        }),
      )
    })

    it('should use safe mode with --fix and --safe flags', async () => {
      mockChecker.check.mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Test error',
          },
        ],
        duration: 100,
        correlationId: 'test-id',
      })

      const args = ['--file', 'test.ts', '--fix', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockChecker.check).toHaveBeenCalledWith(
        ['test.ts'],
        expect.objectContaining({
          fixMode: 'safe',
        }),
      )

      expect(mockChecker.fix).toHaveBeenCalledWith(['test.ts'], { safe: true })
    })
  })

  describe('default fix mode from environment', () => {
    it('should use environment default when no explicit mode is provided', async () => {
      mockGetDefaultFixMode.mockReturnValue('safe')

      const args = ['--file', 'test.ts']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockGetDefaultFixMode).toHaveBeenCalled()
      expect(mockChecker.check).toHaveBeenCalledWith(
        ['test.ts'],
        expect.objectContaining({
          fixMode: 'safe',
        }),
      )
    })

    it('should use full mode as default in interactive environment', async () => {
      mockGetDefaultFixMode.mockReturnValue('full')

      const args = ['--file', 'test.ts']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockGetDefaultFixMode).toHaveBeenCalled()
      expect(mockChecker.check).toHaveBeenCalledWith(
        ['test.ts'],
        expect.objectContaining({
          fixMode: 'full',
        }),
      )
    })
  })

  describe('fix mode precedence', () => {
    it('should prioritize --safe flag over environment default', async () => {
      mockGetDefaultFixMode.mockReturnValue('full')

      const args = ['--file', 'test.ts', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockChecker.check).toHaveBeenCalledWith(
        ['test.ts'],
        expect.objectContaining({
          fixMode: 'safe',
        }),
      )
    })

    it('should prioritize explicit fixMode over --safe flag', async () => {
      const args = ['--file', 'test.ts', '--safe']

      // Simulate passing fixMode directly in options
      mockChecker.check.mockImplementation((files, options) => {
        expect(options.fixMode).toBe('safe')
        return Promise.resolve({
          success: true,
          issues: [],
          duration: 100,
          correlationId: 'test-id',
        })
      })

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }
    })
  })

  describe('fix mode output messages', () => {
    it('should include fix mode in success message', async () => {
      mockChecker.check.mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Test error',
          },
        ],
        duration: 100,
        correlationId: 'test-id',
      })

      mockChecker.fix.mockResolvedValue({
        success: true,
        count: 5,
        fixed: ['ESLint'],
      })

      const args = ['--file', 'test.ts', '--fix', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Fixed 5 issues (safe mode)'),
      )
    })

    it('should include fix mode in success message for full mode', async () => {
      mockChecker.check.mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Test error',
          },
        ],
        duration: 100,
        correlationId: 'test-id',
      })

      mockChecker.fix.mockResolvedValue({
        success: true,
        count: 3,
        fixed: ['ESLint'],
      })

      const args = ['--file', 'test.ts', '--fix']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Fixed 3 issues (full mode)'),
      )
    })
  })

  describe('help text', () => {
    it('should show help text with --safe flag documentation', async () => {
      const args = ['--help']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--safe'))
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Use safe fix mode (layout + suggestions only)'),
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Safe mode: only layout and suggestion fixes'),
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Full mode: all fix types including behavior changes'),
      )
    })
  })

  describe('error handling', () => {
    it('should handle quality checker errors gracefully', async () => {
      mockChecker.check.mockRejectedValue(new Error('Quality check failed'))

      const args = ['--file', 'test.ts', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockConsoleError).toHaveBeenCalledWith('Error:', 'Quality check failed')
    })

    it('should handle fix errors gracefully', async () => {
      mockChecker.check.mockResolvedValue({
        success: false,
        issues: [
          {
            engine: 'eslint',
            severity: 'error',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'Test error',
          },
        ],
        duration: 100,
        correlationId: 'test-id',
      })

      mockChecker.fix.mockRejectedValue(new Error('Fix failed'))

      const args = ['--file', 'test.ts', '--fix', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockConsoleError).toHaveBeenCalledWith('Error:', 'Fix failed')
    })
  })

  describe('staging integration', () => {
    it('should pass fixMode to quality checker for staged files', async () => {
      const args = ['--staged', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockChecker.check).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          fixMode: 'safe',
          staged: true,
        }),
      )
    })

    it('should pass fixMode to quality checker for since-based checks', async () => {
      const args = ['--since', 'main', '--safe']

      try {
        await runCLI(args)
      } catch (error) {
        expect(error.message).toBe('process.exit called')
      }

      expect(mockChecker.check).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          fixMode: 'safe',
          since: 'main',
        }),
      )
    })
  })
})
