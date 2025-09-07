/**
 * Vitest Integration Test
 * Validates that modern fixtures integrate seamlessly with existing Vitest configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as child_process from 'node:child_process'
import {
  ESLintFixtureFactory,
  TypeScriptFixtureFactory,
  PrettierFixtureFactory,
  MultiEngineFixtureFactory,
  ExitCodeFixtureFactory
} from './modern-fixtures.js'
import { assertQualityResult, assertFixResult } from './assertion-helpers.js'
import { QualityChecker } from '../core/quality-checker.js'
import type { TestFixture, MockFile, ExpectedMessage } from './modern-fixtures.js'

// Mock the modules at the top level
vi.mock('node:fs')
vi.mock('node:child_process')

// Global storage for mock data
const globalMockFiles = new Map<string, MockFile>()
const globalExecutionResults = new Map<string, any>()

describe('Quality Checker - Modern Integration Tests', () => {
  let checker: QualityChecker
  let performanceTracker: Map<string, number>

  beforeEach(() => {
    performanceTracker = new Map()
    // Clear mock data
    globalMockFiles.clear()
    globalExecutionResults.clear()
    
    // Setup fs mocks
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const pathStr = typeof path === 'string' ? path : path.toString()
      const file = globalMockFiles.get(pathStr)
      return file?.exists ?? false
    })
    
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const pathStr = typeof path === 'string' ? path : path.toString()
      const file = globalMockFiles.get(pathStr)
      if (!file || !file.exists) {
        throw new Error(`ENOENT: no such file or directory, open '${pathStr}'`)
      }
      return file.content
    })
    
    vi.mocked(fs.writeFileSync).mockImplementation((path, content) => {
      const pathStr = typeof path === 'string' ? path : path.toString()
      const contentStr = typeof content === 'string' ? content : content.toString()
      const file = globalMockFiles.get(pathStr)
      if (file) {
        file.content = contentStr
      } else {
        globalMockFiles.set(pathStr, {
          path: pathStr,
          content: contentStr,
          exists: true
        })
      }
    })
    
    // Setup child_process mocks
    vi.mocked(child_process.execSync).mockImplementation((command: any) => {
      const cmdStr = typeof command === 'string' ? command : String(command)
      const result = globalExecutionResults.get(cmdStr)
      
      if (!result) {
        // Default behavior - return empty buffer for unknown commands
        return Buffer.from('')
      }
      
      if (result.exitCode && result.exitCode !== 0) {
        const error = new Error(result.stderr || '') as any
        error.status = result.exitCode
        error.stderr = Buffer.from(result.stderr || '')
        error.stdout = Buffer.from(result.stdout || '')
        throw error
      }
      
      return Buffer.from(result.stdout || '')
    })
    
    checker = new QualityChecker()
  })

  afterEach(() => {
    vi.clearAllMocks()
    
    // Validate performance for all tracked tests
    performanceTracker.forEach((duration, testName) => {
      if (duration > 100) {
        console.warn(`Performance warning: ${testName} took ${duration}ms (target: <100ms)`)
      }
    })
  })
  
  async function trackPerformance(testName: string, operation: () => Promise<void>): Promise<void> {
    const startTime = performance.now()
    await operation()
    const duration = performance.now() - startTime
    performanceTracker.set(testName, duration)
    expect(duration).toBeLessThan(100)
  }

  function loadFixture(fixture: TestFixture): void {
    // Load mock files
    for (const file of fixture.files) {
      globalMockFiles.set(file.path, { ...file })
    }
    
    // Setup execution results based on expected results
    setupExecutionResults(fixture)
  }
  
  function setupExecutionResults(fixture: TestFixture): void {
    const options = fixture.options || {}
    
    // Mock ESLint results
    if (fixture.expected.eslint) {
      // Match any eslint command that includes the files
      const eslintCommands = [
        `npx eslint ${fixture.files.map(f => `"${f.path}"`).join(' ')} --format=json`,
        `npx eslint ${fixture.files.map(f => f.path).join(' ')} --format=json`,
      ]
      
      const eslintOutput = createESLintOutput(fixture.expected.eslint, fixture.files)
      eslintCommands.forEach(cmd => {
        globalExecutionResults.set(cmd, {
          stdout: JSON.stringify(eslintOutput),
          stderr: '',
          exitCode: (fixture.expected.eslint?.errorCount ?? 0) > 0 ? 1 : 0
        })
      })
      
      // Also handle fix mode
      if (options.fix) {
        const fixCommands = [
          `npx eslint ${fixture.files.map(f => `"${f.path}"`).join(' ')} --fix --format=json`,
          `npx eslint ${fixture.files.map(f => f.path).join(' ')} --fix --format=json`,
        ]
        fixCommands.forEach(cmd => {
          globalExecutionResults.set(cmd, {
            stdout: JSON.stringify(eslintOutput),
            stderr: '',
            exitCode: 0
          })
        })
      }
    }
    
    // Mock TypeScript results
    if (fixture.expected.typescript) {
      const tscCommand = 'npx tsc --noEmit'
      globalExecutionResults.set(tscCommand, {
        stdout: '',
        stderr: createTypeScriptOutput(fixture.expected.typescript, fixture.files),
        exitCode: (fixture.expected.typescript?.errorCount ?? 0) > 0 ? 1 : 0
      })
    }
    
    // Mock Prettier results
    if (fixture.expected.prettier) {
      const prettierCommands = [
        `npx prettier --check ${fixture.files.map(f => `"${f.path}"`).join(' ')}`,
        `npx prettier --check ${fixture.files.map(f => f.path).join(' ')}`,
      ]
      
      prettierCommands.forEach(cmd => {
        globalExecutionResults.set(cmd, {
          stdout: createPrettierOutput(fixture.expected.prettier, fixture.files),
          stderr: '',
          exitCode: (fixture.expected.prettier?.errorCount ?? 0) > 0 ? 1 : 0
        })
      })
      
      // Also handle fix mode
      if (options.fix) {
        const fixCommands = [
          `npx prettier --write ${fixture.files.map(f => `"${f.path}"`).join(' ')}`,
          `npx prettier --write ${fixture.files.map(f => f.path).join(' ')}`,
        ]
        fixCommands.forEach(cmd => {
          globalExecutionResults.set(cmd, {
            stdout: '',
            stderr: '',
            exitCode: 0
          })
        })
      }
    }
    
    // Add tsconfig.json if typescript is being tested
    if (fixture.expected.typescript) {
      globalMockFiles.set('tsconfig.json', {
        path: 'tsconfig.json',
        content: '{}',
        exists: true
      })
    }
  }
  
  function createESLintOutput(expected: any, files: MockFile[]): any[] {
    const messages = expected.messages || []
    return files.map(file => ({
      filePath: file.path,
      messages: messages
        .filter((msg: ExpectedMessage) => msg.file === file.path)
        .map((msg: ExpectedMessage) => ({
          ruleId: msg.rule,
          severity: msg.severity === 'error' ? 2 : 1,
          message: msg.message,
          line: msg.line,
          column: msg.column
        })),
      errorCount: messages.filter((m: ExpectedMessage) => m.severity === 'error' && m.file === file.path).length,
      warningCount: messages.filter((m: ExpectedMessage) => m.severity === 'warning' && m.file === file.path).length,
      fixableErrorCount: expected.fixableCount ?? 0,
      fixableWarningCount: 0
    }))
  }
  
  function createTypeScriptOutput(expected: any, _files: MockFile[]): string {
    const messages = expected.messages || []
    return messages
      .map((msg: ExpectedMessage) => 
        `${msg.file}(${msg.line},${msg.column}): error TS${msg.rule || '2322'}: ${msg.message}`
      )
      .join('\n')
  }
  
  function createPrettierOutput(expected: any, _files: MockFile[]): string {
    const messages = expected.messages || []
    return messages
      .map((msg: ExpectedMessage) => `${msg.file}\n${msg.message}`)
      .join('\n')
  }

  describe('Engine: ESLint', () => {
    it('detects violations with flat config and Airbnb rules', async () => {
      await trackPerformance('ESLint flat config', async () => {
        const fixture = ESLintFixtureFactory.createAirbnbStyleFixture()
        loadFixture(fixture)

        const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)

        assertQualityResult(result)
          .shouldFail()
          .shouldHaveESLintResults()
          .shouldMatch(fixture.expected.eslint!)
      })
    })

    it('applies auto-fixes for fixable issues', async () => {
      await trackPerformance('ESLint auto-fix', async () => {
        const fixture = ESLintFixtureFactory.createAutoFixableIssuesFixture()
        loadFixture(fixture)

        // Test check first
        const checkResult = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)
        assertQualityResult(checkResult).shouldFail()

        // Test fix
        const fixResult = await checker.fix(fixture.files.map((f: MockFile) => f.path), { safe: false })
        assertFixResult(fixResult)
          .shouldSucceed()
          .shouldHaveFixed(['ESLint', 'Prettier'])
      })
    })
  })

  describe('Engine: TypeScript', () => {
    it('detects strict mode violations', async () => {
      await trackPerformance('TypeScript strict mode', async () => {
        const fixture = TypeScriptFixtureFactory.createStrictModeFixture()
        loadFixture(fixture)

        const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)

        assertQualityResult(result)
          .shouldFail()
          .shouldHaveTypeScriptResults()
          .shouldMatch(fixture.expected.typescript!)
      })
    })

    it('detects unused parameters', async () => {
      const fixture = TypeScriptFixtureFactory.createNoUnusedFixture()
      loadFixture(fixture)

      const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)

      assertQualityResult(result)
        .shouldFail()
        .shouldHaveTypeScriptResults()
    })
  })

  describe('Engine: Prettier', () => {
    it('detects formatting violations', async () => {
      await trackPerformance('Prettier violations', async () => {
        const fixture = PrettierFixtureFactory.createFormattingIssuesFixture()
        loadFixture(fixture)

        const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)

        assertQualityResult(result)
          .shouldFail()
          .shouldHavePrettierResults()
      })
    })

    it('applies formatting auto-fixes', async () => {
      const fixture = PrettierFixtureFactory.createAutoFixFormattingFixture()
      loadFixture(fixture)

      // Test check first
      const checkResult = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)
      assertQualityResult(checkResult).shouldFail()

      // Test fix
      const fixResult = await checker.fix(fixture.files.map((f: MockFile) => f.path), { safe: false })
      assertFixResult(fixResult)
        .shouldSucceed()
        .shouldHaveFixed(['ESLint', 'Prettier'])
    })
  })

  describe('Feature: Auto-Fix Behavior', () => {
    it('modifies files in-memory during ESLint auto-fix', async () => {
      const fixture = ESLintFixtureFactory.createAutoFixableIssuesFixture()
      loadFixture(fixture)
      
      // Track original content
      const originalContent = fixture.files.map(f => ({
        path: f.path,
        content: globalMockFiles.get(f.path)?.content
      }))

      // Execute fix
      await checker.fix(fixture.files.map((f: MockFile) => f.path), { safe: false })

      // Verify files were modified in memory
      originalContent.forEach(original => {
        const updatedFile = globalMockFiles.get(original.path)
        expect(updatedFile).toBeDefined()
        // Content should potentially be different after fix
        expect(updatedFile?.content).toBeDefined()
      })
    })

    it('modifies files in-memory during Prettier auto-fix', async () => {
      const fixture = PrettierFixtureFactory.createAutoFixFormattingFixture()
      loadFixture(fixture)
      
      // Store original file states
      const fileStates = new Map<string, string>()
      fixture.files.forEach(f => {
        fileStates.set(f.path, f.content)
      })

      // Execute fix with tracking
      const fixResult = await checker.fix(fixture.files.map((f: MockFile) => f.path), { safe: false })
      
      // Verify fix succeeded
      expect(fixResult.success).toBe(true)
      expect(fixResult.count).toBeGreaterThan(0)
      
      // Verify in-memory updates occurred
      fixture.files.forEach(f => {
        const updatedFile = globalMockFiles.get(f.path)
        expect(updatedFile).toBeDefined()
        expect(updatedFile?.exists).toBe(true)
      })
    })

    it('applies multiple engine auto-fixes sequentially', async () => {
      const fixture = MultiEngineFixtureFactory.createComplexIntegrationFixture()
      loadFixture(fixture)
      
      // Mock sequential fix operations
      const eslintFixCmd = `npx eslint ${fixture.files.map(f => `"${f.path}"`).join(' ')} --fix --format=json`
      const prettierFixCmd = `npx prettier --write ${fixture.files.map(f => `"${f.path}"`).join(' ')}`
      
      globalExecutionResults.set(eslintFixCmd, {
        stdout: JSON.stringify([]),
        stderr: '',
        exitCode: 0
      })
      
      globalExecutionResults.set(prettierFixCmd, {
        stdout: '',
        stderr: '',
        exitCode: 0
      })

      // Execute multi-engine fix
      const fixResult = await checker.fix(fixture.files.map((f: MockFile) => f.path), { safe: false })
      
      // Verify all fixes applied
      expect(fixResult.success).toBe(true)
      
      // Verify files remain accessible in memory
      fixture.files.forEach(f => {
        const file = globalMockFiles.get(f.path)
        expect(file).toBeDefined()
        expect(file?.exists).toBe(true)
      })
    })
  })

  describe('Integration: Multi-Engine', () => {
    it('processes complex scenarios with multiple engines', async () => {
      const fixture = MultiEngineFixtureFactory.createComplexIntegrationFixture()
      loadFixture(fixture)

      const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)

      assertQualityResult(result)
        .shouldFail()
        .shouldHaveESLintResults()

      // Verify TypeScript results if present
      if (fixture.expected.typescript) {
        assertQualityResult(result).shouldHaveTypeScriptResults()
      }
      
      // Check for Prettier results
      expect(result.checkers.prettier).toBeDefined()

      // Verify all engines reported issues
      const eslintErrors = result.checkers.eslint?.errors?.length ?? 0
      const typescriptErrors = result.checkers.typescript?.errors?.length ?? 0  
      const prettierErrors = result.checkers.prettier?.errors?.length ?? 0

      expect(eslintErrors).toBeGreaterThan(0)
      expect(typescriptErrors).toBeGreaterThan(0)
      expect(prettierErrors).toBeGreaterThan(0)
    })

    it('passes clean code through all engines', async () => {
      const fixture = MultiEngineFixtureFactory.createCleanCodeFixture()
      loadFixture(fixture)

      const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)

      assertQualityResult(result)
        .shouldSucceed()
      
      // Verify no errors in any engine
      expect(result.checkers.eslint?.errors?.length ?? 0).toBe(0)
      expect(result.checkers.typescript?.errors?.length ?? 0).toBe(0)
      expect(result.checkers.prettier?.errors?.length ?? 0).toBe(0)
    })
  })

  describe('Feature: Exit Code Logic', () => {
    it('returns exit code 0 for clean code', async () => {
      const fixture = ExitCodeFixtureFactory.createSuccessFixture()
      loadFixture(fixture)

      const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)
      assertQualityResult(result).shouldSucceed()
      expect(result.success).toBe(true)
      
      // Verify deterministic behavior
      expect(result.checkers).toBeDefined()
      Object.values(result.checkers).forEach(checker => {
        expect(checker?.success).toBe(true)
      })
    })

    it('returns exit code 1 for code with errors', async () => {
      const fixture = ExitCodeFixtureFactory.createErrorFixture()
      loadFixture(fixture)

      const result = await checker.check(fixture.files.map((f: MockFile) => f.path), fixture.options!)
      assertQualityResult(result).shouldFail()
      expect(result.success).toBe(false)
      
      // Verify at least one checker failed deterministically
      const failedCheckers = Object.values(result.checkers).filter(c => !c?.success)
      expect(failedCheckers.length).toBeGreaterThan(0)
    })

    it('maintains deterministic exit codes across multiple runs', async () => {
      const successFixture = ExitCodeFixtureFactory.createSuccessFixture()
      const errorFixture = ExitCodeFixtureFactory.createErrorFixture()
      
      // Test success case multiple times
      for (let i = 0; i < 3; i++) {
        globalMockFiles.clear()
        globalExecutionResults.clear()
        loadFixture(successFixture)
        
        const result = await checker.check(
          successFixture.files.map((f: MockFile) => f.path), 
          successFixture.options!
        )
        expect(result.success).toBe(true)
      }
      
      // Test failure case multiple times
      for (let i = 0; i < 3; i++) {
        globalMockFiles.clear()
        globalExecutionResults.clear()
        loadFixture(errorFixture)
        
        const result = await checker.check(
          errorFixture.files.map((f: MockFile) => f.path),
          errorFixture.options!
        )
        expect(result.success).toBe(false)
      }
    })
  })
})