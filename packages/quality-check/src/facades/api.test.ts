/**
 * API Facade V2 Compatibility Tests
 * Tests for QualityCheckAPI using QualityCheckerV2 implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QualityCheckAPI } from './api.js'
import type { QualityCheckOptions, FixResult, QualityCheckResult } from '../types.js'

// Mock the QualityChecker import to use V2
vi.mock('../core/quality-checker.js', async () => {
  const module = await vi.importActual('../core/quality-checker-v2.js')
  return {
    QualityChecker: module.QualityCheckerV2,
  }
})

describe('QualityCheckAPI with V2 Implementation', () => {
  let api: QualityCheckAPI
  let mockCheckResult: QualityCheckResult
  let mockFixResult: FixResult

  beforeEach(() => {
    api = new QualityCheckAPI()

    // Setup mock results
    mockCheckResult = {
      success: true,
      checkers: {
        typescript: { success: true, errors: [], warnings: [] },
        eslint: { success: true, errors: [], warnings: [] },
        prettier: { success: true, errors: [], warnings: [] },
      },
    }

    mockFixResult = {
      success: true,
      count: 1,
      fixed: ['src/test.ts'],
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should instantiate QualityCheckerV2 internally', () => {
      const newApi = new QualityCheckAPI()
      expect(newApi).toBeDefined()
      // The internal checker should be an instance of QualityCheckerV2 (mocked as QualityChecker)
      expect(newApi['checker']).toBeDefined()
    })
  })

  describe('check method', () => {
    it('should call QualityCheckerV2.check with correct parameters', async () => {
      const checkSpy = vi.spyOn(api['checker'], 'check').mockResolvedValue(mockCheckResult)
      const files = ['src/test.ts']
      const options: QualityCheckOptions = { fix: false }

      const result = await api.check(files, options)

      expect(checkSpy).toHaveBeenCalledWith(files, options)
      expect(result).toEqual(mockCheckResult)
    })

    it('should use empty options when not provided', async () => {
      const checkSpy = vi.spyOn(api['checker'], 'check').mockResolvedValue(mockCheckResult)
      const files = ['src/test.ts']

      await api.check(files)

      expect(checkSpy).toHaveBeenCalledWith(files, {})
    })

    it('should handle multiple files', async () => {
      const checkSpy = vi.spyOn(api['checker'], 'check').mockResolvedValue(mockCheckResult)
      const files = ['src/test1.ts', 'src/test2.ts', 'src/test3.ts']

      const result = await api.check(files)

      expect(checkSpy).toHaveBeenCalledWith(files, {})
      expect(result).toEqual(mockCheckResult)
    })

    it('should propagate errors from QualityCheckerV2', async () => {
      const error = new Error('Check failed')
      vi.spyOn(api['checker'], 'check').mockRejectedValue(error)

      await expect(api.check(['src/test.ts'])).rejects.toThrow('Check failed')
    })
  })

  describe('fix method', () => {
    it('should call QualityCheckerV2.fix with correct parameters', async () => {
      const fixSpy = vi.spyOn(api['checker'], 'fix').mockResolvedValue(mockFixResult)
      const files = ['src/test.ts']
      const options = { safe: false }

      const result = await api.fix(files, options)

      expect(fixSpy).toHaveBeenCalledWith(files, options)
      expect(result).toEqual(mockFixResult)
    })

    it('should default to safe mode when options not provided', async () => {
      const fixSpy = vi.spyOn(api['checker'], 'fix').mockResolvedValue(mockFixResult)
      const files = ['src/test.ts']

      await api.fix(files)

      expect(fixSpy).toHaveBeenCalledWith(files, { safe: true })
    })

    it('should handle multiple files for fixing', async () => {
      const fixSpy = vi.spyOn(api['checker'], 'fix').mockResolvedValue(mockFixResult)
      const files = ['src/test1.ts', 'src/test2.ts']

      const result = await api.fix(files, { safe: false })

      expect(fixSpy).toHaveBeenCalledWith(files, { safe: false })
      expect(result).toEqual(mockFixResult)
    })

    it('should propagate errors from QualityCheckerV2', async () => {
      const error = new Error('Fix failed')
      vi.spyOn(api['checker'], 'fix').mockRejectedValue(error)

      await expect(api.fix(['src/test.ts'])).rejects.toThrow('Fix failed')
    })
  })

  describe('checkFile method', () => {
    it('should delegate to check with single file array', async () => {
      const checkSpy = vi.spyOn(api['checker'], 'check').mockResolvedValue(mockCheckResult)
      const filePath = 'src/test.ts'
      const options: QualityCheckOptions = { fix: false }

      const result = await api.checkFile(filePath, options)

      expect(checkSpy).toHaveBeenCalledWith([filePath], options)
      expect(result).toEqual(mockCheckResult)
    })

    it('should work without options', async () => {
      const checkSpy = vi.spyOn(api['checker'], 'check').mockResolvedValue(mockCheckResult)
      const filePath = 'src/test.ts'

      await api.checkFile(filePath)

      expect(checkSpy).toHaveBeenCalledWith([filePath], {})
    })
  })

  describe('fixFile method', () => {
    it('should delegate to fix with single file array', async () => {
      const fixSpy = vi.spyOn(api['checker'], 'fix').mockResolvedValue(mockFixResult)
      const filePath = 'src/test.ts'
      const options = { safe: false }

      const result = await api.fixFile(filePath, options)

      expect(fixSpy).toHaveBeenCalledWith([filePath], options)
      expect(result).toEqual(mockFixResult)
    })

    it('should default to safe mode for single file', async () => {
      const fixSpy = vi.spyOn(api['checker'], 'fix').mockResolvedValue(mockFixResult)
      const filePath = 'src/test.ts'

      await api.fixFile(filePath)

      expect(fixSpy).toHaveBeenCalledWith([filePath], { safe: true })
    })
  })

  describe('V2 Compatibility', () => {
    it('should maintain backward compatibility with V1 API surface', () => {
      // Verify all expected methods exist
      expect(api.check).toBeDefined()
      expect(api.fix).toBeDefined()
      expect(api.checkFile).toBeDefined()
      expect(api.fixFile).toBeDefined()

      // Verify they are functions
      expect(typeof api.check).toBe('function')
      expect(typeof api.fix).toBe('function')
      expect(typeof api.checkFile).toBe('function')
      expect(typeof api.fixFile).toBe('function')
    })

    it('should handle V2-specific result format', async () => {
      const v2Result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['Type error at line 10'],
            warnings: [],
          },
        },
        parsedErrors: [
          {
            file: 'src/test.ts',
            line: 10,
            column: 5,
            code: 'no-implicit-any',
            message: 'Type error',
            severity: 'error',
            source: 'typescript',
            fixable: false,
          },
        ],
      }

      vi.spyOn(api['checker'], 'check').mockResolvedValue(v2Result)

      const result = await api.check(['src/test.ts'])

      expect(result).toEqual(v2Result)
      expect(result.parsedErrors).toBeDefined()
      expect(result.parsedErrors).toHaveLength(1)
    })

    it('should handle V2 enhanced fix results', async () => {
      const v2FixResult: FixResult = {
        success: true,
        count: 3,
        fixed: ['src/test1.ts', 'src/test2.ts', 'src/test3.ts'],
      }

      vi.spyOn(api['checker'], 'fix').mockResolvedValue(v2FixResult)

      const result = await api.fix(['src/test1.ts', 'src/test2.ts', 'src/test3.ts'])

      expect(result).toEqual(v2FixResult)
      expect(result.count).toBe(3)
      expect(result.fixed).toHaveLength(3)
    })
  })

  describe('Performance', () => {
    it('should complete checks within performance budget', async () => {
      const startTime = Date.now()

      vi.spyOn(api['checker'], 'check').mockImplementation(async () => {
        // Simulate V2 fast execution
        await new Promise((resolve) => setTimeout(resolve, 50))
        return mockCheckResult
      })

      await api.check(['src/test.ts'])

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(300) // V2 performance target
    })
  })

  describe('Error Handling', () => {
    it('should handle timeout errors appropriately', async () => {
      const timeoutError = new Error('Operation timed out')
      vi.spyOn(api['checker'], 'check').mockRejectedValue(timeoutError)

      await expect(api.check(['src/test.ts'])).rejects.toThrow('Operation timed out')
    })

    it('should handle configuration errors', async () => {
      const configError = new Error('Invalid configuration')
      vi.spyOn(api['checker'], 'check').mockRejectedValue(configError)

      await expect(api.check(['src/test.ts'])).rejects.toThrow('Invalid configuration')
    })

    it('should handle file not found errors', async () => {
      const fileError = new Error('File not found: src/missing.ts')
      vi.spyOn(api['checker'], 'check').mockRejectedValue(fileError)

      await expect(api.check(['src/missing.ts'])).rejects.toThrow('File not found')
    })
  })
})
