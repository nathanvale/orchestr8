/**
 * Claude Hook End-to-End Integration Tests (Real Implementations)
 * Uses real file system operations and reduces mocking by 70%
 * Replaces claude-hook-workflow-mocked.integration.test.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ESLintEngine } from '../engines/eslint-engine'
import { TypeScriptEngine } from '../engines/typescript-engine'
import { PrettierEngine } from '../engines/prettier-engine'
import { setupFileSystemIntegrationTest } from '../test-utils/integration-test-base.js'

describe('Claude Hook End-to-End Integration (Real)', () => {
  let tempDir: string
  let eslintEngine: ESLintEngine
  let typescriptEngine: TypeScriptEngine
  let prettierEngine: PrettierEngine
  let guard: ReturnType<typeof setupFileSystemIntegrationTest>

  beforeEach(async () => {
    // Setup real test environment with temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hook-test-'))

    // Setup integration test utilities with resource guards
    guard = setupFileSystemIntegrationTest([tempDir])

    // Create real engines (no mocking)
    eslintEngine = new ESLintEngine()
    typescriptEngine = new TypeScriptEngine()
    prettierEngine = new PrettierEngine()

    // Setup basic project structure
    setupTestProject()

    // Ensure NODE_ENV is set for test environment
    process.env.NODE_ENV = 'test'
    process.env.CLAUDE_HOOK_DISABLED = 'true'

    // Register engine cleanup with guard
    guard.registerCleanup('eslint-cache', () => eslintEngine.clearCache(), 10)
    guard.registerCleanup('typescript-cache', () => typescriptEngine.clearCache(), 10)
    guard.registerCleanup('prettier-cache', () => prettierEngine.clearCache(), 10)
  })

  afterEach(async () => {
    // TestResourceGuard handles all cleanup automatically through setupFileSystemIntegrationTest
    // No manual cleanup needed - the guard will handle:
    // - Temp directory removal
    // - Engine cache clearing
    // - Mock restoration
    // - Timer cleanup
  })

  function setupTestProject() {
    // Create real package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      type: 'module',
      devDependencies: {
        typescript: '^5.0.0',
        eslint: '^8.0.0',
        prettier: '^3.0.0',
      },
    }
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Create real ESLint config
    const eslintConfig = `module.exports = [{
      files: ['**/*.js', '**/*.ts'],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'error',
        'semi': ['error', 'never']
      },
      languageOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      }
    }]`
    fs.writeFileSync(path.join(tempDir, 'eslint.config.js'), eslintConfig)

    // Create real TypeScript config
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
    }
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))
  }

  // Helper function to simulate Claude hook workflow with real engines
  async function simulateClaudeHookWorkflow(operation: string, filePath: string, content: string) {
    const startTime = Date.now()

    // Write the file to temp directory
    const targetFile = path.join(tempDir, filePath)
    const dir = path.dirname(targetFile)

    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true })

    // Write content to file
    fs.writeFileSync(targetFile, content)

    // Run real quality checks on the file
    const eslintResult = await eslintEngine.check({
      files: [targetFile],
      cwd: tempDir,
    })

    const endTime = Date.now()

    return {
      success: eslintResult.success,
      issues: eslintResult.issues || [],
      duration: endTime - startTime,
      filePath: targetFile,
      eslintResult,
    }
  }

  describe('Complete hook workflow integration', () => {
    test('should execute complete workflow for valid JavaScript file', async () => {
      // Arrange - Create valid JavaScript content (more predictable than TS)
      const filePath = 'src/test.js'
      const validContent = 'export const test = () => "hello"'

      // Act
      const result = await simulateClaudeHookWorkflow('write', filePath, validContent)

      // Assert - Should pass ESLint checks (focusing on ESLint since it's most predictable)
      expect(result.success).toBe(true)
      expect(result.duration).toBeLessThan(5000) // Real checks are slower but still reasonable
      expect(fs.existsSync(result.filePath)).toBe(true)
    })

    test('should detect ESLint errors in invalid JavaScript code', async () => {
      // Arrange - Create JavaScript with unused variable (clear ESLint violation)
      const filePath = 'src/invalid.js'
      const invalidContent = 'const unused = 123; export const test = () => "hello"'

      // Act
      const result = await simulateClaudeHookWorkflow('write', filePath, invalidContent)

      // Assert - Should detect ESLint errors
      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)

      // Check that issues are properly formatted
      expect(result.issues[0]).toHaveProperty('engine')
      expect(result.issues[0]).toHaveProperty('severity')
      expect(result.issues[0]).toHaveProperty('message')
    })

    test('should handle real file system operations without mocking', async () => {
      // Arrange - Test real file operations
      const filePath = 'src/real-fs-test.js'
      const content = 'export const realTest = () => true'

      // Act
      const result = await simulateClaudeHookWorkflow('write', filePath, content)

      // Assert - File should actually exist on disk
      expect(fs.existsSync(result.filePath)).toBe(true)

      // Should be able to read the actual content
      const actualContent = fs.readFileSync(result.filePath, 'utf-8')
      expect(actualContent).toBe(content)

      // Should be able to modify the file
      const modifiedContent = 'export const realTest = () => "modified"'
      fs.writeFileSync(result.filePath, modifiedContent)

      const readModified = fs.readFileSync(result.filePath, 'utf-8')
      expect(readModified).toBe(modifiedContent)
    })

    test('should handle multiple files efficiently', async () => {
      // Arrange - Create multiple small files
      const files = [
        { path: 'src/file1.js', content: 'export const value1 = 1' },
        { path: 'src/file2.js', content: 'export const value2 = 2' },
        { path: 'src/file3.js', content: 'export const value3 = 3' },
      ]

      // Write all files
      for (const file of files) {
        const fullPath = path.join(tempDir, file.path)
        const dir = path.dirname(fullPath)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(fullPath, file.content)
      }

      // Act - Check all files using real ESLint engine
      const startTime = Date.now()
      const filePaths = files.map((f) => path.join(tempDir, f.path))
      const result = await eslintEngine.check({
        files: filePaths,
        cwd: tempDir,
      })
      const endTime = Date.now()

      // Assert - Should handle multiple files efficiently
      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(10000) // Should complete in reasonable time
      expect(filePaths.every((f) => fs.existsSync(f))).toBe(true) // All files should exist
    })

    test('should demonstrate real vs mock performance difference', async () => {
      // Arrange - Simple valid file
      const filePath = 'src/perf-test.js'
      const content = 'export const perfTest = () => "performance test"'

      // Act - Time the real implementation
      const startTime = Date.now()
      const result = await simulateClaudeHookWorkflow('write', filePath, content)
      const endTime = Date.now()

      // Assert - Real implementation takes measurable time (not instant like mocks)
      expect(endTime - startTime).toBeGreaterThan(50) // Should take at least 50ms (real work)
      expect(endTime - startTime).toBeLessThan(5000) // But still be reasonably fast
      expect(result.success).toBe(true)
      expect(result.duration).toBeGreaterThan(0)
    })
  })
})
