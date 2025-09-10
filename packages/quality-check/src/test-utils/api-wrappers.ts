/**
 * Direct API call wrappers replacing CLI/binary execution
 * Provides in-memory mocking for QualityChecker without process spawning
 */

import { vi } from 'vitest'
import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckOptions, FixResult } from '../types.js'
import type { QualityCheckResult } from '../types/issue-types.js'
import type {
  TestFixture,
  MockFile,
  ExpectedEngineResult,
  ExpectedMessage,
} from './modern-fixtures.js'

/**
 * Mock execution result for simulating engine behavior
 */
export interface MockExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

// Global storage for mock data that vi.mock can access
const globalMockFiles = new Map<string, MockFile>()
const globalExecutionResults = new Map<string, MockExecutionResult>()

// Mock file system operations
vi.mock('node:fs', () => ({
  existsSync: vi.fn((filePath: string) => {
    const file = globalMockFiles.get(filePath)
    return file?.exists ?? false
  }),
  readFileSync: vi.fn((filePath: string) => {
    const file = globalMockFiles.get(filePath)
    if (!file || !file.exists) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`)
    }
    return file.content
  }),
  writeFileSync: vi.fn((filePath: string, content: string) => {
    const file = globalMockFiles.get(filePath)
    if (file) {
      file.content = content
    } else {
      globalMockFiles.set(filePath, {
        path: filePath,
        content,
        exists: true,
      })
    }
  }),
  mkdirSync: vi.fn((dirPath: string, _options?: { recursive?: boolean }) => {
    // Mock directory creation - just mark it as existing
    if (!globalMockFiles.has(dirPath)) {
      globalMockFiles.set(dirPath, {
        path: dirPath,
        content: '',
        exists: true,
      })
    }
    return undefined
  }),
  appendFileSync: vi.fn((filePath: string, content: string) => {
    const file = globalMockFiles.get(filePath)
    if (file) {
      file.content += content
    } else {
      globalMockFiles.set(filePath, {
        path: filePath,
        content,
        exists: true,
      })
    }
  }),
  readdirSync: vi.fn((_dirPath: string) => {
    // Return empty array for directory listing
    return []
  }),
  unlinkSync: vi.fn((_filePath: string) => {
    // Mock file deletion
    return undefined
  }),
  statSync: vi.fn((filePath: string) => {
    const file = globalMockFiles.get(filePath)
    if (!file || !file.exists) {
      const error = new Error(`ENOENT: no such file or directory, stat '${filePath}'`)
      ;(error as any).code = 'ENOENT'
      throw error
    }
    return {
      isFile: () => true,
      isDirectory: () => false,
      size: file.content.length,
      mtime: new Date(),
    }
  }),
}))

// Mock child_process operations
vi.mock('node:child_process', () => ({
  execSync: vi.fn((command: string) => {
    const result = globalExecutionResults.get(command)
    if (!result) {
      // Return a default success for commands we don't explicitly mock
      return Buffer.from('')
    }

    if (result.exitCode !== 0) {
      const error = new Error(result.stderr) as Error & {
        status: number
        stderr: Buffer
        stdout: Buffer
      }
      error.status = result.exitCode
      error.stderr = Buffer.from(result.stderr)
      error.stdout = Buffer.from(result.stdout)
      throw error
    }

    return Buffer.from(result.stdout)
  }),
}))

/**
 * In-memory QualityChecker wrapper that mocks file system and process execution
 */
export class MockedQualityChecker {
  private startTime: number = 0

  constructor() {
    // Clear any previous mock data
    this.cleanup()
  }

  /**
   * Load fixture files into in-memory file system
   */
  loadFixture(fixture: TestFixture): void {
    globalMockFiles.clear()
    globalExecutionResults.clear()

    // Load mock files
    for (const file of fixture.files) {
      globalMockFiles.set(file.path, { ...file })
    }

    // Setup execution results based on expected results
    this.setupExecutionResults(fixture)
  }

  /**
   * Setup mock execution results based on fixture expectations
   */
  private setupExecutionResults(fixture: TestFixture): void {
    const options = fixture.options || {}

    // Mock ESLint results
    if (fixture.expected.eslint) {
      const eslintCommand = this.buildESLintCommand(
        fixture.files.map((f) => f.path),
        options,
      )
      globalExecutionResults.set(eslintCommand, {
        stdout: JSON.stringify(this.createESLintOutput(fixture.expected.eslint)),
        stderr: '',
        exitCode: (fixture.expected.eslint.errorCount ?? 0) > 0 ? 1 : 0,
        duration: 50,
      })
    }

    // Mock TypeScript results
    if (fixture.expected.typescript) {
      const tscCommand = this.buildTypeScriptCommand(
        fixture.files.map((f) => f.path),
        options,
      )
      globalExecutionResults.set(tscCommand, {
        stdout: this.createTypeScriptOutput(fixture.expected.typescript),
        stderr:
          (fixture.expected.typescript.errorCount ?? 0) > 0
            ? this.createTypeScriptOutput(fixture.expected.typescript)
            : '',
        exitCode: (fixture.expected.typescript.errorCount ?? 0) > 0 ? 1 : 0,
        duration: 30,
      })
    }

    // Mock Prettier results
    if (fixture.expected.prettier) {
      const prettierCommand = this.buildPrettierCommand(
        fixture.files.map((f) => f.path),
        options,
      )
      globalExecutionResults.set(prettierCommand, {
        stdout:
          (fixture.expected.prettier.errorCount ?? 0) > 0
            ? this.createPrettierOutput(fixture.expected.prettier)
            : '',
        stderr: '',
        exitCode: (fixture.expected.prettier.errorCount ?? 0) > 0 ? 1 : 0,
        duration: 20,
      })
    }
  }

  /**
   * Build ESLint command string
   */
  private buildESLintCommand(files: string[], options: QualityCheckOptions): string {
    const parts = ['npx', 'eslint']
    parts.push(...files.map((f) => `"${f}"`))
    if (!options.fix) {
      parts.push('--format=json')
    } else {
      parts.push('--fix')
    }
    return parts.join(' ')
  }

  /**
   * Build TypeScript command string
   */
  private buildTypeScriptCommand(files: string[], _options: QualityCheckOptions): string {
    return `npx tsc --noEmit ${files.join(' ')}`
  }

  /**
   * Build Prettier command string
   */
  private buildPrettierCommand(files: string[], options: QualityCheckOptions): string {
    const parts = ['npx', 'prettier']
    if (options.fix) {
      parts.push('--write')
    } else {
      parts.push('--check')
    }
    parts.push(...files)
    return parts.join(' ')
  }

  /**
   * Create mock ESLint output
   */
  private createESLintOutput(expected: ExpectedEngineResult): unknown {
    const messages = expected.messages || []
    // Group messages by file
    const fileGroups = messages.reduce(
      (acc, msg) => {
        if (!acc[msg.file]) {
          acc[msg.file] = []
        }
        acc[msg.file].push(msg)
        return acc
      },
      {} as Record<string, ExpectedMessage[]>,
    )

    // Create result for each file
    const results = Object.entries(fileGroups).map(([filePath, fileMessages]) => ({
      filePath,
      messages: fileMessages.map((msg: ExpectedMessage) => ({
        ruleId: msg.rule,
        severity: msg.severity === 'error' ? 2 : 1,
        message: msg.message,
        line: msg.line,
        column: msg.column,
      })),
      errorCount: fileMessages.filter((m) => m.severity === 'error').length,
      warningCount: fileMessages.filter((m) => m.severity === 'warning').length,
      fixableErrorCount: expected.fixableCount ?? 0,
      fixableWarningCount: 0,
    }))

    // If no messages, return a single empty result
    if (results.length === 0) {
      return [
        {
          filePath: 'src/test.js',
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ]
    }

    return results
  }

  /**
   * Create mock TypeScript output
   */
  private createTypeScriptOutput(expected: ExpectedEngineResult): string {
    const messages = expected.messages || []
    return messages
      .map(
        (msg: ExpectedMessage) =>
          `${msg.file}(${msg.line},${msg.column}): error TS${msg.rule || '0000'}: ${msg.message}`,
      )
      .join('\n')
  }

  /**
   * Create mock Prettier output
   */
  private createPrettierOutput(expected: ExpectedEngineResult): string {
    const messages = expected.messages || []
    return messages.map((msg: ExpectedMessage) => `${msg.file}\n${msg.message}`).join('\n')
  }

  /**
   * Add a mock file to the in-memory file system
   */
  addMockFile(path: string, content: string, exists: boolean = true): void {
    globalMockFiles.set(path, { path, content, exists })
  }

  /**
   * Add a mock execution result
   */
  addMockExecution(command: string, result: MockExecutionResult): void {
    globalExecutionResults.set(command, result)
  }

  /**
   * Check files using mocked QualityChecker
   */
  async check(files: string[], options?: QualityCheckOptions): Promise<QualityCheckResult> {
    this.startTime = Date.now()
    const checker = new QualityChecker()
    return await checker.check(files, options || {})
  }

  /**
   * Fix files using mocked QualityChecker
   */
  async fix(files: string[], _options?: QualityCheckOptions): Promise<FixResult> {
    this.startTime = Date.now()
    const checker = new QualityChecker()
    // QualityChecker.fix expects { safe?: boolean } but we have QualityCheckOptions
    // For now, default to safe: false
    return await checker.fix(files, { safe: false })
  }

  /**
   * Get file content from mock file system
   */
  getFileContent(path: string): string | undefined {
    return globalMockFiles.get(path)?.content
  }

  /**
   * Check if file exists in mock file system
   */
  fileExists(path: string): boolean {
    return globalMockFiles.get(path)?.exists ?? false
  }

  /**
   * Get execution time since operation started
   */
  getExecutionTime(): number {
    return Date.now() - this.startTime
  }

  /**
   * Clean up all mocks
   */
  cleanup(): void {
    globalMockFiles.clear()
    globalExecutionResults.clear()
    vi.clearAllMocks()
  }
}

/**
 * Performance tracking wrapper for measuring test execution time
 */
export class PerformanceWrapper {
  private operations: Array<{
    name: string
    duration: number
    timestamp: number
  }> = []

  /**
   * Track an operation's performance
   */
  async track<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await operation()
    const duration = performance.now() - start

    this.operations.push({
      name,
      duration,
      timestamp: Date.now(),
    })

    return result
  }

  /**
   * Get average operation time
   */
  getAverageTime(operationName?: string): number {
    const ops = operationName
      ? this.operations.filter((op) => op.name === operationName)
      : this.operations

    if (ops.length === 0) return 0
    return ops.reduce((sum, op) => sum + op.duration, 0) / ops.length
  }

  /**
   * Get maximum operation time
   */
  getMaxTime(operationName?: string): number {
    const ops = operationName
      ? this.operations.filter((op) => op.name === operationName)
      : this.operations

    if (ops.length === 0) return 0
    return Math.max(...ops.map((op) => op.duration))
  }

  /**
   * Assert that all operations completed within time limit
   */
  assertAllUnder(limitMs: number): void {
    const slowOps = this.operations.filter((op) => op.duration > limitMs)
    if (slowOps.length > 0) {
      throw new Error(
        `${slowOps.length} operations exceeded ${limitMs}ms limit:\n` +
          slowOps.map((op) => `  - ${op.name}: ${op.duration.toFixed(2)}ms`).join('\n'),
      )
    }
  }

  /**
   * Clear tracked operations
   */
  clear(): void {
    this.operations = []
  }
}

/**
 * Direct API wrapper for calling QualityChecker without mocking
 * Used for testing actual integration with real engines
 */
export class DirectAPIWrapper {
  private checker: QualityChecker

  constructor() {
    this.checker = new QualityChecker()
  }

  /**
   * Direct check call
   */
  async check(files: string[], options?: QualityCheckOptions): Promise<QualityCheckResult> {
    return await this.checker.check(files, options || {})
  }

  /**
   * Direct fix call
   */
  async fix(files: string[], _options?: QualityCheckOptions): Promise<FixResult> {
    // QualityChecker.fix expects { safe?: boolean } but we have QualityCheckOptions
    // For now, default to safe: false
    return await this.checker.fix(files, { safe: false })
  }
}
