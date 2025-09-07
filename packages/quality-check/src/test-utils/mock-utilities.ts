/**
 * Reusable test utilities with in-memory mocking using vi.mock()
 * Provides comprehensive mocking patterns for quality check engines
 */

import { vi, expect, type Mock, type MockedFunction } from 'vitest'
import type { ESLint } from 'eslint'
import type { QualityCheckOptions } from '../types.js'

// Define local types for mock utilities
interface MockEngineResult {
  success: boolean
  errorCount: number
  warningCount: number
  fixableCount: number
  messages: MockValidationMessage[]
  files: string[]
  duration: number
}

interface MockValidationMessage {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning'
  message: string
  rule: string
  engine: string
}

interface MockLintMessage {
  ruleId: string | null
  severity: 0 | 1 | 2
  message: string
  line: number
  column: number
  nodeType: string
}

/**
 * Mock file system for in-memory testing
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map()
  private directories: Set<string> = new Set()

  constructor(initialFiles: Record<string, string> = {}) {
    Object.entries(initialFiles).forEach(([path, content]) => {
      this.writeFile(path, content)
    })
  }

  writeFile(path: string, content: string): void {
    this.files.set(path, content)
    // Add parent directories
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      this.directories.add(parts.slice(0, i).join('/'))
    }
  }

  readFile(path: string): string | undefined {
    return this.files.get(path)
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.directories.has(path)
  }

  isDirectory(path: string): boolean {
    return this.directories.has(path)
  }

  listFiles(dir: string): string[] {
    const dirPath = dir.endsWith('/') ? dir : `${dir}/`
    return Array.from(this.files.keys())
      .filter((path) => path.startsWith(dirPath))
      .map((path) => path.slice(dirPath.length).split('/')[0])
      .filter((v, i, a) => a.indexOf(v) === i) // unique
  }

  clear(): void {
    this.files.clear()
    this.directories.clear()
  }
}

/**
 * Mock ESLint engine for testing
 */
export class MockESLintEngine {
  private rules: Map<string, unknown> = new Map()
  private results: ESLint.LintResult[] = []

  constructor(config?: { rules?: Record<string, unknown> }) {
    if (config?.rules) {
      Object.entries(config.rules).forEach(([name, value]) => {
        this.rules.set(name, value)
      })
    }
  }

  setResults(results: ESLint.LintResult[]): void {
    this.results = results
  }

  async lintText(text: string, options?: { filePath?: string }): Promise<ESLint.LintResult[]> {
    if (this.results.length > 0) {
      return this.results
    }

    // Generate mock results based on rules
    const messages: MockLintMessage[] = []

    if (this.rules.has('no-console') && text.includes('console.')) {
      messages.push({
        ruleId: 'no-console',
        severity: this.rules.get('no-console') === 'error' ? 2 : 1,
        message: 'Unexpected console statement',
        line: 1,
        column: text.indexOf('console.') + 1,
        nodeType: 'MemberExpression',
      })
    }

    if (this.rules.has('no-unused-vars')) {
      const varMatch = text.match(/const\s+(\w+)\s*=/)
      if (varMatch && !text.includes(varMatch[1] + ' ')) {
        messages.push({
          ruleId: 'no-unused-vars',
          severity: 2,
          message: `'${varMatch[1]}' is defined but never used`,
          line: 1,
          column: text.indexOf(varMatch[1]) + 1,
          nodeType: 'Identifier',
        })
      }
    }

    return [
      {
        filePath: options?.filePath || '<text>',
        messages: messages as ESLint.LintResult['messages'],
        errorCount: messages.filter((m) => m.severity === 2).length,
        warningCount: messages.filter((m) => m.severity === 1).length,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        source: text,
        usedDeprecatedRules: [],
        suppressedMessages: [],
        fatalErrorCount: 0,
      },
    ]
  }

  async lintFiles(_patterns: string[]): Promise<ESLint.LintResult[]> {
    return this.results.length > 0 ? this.results : []
  }

  static outputFixes: Mock = vi.fn()

  async calculateConfigForFile(_filePath: string): Promise<unknown> {
    return { rules: Object.fromEntries(this.rules) }
  }
}

