/**
 * V2 Error Handling Test Suite
 * Tests error boundary, exception handling, and error recovery for QualityChecker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QualityChecker } from './quality-checker.js'
import { ToolMissingError } from './errors.js'

// Mock dependencies
vi.mock('../engines/typescript-engine.js')
vi.mock('../engines/eslint-engine.js')
vi.mock('../engines/prettier-engine.js')
vi.mock('./config-loader.js')
vi.mock('./file-matcher.js')
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createTimer: vi.fn(() => ({ end: vi.fn(() => 100) })),
}))

describe('QualityChecker Error Handling', () => {
  let checker: QualityChecker
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    checker = new QualityChecker()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  describe('Error Boundaries', () => {
    it('should catch and handle configuration loading errors', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const mockLoad = vi.fn().mockRejectedValue(new Error('Config load failed'))
      vi.mocked(ConfigLoader).prototype.load = mockLoad

      const result = await checker.check(['test.ts'], {})

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]?.message).toBe('Config load failed')
    })

    it('should catch and handle file resolution errors', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')

      const mockLoad = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: true, prettier: true },
      })
      vi.mocked(ConfigLoader).prototype.load = mockLoad

      const mockResolveFiles = vi.fn().mockRejectedValue(new Error('File resolution failed'))
      vi.mocked(FileMatcher).prototype.resolveFiles = mockResolveFiles

      const result = await checker.check(['test.ts'], {})

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]?.message).toBe('File resolution failed')
    })

    it('should handle engine check failures gracefully', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')
      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: false, prettier: false },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      const mockCheck = vi.fn().mockRejectedValue(new Error('TypeScript engine failed'))
      vi.mocked(TypeScriptEngine).prototype.check = mockCheck

      const result = await checker.check(['test.ts'], {})

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should continue checking other engines when one fails', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')
      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
      const { ESLintEngine } = await import('../engines/eslint-engine.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: true, prettier: false },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      // TypeScript fails
      vi.mocked(TypeScriptEngine).prototype.check = vi
        .fn()
        .mockRejectedValue(new Error('TypeScript failed'))

      // ESLint succeeds
      vi.mocked(ESLintEngine).prototype.check = vi.fn().mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 0,
      })

      // Run checks through the private method indirectly via check
      const result = await checker.check(['test.ts'], {})

      // Result should include the failure but not crash completely
      expect(result).toBeDefined()
    })
  })

  describe('Exception Handling', () => {
    it('should handle null/undefined file arrays gracefully', async () => {
      const resultNull = await checker.check(null as any, {})
      expect(resultNull.success).toBe(false)
      expect(resultNull.issues.length).toBeGreaterThan(0)

      const resultUndefined = await checker.check(undefined as any, {})
      expect(resultUndefined.success).toBe(false)
      expect(resultUndefined.issues.length).toBeGreaterThan(0)
    })

    it('should handle empty file arrays', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: [],
        fix: false,
        engines: { typescript: true, eslint: true, prettier: true },
        timeoutMs: 30000,
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue([])

      const result = await checker.check([], {})

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.duration).toBeDefined()
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should handle malformed options gracefully', async () => {
      const malformedOptions = {
        typescript: 'not-a-boolean',
        eslint: null,
        prettier: undefined,
      } as any

      const result = await checker.check(['test.ts'], malformedOptions)

      // Should not crash, should return a result
      expect(result).toBeDefined()
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('issues')
    })

    it('should handle timeout errors specifically', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: false, prettier: false },
        timeoutMs: 1, // 1ms timeout to force timeout
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      // Simulate a timeout error
      const timeoutError = new Error('Operation timed out')
      timeoutError.name = 'TimeoutError'

      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
      vi.mocked(TypeScriptEngine).prototype.check = vi.fn().mockRejectedValue(timeoutError)

      const result = await checker.check(['test.ts'], { timeout: 1 })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      // The timeout error should be reported
      const hasTimeoutError = result.issues.some(
        (issue) =>
          issue.message.toLowerCase().includes('timed out') ||
          issue.message.toLowerCase().includes('timeout'),
      )
      expect(hasTimeoutError).toBe(true)
    })
  })

  describe('Tool Missing Errors', () => {
    it('should handle missing TypeScript gracefully', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')
      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: false, prettier: false },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      vi.mocked(TypeScriptEngine).prototype.check = vi
        .fn()
        .mockRejectedValue(new ToolMissingError('TypeScript'))

      const result = await checker.check(['test.ts'], {})

      // Should handle gracefully without crashing
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
    })

    it('should handle missing ESLint during fix operations', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')
      const { ESLintEngine } = await import('../engines/eslint-engine.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: true,
        prettierWrite: true,
        engines: { typescript: false, eslint: true, prettier: false },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      vi.mocked(ESLintEngine).prototype.check = vi
        .fn()
        .mockRejectedValue(new ToolMissingError('ESLint'))

      const result = await checker.fix(['test.ts'])

      // Should not count missing tools as failures
      expect(result).toBeDefined()
      expect(result.count).toBe(0)
      expect(result.fixed).toHaveLength(0)
    })

    it('should continue with other tools when one is missing', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')
      const { ESLintEngine } = await import('../engines/eslint-engine.js')
      const { PrettierEngine } = await import('../engines/prettier-engine.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: true,
        prettierWrite: true,
        engines: { typescript: false, eslint: true, prettier: true },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      // ESLint is missing
      vi.mocked(ESLintEngine).prototype.check = vi
        .fn()
        .mockRejectedValue(new ToolMissingError('ESLint'))

      // Prettier works
      vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
        success: true,
        issues: [],
        fixedCount: 1,
      })

      const result = await checker.fix(['test.ts'])

      expect(result.success).toBe(true)
      expect(result.count).toBe(1)
      expect(result.fixed).toContain('Prettier')
    })
  })

  describe('Error Recovery', () => {
    it('should recover from partial engine failures', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')
      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
      const { ESLintEngine } = await import('../engines/eslint-engine.js')
      const { PrettierEngine } = await import('../engines/prettier-engine.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: true, prettier: true },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      // TypeScript fails
      vi.mocked(TypeScriptEngine).prototype.check = vi
        .fn()
        .mockRejectedValue(new Error('TS failed'))

      // ESLint succeeds
      vi.mocked(ESLintEngine).prototype.check = vi.fn().mockResolvedValue({
        issues: [
          {
            engine: 'eslint',
            severity: 'warning',
            file: 'test.ts',
            line: 1,
            col: 1,
            message: 'ESLint warning',
          },
        ],
        fixedCount: 0,
      })

      // Prettier succeeds
      vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
        issues: [],
        fixedCount: 0,
      })

      const result = await checker.check(['test.ts'], {})

      // Should have results from working engines
      expect(result).toBeDefined()
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should provide meaningful error messages for unknown errors', async () => {
      const { ConfigLoader } = await import('./config-loader.js')

      // Throw a non-Error object
      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockRejectedValue('string error')

      const result = await checker.check(['test.ts'], {})

      expect(result.success).toBe(false)
      // When a non-Error object is thrown, it gets converted to string
      expect(result.issues[0]?.message).toBe('string error')
    })

    it('should handle circular reference errors', async () => {
      const { ConfigLoader } = await import('./config-loader.js')

      // Create a circular reference error
      const circularObj: any = { prop: 'value' }
      circularObj.circular = circularObj
      const error = new Error('Circular reference')
      error.cause = circularObj

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockRejectedValue(error)

      const result = await checker.check(['test.ts'], {})

      expect(result.success).toBe(false)
      expect(result.issues[0]?.message).toBe('Circular reference')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large file lists without crashing', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')

      const largeFileList = Array.from({ length: 10000 }, (_, i) => `file${i}.ts`)

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: largeFileList,
        fix: false,
        engines: { typescript: true, eslint: true, prettier: true },
        timeoutMs: 30000,
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(largeFileList)

      // Mock engines to handle large lists
      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
      const { ESLintEngine } = await import('../engines/eslint-engine.js')
      const { PrettierEngine } = await import('../engines/prettier-engine.js')

      vi.mocked(TypeScriptEngine).prototype.check = vi
        .fn()
        .mockResolvedValue({ success: true, issues: [], fixedCount: 0 })
      vi.mocked(ESLintEngine).prototype.check = vi
        .fn()
        .mockResolvedValue({ success: true, issues: [], fixedCount: 0 })
      vi.mocked(PrettierEngine).prototype.check = vi
        .fn()
        .mockResolvedValue({ success: true, issues: [], fixedCount: 0 })

      const result = await checker.check(largeFileList, {})

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    it('should handle concurrent check and fix operations', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: true, prettier: true },
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      // Mock engines
      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
      const { ESLintEngine } = await import('../engines/eslint-engine.js')
      const { PrettierEngine } = await import('../engines/prettier-engine.js')

      vi.mocked(TypeScriptEngine).prototype.check = vi
        .fn()
        .mockResolvedValue({ success: true, issues: [], fixedCount: 0 })
      vi.mocked(ESLintEngine).prototype.check = vi
        .fn()
        .mockResolvedValue({ success: true, issues: [], fixedCount: 0 })
      vi.mocked(PrettierEngine).prototype.check = vi
        .fn()
        .mockResolvedValue({ success: true, issues: [], fixedCount: 0 })

      // Run concurrent operations
      const [checkResult, fixResult] = await Promise.all([
        checker.check(['test.ts'], {}),
        checker.fix(['test.ts'], {}),
      ])

      expect(checkResult).toBeDefined()
      expect(fixResult).toBeDefined()
    })

    it('should handle memory pressure scenarios', async () => {
      const { ConfigLoader } = await import('./config-loader.js')
      const { FileMatcher } = await import('./file-matcher.js')

      vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
        files: ['test.ts'],
        fix: false,
        engines: { typescript: true, eslint: false, prettier: false },
        timeoutMs: 30000,
      })

      vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

      // Simulate memory pressure error
      const memoryError = new Error('JavaScript heap out of memory')
      memoryError.name = 'RangeError'

      const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
      vi.mocked(TypeScriptEngine).prototype.check = vi.fn().mockRejectedValue(memoryError)

      const result = await checker.check(['test.ts'], {})

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      // Check if any issue contains memory-related message
      const hasMemoryError = result.issues.some(
        (issue) =>
          issue.message.toLowerCase().includes('heap') ||
          issue.message.toLowerCase().includes('memory'),
      )
      expect(hasMemoryError).toBe(true)
    })
  })
})
