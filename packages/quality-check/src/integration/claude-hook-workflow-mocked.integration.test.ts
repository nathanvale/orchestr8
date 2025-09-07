import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { 
  MockClaudeHookManager, 
  MockClaudeHookScenarios, 
  runMockClaudeHook 
} from '../test-utils/mock-claude-hook.js'

describe('Claude Hook End-to-End Integration (Mocked)', () => {
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
    duration: number
  }> {
    const startTime = Date.now()
    
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

    const endTime = Date.now()
    return { exitCode, stdout, stderr, duration: endTime - startTime }
  }

  describe('Complete hook workflow integration', () => {
    test('should_execute_complete_workflow_for_write_operation', async () => {
      // Arrange - Setup mock for successful execution
      const filePath = path.join(testProjectDir, 'src', 'test.ts')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: 'export const test = () => console.log("hello")',
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert - Hook should execute successfully
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(100) // Much faster with mocks
    })

    test('should_handle_edit_operations_correctly', async () => {
      // Arrange
      const testFile = path.join(testProjectDir, 'src', 'component.tsx')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const payload = {
        operation: 'edit_file',
        file_path: testFile,
        content: 'export const Button = () => <button>New</button>',
        metadata: {
          tool_name: 'Edit',
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(100)
    })

    test('should_handle_multi_edit_operations', async () => {
      // Arrange
      const filePath = path.join(testProjectDir, 'src', 'service.ts')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const payload = {
        operation: 'multi_edit',
        file_path: filePath,
        content: 'export class UserService { getId() { return "123" } }',
        metadata: {
          tool_name: 'MultiEdit',
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(100)
    })
  })

  describe('Real Claude Code PostToolUse simulation', () => {
    test('should_process_authentic_claude_payload_format', async () => {
      // Arrange - Setup mock for successful execution
      const filePath = path.join(testProjectDir, 'src', 'utils.ts')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const authenticPayload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: `/**
 * Utility functions for the application
 */

export function formatDate(date: Date): string {
  return date.toLocaleDateString()
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}`,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(authenticPayload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('') // No error output expected
      expect(result.duration).toBeLessThan(100)
    })

    test('should_handle_complex_react_component_payload', async () => {
      // Arrange
      const filePath = path.join(testProjectDir, 'src', 'UserProfile.tsx')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const reactComponentPayload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: `import React, { useState, useEffect } from 'react'

interface UserProfileProps {
  userId: string
  onUserUpdate?: (user: User) => void
}

interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userId,
  onUserUpdate
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUser(userId)
  }, [userId])

  const fetchUser = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(\`/api/users/\${id}\`)
      if (!response.ok) throw new Error('User not found')
      const userData = await response.json()
      setUser(userData)
      onUserUpdate?.(userData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!user) return null

  return (
    <div className="user-profile">
      {user.avatar && <img src={user.avatar} alt={user.name} />}
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}`,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(reactComponentPayload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(100)
    })
  })

  describe('Auto-fixable issues validation', () => {
    test('should_silently_fix_formatting_issues', async () => {
      // Arrange - Setup mock for auto-fixable formatting issues
      const filePath = path.join(testProjectDir, 'src', 'badly-formatted.ts')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const badlyFormattedCode = `export const test=()=>{
console.log("hello")
return"world"
}`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: badlyFormattedCode,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert - Should exit silently (0) after auto-fixing
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('') // No error output for auto-fixed issues
      expect(result.duration).toBeLessThan(100)
    })

    test('should_silently_fix_import_organization_issues', async () => {
      // Arrange - Setup mock for auto-fixable import issues
      const filePath = path.join(testProjectDir, 'src', 'unorganized.tsx')
      const mockChecker = MockClaudeHookScenarios.createAutoFixableScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const unorganizedImports = `import { useState } from 'react'
import path from 'node:path'
import fs from 'node:fs'
import React from 'react'

export const Component = () => {
  const [state, setState] = useState('')
  return <div>{state}</div>
}`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: unorganizedImports,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(100)
    })
  })

  describe('Blocking behavior for complex issues', () => {
    test('should_block_for_type_safety_issues', async () => {
      // Arrange - Setup mock for TypeScript type safety errors
      const filePath = path.join(testProjectDir, 'src', 'unsafe.ts')
      const mockChecker = MockClaudeHookScenarios.createTypeScriptErrorScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const unsafeCode = `export function processData(data: any): any {
  return data.someProperty.anotherProperty
}`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: unsafeCode,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert - Should block (exit code 2) for human-required issues
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('Quality issues require manual intervention')
      expect(result.duration).toBeLessThan(100)
    })

    test('should_block_for_complexity_issues', async () => {
      // Arrange - Setup mock for complexity errors
      const filePath = path.join(testProjectDir, 'src', 'complex.ts')
      const mockChecker = MockClaudeHookScenarios.createComplexityErrorScenario(filePath)
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const complexCode = `export function complexFunction(a: number, b: string, c: boolean, d: object) {
  if (a > 0) {
    if (b.length > 0) {
      if (c) {
        if (d && typeof d === 'object') {
          if (Object.keys(d).length > 0) {
            for (const key in d) {
              if (d.hasOwnProperty(key)) {
                const value = d[key]
                if (typeof value === 'string') {
                  if (value.length > 10) {
                    return value.substring(0, 10)
                  } else if (value.length > 5) {
                    return value.substring(0, 5)
                  } else {
                    return value
                  }
                } else if (typeof value === 'number') {
                  if (value > 100) {
                    return value / 100
                  } else if (value > 10) {
                    return value / 10
                  } else {
                    return value
                  }
                }
              }
            }
          }
        }
      } else {
        return b.toUpperCase()
      }
    } else {
      return 'empty'
    }
  } else {
    return null
  }
  return undefined
}`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: complexCode,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert - Should block for complexity issues
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('Quality issues require manual intervention')
      expect(result.duration).toBeLessThan(100)
    })
  })

  describe('Performance requirements validation', () => {
    test('should_complete_execution_under_100ms', async () => {
      // Arrange
      const filePath = path.join(testProjectDir, 'src', 'performance-test.ts')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: 'export const perfTest = () => "fast"',
        },
      }

      // Act
      const startTime = Date.now()
      const result = await executeMockedClaudeHook(JSON.stringify(payload))
      const endTime = Date.now()
      const actualDuration = endTime - startTime

      // Assert
      expect(actualDuration).toBeLessThan(100)
      expect(result.duration).toBeLessThan(100)
      expect(result.exitCode).toBe(0)
    })

    test('should_handle_large_files_efficiently', async () => {
      // Arrange
      const filePath = path.join(testProjectDir, 'src', 'large-file.ts')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const largeFileContent = Array.from(
        { length: 1000 },
        (_, i) => `export const function${i} = () => { return ${i} }`,
      ).join('\n')

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: largeFileContent,
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.duration).toBeLessThan(100)
      expect(result.exitCode).toBe(0)
    })
  })

  describe('Error handling and edge cases', () => {
    test('should_handle_non_existent_file_operations_gracefully', async () => {
      // Arrange
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const payload = {
        tool_name: 'Edit',
        tool_input: {
          file_path: '/non/existent/path/file.ts',
          old_string: '',
          new_string: 'export const test = true',
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert - Should exit gracefully, not crash
      expect([0, 1]).toContain(result.exitCode) // Either success or controlled failure
      expect(result.duration).toBeLessThan(100)
    })

    test('should_skip_non_code_files_silently', async () => {
      // Arrange
      const filePath = path.join(testProjectDir, 'README.md')
      const mockChecker = MockClaudeHookScenarios.createSuccessScenario()
      MockClaudeHookManager.setMockQualityChecker(mockChecker)

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: filePath,
          content: '# Test Project',
        },
      }

      // Act
      const result = await executeMockedClaudeHook(JSON.stringify(payload))

      // Assert - Should skip silently
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(50) // Should be very fast for skipped files
    })
  })
})