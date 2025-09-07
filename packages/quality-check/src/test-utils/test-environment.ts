/**
 * Test Environment Utilities
 * Provides standardized setup/teardown for test isolation
 */

import { vi, type MockInstance } from 'vitest'
import { Readable, Writable } from 'node:stream'

export interface TestEnvironment {
  stdin: MockReadable
  stdout: MockWritable
  stderr: MockWritable
  processExit: MockInstance
  originalEnv: Record<string, string | undefined>
}

export class MockReadable extends Readable {
  private data: string

  constructor(data = '') {
    super()
    this.data = data
  }

  override _read(): void {
    if (this.data) {
      this.push(this.data)
      this.data = ''
    }
    this.push(null)
  }

  setData(data: string): void {
    this.data = data
  }
}

export class MockWritable extends Writable {
  private chunks: string[] = []

  override _write(chunk: unknown, _encoding: string, callback: () => void): void {
    this.chunks.push(String(chunk))
    callback()
  }

  getOutput(): string {
    return this.chunks.join('')
  }

  clear(): void {
    this.chunks = []
  }
}

/**
 * Setup test environment with proper isolation
 */
export function setupTestEnvironment(): TestEnvironment {
  // Store original environment BEFORE making changes
  const originalEnv = { ...process.env }

  // Disable Claude hook in test environment
  process.env.CLAUDE_HOOK_DISABLED = 'true'

  // Create mock streams
  const stdin = new MockReadable()
  const stdout = new MockWritable()
  const stderr = new MockWritable()

  // Mock process.exit to prevent test termination
  const processExit = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null | undefined) => {
      // Store exit code without throwing
      const exitCode =
        typeof code === 'number' ? code : code === null ? 1 : parseInt(String(code), 10) || 0
      ;(global as unknown as { __testExitCode?: number }).__testExitCode = exitCode
      // Don't throw to prevent test interruption
      return undefined as never
    })

  // Replace standard streams
  Object.defineProperty(process, 'stdin', {
    value: stdin,
    writable: true,
    configurable: true,
  })

  Object.defineProperty(process, 'stdout', {
    value: stdout,
    writable: true,
    configurable: true,
  })

  Object.defineProperty(process, 'stderr', {
    value: stderr,
    writable: true,
    configurable: true,
  })

  return {
    stdin,
    stdout,
    stderr,
    processExit,
    originalEnv,
  }
}

/**
 * Teardown test environment and restore original state
 */
export function teardownTestEnvironment(env: TestEnvironment): void {
  // Restore environment variables
  process.env = env.originalEnv

  // Restore process.exit
  env.processExit.mockRestore()

  // Clear test exit code
  delete (global as unknown as { __testExitCode?: number }).__testExitCode

  // Clear all mocks
  vi.clearAllMocks()
}

/**
 * Get the last exit code from mocked process.exit
 */
export function getTestExitCode(): number | undefined {
  return (global as unknown as { __testExitCode?: number }).__testExitCode
}

/**
 * Create a test payload for Claude hook
 */
export function createTestPayload(toolName: string, filePath: string, content?: string): string {
  return JSON.stringify({
    tool_name: toolName,
    tool_input: {
      file_path: filePath,
      content,
    },
  })
}

/**
 * Mock file system for tests
 */
export class InMemoryFileSystem {
  private files: Map<string, string> = new Map()

  write(path: string, content: string): void {
    this.files.set(path, content)
  }

  read(path: string): string | undefined {
    return this.files.get(path)
  }

  exists(path: string): boolean {
    return this.files.has(path)
  }

  delete(path: string): boolean {
    return this.files.delete(path)
  }

  clear(): void {
    this.files.clear()
  }

  listFiles(): string[] {
    return Array.from(this.files.keys())
  }
}

/**
 * Create a mock quality checker for predictable test results
 */
interface QualityCheckResult {
  filePath: string
  success: boolean
  issues: Array<{
    line: number
    column: number
    message: string
    severity: string
    engine: string
    ruleId?: string
  }>
}

export class MockQualityChecker {
  private predefinedResults: Map<string, QualityCheckResult> = new Map()

  setPredefinedResult(filePath: string, result: QualityCheckResult): void {
    this.predefinedResults.set(filePath, result)
  }

  async check(files: string[]): Promise<{
    success: boolean
    issues: QualityCheckResult['issues']
    checkers: Record<string, unknown>
  }> {
    const results = files.map((file) => {
      const predefined = this.predefinedResults.get(file)
      if (predefined) return predefined

      // Default success result
      return {
        filePath: file,
        success: true,
        issues: [],
      }
    })

    return {
      success: results.every((r) => r.success),
      issues: results.flatMap((r) => r.issues || []),
      checkers: {},
    }
  }

  clear(): void {
    this.predefinedResults.clear()
  }
}

/**
 * Mock configuration loader for test fixtures
 */
export class MockConfigLoader {
  private configs: Map<string, unknown> = new Map()

  setConfig(name: string, config: unknown): void {
    this.configs.set(name, config)
  }

  getConfig(name: string): unknown {
    return this.configs.get(name)
  }

  loadESLintConfig(): unknown {
    return this.configs.get('eslint') || { rules: {} }
  }

  loadPrettierConfig(): unknown {
    return this.configs.get('prettier') || { semi: true }
  }

  loadTypeScriptConfig(): unknown {
    return this.configs.get('typescript') || { compilerOptions: { strict: true } }
  }

  clear(): void {
    this.configs.clear()
  }
}

/**
 * Create a complete mock environment for integration tests
 */
export function createMockEnvironment() {
  return {
    qualityChecker: new MockQualityChecker(),
    fileSystem: new InMemoryFileSystem(),
    configLoader: new MockConfigLoader(),
    ...setupTestEnvironment(),
  }
}

/**
 * Standard test setup for integration tests
 */
export function standardTestSetup() {
  const env = createMockEnvironment()

  // Set common test environment variables
  process.env.CLAUDE_HOOK_DISABLED = 'true'
  process.env.CLAUDE_HOOK_SILENT = 'true'
  process.env.NODE_ENV = 'test'

  return env
}

/**
 * Standard test teardown for integration tests
 */
export function standardTestTeardown(env: ReturnType<typeof createMockEnvironment>) {
  teardownTestEnvironment(env)
  env.qualityChecker.clear()
  env.fileSystem.clear()
  env.configLoader.clear()
}
