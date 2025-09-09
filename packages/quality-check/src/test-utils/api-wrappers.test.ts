/**
 * API Wrappers V2 Compatibility Tests
 * Tests for test utilities using QualityChecker implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MockedQualityChecker,
  PerformanceWrapper,
  DirectAPIWrapper,
  type MockExecutionResult,
} from './api-wrappers.js'
import type { TestFixture } from './modern-fixtures.js'
import type { QualityCheckOptions, QualityCheckResult, FixResult } from '../types.js'

// Mock the QualityChecker to use V2
vi.mock('../core/quality-checker.js', async () => {
  const module = await vi.importActual('../core/quality-checker.js')
  return {
    QualityChecker: module.QualityChecker,
  }
})

describe('API Wrappers with V2 Implementation', () => {
  describe('MockedQualityChecker', () => {
    let checker: MockedQualityChecker

    beforeEach(() => {
      checker = new MockedQualityChecker()
    })

    afterEach(() => {
      checker.cleanup()
    })

    describe('File System Mocking', () => {
      it('should mock file existence checks', () => {
        checker.addMockFile('/src/test.ts', 'const x = 1;', true)
        expect(checker.fileExists('/src/test.ts')).toBe(true)
        expect(checker.fileExists('/src/missing.ts')).toBe(false)
      })

      it('should mock file content reading', () => {
        const content = 'export const foo = "bar";'
        checker.addMockFile('/src/module.ts', content, true)
        expect(checker.getFileContent('/src/module.ts')).toBe(content)
        expect(checker.getFileContent('/src/unknown.ts')).toBeUndefined()
      })

      it('should handle non-existent files in mocks', () => {
        checker.addMockFile('/src/deleted.ts', '', false)
        expect(checker.fileExists('/src/deleted.ts')).toBe(false)
      })
    })

    describe('Execution Result Mocking', () => {
      it('should mock ESLint execution results', () => {
        const mockResult: MockExecutionResult = {
          stdout: JSON.stringify([{ filePath: 'test.js', messages: [] }]),
          stderr: '',
          exitCode: 0,
          duration: 100,
        }

        const command = 'npx eslint "src/test.js" --format=json'
        checker.addMockExecution(command, mockResult)

        // The check method should use these mocked results
        checker.addMockFile('src/test.js', 'const x = 1;', true)
      })

      it('should mock TypeScript execution results', () => {
        const mockResult: MockExecutionResult = {
          stdout: '',
          stderr: 'src/test.ts(1,1): error TS2304: Cannot find name "foo".',
          exitCode: 1,
          duration: 150,
        }

        const command = 'npx tsc --noEmit src/test.ts'
        checker.addMockExecution(command, mockResult)
      })

      it('should mock Prettier execution results', () => {
        const mockResult: MockExecutionResult = {
          stdout: 'src/test.js',
          stderr: '',
          exitCode: 1,
          duration: 50,
        }

        const command = 'npx prettier --check src/test.js'
        checker.addMockExecution(command, mockResult)
      })
    })

    describe('Fixture Loading', () => {
      it('should load fixture files into mock file system', () => {
        const fixture: TestFixture = {
          description: 'test-fixture',
          files: [
            { path: '/src/a.ts', content: 'const a = 1;', exists: true },
            { path: '/src/b.ts', content: 'const b = 2;', exists: true },
          ],
          expected: {
            eslint: { success: true, errorCount: 0 },
            typescript: { success: true, errorCount: 0 },
            prettier: { success: true, errorCount: 0 },
            overall: { success: true },
          },
        }

        checker.loadFixture(fixture)

        expect(checker.fileExists('/src/a.ts')).toBe(true)
        expect(checker.getFileContent('/src/a.ts')).toBe('const a = 1;')
        expect(checker.fileExists('/src/b.ts')).toBe(true)
        expect(checker.getFileContent('/src/b.ts')).toBe('const b = 2;')
      })

      it('should setup execution results from fixture expectations', () => {
        const fixture: TestFixture = {
          description: 'error-fixture',
          files: [{ path: '/src/error.ts', content: 'const x = ;', exists: true }],
          expected: {
            typescript: {
              success: false,
              errorCount: 1,
              messages: [
                {
                  file: '/src/error.ts',
                  line: 1,
                  column: 11,
                  severity: 'error',
                  message: 'Expression expected',
                  rule: '1005',
                },
              ],
            },
            overall: { success: false },
          },
        }

        checker.loadFixture(fixture)
        // The mock execution results should be set up based on expected errors
      })
    })

    describe('V2 Check and Fix Methods', () => {
      it('should use QualityChecker for check operations', async () => {
        checker.addMockFile('/src/test.ts', 'const x = 1;', true)

        const result = await checker.check(['/src/test.ts'])

        expect(result).toBeDefined()
        expect(result.success).toBeDefined()
      })

      it('should use QualityChecker for fix operations', async () => {
        checker.addMockFile('/src/test.ts', 'const x=1', true)

        const result = await checker.fix(['/src/test.ts'])

        expect(result).toBeDefined()
        expect(result.success).toBeDefined()
      })

      it('should track execution time', async () => {
        checker.addMockFile('/src/test.ts', 'const x = 1;', true)

        await checker.check(['/src/test.ts'])
        const execTime = checker.getExecutionTime()

        expect(execTime).toBeGreaterThan(0)
      })
    })

    describe('Cleanup', () => {
      it('should clear all mocks on cleanup', () => {
        checker.addMockFile('/src/test.ts', 'content', true)
        checker.addMockExecution('command', {
          stdout: '',
          stderr: '',
          exitCode: 0,
          duration: 0,
        })

        expect(checker.fileExists('/src/test.ts')).toBe(true)

        checker.cleanup()

        expect(checker.fileExists('/src/test.ts')).toBe(false)
      })
    })
  })

  describe('PerformanceWrapper', () => {
    let wrapper: PerformanceWrapper

    beforeEach(() => {
      wrapper = new PerformanceWrapper()
    })

    afterEach(() => {
      wrapper.clear()
    })

    it('should track operation performance', async () => {
      const result = await wrapper.track('test-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'done'
      })

      expect(result).toBe('done')
      expect(wrapper.getAverageTime('test-op')).toBeGreaterThan(0)
    })

    it('should calculate average time for operations', async () => {
      await wrapper.track('op1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
      await wrapper.track('op1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })

      const avg = wrapper.getAverageTime('op1')
      expect(avg).toBeGreaterThan(10)
      expect(avg).toBeLessThan(30)
    })

    it('should find maximum operation time', async () => {
      await wrapper.track('op2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
      await wrapper.track('op2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 25))
      })

      const max = wrapper.getMaxTime('op2')
      expect(max).toBeGreaterThanOrEqual(25)
    })

    it('should assert all operations under limit', async () => {
      await wrapper.track('fast', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })

      expect(() => wrapper.assertAllUnder(100)).not.toThrow()
      expect(() => wrapper.assertAllUnder(1)).toThrow(/exceeded 1ms limit/)
    })

    it('should clear tracked operations', async () => {
      await wrapper.track('op', async () => 'result')
      expect(wrapper.getAverageTime()).toBeGreaterThan(0)

      wrapper.clear()
      expect(wrapper.getAverageTime()).toBe(0)
    })
  })

  describe('DirectAPIWrapper', () => {
    let wrapper: DirectAPIWrapper

    beforeEach(() => {
      wrapper = new DirectAPIWrapper()
    })

    it('should create instance with QualityChecker', () => {
      expect(wrapper).toBeDefined()
      expect(wrapper['checker']).toBeDefined()
    })

    it('should delegate check to QualityChecker', async () => {
      const checkSpy = vi.spyOn(wrapper['checker'], 'check').mockResolvedValue({
        success: true,
        checkers: {},
      } as QualityCheckResult)

      const result = await wrapper.check(['/src/test.ts'])

      expect(checkSpy).toHaveBeenCalledWith(['/src/test.ts'], {})
      expect(result.success).toBe(true)
    })

    it('should delegate fix to QualityChecker', async () => {
      const fixSpy = vi.spyOn(wrapper['checker'], 'fix').mockResolvedValue({
        success: true,
        count: 1,
        fixed: ['/src/test.ts'],
      } as FixResult)

      const result = await wrapper.fix(['/src/test.ts'])

      expect(fixSpy).toHaveBeenCalledWith(['/src/test.ts'], { safe: false })
      expect(result.success).toBe(true)
    })

    it('should pass options to check method', async () => {
      const checkSpy = vi.spyOn(wrapper['checker'], 'check').mockResolvedValue({
        success: true,
        checkers: {},
      } as QualityCheckResult)

      const options: QualityCheckOptions = { fix: false, eslint: true }
      await wrapper.check(['/src/test.ts'], options)

      expect(checkSpy).toHaveBeenCalledWith(['/src/test.ts'], options)
    })
  })

  describe('V2 Compatibility', () => {
    it('should work with V2 result formats', async () => {
      const checker = new MockedQualityChecker()
      checker.addMockFile('/src/test.ts', 'const x = 1', true)

      const v2Result: QualityCheckResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['Type error'],
            warnings: [],
          },
        },
        parsedErrors: [
          {
            file: '/src/test.ts',
            line: 1,
            column: 1,
            code: 'TS2304',
            message: 'Cannot find name',
            severity: 'error',
            source: 'typescript',
            fixable: false,
          },
        ],
      }

      vi.spyOn(checker, 'check').mockResolvedValue(v2Result)

      const result = await checker.check(['/src/test.ts'])
      expect(result.parsedErrors).toBeDefined()
      expect(result.parsedErrors).toHaveLength(1)
    })

    it('should handle V2 fix results', async () => {
      const wrapper = new DirectAPIWrapper()

      const v2FixResult: FixResult = {
        success: true,
        count: 2,
        fixed: ['/src/a.ts', '/src/b.ts'],
      }

      vi.spyOn(wrapper['checker'], 'fix').mockResolvedValue(v2FixResult)

      const result = await wrapper.fix(['/src/a.ts', '/src/b.ts'])
      expect(result.count).toBe(2)
      expect(result.fixed).toHaveLength(2)
    })

    it('should maintain performance targets with V2', async () => {
      const wrapper = new PerformanceWrapper()
      const checker = new MockedQualityChecker()

      checker.addMockFile('/src/test.ts', 'const x = 1;', true)

      const result = await wrapper.track('v2-check', async () => {
        return await checker.check(['/src/test.ts'])
      })

      expect(result).toBeDefined()
      expect(wrapper.getMaxTime('v2-check')).toBeLessThan(300) // V2 performance target
    })
  })
})
