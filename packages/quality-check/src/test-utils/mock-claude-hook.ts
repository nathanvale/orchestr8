/**
 * Mock Claude Hook Implementation for Integration Tests
 *
 * Provides a mocked version of runClaudeHook that uses MockQualityChecker
 * instead of real linting/formatting tools for predictable test results.
 */

import { ExitCodes } from '../core/exit-codes.js'
import { MockQualityChecker } from './test-environment.js'

// Claude Code payload format - matches actual Claude Code structure
interface ClaudeCodePayload {
  tool_name: string // "Write", "Edit", "MultiEdit"
  tool_input: {
    file_path: string
    content?: string // For Write
    old_string?: string // For Edit
    new_string?: string // For Edit
    edits?: Array<{
      // For MultiEdit
      old_string: string
      new_string: string
    }>
  }
}

/**
 * Mock instance manager for the Claude hook
 */
export class MockClaudeHookManager {
  private static mockQualityChecker: MockQualityChecker = new MockQualityChecker()

  /**
   * Set the mock quality checker to use for tests
   */
  static setMockQualityChecker(checker: MockQualityChecker): void {
    MockClaudeHookManager.mockQualityChecker = checker
  }

  /**
   * Get the current mock quality checker
   */
  static getMockQualityChecker(): MockQualityChecker {
    return MockClaudeHookManager.mockQualityChecker
  }

  /**
   * Reset to a clean mock quality checker
   */
  static reset(): void {
    MockClaudeHookManager.mockQualityChecker = new MockQualityChecker()
  }
}

/**
 * Mock version of runClaudeHook for integration tests
 *
 * This function provides the same interface as the real runClaudeHook but uses
 * MockQualityChecker to provide predictable, controllable results for testing.
 */
export async function runMockClaudeHook(): Promise<void> {
  // Skip the CLAUDE_HOOK_DISABLED check in test environment
  // to allow testing the actual hook behavior
  if (process.env.NODE_ENV !== 'test' && process.env.CLAUDE_HOOK_DISABLED === 'true') {
    process.exit(ExitCodes.SUCCESS)
    return
  }

  try {
    // Read and parse payload from stdin
    const input = await readStdin()
    let payload: ClaudeCodePayload | undefined

    try {
      if (!input || input.trim() === '') {
        process.exit(ExitCodes.SUCCESS)
        return
      }

      const parsed = JSON.parse(input)
      if (parsed === null || parsed === undefined) {
        process.exit(ExitCodes.SUCCESS)
        return
      }

      payload = parsed as ClaudeCodePayload
    } catch {
      // Silent exit for malformed payloads
      process.exit(ExitCodes.SUCCESS)
      return
    }

    // Validate required fields
    if (!payload || !payload.tool_name || !payload.tool_input || !payload.tool_input.file_path) {
      process.exit(ExitCodes.SUCCESS)
      return
    }

    // Only process supported operations
    if (!shouldProcessOperation(payload.tool_name)) {
      process.exit(ExitCodes.SUCCESS)
      return
    }

    // Skip non-code files
    if (!isSupportedFileType(payload.tool_input.file_path)) {
      process.exit(ExitCodes.SUCCESS)
      return
    }

    // Use mock quality checker for predictable results
    const mockChecker = MockClaudeHookManager.getMockQualityChecker()
    const result = await mockChecker.check([payload.tool_input.file_path])

    if (result.success) {
      // Silent success - no output
      process.exit(ExitCodes.SUCCESS)
    }

    const issues = result.issues || []

    // Determine the mock behavior based on the predefined result
    // This simulates the autopilot decision logic but with predictable outcomes
    const hasTypeScriptErrors = issues.some((issue) => issue.engine === 'typescript')
    const hasOnlyFixableIssues =
      issues.length > 0 &&
      issues.every((issue) => issue.engine === 'eslint' || issue.engine === 'prettier')

    if (hasTypeScriptErrors) {
      // Simulate REPORT_ONLY for TypeScript errors that require manual intervention
      const errorMessage = 'Quality issues require manual intervention'
      process.stderr.write(errorMessage)
      process.exit(ExitCodes.QUALITY_ISSUES)
    } else if (hasOnlyFixableIssues) {
      // Simulate FIX_SILENTLY for auto-fixable issues
      // Silent success - no output, exit successfully
      process.exit(ExitCodes.SUCCESS)
    } else if (issues.length > 0) {
      // If there are issues but not TypeScript or fixable, also exit with quality issues
      const errorMessage = 'Quality issues require manual intervention'
      process.stderr.write(errorMessage)
      process.exit(ExitCodes.QUALITY_ISSUES)
    } else {
      // Default to success for no issues
      process.exit(ExitCodes.SUCCESS)
    }
  } catch (error) {
    // In test environment, if the error is from mocked process.exit, don't call exit again
    if (
      process.env.NODE_ENV === 'test' &&
      error instanceof Error &&
      error.message === 'Process exit called'
    ) {
      // Let the test handle it
      throw error
    }
    // Silent error handling - don't output to stderr
    // Exit gracefully - don't block Claude for hook issues
    process.exit(ExitCodes.SUCCESS)
  }
}

