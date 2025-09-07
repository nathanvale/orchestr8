import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { runClaudeHook } from './claude.js'
import * as AutopilotModule from '../adapters/autopilot.js'
import * as QualityCheckerModule from '../core/quality-checker.js'
import * as FixerModule from '../adapters/fixer.js'
import { ClaudeFormatter } from '../formatters/claude-formatter.js'

describe('Claude Hook XML Output', () => {
  let mockStdin: any
  let mockProcess: any
  let mockConsole: any
  let originalProcessExit: typeof process.exit
  let originalConsoleError: typeof console.error
  let originalConsoleLog: typeof console.log

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock process.exit to capture exit codes
    originalProcessExit = process.exit
    mockProcess = { exit: vi.fn() }
    process.exit = mockProcess.exit as any

    // Mock console to capture output
    originalConsoleError = console.error
    originalConsoleLog = console.log
    mockConsole = {
      error: vi.fn(),
      log: vi.fn(),
    }
    console.error = mockConsole.error
    console.log = mockConsole.log

    // Mock stdin
    mockStdin = {
      setEncoding: vi.fn(),
      on: vi.fn(),
    }
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any)
  })

  afterEach(() => {
    process.exit = originalProcessExit
    console.error = originalConsoleError
    console.log = originalConsoleLog
    vi.restoreAllMocks()
  })

  describe('REPORT_ONLY mode XML output', () => {
    test('should_output_xml_formatted_issues_when_autopilot_decides_report_only', async () => {
      // Arrange
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/component.ts',
          content: 'const x: any = 42',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Mock QualityChecker to return TypeScript errors
      const mockQualityResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['TS7006: Parameter implicitly has an any type'],
          },
        },
      }
      vi.spyOn(QualityCheckerModule, 'QualityChecker').mockImplementation(
        () =>
          ({
            check: vi.fn().mockResolvedValue(mockQualityResult),
          }) as any,
      )

      // Mock Autopilot to return REPORT_ONLY decision
      vi.spyOn(AutopilotModule, 'Autopilot').mockImplementation(
        () =>
          ({
            decide: vi.fn().mockReturnValue({
              action: 'REPORT_ONLY',
              confidence: 0.9,
              issues: [
                {
                  engine: 'typescript',
                  severity: 'error',
                  ruleId: 'TS7006',
                  file: '/test/component.ts',
                  line: 1,
                  col: 7,
                  message: 'Parameter implicitly has an any type',
                },
              ],
            }),
          }) as any,
      )

      // Setup stdin callbacks
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback(payloadString)
      endCallback()
      await promise

      // Assert - Should output XML formatted issues to stderr
      const errorCalls = mockConsole.error.mock.calls
      const xmlOutput = errorCalls.map((call) => call.join(' ')).join('\n')

      // Check for XML structure in output
      expect(xmlOutput).toContain('<quality-check-result>')
      expect(xmlOutput).toContain('<typescript>')
      expect(xmlOutput).toContain('<error')
      expect(xmlOutput).toContain('file="/test/component.ts"')
      expect(xmlOutput).toContain('line="1"')
      expect(xmlOutput).toContain('column="7"')
      expect(xmlOutput).toContain('code="TS7006"')
      expect(xmlOutput).toContain('Parameter implicitly has an any type')
      expect(xmlOutput).toContain('</error>')
      expect(xmlOutput).toContain('</typescript>')
      expect(xmlOutput).toContain('</quality-check-result>')

      // Should exit with quality issues code
      expect(mockProcess.exit).toHaveBeenCalledWith(2)
    })

    test('should_escape_xml_special_characters_in_report_only_output', async () => {
      // Arrange
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/component.ts',
          content: 'const x = 1',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Mock quality result with special characters
      const mockQualityResult = {
        success: false,
        checkers: {
          eslint: {
            success: false,
            errors: ['Unexpected use of < and > operators & "quotes"'],
          },
        },
      }
      vi.spyOn(QualityCheckerModule, 'QualityChecker').mockImplementation(
        () =>
          ({
            check: vi.fn().mockResolvedValue(mockQualityResult),
          }) as any,
      )

      // Mock Autopilot
      vi.spyOn(AutopilotModule, 'Autopilot').mockImplementation(
        () =>
          ({
            decide: vi.fn().mockReturnValue({
              action: 'REPORT_ONLY',
              confidence: 0.8,
              issues: [
                {
                  engine: 'eslint',
                  severity: 'error',
                  ruleId: 'custom-rule',
                  file: '/test/component.ts',
                  line: 1,
                  col: 1,
                  message: 'Unexpected use of < and > operators & "quotes"',
                },
              ],
            }),
          }) as any,
      )

      // Setup stdin
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback(payloadString)
      endCallback()
      await promise

      // Assert - XML special characters should be escaped
      const errorCalls = mockConsole.error.mock.calls
      const xmlOutput = errorCalls.map((call) => call.join(' ')).join('\n')

      expect(xmlOutput).toContain('&lt;')
      expect(xmlOutput).toContain('&gt;')
      expect(xmlOutput).toContain('&amp;')
      expect(xmlOutput).toContain('&quot;')
    })

    test('should_group_multiple_issues_by_engine_in_xml', async () => {
      // Arrange
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/mixed.ts',
          content: 'const x = 1',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Mock multiple issues from different engines
      const mockQualityResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['TS2307: Cannot find module', 'TS2304: Cannot find name'],
          },
          eslint: {
            success: false,
            errors: ['no-console: Unexpected console statement'],
          },
        },
      }
      vi.spyOn(QualityCheckerModule, 'QualityChecker').mockImplementation(
        () =>
          ({
            check: vi.fn().mockResolvedValue(mockQualityResult),
          }) as any,
      )

      // Mock Autopilot with multiple issues
      vi.spyOn(AutopilotModule, 'Autopilot').mockImplementation(
        () =>
          ({
            decide: vi.fn().mockReturnValue({
              action: 'REPORT_ONLY',
              confidence: 0.7,
              issues: [
                {
                  engine: 'typescript',
                  severity: 'error',
                  ruleId: 'TS2307',
                  file: '/test/mixed.ts',
                  line: 1,
                  col: 1,
                  message: 'Cannot find module',
                },
                {
                  engine: 'typescript',
                  severity: 'error',
                  ruleId: 'TS2304',
                  file: '/test/mixed.ts',
                  line: 2,
                  col: 5,
                  message: 'Cannot find name',
                },
                {
                  engine: 'eslint',
                  severity: 'warning',
                  ruleId: 'no-console',
                  file: '/test/mixed.ts',
                  line: 3,
                  col: 1,
                  message: 'Unexpected console statement',
                },
              ],
            }),
          }) as any,
      )

      // Setup stdin
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback(payloadString)
      endCallback()
      await promise

      // Assert - Issues should be grouped by engine
      const errorCalls = mockConsole.error.mock.calls
      const xmlOutput = errorCalls.map((call) => call.join(' ')).join('\n')

      // Check TypeScript section has 2 errors
      const tsMatch = xmlOutput.match(/<typescript>([\s\S]*?)<\/typescript>/)
      expect(tsMatch).toBeTruthy()
      const tsSection = tsMatch![1]
      expect((tsSection.match(/<error/g) || []).length).toBe(2)

      // Check ESLint section has 1 warning
      const eslintMatch = xmlOutput.match(/<eslint>([\s\S]*?)<\/eslint>/)
      expect(eslintMatch).toBeTruthy()
      const eslintSection = eslintMatch![1]
      expect((eslintSection.match(/<warning/g) || []).length).toBe(1)
    })
  })

  describe('FIX_AND_REPORT mode XML output', () => {
    test('should_output_xml_for_remaining_issues_after_fix', async () => {
      // Arrange
      const payload = {
        tool_name: 'Edit',
        tool_input: {
          file_path: '/test/mixed.ts',
          old_string: 'const x = 1',
          new_string: 'const x: number = 1',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Mock quality result with mixed fixable/unfixable issues
      const mockQualityResult = {
        success: false,
        checkers: {
          typescript: {
            success: false,
            errors: ['TS2307: Cannot find module "missing"'],
          },
          prettier: {
            success: false,
            errors: ['Code style issues'],
          },
        },
      }
      vi.spyOn(QualityCheckerModule, 'QualityChecker').mockImplementation(
        () =>
          ({
            check: vi.fn().mockResolvedValue(mockQualityResult),
          }) as any,
      )

      // Mock Autopilot to return FIX_AND_REPORT
      vi.spyOn(AutopilotModule, 'Autopilot').mockImplementation(
        () =>
          ({
            decide: vi.fn().mockReturnValue({
              action: 'FIX_AND_REPORT',
              confidence: 0.75,
              issues: [
                {
                  engine: 'typescript',
                  severity: 'error',
                  ruleId: 'TS2307',
                  file: '/test/mixed.ts',
                  line: 1,
                  col: 8,
                  message: 'Cannot find module "missing"',
                },
              ],
            }),
          }) as any,
      )

      // Mock Fixer to simulate partial fix
      vi.spyOn(FixerModule, 'Fixer').mockImplementation(
        () =>
          ({
            autoFix: vi.fn().mockResolvedValue({
              success: false, // Partial fix
              remainingIssues: 1,
            }),
          }) as any,
      )

      // Setup stdin
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback(payloadString)
      endCallback()
      await promise

      // Assert - Should output XML for remaining issues
      const errorCalls = mockConsole.error.mock.calls
      const xmlOutput = errorCalls.map((call) => call.join(' ')).join('\n')

      expect(xmlOutput).toContain('<quality-check-result>')
      expect(xmlOutput).toContain('<typescript>')
      expect(xmlOutput).toContain('TS2307')
      expect(xmlOutput).toContain('Cannot find module')
      expect(xmlOutput).toContain('</quality-check-result>')

      expect(mockProcess.exit).toHaveBeenCalledWith(2)
    })

    test('should_handle_successful_fix_with_no_remaining_issues', async () => {
      // Arrange
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/formatting.ts',
          content: 'const   x    =    1    ',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Mock quality result with only fixable issues
      const mockQualityResult = {
        success: false,
        checkers: {
          prettier: {
            success: false,
            errors: ['Formatting issues'],
          },
        },
      }
      vi.spyOn(QualityCheckerModule, 'QualityChecker').mockImplementation(
        () =>
          ({
            check: vi.fn().mockResolvedValue(mockQualityResult),
          }) as any,
      )

      // Mock Autopilot
      vi.spyOn(AutopilotModule, 'Autopilot').mockImplementation(
        () =>
          ({
            decide: vi.fn().mockReturnValue({
              action: 'FIX_AND_REPORT',
              confidence: 0.95,
              issues: [], // No remaining issues after fix
            }),
          }) as any,
      )

      // Mock successful fix
      vi.spyOn(FixerModule, 'Fixer').mockImplementation(
        () =>
          ({
            autoFix: vi.fn().mockResolvedValue({
              success: true,
              remainingIssues: 0,
            }),
          }) as any,
      )

      // Setup stdin
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback(payloadString)
      endCallback()
      await promise

      // Assert - Should exit successfully without XML output
      expect(mockProcess.exit).toHaveBeenCalledWith(0)

      // Should not output XML when all issues are fixed
      const errorCalls = mockConsole.error.mock.calls
      const xmlOutput = errorCalls.map((call) => call.join(' ')).join('\n')
      expect(xmlOutput).not.toContain('<quality-check-result>')
    })
  })

  describe('XML formatter integration', () => {
    test('should_properly_format_issues_with_suggestions', () => {
      // Arrange
      const formatter = new ClaudeFormatter()
      const issues = [
        {
          engine: 'typescript' as const,
          severity: 'error' as const,
          ruleId: 'TS7006',
          file: '/test/file.ts',
          line: 10,
          col: 15,
          endLine: 10,
          endCol: 25,
          message: 'Parameter implicitly has an any type',
          suggestion: 'Add explicit type annotation',
        },
      ]

      // Act
      const xml = formatter.format(issues)

      // Assert
      expect(xml).toContain('<quality-check-result>')
      expect(xml).toContain('<typescript>')
      expect(xml).toContain('code="TS7006"')
      expect(xml).toContain('endLine="10"')
      expect(xml).toContain('endColumn="25"')
      expect(xml).toContain('SUGGESTION: Add explicit type annotation')
      expect(xml).toContain('</typescript>')
      expect(xml).toContain('</quality-check-result>')
    })

    test('should_handle_empty_issues_array', () => {
      // Arrange
      const formatter = new ClaudeFormatter()
      const issues: any[] = []

      // Act
      const xml = formatter.format(issues)

      // Assert
      expect(xml).toBe('')
    })

    test('should_use_severity_based_tags', () => {
      // Arrange
      const formatter = new ClaudeFormatter()
      const issues = [
        {
          engine: 'eslint' as const,
          severity: 'error' as const,
          ruleId: 'no-unused-vars',
          file: '/test.ts',
          line: 1,
          col: 1,
          message: 'Unused variable',
        },
        {
          engine: 'eslint' as const,
          severity: 'warning' as const,
          ruleId: 'no-console',
          file: '/test.ts',
          line: 2,
          col: 1,
          message: 'Console statement',
        },
        {
          engine: 'eslint' as const,
          severity: 'info' as const,
          ruleId: 'custom-info',
          file: '/test.ts',
          line: 3,
          col: 1,
          message: 'Info message',
        },
      ]

      // Act
      const xml = formatter.format(issues)

      // Assert
      expect(xml).toContain('<error')
      expect(xml).toContain('<warning')
      expect(xml).toContain('<info')
    })
  })
})
