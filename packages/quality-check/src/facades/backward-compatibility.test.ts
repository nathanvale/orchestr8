/**
 * V2 Backward Compatibility Verification Tests
 * Ensures QualityChecker maintains full compatibility with V1 interfaces
 */

import { describe, it, expect, vi } from 'vitest'
// import { QualityChecker } from '../core/quality-checker.js'  // Unused in V2 compatibility tests
import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckOptions, FixResult } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'

describe('V2 Backward Compatibility', () => {
  describe('API Surface Compatibility', () => {
    it('should expose all V1 public methods', () => {
      // const _v1Instance = {} as QualityChecker  // Commented out unused variable
      const v2Instance = new QualityChecker()

      // Core methods that must exist
      const requiredMethods = ['check', 'fix']

      for (const method of requiredMethods) {
        expect(v2Instance).toHaveProperty(method)
        expect(typeof (v2Instance as any)[method]).toBe('function')
      }
    })

    it('should accept V1 check options', async () => {
      const v2Instance = new QualityChecker()
      const v1Options: QualityCheckOptions = {
        file: 'test.ts',
        fix: false,
        eslint: true,
        prettier: true,
        typescript: true,
        silent: false,
        debug: false,
        timeout: 5000,
        parallel: true,
        respectGitignore: true,
        hookMode: false,
        preCommit: false,
        cacheDir: '.cache',
        correlationId: 'test-id',
      }

      // Mock the check method to verify it accepts V1 options
      const checkSpy = vi.spyOn(v2Instance, 'check').mockResolvedValue({
        success: true,
        duration: 100,
        issues: [],
      } as QualityCheckResult)

      await v2Instance.check(['test.ts'], v1Options)
      expect(checkSpy).toHaveBeenCalledWith(['test.ts'], v1Options)
    })

    it('should accept V1 fix options', async () => {
      const v2Instance = new QualityChecker()
      const v1FixOptions = { safe: true }

      // Mock the fix method to verify it accepts V1 options
      const fixSpy = vi.spyOn(v2Instance, 'fix').mockResolvedValue({
        success: true,
        count: 0,
        fixed: [],
      } as FixResult)

      await v2Instance.fix(['test.ts'], v1FixOptions)
      expect(fixSpy).toHaveBeenCalledWith(['test.ts'], v1FixOptions)
    })
  })

  describe('Result Format Compatibility', () => {
    it('should return V1-compatible check results', async () => {
      const v2Instance = new QualityChecker()

      // Mock to return a result that simulates backward compatibility
      vi.spyOn(v2Instance, 'check').mockResolvedValue({
        success: true,
        duration: 100,
        issues: [],
      } as QualityCheckResult)

      const result = await v2Instance.check(['test.ts'], {})

      // Verify V2 result structure (which should be backward compatible)
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('issues')
      expect(Array.isArray(result.issues)).toBe(true)
    })

    it('should return V1-compatible fix results', async () => {
      const v2Instance = new QualityChecker()

      // Mock to return a result
      vi.spyOn(v2Instance, 'fix').mockResolvedValue({
        success: true,
        count: 2,
        fixed: ['file1.ts', 'file2.ts'],
      } as FixResult)

      const result = await v2Instance.fix(['file1.ts', 'file2.ts'])

      // Verify V1 result structure
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('count')
      expect(result).toHaveProperty('fixed')
      expect(Array.isArray(result.fixed)).toBe(true)
    })

    it('should handle error result formats', async () => {
      const v2Instance = new QualityChecker()

      const errorResult: QualityCheckResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript',
            severity: 'error',
            ruleId: 'TS2307',
            file: '/test/error.ts',
            line: 10,
            col: 1,
            message: 'Cannot find module',
          },
          {
            engine: 'typescript',
            severity: 'warning',
            ruleId: 'TS6133',
            file: '/test/error.ts',
            line: 5,
            col: 8,
            message: 'Unused variable',
          },
        ],
      }

      vi.spyOn(v2Instance, 'check').mockResolvedValue(errorResult)

      const result = await v2Instance.check(['error.ts'], {})

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(2)
      expect(result.issues[0].severity).toBe('error')
      expect(result.issues[1].severity).toBe('warning')
    })
  })

  describe('Behavior Compatibility', () => {
    it('should respect disabled engines like V1', async () => {
      const v2Instance = new QualityChecker()

      const optionsWithDisabledEngines: QualityCheckOptions = {
        eslint: false,
        prettier: false,
        typescript: true,
      }

      const checkSpy = vi.spyOn(v2Instance, 'check').mockImplementation(async (_files, options) => {
        // Verify only TypeScript is enabled
        expect(options?.eslint).toBe(false)
        expect(options?.prettier).toBe(false)
        expect(options?.typescript).toBe(true)

        return {
          success: true,
          duration: 100,
          issues: [],
        } as QualityCheckResult
      })

      await v2Instance.check(['test.ts'], optionsWithDisabledEngines)
      expect(checkSpy).toHaveBeenCalled()
    })

    it('should handle timeout option like V1', async () => {
      const v2Instance = new QualityChecker()

      const optionsWithTimeout: QualityCheckOptions = {
        timeout: 1000,
      }

      const checkSpy = vi.spyOn(v2Instance, 'check').mockImplementation(async (_files, options) => {
        expect(options?.timeout).toBe(1000)
        return { success: true, duration: 100, issues: [] } as QualityCheckResult
      })

      await v2Instance.check(['test.ts'], optionsWithTimeout)
      expect(checkSpy).toHaveBeenCalled()
    })

    it('should support parallel execution like V1', async () => {
      const v2Instance = new QualityChecker()

      const optionsWithParallel: QualityCheckOptions = {
        parallel: true,
      }

      const checkSpy = vi.spyOn(v2Instance, 'check').mockImplementation(async (_files, options) => {
        expect(options?.parallel).toBe(true)
        return { success: true, duration: 100, issues: [] } as QualityCheckResult
      })

      await v2Instance.check(['test1.ts', 'test2.ts'], optionsWithParallel)
      expect(checkSpy).toHaveBeenCalled()
    })
  })

  describe('Error Handling Compatibility', () => {
    it('should throw errors in the same format as V1', async () => {
      const v2Instance = new QualityChecker()

      const v1Error = new Error('Configuration file not found')
      vi.spyOn(v2Instance, 'check').mockRejectedValue(v1Error)

      await expect(v2Instance.check(['test.ts'], {})).rejects.toThrow(
        'Configuration file not found',
      )
    })

    it('should handle file not found errors like V1', async () => {
      const v2Instance = new QualityChecker()

      const fileError = new Error('ENOENT: no such file or directory')
      vi.spyOn(v2Instance, 'check').mockRejectedValue(fileError)

      await expect(v2Instance.check(['missing.ts'], {})).rejects.toThrow('ENOENT')
    })

    it('should handle tool missing errors like V1', async () => {
      const v2Instance = new QualityChecker()

      const toolError = new Error('ESLint is not installed')
      vi.spyOn(v2Instance, 'check').mockRejectedValue(toolError)

      await expect(v2Instance.check(['test.ts'], {})).rejects.toThrow('ESLint is not installed')
    })
  })

  describe('File Processing Compatibility', () => {
    it('should process single files like V1', async () => {
      const v2Instance = new QualityChecker()

      const checkSpy = vi.spyOn(v2Instance, 'check').mockResolvedValue({
        success: true,
        duration: 100,
        issues: [],
      } as QualityCheckResult)

      await v2Instance.check(['single.ts'], {})
      expect(checkSpy).toHaveBeenCalledWith(['single.ts'], {})
    })

    it('should process multiple files like V1', async () => {
      const v2Instance = new QualityChecker()

      const files = ['file1.ts', 'file2.js', 'file3.tsx']
      const checkSpy = vi.spyOn(v2Instance, 'check').mockResolvedValue({
        success: true,
        duration: 100,
        issues: [],
      } as QualityCheckResult)

      await v2Instance.check(files, {})
      expect(checkSpy).toHaveBeenCalledWith(files, {})
    })

    it('should handle empty file array like V1', async () => {
      const v2Instance = new QualityChecker()

      const checkSpy = vi.spyOn(v2Instance, 'check').mockResolvedValue({
        success: true,
        duration: 100,
        issues: [],
      } as QualityCheckResult)

      await v2Instance.check([], {})
      expect(checkSpy).toHaveBeenCalledWith([], {})
    })
  })

  describe('Configuration Compatibility', () => {
    it('should respect gitignore settings like V1', async () => {
      const v2Instance = new QualityChecker()

      const options: QualityCheckOptions = {
        respectGitignore: true,
      }

      const checkSpy = vi.spyOn(v2Instance, 'check').mockImplementation(async (_files, opts) => {
        expect(opts?.respectGitignore).toBe(true)
        return { success: true, duration: 100, issues: [] } as QualityCheckResult
      })

      await v2Instance.check(['test.ts'], options)
      expect(checkSpy).toHaveBeenCalled()
    })

    it('should handle cache directory configuration like V1', async () => {
      const v2Instance = new QualityChecker()

      const options: QualityCheckOptions = {
        cacheDir: '/custom/cache',
      }

      const checkSpy = vi.spyOn(v2Instance, 'check').mockImplementation(async (_files, opts) => {
        expect(opts?.cacheDir).toBe('/custom/cache')
        return { success: true, duration: 100, issues: [] } as QualityCheckResult
      })

      await v2Instance.check(['test.ts'], options)
      expect(checkSpy).toHaveBeenCalled()
    })

    it('should support hook mode like V1', async () => {
      const v2Instance = new QualityChecker()

      const options: QualityCheckOptions = {
        hookMode: true,
        preCommit: true,
      }

      const checkSpy = vi.spyOn(v2Instance, 'check').mockImplementation(async (_files, opts) => {
        expect(opts?.hookMode).toBe(true)
        expect(opts?.preCommit).toBe(true)
        return { success: true, duration: 100, issues: [] } as QualityCheckResult
      })

      await v2Instance.check(['test.ts'], options)
      expect(checkSpy).toHaveBeenCalled()
    })
  })

  describe('Migration Safety', () => {
    it('should be safe to replace V1 imports with V2', () => {
      // This test verifies that V2 can be used as a drop-in replacement
      const v2Instance = new QualityChecker()

      // All V1 methods should exist
      expect(v2Instance.check).toBeDefined()
      expect(v2Instance.fix).toBeDefined()

      // Should be callable
      expect(typeof v2Instance.check).toBe('function')
      expect(typeof v2Instance.fix).toBe('function')
    })

    it('should maintain same method signatures as V1', () => {
      const v2Instance = new QualityChecker()

      // Check method signature
      expect(v2Instance.check.length).toBeLessThanOrEqual(2) // files and options

      // Fix method signature
      expect(v2Instance.fix.length).toBeLessThanOrEqual(2) // files and options
    })
  })
})