/**
 * Mock TypeScript compiler API
 */
export class MockTypeScriptCompiler {
  private diagnostics: Array<{
    file?: { fileName?: string }
    start?: number
    messageText?: string
    code?: number
    category?: number
    length?: number
  }> = []

  setDiagnostics(diagnostics: typeof this.diagnostics): void {
    this.diagnostics = diagnostics
  }

  createProgram(_files: string[], _options: unknown) {
    const diagnostics = this.diagnostics
    return {
      getSemanticDiagnostics: () => diagnostics,
      getSyntacticDiagnostics: () => [],
      getGlobalDiagnostics: () => [],
      emit: () => ({ emitSkipped: false, diagnostics: [] }),
    }
  }

  formatDiagnostic(diagnostic: { messageText?: string }): string {
    return diagnostic.messageText || 'TypeScript error'
  }

  createDiagnostic(
    file: string,
    _line: number,
    column: number,
    code: number,
    message: string,
  ): (typeof this.diagnostics)[0] {
    return {
      file: { fileName: file },
      start: column,
      length: 10,
      messageText: message,
      category: 1, // Error
      code,
    }
  }
}

/**
 * Mock Prettier formatter
 */
export class MockPrettierFormatter {
  private config: Record<string, unknown> = {}
  private shouldFormat: boolean = false

  constructor(config?: Record<string, unknown>) {
    this.config = config || {}
  }

  setShouldFormat(value: boolean): void {
    this.shouldFormat = value
  }

  async format(text: string, _options?: unknown): Promise<string> {
    if (!this.shouldFormat) {
      return text
    }

    // Simple mock formatting
    let formatted = text
    if (this.config.semi === false) {
      formatted = formatted.replace(/;$/gm, '')
    }
    if (this.config.singleQuote) {
      formatted = formatted.replace(/"/g, "'")
    }
    if (this.config.tabWidth === 2) {
      formatted = formatted.replace(/\t/g, '  ')
    }

    return formatted
  }

  async check(text: string, options?: unknown): Promise<boolean> {
    const formatted = await this.format(text, options)
    return formatted === text
  }

  async resolveConfig(_filePath: string): Promise<Record<string, unknown>> {
    return this.config
  }
}

/**
 * Create mock quality checker with all engines
 */
export function createMockQualityChecker() {
  const mockFS = new MockFileSystem()
  const mockESLint = new MockESLintEngine()
  const mockTypeScript = new MockTypeScriptCompiler()
  const mockPrettier = new MockPrettierFormatter()

  return {
    fileSystem: mockFS,
    eslint: mockESLint,
    typescript: mockTypeScript,
    prettier: mockPrettier,

    async check(options: QualityCheckOptions): Promise<MockEngineResult> {
      const messages: MockValidationMessage[] = []
      let errorCount = 0
      let warningCount = 0

      if (options.eslint) {
        const results = await mockESLint.lintFiles(['**/*.js', '**/*.ts'])
        results.forEach((result) => {
          errorCount += result.errorCount
          warningCount += result.warningCount
          result.messages.forEach((msg) => {
            messages.push({
              file: result.filePath,
              line: msg.line,
              column: msg.column || 0,
              severity: msg.severity === 2 ? 'error' : 'warning',
              message: msg.message,
              rule: msg.ruleId || 'unknown',
              engine: 'eslint',
            })
          })
        })
      }

      if (options.typescript) {
        const program = mockTypeScript.createProgram([], {})
        const diagnostics = program.getSemanticDiagnostics()
        diagnostics.forEach((diag) => {
          errorCount++
          messages.push({
            file: diag.file?.fileName || 'unknown',
            line: 1,
            column: diag.start || 0,
            severity: 'error',
            message: String(diag.messageText || ''),
            rule: `TS${diag.code || 0}`,
            engine: 'typescript',
          })
        })
      }

      if (options.prettier) {
        const needsFormatting = !(await mockPrettier.check('test'))
        if (needsFormatting) {
          errorCount++
          messages.push({
            file: 'test.js',
            line: 1,
            column: 1,
            severity: 'error',
            message: 'File needs formatting',
            rule: 'prettier/prettier',
            engine: 'prettier',
          })
        }
      }

      return {
        success: errorCount === 0,
        errorCount,
        warningCount,
        fixableCount: 0,
        messages,
        files: [],
        duration: 10,
      }
    },
  }
}

/**
 * Create mock child process for CLI testing
 */
export function createMockChildProcess() {
  type EventHandler = (...args: unknown[]) => void
  const events = new Map<string, EventHandler[]>()
  const stdout = { on: vi.fn() }
  const stderr = { on: vi.fn() }

  const mockProcess = {
    stdout,
    stderr,
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!events.has(event)) {
        events.set(event, [])
      }
      events.get(event)!.push(handler)
    }),
    kill: vi.fn(),
    pid: 12345,

    // Helper to trigger events in tests
    emit(event: string, ...args: unknown[]) {
      const handlers = events.get(event) || []
      handlers.forEach((handler) => handler(...args))
    },

    // Helper to send stdout data
    sendStdout(data: string) {
      const handlers = stdout.on.mock.calls
        .filter(([evt]) => evt === 'data')
        .map(([, handler]) => handler)
      handlers.forEach((handler) => handler(Buffer.from(data)))
    },

    // Helper to send stderr data
    sendStderr(data: string) {
      const handlers = stderr.on.mock.calls
        .filter(([evt]) => evt === 'data')
        .map(([, handler]) => handler)
      handlers.forEach((handler) => handler(Buffer.from(data)))
    },
  }

  return mockProcess
}

