import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import { runClaudeHookV2 } from './claude-v2.js'
import { QualityChecker } from '../core/quality-checker.js'
import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { ClaudeFormatter } from '../formatters/claude-formatter.js'
import { ExitCodes } from '../core/exit-codes.js'

vi.mock('../core/quality-checker.js')
vi.mock('../adapters/autopilot.js')
vi.mock('../adapters/fixer.js')
vi.mock('../formatters/claude-formatter.js')
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setCorrelationId: vi.fn(() => 'test-correlation-id'),
    getCorrelationId: vi.fn(() => 'test-correlation-id'),
    payloadReceived: vi.fn(),
    payloadValidation: vi.fn(),
    hookStarted: vi.fn(),
    hookCompleted: vi.fn(),
    qualityCheckStarted: vi.fn(),
    qualityCheckCompleted: vi.fn(),
    autopilotDecision: vi.fn(),
    autoFixStarted: vi.fn(),
    autoFixCompleted: vi.fn(),
  },
  createTimer: vi.fn(() => ({
    end: vi.fn(() => 100),
  })),
}))

describe('Claude Facade V2 Integration', () => {
  let mockStdin: any
  let mockProcessExit: Mock
  let mockQualityChecker: any
  let mockAutopilot: any
  let mockFixer: any
  let mockClaudeFormatter: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockProcessExit = vi.fn()
    vi.spyOn(process, 'exit').mockImplementation(mockProcessExit as any)
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    vi.spyOn(console, 'error').mockImplementation(vi.fn())

    mockStdin = {
      setEncoding: vi.fn(),
      on: vi.fn(),
    }
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any)

    mockQualityChecker = {
      check: vi.fn(),
      fix: vi.fn(),
    }
    ;(QualityChecker as any).mockImplementation(() => mockQualityChecker)

    mockAutopilot = {
      decide: vi.fn(),
    }
    ;(Autopilot as any).mockImplementation(() => mockAutopilot)

    mockFixer = {
      autoFix: vi.fn(),
    }
    ;(Fixer as any).mockImplementation(() => mockFixer)

    mockClaudeFormatter = {
      format: vi.fn(),
      formatDetailed: vi.fn(),
    }
    ;(ClaudeFormatter as any).mockImplementation(() => mockClaudeFormatter)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Core Integration', () => {
    test('should_use_QualityChecker_for_successful_check_when_no_issues_found', async () => {
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/component.ts',
          content: 'export const test = true',
        },
      }

      const mockResult = {
        success: true,
        duration: 100,
        errors: [],
        warnings: [],
        autofixes: [],
        checkers: {},
        correlationId: 'test-correlation-id',
      }

      mockQualityChecker.check.mockResolvedValue(mockResult)
      setupStdinPayload(payload)

      await runClaudeHookV2()

      expect(QualityChecker).toHaveBeenCalledTimes(1)
      expect(mockQualityChecker.check).toHaveBeenCalledWith(['/test/component.ts'], { fix: false })
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCodes.SUCCESS)
    })

    test('should_process_issues_and_call_autopilot_when_quality_check_fails', async () => {
      const payload = {
        tool_name: 'Edit',
        tool_input: {
          file_path: '/test/service.ts',
          old_string: 'const x = 1',
          new_string: 'const x: number = 1',
        },
      }

      const mockResult = {
        success: false,
        duration: 150,
        errors: ['TypeScript error', 'ESLint error'],
        warnings: [],
        autofixes: [],
        checkers: {
          eslint: {
            success: false,
            errors: [
              "/test/service.ts:15:7 - 'unusedVar' is assigned a value but never used (no-unused-vars)",
            ],
          },
          typescript: {
            success: false,
            errors: ["/test/service.ts:10:5 - Cannot find module 'missing-module' (TS2307)"],
          },
        },
        correlationId: 'test-correlation-id',
      }

      mockQualityChecker.check.mockResolvedValue(mockResult)
      mockAutopilot.decide.mockReturnValue({
        action: 'REPORT_ONLY',
        issues: [],
      })

      setupStdinPayload(payload)

      await runClaudeHookV2()

      expect(mockQualityChecker.check).toHaveBeenCalledWith(['/test/service.ts'], { fix: false })
      expect(mockAutopilot.decide).toHaveBeenCalled()

      const autopilotCall = mockAutopilot.decide.mock.calls[0][0]
      expect(autopilotCall.filePath).toBe('/test/service.ts')
      expect(autopilotCall.issues.length).toBe(2) // ESLint and TypeScript issues
      expect(autopilotCall.hasErrors).toBe(true)
      expect(autopilotCall.fixable).toBe(true) // ESLint is fixable
    })

    test('should_use_ClaudeFormatter_for_output_when_reporting_issues', async () => {
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/component.tsx',
          content: 'const Component = () => <div>Test</div>',
        },
      }

      const mockResult = {
        success: false,
        duration: 100,
        errors: ['TypeScript error'],
        warnings: [],
        autofixes: [],
        checkers: {
          typescript: {
            success: false,
            errors: [
              "/test/component.tsx:1:7 - Cannot assign to 'Component' because it is a constant (TS2588)",
            ],
          },
        },
        correlationId: 'test-correlation-id',
      }

      const formattedOutput = `
<quality-check-result>
  <typescript>
    <error file="/test/component.tsx" line="1" column="7" code="TS2588">
      Cannot assign to 'Component' because it is a constant
    </error>
  </typescript>
</quality-check-result>
      `.trim()

      mockQualityChecker.check.mockResolvedValue(mockResult)
      mockClaudeFormatter.format.mockReturnValue(formattedOutput)
      mockAutopilot.decide.mockReturnValue({
        action: 'CONTINUE',
        issues: [],
      })

      setupStdinPayload(payload)

      await runClaudeHookV2()

      expect(ClaudeFormatter).toHaveBeenCalledTimes(1)
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCodes.SUCCESS)
    })

    test('should_handle_errors_gracefully_when_check_fails', async () => {
      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/error.ts',
          content: 'const test = true',
        },
      }

      mockQualityChecker.check.mockRejectedValue(new Error('Check failed'))
      setupStdinPayload(payload)

      await runClaudeHookV2()

      expect(mockProcessExit).toHaveBeenCalledWith(ExitCodes.SUCCESS) // Graceful exit
    })
  })

  describe('Backward Compatibility', () => {
    test('should_handle_legacy_payloads_correctly', async () => {
      const oldPayload = {
        tool_name: 'Write',
        tool_input: {
          file_path: '/test/legacy.js',
          content: 'function legacy() { return true }',
        },
      }

      const mockResult = {
        success: true,
        duration: 50,
        errors: [],
        warnings: [],
        autofixes: [],
        checkers: {},
        correlationId: 'test-correlation-id',
      }

      mockQualityChecker.check.mockResolvedValue(mockResult)
      setupStdinPayload(oldPayload)

      await runClaudeHookV2()

      expect(mockQualityChecker.check).toHaveBeenCalledWith(['/test/legacy.js'], { fix: false })
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCodes.SUCCESS)
    })
  })

  // Helper function to setup stdin payload
  function setupStdinPayload(payload: any) {
    const payloadString = JSON.stringify(payload)
    let dataCallback: any
    let endCallback: any

    mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
      if (event === 'data') dataCallback = callback
      if (event === 'end') endCallback = callback
      return mockStdin
    })

    // Simulate async stdin read
    setTimeout(() => {
      if (dataCallback) dataCallback(payloadString)
      if (endCallback) endCallback()
    }, 0)
  }
})
