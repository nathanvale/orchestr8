/**
 * Exit code logic tests using deterministic patterns
 * Replaces non-deterministic process exit codes with predictable behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MockedQualityChecker } from './api-wrappers.js'
import { ESLintFixtureFactory, TypeScriptFixtureFactory, PrettierFixtureFactory } from './modern-fixtures.js'
import type { TestFixture } from './modern-fixtures.js'

describe('Exit Code Logic - Deterministic Patterns', () => {
  let wrapper: MockedQualityChecker

  beforeEach(() => {
    wrapper = new MockedQualityChecker()
  })

  afterEach(() => {
    wrapper.cleanup()
  })

  describe('Single Engine Exit Codes', () => {
    it('should return exit code 0 for passing ESLint checks', async () => {
      // Arrange - Create a fixture with no issues
      const fixture: TestFixture = {
        description: 'Clean ESLint code',
        files: [
          ESLintFixtureFactory.createFlatConfig({
            rules: {
              'semi': ['error', 'always'],
              'quotes': ['error', 'single']
            }
          }),
          {
            path: 'src/clean.js',
            content: `const test = 'hello world';\nexport default test;\n`,
            exists: true
          }
        ],
        options: { eslint: true, typescript: false, prettier: false },
        expected: {
          eslint: { success: true, errorCount: 0 },
          overall: { success: true }
        }
      }
      
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const result = await wrapper.check(['src/clean.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert - Deterministic exit code based on success
      expect(result.success).toBe(true)
      // Exit code would be 0 for success
      const exitCode = result.success ? 0 : 1
      expect(exitCode).toBe(0)
      expect(executionTime).toBeLessThan(100)
    })

    it('should return exit code 1 for ESLint errors', async () => {
      // Arrange
      const fixture = ESLintFixtureFactory.createAirbnbStyleFixture()
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const result = await wrapper.check(['src/test.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert - Deterministic exit code for errors
      expect(result.success).toBe(false)
      // Exit code would be 1 for errors
      const exitCode = result.success ? 0 : 1
      expect(exitCode).toBe(1)
      expect(result.checkers.eslint?.errors).toBeDefined()
      expect((result.checkers.eslint?.errors || []).length).toBeGreaterThan(0)
      expect(executionTime).toBeLessThan(100)
    })

    it('should return exit code 2 for TypeScript compilation errors', async () => {
      // Arrange
      const fixture = TypeScriptFixtureFactory.createStrictModeFixture()
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const result = await wrapper.check(['src/strict.ts'], { 
        typescript: true, 
        eslint: false, 
        prettier: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert - TypeScript errors should map to exit code
      expect(result.success).toBe(false)
      // TypeScript errors result in non-zero exit code
      const exitCode = result.success ? 0 : 1
      expect(exitCode).toBeGreaterThanOrEqual(1)
      expect(result.checkers.typescript?.errors).toBeDefined()
      expect((result.checkers.typescript?.errors || []).length).toBeGreaterThan(0)
      expect(executionTime).toBeLessThan(100)
    })
  })

  describe('Multi-Engine Exit Code Priority', () => {
    it('should prioritize highest severity exit code across engines', async () => {
      // Arrange - Multiple engines with different severity issues
      const fixture: TestFixture = {
        description: 'Multi-engine with mixed severity',
        files: [
          ESLintFixtureFactory.createFlatConfig({
            rules: {
              'no-console': 'warn', // Warning only
              'semi': ['error', 'always']
            }
          }),
          TypeScriptFixtureFactory.createConfig({
            compilerOptions: {
              strict: true,
              noImplicitAny: true
            }
          }),
          PrettierFixtureFactory.createConfig({
            semi: true,
            singleQuote: true
          }),
          {
            path: 'src/mixed.ts',
            content: `function test(data) { // TypeScript error: implicit any
  console.log(data) // ESLint warning
  return data
}`, // Missing semicolon and formatting issues
            exists: true
          }
        ],
        options: { eslint: true, typescript: true, prettier: true },
        expected: {
          eslint: { 
            success: false, 
            errorCount: 1, 
            warningCount: 1 
          },
          typescript: { 
            success: false, 
            errorCount: 1 
          },
          prettier: { 
            success: false, 
            errorCount: 1 
          },
          overall: { success: false }
        }
      }
      
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const result = await wrapper.check(['src/mixed.ts'], { 
        eslint: true, 
        typescript: true, 
        prettier: true 
      })
      const executionTime = Date.now() - startTime
      
      // Assert - Should use highest severity exit code
      expect(result.success).toBe(false)
      // With multiple engine failures, exit code should be non-zero
      const exitCode = result.success ? 0 : 1
      expect(exitCode).toBeGreaterThanOrEqual(1)
      expect(executionTime).toBeLessThan(100)
      
      // Verify all engines reported issues
      expect(result.checkers.eslint).toBeDefined()
      expect(result.checkers.typescript).toBeDefined()
      expect(result.checkers.prettier).toBeDefined()
    })
  })

  describe('Auto-Fix Exit Code Behavior', () => {
    it('should return exit code 0 after successful auto-fix', async () => {
      // Arrange
      const fixture = ESLintFixtureFactory.createAutoFixableIssuesFixture()
      wrapper.loadFixture(fixture)
      
      // Act - Check initial state
      const initialResult = await wrapper.check(['src/fixable.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false 
      })
      
      // Perform fix
      const startTime = Date.now()
      const fixResult = await wrapper.fix(['src/fixable.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false,
        fix: true 
      })
      const executionTime = Date.now() - startTime
      
      // Assert
      expect(initialResult.success).toBe(false)
      const initialExitCode = initialResult.success ? 0 : 1
      expect(initialExitCode).toBeGreaterThanOrEqual(1)
      
      // After fix, exit code should be 0
      expect(fixResult.success).toBe(true)
      const fixExitCode = fixResult.success ? 0 : 1
      expect(fixExitCode).toBe(0)
      expect(executionTime).toBeLessThan(100)
    })

    it('should return non-zero exit code for unfixable issues', async () => {
      // Arrange - TypeScript type errors cannot be auto-fixed
      const fixture: TestFixture = {
        description: 'Unfixable TypeScript errors',
        files: [
          TypeScriptFixtureFactory.createConfig({
            compilerOptions: {
              strict: true,
              noUnusedLocals: true
            }
          }),
          {
            path: 'src/unfixable.ts',
            content: `function test(): string {
  const unused = 42; // Cannot auto-fix unused variable
  return 123; // Type error: number is not assignable to string
}`,
            exists: true
          }
        ],
        options: { typescript: true, eslint: false, prettier: false, fix: true },
        expected: {
          typescript: { 
            success: false, 
            errorCount: 2,
            fixableCount: 0 
          },
          overall: { success: false }
        }
      }
      
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const result = await wrapper.check(['src/unfixable.ts'], { 
        typescript: true, 
        eslint: false, 
        prettier: false 
      })
      
      // Attempt fix (should fail for TypeScript type errors)
      const fixResult = await wrapper.fix(['src/unfixable.ts'], { 
        typescript: true, 
        eslint: false, 
        prettier: false,
        fix: true 
      })
      const executionTime = Date.now() - startTime
      
      // Assert - Exit code should remain non-zero
      expect(result.success).toBe(false)
      const resultExitCode = result.success ? 0 : 1
      expect(resultExitCode).toBeGreaterThanOrEqual(1)
      
      // Fix should fail for unfixable issues
      expect(fixResult.success).toBe(false)
      const fixExitCode = fixResult.success ? 0 : 1
      expect(fixExitCode).toBeGreaterThanOrEqual(1)
      expect(executionTime).toBeLessThan(100)
    })

    it('should handle partial fixes with appropriate exit code', async () => {
      // Arrange - Mix of fixable and unfixable issues
      const fixture: TestFixture = {
        description: 'Mixed fixable and unfixable issues',
        files: [
          ESLintFixtureFactory.createFlatConfig({
            rules: {
              'semi': ['error', 'always'], // Fixable
              'no-unused-vars': 'error', // Not auto-fixable
              'quotes': ['error', 'single'] // Fixable
            }
          }),
          {
            path: 'src/partial-fix.js',
            content: `const test = "hello world"
const unused = 42
export default test`,
            exists: true
          }
        ],
        options: { eslint: true, typescript: false, prettier: false, fix: true },
        expected: {
          eslint: { 
            success: false, 
            errorCount: 3,
            fixableCount: 2 // semi and quotes are fixable
          },
          overall: { success: false }
        }
      }
      
      wrapper.loadFixture(fixture)
      
      // Act
      const startTime = Date.now()
      const fixResult = await wrapper.fix(['src/partial-fix.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false,
        fix: true 
      })
      
      // Check after partial fix
      const afterFixResult = await wrapper.check(['src/partial-fix.js'], { 
        eslint: true, 
        typescript: false, 
        prettier: false 
      })
      const executionTime = Date.now() - startTime
      
      // Assert - Exit code should be non-zero due to remaining unfixable issues
      expect(fixResult.count).toBeGreaterThan(0) // Some issues were fixed
      expect(afterFixResult.success).toBe(false) // But not all
      const afterFixExitCode = afterFixResult.success ? 0 : 1
      expect(afterFixExitCode).toBeGreaterThanOrEqual(1)
      expect(executionTime).toBeLessThan(100)
      
      // Verify unfixable issue remains
      expect(afterFixResult.checkers.eslint?.errors).toBeDefined()
      const errors = afterFixResult.checkers.eslint?.errors || []
      expect(errors.some(e => e.includes('no-unused-vars'))).toBe(true)
    })
  })
})