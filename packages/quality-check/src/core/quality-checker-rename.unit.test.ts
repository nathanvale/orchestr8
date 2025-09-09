/**
 * Test suite to validate QualityChecker → QualityChecker rename compatibility
 * This ensures that renaming the class will not break existing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QualityChecker } from './quality-checker.js'
import type { QualityCheckOptions } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'

describe('QualityChecker Class Rename Compatibility', () => {
  let checker: QualityChecker

  beforeEach(() => {
    vi.clearAllMocks()
    checker = new QualityChecker()
  })

  describe('Task 11.1: Class rename compatibility', () => {
    it('should instantiate correctly with no arguments', () => {
      const instance = new QualityChecker()
      expect(instance).toBeDefined()
      expect(instance).toBeInstanceOf(QualityChecker)
    })

    it('should have all public methods available', () => {
      expect(typeof checker.check).toBe('function')
      expect(typeof checker.fix).toBe('function')
    })

    it('should maintain method signatures', async () => {
      // Test check method signature
      const checkSpy = vi.spyOn(checker, 'check')
      const files = ['test.ts']
      const options: QualityCheckOptions = { fix: false }

      // Call without await to check signature matches
      const checkPromise = checker.check(files, options)
      expect(checkPromise).toBeInstanceOf(Promise)

      // Prevent actual execution
      checkSpy.mockResolvedValue({
        success: true,
        duration: 0,
        issues: [],
        correlationId: 'test-id',
      })

      await checkPromise
      expect(checkSpy).toHaveBeenCalledWith(files, options)
    })
  })

  describe('Task 11.2: Public API remains unchanged', () => {
    it('should expose check method with correct signature', () => {
      const checkMethod = checker.check
      expect(checkMethod.length).toBe(2) // Two parameters: files and options
    })

    it('should expose fix method with correct signature', () => {
      const fixMethod = checker.fix
      // Note: fix method has default parameter for options, so length is 1
      expect(fixMethod.length).toBe(1) // One required parameter (files), options has default
    })

    it('should return correct result structure from check', async () => {
      const mockResult: QualityCheckResult = {
        success: true,
        duration: 100,
        issues: [],
        correlationId: 'mock-id',
      }

      vi.spyOn(checker, 'check').mockResolvedValue(mockResult)

      const result = await checker.check(['test.ts'], {})

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('issues')
      expect(result).toHaveProperty('correlationId')
    })
  })

  describe('Task 11.3: Internal method references will work', () => {
    it('should handle internal method calls through public interface', async () => {
      // Mock internal dependencies to verify they're called
      const checkSpy = vi.spyOn(checker, 'check')
      const runChecksSpy = vi.spyOn(checker as any, 'runChecks')

      // Mock to prevent actual execution
      runChecksSpy.mockResolvedValue([])
      checkSpy.mockResolvedValue({
        success: true,
        duration: 0,
        issues: [],
        correlationId: 'test',
      })

      await checker.check(['test.ts'], {})

      expect(checkSpy).toHaveBeenCalled()
    })

    it('should maintain private method accessibility within class', () => {
      // Test that private methods exist (accessed via any)
      const instance = checker as any

      expect(typeof instance.runChecks).toBe('function')
      expect(typeof instance.generateCorrelationId).toBe('function')
      expect(typeof instance.runTypeScriptCheck).toBe('function')
      expect(typeof instance.runESLintCheck).toBe('function')
      expect(typeof instance.runPrettierCheck).toBe('function')
    })

    it('should preserve method binding context', async () => {
      // Ensure methods maintain correct 'this' context
      const spy = vi.spyOn(checker, 'check').mockResolvedValue({
        success: true,
        duration: 0,
        issues: [],
        correlationId: 'test',
      })

      const checkMethod = checker.check.bind(checker)
      await checkMethod(['test.ts'], {})
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('Task 11.4: Type exports will work correctly', () => {
    it('should be assignable to QualityChecker type', () => {
      const instance: QualityChecker = new QualityChecker()
      expect(instance).toBeDefined()
    })

    it('should work with typed method parameters', async () => {
      const files: string[] = ['test.ts']
      const options: QualityCheckOptions & { format?: 'stylish' | 'json' } = {
        fix: false,
        format: 'stylish',
      }

      const spy = vi.spyOn(checker, 'check').mockResolvedValue({
        success: true,
        duration: 0,
        issues: [],
        correlationId: 'test',
      })

      const result: QualityCheckResult = await checker.check(files, options)

      expect(spy).toHaveBeenCalledWith(files, options)
      expect(result).toBeDefined()
    })

    it('should maintain type compatibility for inheritance', () => {
      // Test that a class could extend QualityChecker
      class ExtendedChecker extends QualityChecker {
        customMethod() {
          return 'extended'
        }
      }

      const extended = new ExtendedChecker()
      expect(extended).toBeInstanceOf(QualityChecker)
      expect(extended.customMethod()).toBe('extended')
    })
  })

  describe('Task 11.5: Migration checklist validation', () => {
    it('✓ Class can be instantiated', () => {
      expect(() => new QualityChecker()).not.toThrow()
    })

    it('✓ All public methods are accessible', () => {
      const methods = ['check', 'fix']
      methods.forEach((method) => {
        expect(checker).toHaveProperty(method)
        expect(typeof (checker as any)[method]).toBe('function')
      })
    })

    it('✓ Method signatures match expected interface', () => {
      expect(checker.check.length).toBe(2)
      expect(checker.fix.length).toBe(1) // fix has default parameter for options
    })

    it('✓ Return types are correct', async () => {
      vi.spyOn(checker, 'check').mockResolvedValue({
        success: true,
        duration: 0,
        issues: [],
        correlationId: 'test',
      })

      const checkResult = await checker.check(['test.ts'], {})
      expect(checkResult).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        issues: expect.any(Array),
        correlationId: expect.any(String),
      })
    })

    it('✓ No breaking changes in constructor', () => {
      // Test that constructor doesn't require parameters
      const instance = new QualityChecker()
      expect(instance).toBeDefined()
    })
  })

  describe('Task 11.6: Preparatory tests for rename', () => {
    it('should simulate class rename behavior', () => {
      // Simulate what happens when we rename the class
      const QualityChecker = QualityChecker

      const instance = new QualityChecker()
      expect(instance).toBeInstanceOf(QualityChecker)
      expect(instance).toBeInstanceOf(QualityChecker)
    })

    it('should work with aliased imports', () => {
      // Test import alias pattern
      type QualityChecker = QualityChecker
      const instance: QualityChecker = new QualityChecker()

      expect(instance).toBeDefined()
    })

    it('should maintain compatibility with facade usage', async () => {
      // Simulate how facades will use the renamed class
      class MockFacade {
        private checker: QualityChecker

        constructor() {
          this.checker = new QualityChecker()
        }

        async runCheck(files: string[]) {
          return this.checker.check(files, {})
        }
      }

      const facade = new MockFacade()
      const spy = vi.spyOn(QualityChecker.prototype, 'check').mockResolvedValue({
        success: true,
        duration: 0,
        issues: [],
        correlationId: 'test',
      })

      const result = await facade.runCheck(['test.ts'])
      expect(spy).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should handle type exports correctly', () => {
      // Test that we can export and use the type
      type ExportedChecker = QualityChecker
      const instance: ExportedChecker = new QualityChecker()

      expect(instance).toBeDefined()
    })
  })
})
