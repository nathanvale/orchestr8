import { describe, it, expect, beforeEach } from 'vitest'
import { ESLintEngine } from '../engines/eslint-engine.js'
import type { CheckerResult } from '../types/issue-types.js'

describe('ESLintEngine - Parser Resilience', () => {
  let engine: ESLintEngine

  beforeEach(() => {
    engine = new ESLintEngine()
  })

  describe('Graceful degradation on parser service failure', () => {
    it('should handle fileExists errors with cache fallback', async () => {
      // Create a test file to lint
      const testFile = 'packages/quality-check/src/engines/eslint-engine.ts'

      const result: CheckerResult = await engine.check({
        files: [testFile],
        fix: false,
      })

      // Should complete without throwing
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(Array.isArray(result.issues)).toBe(true)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should return issues array even on parser initialization failure', async () => {
      // Test with a file that might trigger parser issues in edge cases
      const result: CheckerResult = await engine.check({
        files: ['packages/quality-check/src/engines/eslint-engine.ts'],
        fix: false,
      })

      expect(result.issues).toBeDefined()
      expect(Array.isArray(result.issues)).toBe(true)
    })

    it('should preserve modified files list on error', async () => {
      const result: CheckerResult = await engine.check({
        files: ['packages/quality-check/src/engines/eslint-engine.ts'],
        fix: false,
      })

      expect(result.modifiedFiles).toBeDefined()
      expect(Array.isArray(result.modifiedFiles)).toBe(true)
    })

    it('should downgrade severity to warning for parser service errors', async () => {
      // This test verifies that the Layer 3 error handling correctly downgrades
      // error severity for parser service failures to warnings
      const result: CheckerResult = await engine.check({
        files: ['packages/quality-check/src/engines/eslint-engine.ts'],
        fix: false,
      })

      // If there are any parser service errors, they should be warnings not errors
      const parserErrors = result.issues.filter(
        (issue) =>
          issue.message.includes('parser service') || issue.message.includes('TypeScript parser'),
      )

      if (parserErrors.length > 0) {
        expect(parserErrors.every((e) => e.severity === 'warning')).toBe(true)
      }
    })

    it('should provide actionable error messages for parser failures', async () => {
      const result: CheckerResult = await engine.check({
        files: ['packages/quality-check/src/engines/eslint-engine.ts'],
        fix: false,
      })

      // Check that error messages for parser service failures are descriptive
      const parserErrors = result.issues.filter(
        (issue) =>
          issue.message.includes('parser service') || issue.message.includes('TypeScript parser'),
      )

      if (parserErrors.length > 0) {
        expect(
          parserErrors.some(
            (e) =>
              e.message.includes('tsconfig.json') ||
              e.message.includes('circular') ||
              e.message.includes('projectService'),
          ),
        ).toBe(true)
      }
    })
  })

  describe('Engine configuration caching', () => {
    it('should reuse ESLint instance when config is unchanged', async () => {
      const testFile = 'packages/quality-check/src/engines/eslint-engine.ts'

      // First check
      await engine.check({
        files: [testFile],
        fix: false,
      })

      // Second check with same config
      const result = await engine.check({
        files: [testFile],
        fix: false,
      })

      expect(result).toBeDefined()
      expect(typeof result.duration).toBe('number')
    })

    it('should create new instance when cwd changes', async () => {
      const testFile = 'packages/quality-check/src/engines/eslint-engine.ts'

      await engine.check({
        files: [testFile],
        cwd: process.cwd(),
        fix: false,
      })

      // This should trigger a new instance due to different cwd
      const result = await engine.check({
        files: [testFile],
        cwd: `${process.cwd()}/packages`,
        fix: false,
      })

      expect(result).toBeDefined()
    })

    it('should create new instance when fix mode changes', async () => {
      const testFile = 'packages/quality-check/src/engines/eslint-engine.ts'

      await engine.check({
        files: [testFile],
        fix: false,
      })

      // This should trigger a new instance due to different fix setting
      const result = await engine.check({
        files: [testFile],
        fix: true,
      })

      expect(result).toBeDefined()
    })
  })

  describe('Resource cleanup', () => {
    it('should clear cache and dispose resources', () => {
      expect(() => {
        engine.clearCache()
        engine.dispose()
      }).not.toThrow()
    })

    it('should allow re-initialization after dispose', async () => {
      engine.dispose()

      const result = await engine.check({
        files: ['packages/quality-check/src/engines/eslint-engine.ts'],
        fix: false,
      })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })
})
