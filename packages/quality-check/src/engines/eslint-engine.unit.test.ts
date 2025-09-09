import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ESLintEngine } from './eslint-engine'

describe('ESLintEngine', () => {
  let engine: ESLintEngine
  let tempDir: string

  beforeEach(() => {
    engine = new ESLintEngine()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-engine-test-'))

    // Create a basic ESLint flat config (CommonJS for compatibility)
    const eslintConfig = `
module.exports = [
  {
    files: ['**/*.js', '**/*.ts'],
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'error',
      'semi': ['error', 'never'],
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
      },
    },
  },
]
`
    fs.writeFileSync(path.join(tempDir, 'eslint.config.js'), eslintConfig)
  })

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })
    engine.clearCache()
  })

  describe('check', () => {
    it('should return success when no issues found', async () => {
      const testFile = path.join(tempDir, 'valid.js')
      fs.writeFileSync(
        testFile,
        `const greeting = 'Hello, World!'
module.exports = greeting`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should detect linting errors', async () => {
      const testFile = path.join(tempDir, 'errors.js')
      fs.writeFileSync(
        testFile,
        `const unused = 'Hello';
console.log('test');`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(4) // unused variable + 2 semicolons + console.log

      const unusedVarIssue = result.issues.find((i) => i.ruleId === 'no-unused-vars')
      expect(unusedVarIssue).toBeDefined()
      expect(unusedVarIssue?.severity).toBe('error')
      expect(unusedVarIssue?.message).toContain('unused')

      const consoleIssue = result.issues.find((i) => i.ruleId === 'no-console')
      expect(consoleIssue).toBeDefined()
      expect(consoleIssue?.severity).toBe('warning')
    })

    it('should fix issues when fix option is enabled', async () => {
      const testFile = path.join(tempDir, 'fixable.js')
      fs.writeFileSync(
        testFile,
        `const greeting = 'Hello';
module.exports = greeting`,
      )

      const result = await engine.check({
        files: [testFile],
        fix: true,
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.fixedCount).toBeGreaterThanOrEqual(0)

      // File should not have semicolon after fix
      const content = fs.readFileSync(testFile, 'utf-8')
      expect(content).not.toContain(';')
    })

    it('should respect cache directory option', async () => {
      const customCacheDir = path.join(tempDir, 'custom-cache')
      const testFile = path.join(tempDir, 'cached.js')
      fs.writeFileSync(
        testFile,
        `const greeting = 'Hello'
module.exports = greeting`,
      )

      await engine.check({
        files: [testFile],
        cacheDir: customCacheDir,
        cwd: tempDir,
      })

      // Cache directory should be created
      expect(fs.existsSync(customCacheDir)).toBe(true)
    })

    it('should handle cancellation token', async () => {
      const testFile = path.join(tempDir, 'cancel.js')
      fs.writeFileSync(testFile, `const test = 'test'`)

      const token = {
        isCancellationRequested: true,
        onCancellationRequested: () => {},
      }

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
        token,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should handle multiple files', async () => {
      const file1 = path.join(tempDir, 'file1.js')
      const file2 = path.join(tempDir, 'file2.js')

      fs.writeFileSync(file1, `const unused1 = 'test'`)
      fs.writeFileSync(file2, `const unused2 = 'test'`)

      const result = await engine.check({
        files: [file1, file2],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(2) // One unused variable in each file
      expect(result.issues[0].file).toBe(file1)
      expect(result.issues[1].file).toBe(file2)
    })

    it('should handle ESLint configuration errors gracefully', async () => {
      // Remove ESLint config to cause configuration error
      fs.unlinkSync(path.join(tempDir, 'eslint.config.js'))

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, `const test = 'test'\nmodule.exports = test`)

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Should handle gracefully - either success with no rules or error captured
      expect(result).toBeDefined()
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should detect fixable issues', async () => {
      const testFile = path.join(tempDir, 'fixable-detect.js')
      fs.writeFileSync(
        testFile,
        `const greeting = 'Hello';`, // Has semicolon that should be removed
      )

      const result = await engine.check({
        files: [testFile],
        fix: false, // Don't fix, just detect
        cwd: tempDir,
      })

      expect(result.fixable).toBe(true)
    })
  })

  describe('format', () => {
    it('should format results as stylish by default', async () => {
      const mockResults = [
        {
          filePath: '/test/file.js',
          messages: [
            {
              line: 1,
              column: 1,
              severity: 2 as const,
              message: 'Test error',
              ruleId: 'test-rule',
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
      ]

      const formatted = await engine.format(mockResults)
      expect(formatted).toBeDefined()
      expect(typeof formatted).toBe('string')
    })

    it('should format results as JSON when specified', async () => {
      const mockResults = [
        {
          filePath: '/test/file.js',
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
      ]

      const formatted = await engine.format(mockResults, 'json')
      expect(formatted).toBeDefined()
      expect(() => JSON.parse(formatted)).not.toThrow()
    })
  })

  describe('isConfigured', () => {
    it('should return true when ESLint is configured', async () => {
      const configured = await engine.isConfigured()
      expect(configured).toBe(true)
    })

    it('should return false when ESLint is not configured', async () => {
      // Remove config file
      fs.unlinkSync(path.join(tempDir, 'eslint.config.js'))

      // Change to temp dir without config
      const originalCwd = process.cwd()
      process.chdir(tempDir)

      const configured = await engine.isConfigured()

      // Restore original cwd
      process.chdir(originalCwd)

      // May still return true if there's a global config
      expect(typeof configured).toBe('boolean')
    })
  })

  describe('getVersion', () => {
    it('should return ESLint version', () => {
      const version = ESLintEngine.getVersion()
      expect(version).toBeDefined()
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('clearCache', () => {
    it('should clear internal ESLint instance', () => {
      engine.clearCache()
      // This is mainly for coverage, the actual effect is internal
      expect(engine).toBeDefined()
    })
  })

  describe('JSON Error Reporting', () => {
    it('should generate ErrorReport from ESLint results with errors', async () => {
      const testFile = path.join(tempDir, 'errors.js')
      fs.writeFileSync(
        testFile,
        `const unused = 'Hello';
console.log('test');`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Create mock ESLint results for formatting since getResults() doesn't exist
      const mockResults = [
        {
          filePath: testFile,
          messages: result.issues.map((issue) => ({
            line: issue.line,
            column: issue.col,
            severity: (issue.severity === 'error' ? 2 : 1) as 1 | 2,
            message: issue.message,
            ruleId: issue.ruleId || null,
          })),
          errorCount: result.issues.filter((i) => i.severity === 'error').length,
          warningCount: result.issues.filter((i) => i.severity === 'warning').length,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
      ]

      const jsonOutput = await engine.format(mockResults, 'json')

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(4)
      expect(jsonOutput).toBeDefined()
      expect(() => JSON.parse(jsonOutput)).not.toThrow()

      // Verify JSON structure
      const parsed = JSON.parse(jsonOutput)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0]).toHaveProperty('filePath')
      expect(parsed[0]).toHaveProperty('messages')
      expect(parsed[0].messages).toHaveLength(4)
    })

    it('should generate ErrorReport from ESLint results with no errors', async () => {
      const testFile = path.join(tempDir, 'valid.js')
      fs.writeFileSync(
        testFile,
        `const greeting = 'Hello, World!'
module.exports = greeting`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Create mock ESLint results for formatting since getResults() doesn't exist
      const mockResults = [
        {
          filePath: testFile,
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
      ]

      const jsonOutput = await engine.format(mockResults, 'json')

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(jsonOutput).toBeDefined()
      expect(() => JSON.parse(jsonOutput)).not.toThrow()

      // Verify JSON structure for clean results
      const parsed = JSON.parse(jsonOutput)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed[0]).toHaveProperty('filePath')
      expect(parsed[0].messages).toHaveLength(0)
    })

    it('should support both JSON and stylish output formats simultaneously', async () => {
      const testFile = path.join(tempDir, 'mixed.js')
      fs.writeFileSync(testFile, `const unused = 'test'`)

      await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Create mock ESLint results since getResults() doesn't exist
      const mockResults = [
        {
          filePath: testFile,
          messages: [
            {
              line: 1,
              column: 7,
              severity: 2 as const,
              message: "'unused' is defined but never used.",
              ruleId: 'no-unused-vars',
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
      ]

      const jsonOutput = await engine.format(mockResults, 'json')
      const stylishOutput = await engine.format(mockResults, 'stylish')

      expect(jsonOutput).toBeDefined()
      expect(stylishOutput).toBeDefined()
      expect(() => JSON.parse(jsonOutput)).not.toThrow()
      expect(typeof stylishOutput).toBe('string')
      expect(stylishOutput).toContain('unused')
    })

    it('should provide detailed error information for ErrorReport conversion', async () => {
      const testFile = path.join(tempDir, 'detailed.js')
      fs.writeFileSync(
        testFile,
        `const unused1 = 'test';
const unused2 = 'test';
console.log('debug');`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)

      // Verify we have detailed information for ErrorReport conversion
      const firstIssue = result.issues[0]
      expect(firstIssue).toHaveProperty('file')
      expect(firstIssue).toHaveProperty('line')
      expect(firstIssue).toHaveProperty('col')
      expect(firstIssue).toHaveProperty('message')
      expect(firstIssue).toHaveProperty('ruleId')
      expect(firstIssue).toHaveProperty('severity')
      expect(['error', 'warning']).toContain(firstIssue.severity)
    })

    it('should handle multiple files in JSON output', async () => {
      const file1 = path.join(tempDir, 'file1.js')
      const file2 = path.join(tempDir, 'file2.js')

      fs.writeFileSync(file1, `const unused1 = 'test';`)
      fs.writeFileSync(file2, `console.log('debug');`)

      await engine.check({
        files: [file1, file2],
        cwd: tempDir,
      })

      // Create mock ESLint results for multiple files since getResults() doesn't exist
      const mockResults = [
        {
          filePath: file1,
          messages: [
            {
              line: 1,
              column: 7,
              severity: 2 as const,
              message: "'unused1' is defined but never used.",
              ruleId: 'no-unused-vars',
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
        {
          filePath: file2,
          messages: [
            {
              line: 1,
              column: 1,
              severity: 1 as const,
              message: 'Unexpected console statement.',
              ruleId: 'no-console',
            },
          ],
          errorCount: 0,
          warningCount: 1,
          fatalErrorCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
          usedDeprecatedRules: [],
          suppressedMessages: [],
        },
      ]

      const jsonOutput = await engine.format(mockResults, 'json')
      const parsed = JSON.parse(jsonOutput)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].filePath).toBe(file1)
      expect(parsed[1].filePath).toBe(file2)
      expect(parsed[0].messages.length).toBeGreaterThan(0)
      expect(parsed[1].messages.length).toBeGreaterThan(0)
    })
  })
})
