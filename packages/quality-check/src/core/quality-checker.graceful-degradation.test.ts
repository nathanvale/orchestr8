import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QualityChecker } from './quality-checker.js'

// Mock all external dependencies
vi.mock('./config-loader.js')
vi.mock('./file-matcher.js')
vi.mock('../engines/typescript-engine.js')
vi.mock('../engines/eslint-engine.js')
vi.mock('../engines/prettier-engine.js')
vi.mock('../adapters/fixer.js')
vi.mock('../services/OutputFormatter.js')
vi.mock('../utils/logger.js')
vi.mock('../core/performance-monitor.js')

describe('QualityChecker - Graceful Degradation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock logger - logger is exported as singleton
    const { logger, createTimer } = await import('../utils/logger.js')
    vi.mocked(logger.debug).mockImplementation(vi.fn())
    vi.mocked(logger.info).mockImplementation(vi.fn())
    vi.mocked(logger.warn).mockImplementation(vi.fn())
    vi.mocked(logger.error).mockImplementation(vi.fn())

    // Mock createTimer
    vi.mocked(createTimer).mockReturnValue({
      end: vi.fn().mockReturnValue(100),
    } as any)

    // Mock performance monitor
    const { PerformanceMonitor } = await import('../core/performance-monitor.js')
    vi.mocked(PerformanceMonitor).mockImplementation(
      () =>
        ({
          startOperation: vi.fn().mockReturnValue({
            end: vi.fn(),
            addMetadata: vi.fn(),
          }),
          getReport: vi.fn().mockReturnValue({
            totalDuration: 100,
            operations: [],
          }),
        }) as any,
    )

    // Mock OutputFormatter
    const { OutputFormatter } = await import('../services/OutputFormatter.js')
    vi.mocked(OutputFormatter).mockImplementation(
      () =>
        ({
          format: vi.fn().mockReturnValue({ issues: [] }),
        }) as any,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle missing TypeScript tool gracefully', async () => {
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')
    const { PrettierEngine } = await import('../engines/prettier-engine.js')
    const { ToolMissingError } = await import('./errors.js')

    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
      files: ['test.ts'],
      fix: false,
      engines: { typescript: true, eslint: true, prettier: true },
      timeoutMs: 5000,
    })

    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

    // TypeScript is not available
    vi.mocked(TypeScriptEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new ToolMissingError('TypeScript compiler not found'))

    // ESLint works
    vi.mocked(ESLintEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          severity: 'error' as const,
          message: 'ESLint error',
          rule: 'no-console',
        },
      ],
    })

    // Prettier works
    vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [],
    })

    const checker = new QualityChecker()
    const result = await checker.check(['test.ts'], {})

    // Should continue with available tools
    expect(result.success).toBe(false) // Has ESLint error
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: 'ESLint error',
      }),
    )
    // Should NOT report TypeScript as unavailable - it's gracefully skipped
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({
        engine: 'typescript',
        message: expect.stringContaining('TypeScript is not available'),
      }),
    )
  })

  it('should handle missing ESLint tool gracefully', async () => {
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')
    const { PrettierEngine } = await import('../engines/prettier-engine.js')
    const { ToolMissingError } = await import('./errors.js')

    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
      files: ['test.ts'],
      fix: false,
      engines: { typescript: true, eslint: true, prettier: true },
      timeoutMs: 5000,
    })

    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

    // TypeScript works
    vi.mocked(TypeScriptEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [],
    })

    // ESLint is not available
    vi.mocked(ESLintEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new ToolMissingError('ESLint not found'))

    // Prettier works
    vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [
        {
          file: 'test.ts',
          line: 10,
          column: 1,
          severity: 'error' as const,
          message: 'Formatting required',
        },
      ],
    })

    const checker = new QualityChecker()
    const result = await checker.check(['test.ts'], {})

    // Should continue with available tools
    expect(result.success).toBe(false) // Has Prettier error
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: 'Formatting required',
      }),
    )
    // Should NOT report ESLint as unavailable - it's gracefully skipped
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({
        engine: 'eslint',
        message: expect.stringContaining('ESLint is not available'),
      }),
    )
  })

  it('should handle all tools missing gracefully', async () => {
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')
    const { PrettierEngine } = await import('../engines/prettier-engine.js')
    const { ToolMissingError } = await import('./errors.js')

    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
      files: ['test.ts'],
      fix: false,
      engines: { typescript: true, eslint: true, prettier: true },
      timeoutMs: 5000,
    })

    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

    // All tools are missing
    vi.mocked(TypeScriptEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new ToolMissingError('TypeScript not found'))
    vi.mocked(ESLintEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new ToolMissingError('ESLint not found'))
    vi.mocked(PrettierEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new ToolMissingError('Prettier not found'))

    const checker = new QualityChecker()
    const result = await checker.check(['test.ts'], {})

    // With graceful degradation, all tools being missing results in success with no issues
    expect(result.success).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('should handle mixed tool failures and successes', async () => {
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')
    const { PrettierEngine } = await import('../engines/prettier-engine.js')
    const { ToolMissingError } = await import('./errors.js')

    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
      files: ['test.ts'],
      fix: false,
      engines: { typescript: true, eslint: true, prettier: true },
      timeoutMs: 5000,
    })

    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

    // TypeScript works and finds an error
    vi.mocked(TypeScriptEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [
        {
          file: 'test.ts',
          line: 5,
          column: 10,
          severity: 'error' as const,
          message: 'Type error: Cannot find name "foo"',
          rule: 'TS2304',
        },
      ],
    })

    // ESLint is missing
    vi.mocked(ESLintEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new ToolMissingError('ESLint not found'))

    // Prettier works and finds a formatting issue
    vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          severity: 'warning' as const,
          message: 'File is not formatted',
        },
      ],
    })

    const checker = new QualityChecker()
    const result = await checker.check(['test.ts'], {})

    // Should have issues from working tools and unavailability notice for missing tool
    expect(result.success).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: 'Type error: Cannot find name "foo"',
        severity: 'error',
      }),
    )
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: 'File is not formatted',
        severity: 'warning',
      }),
    )
    // ESLint being unavailable is gracefully skipped, not reported
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({
        engine: 'eslint',
        message: expect.stringContaining('ESLint is not available'),
      }),
    )
  })

  it('should handle non-ToolMissingError exceptions differently', async () => {
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')

    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
      files: ['test.ts'],
      fix: false,
      engines: { typescript: true, eslint: true, prettier: false },
      timeoutMs: 5000,
    })

    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

    // TypeScript has a configuration error (not a missing tool)
    vi.mocked(TypeScriptEngine).prototype.check = vi
      .fn()
      .mockRejectedValue(new Error('Invalid tsconfig.json'))

    // ESLint works
    vi.mocked(ESLintEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [],
    })

    const checker = new QualityChecker()
    const result = await checker.check(['test.ts'], {})

    // Non-ToolMissingError should still be captured as an error
    expect(result.success).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        engine: 'typescript',
        severity: 'error',
        message: 'Invalid tsconfig.json',
      }),
    )
  })

  it('should continue with remaining engines when one times out', async () => {
    const { ConfigLoader } = await import('./config-loader.js')
    const { FileMatcher } = await import('./file-matcher.js')
    const { TypeScriptEngine } = await import('../engines/typescript-engine.js')
    const { ESLintEngine } = await import('../engines/eslint-engine.js')
    const { PrettierEngine } = await import('../engines/prettier-engine.js')

    vi.mocked(ConfigLoader).prototype.load = vi.fn().mockResolvedValue({
      files: ['test.ts'],
      fix: false,
      engines: { typescript: true, eslint: true, prettier: true },
      timeoutMs: 100,
      continueOnTimeout: true, // New option for graceful degradation
      memoryThresholdMB: 500,
      enableBackpressure: false,
      format: 'stylish',
      typescriptCacheDir: '.cache/typescript',
      eslintCacheDir: '.cache/eslint',
      prettierWrite: false,
      staged: false,
      since: '',
    })

    vi.mocked(FileMatcher).prototype.resolveFiles = vi.fn().mockResolvedValue(['test.ts'])

    // TypeScript times out
    const timeoutError = new Error('Operation timed out')
    timeoutError.name = 'TimeoutError'
    vi.mocked(TypeScriptEngine).prototype.check = vi.fn().mockRejectedValue(timeoutError)

    // ESLint works
    vi.mocked(ESLintEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          severity: 'error' as const,
          message: 'ESLint error',
          rule: 'no-console',
        },
      ],
    })

    // Prettier works
    vi.mocked(PrettierEngine).prototype.check = vi.fn().mockResolvedValue({
      issues: [
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          severity: 'warning' as const,
          message: 'Prettier formatting issue',
          rule: 'prettier/prettier',
        },
      ],
    })

    const checker = new QualityChecker()
    const result = await checker.check(['test.ts'], {
      timeout: 100,
    })

    // Should have results from working engines
    expect(result.issues.some((issue) => issue.message === 'ESLint error')).toBe(true)
    expect(result.issues.some((issue) => issue.message === 'Prettier formatting issue')).toBe(true)

    // Should also report the timeout
    expect(
      result.issues.some(
        (issue) =>
          (issue.message.toLowerCase().includes('timeout') ||
            issue.message.toLowerCase().includes('timed out')) &&
          issue.message.toLowerCase().includes('typescript'),
      ),
    ).toBe(true)
  })
})