/**
 * Create mock for performance monitoring
 */
export function createMockPerformanceMonitor() {
  const marks = new Map<string, number>()
  const measures: Array<{ name: string; duration: number }> = []

  return {
    mark(name: string): void {
      marks.set(name, Date.now())
    },

    measure(name: string, startMark: string, endMark?: string): number {
      const start = marks.get(startMark) || Date.now()
      const end = endMark ? marks.get(endMark) || Date.now() : Date.now()
      const duration = end - start
      measures.push({ name, duration })
      return duration
    },

    getMarks(): Map<string, number> {
      return new Map(marks)
    },

    getMeasures(): Array<{ name: string; duration: number }> {
      return [...measures]
    },

    clear(): void {
      marks.clear()
      measures.length = 0
    },
  }
}

/**
 * Helper to mock module imports
 * Note: vi.mock() calls are hoisted, so this is mainly for organizing mock setup
 */
export function mockModule<T>(_modulePath: string, factory: () => T): () => T {
  // vi.mock is hoisted and needs to be called at module level
  // This function is for organizing mock setup
  return factory
}

/**
 * Helper to create async mock that resolves after delay
 */
export function createAsyncMock<T>(value: T, delay: number = 0): Mock {
  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    return value
  })
}

/**
 * Helper to create mock with different results on each call
 */
export function createSequentialMock<T>(...values: T[]): Mock {
  let callCount = 0
  return vi.fn().mockImplementation(() => {
    const value = values[Math.min(callCount, values.length - 1)]
    callCount++
    return value
  })
}

/**
 * Helper to verify mock was called with partial object match
 */
export function expectCalledWithPartial(mock: Mock, partial: unknown): void {
  expect(mock).toHaveBeenCalledWith(expect.objectContaining(partial))
}

/**
 * Helper to wait for mock to be called
 */
export async function waitForMockCall(mock: Mock, timeout: number = 1000): Promise<void> {
  const start = Date.now()
  while (mock.mock.calls.length === 0) {
    if (Date.now() - start > timeout) {
      throw new Error(`Mock was not called within ${timeout}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Reset all mocks and clear module cache
 */
export function resetAllMocks(): void {
  vi.clearAllMocks()
  vi.resetModules()
}

/**
 * Create a spy that tracks property access
 */
export function createPropertySpy<T extends object>(
  obj: T,
  property: keyof T,
): MockedFunction<() => T[keyof T]> {
  const spy = vi.fn(() => obj[property])
  Object.defineProperty(obj, property, {
    get: spy,
    configurable: true,
  })
  return spy
}
