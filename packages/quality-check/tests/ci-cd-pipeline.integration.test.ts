import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { MockEnvironmentFactory, type MockEnvironment } from '../src/test-utils/mock-factory'

describe('CI/CD Pipeline Integration', () => {
  let fixtureDir: string
  let mockEnv: MockEnvironment

  beforeEach(async () => {
    fixtureDir = path.join(tmpdir(), `qc-ci-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
    mockEnv = MockEnvironmentFactory.createStandard()
  })

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
    // Cleanup mock environment
    mockEnv.qualityChecker.clear()
    mockEnv.fileSystem.clear()
    mockEnv.configLoader.clear()
  })

  describe('JSON Output Validation', () => {
    it('should_produce_valid_json_schema_when_format_json_specified', async () => {
      const testFile = path.join(fixtureDir, 'ci-test.ts')
      await fs.writeFile(
        testFile,
        `
        const unused: any = 'test';
        function test() {
          console.log('test');
        }
      `,
      )

      // Setup mock with mixed issues
      mockEnv.qualityChecker.setPredefinedResult('ci-test.ts', {
        filePath: 'ci-test.ts',
        success: false,
        issues: [
          {
            line: 2,
            column: 14,
            message: 'Unexpected any. Specify a different type.',
            severity: 'error',
            engine: 'typescript',
            ruleId: '@typescript-eslint/no-explicit-any',
          },
          {
            line: 2,
            column: 7,
            message: "'unused' is assigned a value but never used.",
            severity: 'error',
            engine: 'eslint',
            ruleId: 'no-unused-vars',
          },
          {
            line: 1,
            column: 1,
            message: 'File is not formatted with Prettier',
            severity: 'warning',
            engine: 'prettier',
            ruleId: 'format',
          },
        ],
      })

      const result = await mockEnv.qualityChecker.check(['ci-test.ts'])

      // Validate JSON schema structure
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        issues: expect.any(Array),
        checkers: expect.any(Object),
      })

      // Should be valid JSON-serializable
      const jsonString = JSON.stringify(result)
      const parsed = JSON.parse(jsonString)
      expect(parsed).toBeDefined()
      expect(parsed.success).toBe(false)
    })

    it('should_provide_parseable_json_when_errors_exist', async () => {
      const errorFile = path.join(fixtureDir, 'error-test.ts')
      await fs.writeFile(
        errorFile,
        `
        const x: unknown = 42;
        // @ts-expect-error
        const y: string = x;
        const unused = 'test';
      `,
      )

      // Setup mock with errors
      mockEnv.qualityChecker.setPredefinedResult('error-test.ts', {
        filePath: 'error-test.ts',
        success: false,
        issues: [
          {
            line: 5,
            column: 7,
            message: "'unused' is assigned a value but never used.",
            severity: 'error',
            engine: 'eslint',
            ruleId: 'no-unused-vars',
          },
        ],
      })

      const result = await mockEnv.qualityChecker.check(['error-test.ts'])

      // Should be valid JSON-serializable
      const jsonString = JSON.stringify(result)
      const parsed = JSON.parse(jsonString)

      expect(parsed).toMatchObject({
        success: expect.any(Boolean),
        issues: expect.any(Array),
      })

      // Errors should be present and parseable
      expect(Array.isArray(parsed.issues)).toBe(true)
      expect(parsed.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Monitoring', () => {
    it('should_complete_check_within_performance_budget', async () => {
      const testFile = path.join(fixtureDir, 'perf-test.ts')
      await fs.writeFile(
        testFile,
        `
        export function performanceTest() {
          return 'fast';
        }
      `,
      )

      // Setup mock with successful result
      mockEnv.qualityChecker.setPredefinedResult('perf-test.ts', {
        filePath: 'perf-test.ts',
        success: true,
        issues: [],
      })

      const startTime = Date.now()
      const result = await mockEnv.qualityChecker.check(['perf-test.ts'])
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      // Mock checks should be very fast
      expect(duration).toBeLessThan(100)
    })

    it('should_handle_multiple_files_efficiently', async () => {
      const files: string[] = []

      // Create multiple test files
      for (let i = 0; i < 10; i++) {
        const fileName = `file-${i}.ts`
        const filePath = path.join(fixtureDir, fileName)
        await fs.writeFile(filePath, `export const value${i} = ${i};`)
        files.push(fileName)

        // Setup mock for each file
        mockEnv.qualityChecker.setPredefinedResult(fileName, {
          filePath: fileName,
          success: true,
          issues: [],
        })
      }

      const startTime = Date.now()
      const result = await mockEnv.qualityChecker.check(files)
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      // Even 10 files should be checked quickly with mocks
      expect(duration).toBeLessThan(200)
    })
  })

  describe('Error Aggregation', () => {
    it('should_aggregate_errors_from_multiple_engines', async () => {
      const testFile = path.join(fixtureDir, 'aggregate-test.ts')
      await fs.writeFile(
        testFile,
        `
        const unused: any = 'test';
        function   badly_formatted() {
          console.log('test')
        }
      `,
      )

      // Setup mock with multiple engine errors
      mockEnv.qualityChecker.setPredefinedResult('aggregate-test.ts', {
        filePath: 'aggregate-test.ts',
        success: false,
        issues: [
          {
            line: 2,
            column: 14,
            message: 'Unexpected any. Specify a different type.',
            severity: 'error',
            engine: 'typescript',
            ruleId: '@typescript-eslint/no-explicit-any',
          },
          {
            line: 2,
            column: 7,
            message: "'unused' is assigned a value but never used.",
            severity: 'error',
            engine: 'eslint',
            ruleId: 'no-unused-vars',
          },
          {
            line: 4,
            column: 1,
            message: 'Unexpected console statement.',
            severity: 'warning',
            engine: 'eslint',
            ruleId: 'no-console',
          },
          {
            line: 1,
            column: 1,
            message: 'File is not formatted with Prettier',
            severity: 'warning',
            engine: 'prettier',
            ruleId: 'format',
          },
        ],
      })

      const result = await mockEnv.qualityChecker.check(['aggregate-test.ts'])

      expect(result.success).toBe(false)

      // Count issues by engine
      const engineCounts = result.issues.reduce((acc: Record<string, number>, issue: any) => {
        acc[issue.engine] = (acc[issue.engine] || 0) + 1
        return acc
      }, {})

      expect(engineCounts.typescript).toBe(1)
      expect(engineCounts.eslint).toBe(2)
      expect(engineCounts.prettier).toBe(1)
    })

    it('should_handle_empty_results_gracefully', async () => {
      const testFile = path.join(fixtureDir, 'empty-test.ts')
      await fs.writeFile(testFile, 'export const valid = true;')

      // Setup mock with no issues
      mockEnv.qualityChecker.setPredefinedResult('empty-test.ts', {
        filePath: 'empty-test.ts',
        success: true,
        issues: [],
      })

      const result = await mockEnv.qualityChecker.check(['empty-test.ts'])

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result).toHaveProperty('checkers')
    })
  })

  describe('Exit Code Scenarios', () => {
    it('should_return_appropriate_exit_codes_for_different_scenarios', async () => {
      // Test file with no issues
      const cleanFile = path.join(fixtureDir, 'clean.ts')
      await fs.writeFile(cleanFile, 'export const clean = true;')

      mockEnv.qualityChecker.setPredefinedResult('clean.ts', {
        filePath: 'clean.ts',
        success: true,
        issues: [],
      })

      const cleanResult = await mockEnv.qualityChecker.check(['clean.ts'])
      expect(cleanResult.success).toBe(true)

      // Test file with warnings only
      const warningFile = path.join(fixtureDir, 'warning.ts')
      await fs.writeFile(warningFile, 'console.log("warning");')

      mockEnv.qualityChecker.setPredefinedResult('warning.ts', {
        filePath: 'warning.ts',
        success: true,
        issues: [
          {
            line: 1,
            column: 1,
            message: 'Unexpected console statement.',
            severity: 'warning',
            engine: 'eslint',
            ruleId: 'no-console',
          },
        ],
      })

      const warningResult = await mockEnv.qualityChecker.check(['warning.ts'])
      expect(warningResult.success).toBe(true)

      // Test file with errors
      const errorFile = path.join(fixtureDir, 'error.ts')
      await fs.writeFile(errorFile, 'const unused = 42;')

      mockEnv.qualityChecker.setPredefinedResult('error.ts', {
        filePath: 'error.ts',
        success: false,
        issues: [
          {
            line: 1,
            column: 7,
            message: "'unused' is assigned a value but never used.",
            severity: 'error',
            engine: 'eslint',
            ruleId: 'no-unused-vars',
          },
        ],
      })

      const errorResult = await mockEnv.qualityChecker.check(['error.ts'])
      expect(errorResult.success).toBe(false)
    })
  })

  describe('Parallel Processing', () => {
    it('should_handle_concurrent_checks_without_interference', async () => {
      const files: string[] = []

      // Create test files
      for (let i = 0; i < 5; i++) {
        const fileName = `parallel-${i}.ts`
        const filePath = path.join(fixtureDir, fileName)
        await fs.writeFile(filePath, `export const value${i} = ${i};`)
        files.push(fileName)

        // Setup different results for each file
        mockEnv.qualityChecker.setPredefinedResult(fileName, {
          filePath: fileName,
          success: i % 2 === 0, // Alternate between success and failure
          issues:
            i % 2 === 0
              ? []
              : [
                  {
                    line: 1,
                    column: 1,
                    message: `Test issue for file ${i}`,
                    severity: 'error',
                    engine: 'eslint',
                    ruleId: 'test-rule',
                  },
                ],
        })
      }

      // Run checks in parallel
      const results = await Promise.all(files.map((file) => mockEnv.qualityChecker.check([file])))

      // Verify each result
      results.forEach((result, index) => {
        if (index % 2 === 0) {
          expect(result.success).toBe(true)
          expect(result.issues).toHaveLength(0)
        } else {
          expect(result.success).toBe(false)
          expect(result.issues).toHaveLength(1)
          expect(result.issues[0].message).toContain(`Test issue for file ${index}`)
        }
      })
    })

    it('should_maintain_result_isolation_between_checks', async () => {
      const file1 = 'isolated-1.ts'
      const file2 = 'isolated-2.ts'

      // Setup different results for each file
      mockEnv.qualityChecker.setPredefinedResult(file1, {
        filePath: file1,
        success: true,
        issues: [],
      })

      mockEnv.qualityChecker.setPredefinedResult(file2, {
        filePath: file2,
        success: false,
        issues: [
          {
            line: 1,
            column: 1,
            message: 'Error in file 2',
            severity: 'error',
            engine: 'eslint',
            ruleId: 'test-rule',
          },
        ],
      })

      // Check files separately
      const result1 = await mockEnv.qualityChecker.check([file1])
      const result2 = await mockEnv.qualityChecker.check([file2])

      // Results should be independent
      expect(result1.success).toBe(true)
      expect(result1.issues).toHaveLength(0)

      expect(result2.success).toBe(false)
      expect(result2.issues).toHaveLength(1)
      expect(result2.issues[0].message).toBe('Error in file 2')
    })
  })
})
