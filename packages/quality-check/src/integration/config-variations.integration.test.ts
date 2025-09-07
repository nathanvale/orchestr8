import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { 
  MockClaudeHookManager, 
  MockClaudeHookScenarios, 
  runMockClaudeHook 
} from '../test-utils/mock-claude-hook.js'

describe('ESLint Config Variations Integration (Mocked)', () => {
  let testProjectDir: string

  beforeEach(async () => {
    vi.clearAllMocks()
    MockClaudeHookManager.reset()
    // Use a simulated test project directory path
    testProjectDir = path.join('/tmp', 'test-project')
    // Ensure NODE_ENV is set for test environment
    process.env.NODE_ENV = 'test'
  })

  afterEach(async () => {
    MockClaudeHookManager.reset()
  })

  // Helper function to execute mocked Claude hook
  async function executeMockedClaudeHook(payload: string): Promise<{
    exitCode: number
    stdout: string
    stderr: string
  }> {
    // Ensure hook is not disabled for testing
    const _originalHookDisabled = process.env.CLAUDE_HOOK_DISABLED
    delete process.env.CLAUDE_HOOK_DISABLED

    // Mock stdin for the Claude hook to read from
    const originalStdin = process.stdin
    const mockStdin = {
      isTTY: false,
      setEncoding: vi.fn(),
      on: vi.fn((event: string, handler: (data?: any) => void) => {
        if (event === 'data') {
          setTimeout(() => handler(payload), 0)
        } else if (event === 'end') {
          setTimeout(() => handler(), 10)
        }
      }),
      removeAllListeners: vi.fn(),
    }

    // Mock stdout and stderr to capture output
    let stdout = ''
    let stderr = ''
    const originalStdoutWrite = process.stdout.write
    const originalStderrWrite = process.stderr.write
    const originalExit = process.exit
    let exitCode = 0

    process.stdout.write = vi.fn((chunk: any) => {
      stdout += chunk.toString()
      return true
    }) as any

    process.stderr.write = vi.fn((chunk: any) => {
      stderr += chunk.toString()
      return true
    }) as any

    process.exit = vi.fn((code?: number) => {
      exitCode = code || 0
      throw new Error('Process exit called')
    }) as any

    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      configurable: true,
    })

    try {
      await runMockClaudeHook()
    } catch (error: any) {
      // Check if it's our controlled exit
      if (error.message !== 'Process exit called') {
        throw error
      }
    } finally {
      // Restore original functions
      process.stdout.write = originalStdoutWrite
      process.stderr.write = originalStderrWrite
      process.exit = originalExit
      Object.defineProperty(process, 'stdin', {
        value: originalStdin,
        configurable: true,
      })
      // Restore CLAUDE_HOOK_DISABLED if it was set
      if (_originalHookDisabled !== undefined) {
        process.env.CLAUDE_HOOK_DISABLED = _originalHookDisabled
      }
    }

    return { exitCode, stdout, stderr }
  }

  describe('Different ESLint configurations', () => {
    test('should_handle_airbnb_style_config', async () => {
      // Arrange - Setup mock for auto-fixable issues
      const filePath = path.join(testProjectDir, 'src', 'airbnb-style.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const codeViolatingAirbnbStyle = `export const myFunction = arg => {
        const obj = {test: "value",another: "test"}
        return obj
      };`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: codeViolatingAirbnbStyle,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })

    test('should_handle_standard_style_config', async () => {
      // Arrange - Setup mock for auto-fixable issues
      const filePath = path.join(testProjectDir, 'src', 'standard-style.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const codeViolatingStandardStyle = `var myFunction = function() {
        var unused = 'test'  
        let mutable = 'should be const'
        return mutable
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: codeViolatingStandardStyle,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })

    test('should_handle_custom_enterprise_config', async () => {
      // Arrange - Setup mock for auto-fixable issues
      const filePath = path.join(testProjectDir, 'src', 'enterprise-style.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const codeViolatingEnterpriseStyle = `export function processData(name, age) {
        const message = 'Name: ' + name + ', Age: ' + age + '. This is a very long line that exceeds the maximum line length of 100 characters.'


        return message
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: codeViolatingEnterpriseStyle,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })
  })

  describe('TypeScript strict mode scenarios', () => {
    test('should_handle_typescript_strict_null_checks', async () => {
      // Arrange - Setup mock for TypeScript errors
      const filePath = path.join(testProjectDir, 'src', 'strict-null.ts')
      const mockChecker = MockClaudeHookScenarios.createTypeScriptErrorScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)
      

      const strictNullCheckCode = `interface User {
        id: number
        name: string
        email?: string
      }

      export function getUserEmail(user: User | null): string {
        // This should trigger strict null check issues
        return user.email
      }

      export function processUsers(users: User[]): string[] {
        return users.map(u => u.email)
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: strictNullCheckCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(2) // Should block for type safety issues
      expect(result.stderr).toContain('Quality issues require manual intervention')
    })

    test('should_handle_typescript_no_implicit_any', async () => {
      // Arrange - Setup mock for TypeScript errors
      const filePath = path.join(testProjectDir, 'src', 'implicit-any.ts')
      const mockChecker = MockClaudeHookScenarios.createTypeScriptErrorScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const implicitAnyCode = `export function processData(data) {
        return data.map(item => item.value * 2)
      }

      export const handler = (req, res) => {
        res.send({ status: 'ok' })
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: implicitAnyCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('Quality issues require manual intervention')
    })

    test('should_handle_typescript_unused_parameters', async () => {
      // Arrange - Setup mock for TypeScript errors
      const filePath = path.join(testProjectDir, 'src', 'unused-params.ts')
      const mockChecker = MockClaudeHookScenarios.createTypeScriptErrorScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const unusedParametersCode = `export function calculate(value: number, unused: string, factor: number): number {
        const unusedLocal = 'not used'
        return value * factor
      }

      export class Calculator {
        compute(a: number, b: number, c: number): number {
          return a + b // c is unused
        }
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: unusedParametersCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('Quality issues require manual intervention')
    })
  })

  describe('Prettier config edge cases', () => {
    test('should_handle_prettier_with_custom_print_width', async () => {
      // Arrange - Setup mock for auto-fixable Prettier issues
      const filePath = path.join(testProjectDir, 'src', 'long-lines.ts')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const longLineCode = `export const myVeryLongFunctionNameThatExceedsThePrintWidth = (firstParameter: string, secondParameter: number, thirdParameter: boolean) => {
        return { first: firstParameter, second: secondParameter, third: thirdParameter }
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: longLineCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })

    test('should_handle_prettier_with_tabs_vs_spaces', async () => {
      // Arrange - Setup mock for auto-fixable Prettier issues
      const filePath = path.join(testProjectDir, 'src', 'tabs-spaces.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const spacesCode = `export function formatData() {
          const data = {
              name: 'test',
              value: 123
          }
          return data
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: spacesCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })

    test('should_handle_prettier_with_trailing_comma_options', async () => {
      // Arrange - Setup mock for auto-fixable Prettier issues
      const filePath = path.join(testProjectDir, 'src', 'trailing-comma.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const noTrailingCommaCode = `export const config = {
        api: { url: "https://api.example.com", timeout: 5000 },
        features: [ "feature1", "feature2", "feature3" ],
        settings: { theme: "dark", language: "en" }
      }

      export const transform = data => data.map(item => ({
        id: item.id,
        name: item.name
      }))`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: noTrailingCommaCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })
  })

  describe('Mixed configuration scenarios', () => {
    test('should_handle_eslint_prettier_conflicts', async () => {
      // Arrange - Setup mock for auto-fixable issues
      const filePath = path.join(testProjectDir, 'src', 'conflicts.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const conflictingCode = `export const message = 'This is a string that might cause conflicts between ESLint and Prettier configurations';`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: conflictingCode,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
    })

    test('should_handle_monorepo_with_different_configs', async () => {
      // Arrange - Setup mock for auto-fixable issues
      const packageADir = path.join(testProjectDir, 'packages', 'package-a')
      const filePath = path.join(packageADir, 'src', 'debug.js')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const codeWithConsole = `export function debug(message) {
        console.log('Debug:', message)
        debugger
        return message
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: codeWithConsole,
        },
      }

      // Act & Assert
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      expect(result.exitCode).toBe(0) // Autopilot should fix console/debugger
    })
  })
})