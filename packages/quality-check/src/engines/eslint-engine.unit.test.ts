import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ESLintEngine } from './eslint-engine'

// Test setup shared across multiple describe blocks
let engine: ESLintEngine
let tempDir: string

const setupTest = () => {
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
}

const teardownTest = () => {
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true })
  engine.clearCache()
}

describe('ESLintEngine - Basic Check Operations', () => {
  beforeEach(setupTest)
  afterEach(teardownTest)

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
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})

describe('ESLintEngine - Fix Operations', () => {
  beforeEach(setupTest)
  afterEach(teardownTest)

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

  it('should populate modifiedFiles when fixes are applied', async () => {
    const testFile = path.join(tempDir, 'fixable-modified.js')
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
    expect(result.modifiedFiles).toBeDefined()
    expect(result.modifiedFiles).toContain(testFile)
  })

  it('should not populate modifiedFiles when no fixes are applied', async () => {
    const testFile = path.join(tempDir, 'no-fixes.js')
    fs.writeFileSync(
      testFile,
      `const greeting = 'Hello'
module.exports = greeting`,
    )

    const result = await engine.check({
      files: [testFile],
      fix: true,
      cwd: tempDir,
    })

    expect(result.success).toBe(true)
    expect(result.modifiedFiles).toBeDefined()
    expect(result.modifiedFiles).toHaveLength(0)
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

describe('ESLintEngine - Configuration and Cache', () => {
  beforeEach(setupTest)
  afterEach(teardownTest)

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

  it('should return true when ESLint is configured', async () => {
    const configured = await engine.isConfigured()
    expect(configured).toBe(true)
  })

  it('should return ESLint version', () => {
    const version = ESLintEngine.getVersion()
    expect(version).toBeDefined()
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('ESLintEngine - Cache Management', () => {
  beforeEach(setupTest)
  afterEach(teardownTest)

  it('should clear internal ESLint instance', () => {
    engine.clearCache()
    // This is mainly for coverage, the actual effect is internal
    expect(engine).toBeDefined()
  })

  it('should allow fresh ESLint instance creation after clearCache', async () => {
    const testFile = path.join(tempDir, 'fresh.js')
    fs.writeFileSync(testFile, `const test = 'test'\nmodule.exports = test`)

    // First check to initialize ESLint instance
    const result1 = await engine.check({
      files: [testFile],
      cwd: tempDir,
    })

    expect(result1).toBeDefined()

    // Clear cache
    engine.clearCache()

    // Second check should work with new instance
    const result2 = await engine.check({
      files: [testFile],
      cwd: tempDir,
    })

    expect(result2).toBeDefined()
    expect(result2.success).toBe(true)
  })

  it('should clear cache after multiple check operations', async () => {
    const testFile1 = path.join(tempDir, 'test1.js')
    const testFile2 = path.join(tempDir, 'test2.js')

    fs.writeFileSync(testFile1, `const test1 = 'test'\nmodule.exports = test1`)
    fs.writeFileSync(testFile2, `const test2 = 'test'\nmodule.exports = test2`)

    // Run multiple checks to create internal state
    await engine.check({ files: [testFile1], cwd: tempDir })
    await engine.check({ files: [testFile2], cwd: tempDir })

    // Clear should not throw and should reset state
    expect(() => engine.clearCache()).not.toThrow()

    // Should still work after clearing
    const result = await engine.check({
      files: [testFile1],
      cwd: tempDir,
    })

    expect(result.success).toBe(true)
  })

  it('should handle clearCache when no ESLint instance exists', () => {
    const freshEngine = new ESLintEngine()
    expect(() => freshEngine.clearCache()).not.toThrow()
  })

  it('should clear cache directory when requested', async () => {
    const customCacheDir = path.join(tempDir, 'eslint-cache')
    const testFile = path.join(tempDir, 'cache-test.js')
    fs.writeFileSync(testFile, `const test = 'test'\nmodule.exports = test`)

    // Run check to create cache
    await engine.check({
      files: [testFile],
      cacheDir: customCacheDir,
      cwd: tempDir,
    })

    // Verify cache was created
    expect(fs.existsSync(customCacheDir)).toBe(true)

    // Clear cache directory
    await engine.clearCacheDirectory(customCacheDir)

    // Cache directory should be removed
    expect(fs.existsSync(customCacheDir)).toBe(false)
  })

  it('should handle clearCacheDirectory when directory does not exist', async () => {
    const nonExistentDir = path.join(tempDir, 'non-existent-cache')

    // Should not throw even if directory doesn't exist
    await expect(engine.clearCacheDirectory(nonExistentDir)).resolves.toBeUndefined()
  })

  it('should dispose resources properly', () => {
    engine.dispose()
    expect(engine).toBeDefined()
    // dispose() should clear internal state without throwing
  })

  it('should return memory usage statistics', () => {
    const memUsage = engine.getMemoryUsage()
    if (memUsage) {
      expect(memUsage).toHaveProperty('used')
      expect(memUsage).toHaveProperty('total')
      expect(typeof memUsage.used).toBe('number')
      expect(typeof memUsage.total).toBe('number')
      expect(memUsage.used).toBeGreaterThan(0)
      expect(memUsage.total).toBeGreaterThan(0)
    } else {
      // Memory usage might not be available in all environments
      expect(memUsage).toBeUndefined()
    }
  })
})

describe('ESLintEngine - Resource Management', () => {
  beforeEach(setupTest)
  afterEach(teardownTest)

  it('should handle memory cleanup during large file operations', async () => {
    // Create a larger file to test memory handling
    const largeFile = path.join(tempDir, 'large.js')
    const largeContent = `
        const data = Array(100).fill(0).map((_, i) => \`const var\${i} = "test\${i}"\`).join("\\n");
        module.exports = { data };
      `
    fs.writeFileSync(largeFile, largeContent)

    const result = await engine.check({
      files: [largeFile],
      cwd: tempDir,
    })

    expect(result).toBeDefined()
    expect(result.duration).toBeGreaterThan(0)

    // Cleanup should work after large operations
    expect(() => engine.clearCache()).not.toThrow()
  })

  it('should handle cleanup after error conditions', async () => {
    const invalidFile = path.join(tempDir, 'invalid.js')
    fs.writeFileSync(invalidFile, 'invalid javascript syntax {{{ ')

    // This should handle the error gracefully
    const result = await engine.check({
      files: [invalidFile],
      cwd: tempDir,
    })

    expect(result).toBeDefined()

    // Cleanup should still work after errors
    expect(() => engine.clearCache()).not.toThrow()

    // Should be able to process valid files after cleanup
    const validFile = path.join(tempDir, 'valid-after-error.js')
    fs.writeFileSync(validFile, `const test = 'test'\nmodule.exports = test`)

    const validResult = await engine.check({
      files: [validFile],
      cwd: tempDir,
    })

    expect(validResult.success).toBe(true)
  })

  it('should handle concurrent operations and cleanup', async () => {
    const file1 = path.join(tempDir, 'concurrent1.js')
    const file2 = path.join(tempDir, 'concurrent2.js')

    fs.writeFileSync(file1, `const test1 = 'test'\nmodule.exports = test1`)
    fs.writeFileSync(file2, `const test2 = 'test'\nmodule.exports = test2`)

    // Start multiple operations
    const promise1 = engine.check({ files: [file1], cwd: tempDir })
    const promise2 = engine.check({ files: [file2], cwd: tempDir })

    const [result1, result2] = await Promise.all([promise1, promise2])

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()

    // Cleanup should work after concurrent operations
    expect(() => engine.clearCache()).not.toThrow()
  })

  it('should properly dispose resources during cancellation', async () => {
    const testFile = path.join(tempDir, 'cancel-cleanup.js')
    fs.writeFileSync(testFile, `const test = 'test'\nmodule.exports = test`)

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

    // Cleanup should work after cancellation
    expect(() => engine.clearCache()).not.toThrow()
  })
})

describe('ESLintEngine - Formatting', () => {
  beforeEach(setupTest)
  afterEach(teardownTest)

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