/**
 * Read JSON payload from stdin
 */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    let hasData = false
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
      hasData = true
    })
    process.stdin.on('end', () => {
      hasData = true
      resolve(data)
    })

    // Timeout to prevent hanging - return empty object for graceful handling
    // Reduced timeout for test environment
    const timeout = process.env.NODE_ENV === 'test' ? 500 : 5000
    setTimeout(() => {
      if (!hasData) {
        resolve('{}')
      }
    }, timeout)
  })
}

/**
 * Check if file type is supported for quality checking
 */
function isSupportedFileType(filePath: string): boolean {
  return /\.(js|jsx|ts|tsx)$/.test(filePath)
}

/**
 * Check if operation should be processed
 */
function shouldProcessOperation(operation: string): boolean {
  const supportedOperations = ['Write', 'Edit', 'MultiEdit']
  return supportedOperations.includes(operation)
}

/**
 * Factory functions for creating predefined mock scenarios
 */
export class MockClaudeHookScenarios {
  /**
   * Configure mock to simulate successful quality check (exit code 0, no stderr)
   */
  static createSuccessScenario(): MockQualityChecker {
    const checker = new MockQualityChecker()
    // Default MockQualityChecker behavior is success with no issues
    return checker
  }

  /**
   * Configure mock to simulate auto-fixable issues (exit code 0, no stderr)
   */
  static createAutoFixableScenario(filePath: string): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult(filePath, {
      filePath,
      success: false,
      issues: [
        {
          line: 1,
          column: 1,
          message: 'File is not formatted with Prettier',
          severity: 'warning',
          engine: 'prettier',
          ruleId: 'format',
        },
      ],
    })
    return checker
  }

  /**
   * Configure mock to simulate TypeScript errors (exit code 2, stderr output)
   */
  static createTypeScriptErrorScenario(filePath: string): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult(filePath, {
      filePath,
      success: false,
      issues: [
        {
          line: 10,
          column: 5,
          message: "Type 'string' is not assignable to type 'number'",
          severity: 'error',
          engine: 'typescript',
          ruleId: 'TS2322',
        },
      ],
    })
    return checker
  }

  /**
   * Configure mock to simulate complexity issues (exit code 2, stderr output)
   */
  static createComplexityErrorScenario(filePath: string): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult(filePath, {
      filePath,
      success: false,
      issues: [
        {
          line: 1,
          column: 1,
          message: "Function 'complexFunction' has a complexity of 12. Maximum allowed is 10.",
          severity: 'error',
          engine: 'typescript',
          ruleId: 'TS2322',
        },
      ],
    })
    return checker
  }

  /**
   * Configure mock to simulate mixed issues that will be partially fixed
   */
  static createMixedIssuesScenario(filePath: string): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult(filePath, {
      filePath,
      success: false,
      issues: [
        {
          line: 1,
          column: 1,
          message: 'File is not formatted with Prettier',
          severity: 'warning',
          engine: 'prettier',
          ruleId: 'format',
        },
        {
          line: 10,
          column: 5,
          message: "Type 'string' is not assignable to type 'number'",
          severity: 'error',
          engine: 'typescript',
          ruleId: 'TS2322',
        },
      ],
    })
    return checker
  }
}
