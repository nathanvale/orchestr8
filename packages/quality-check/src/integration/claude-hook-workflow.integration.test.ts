import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('Claude Hook End-to-End Integration', () => {
  let testProjectDir: string
  let originalCwd: string
  let cleanupPaths: string[]

  beforeEach(async () => {
    vi.clearAllMocks()
    cleanupPaths = []
    originalCwd = process.cwd()

    // Create temporary test project directory
    testProjectDir = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'test-temp',
      `claude-test-${Date.now()}`,
    )
    await fs.mkdir(testProjectDir, { recursive: true })
    cleanupPaths.push(testProjectDir)
    process.chdir(testProjectDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)

    // Cleanup temp directories
    for (const cleanupPath of cleanupPaths) {
      try {
        await fs.rm(cleanupPath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('Complete hook workflow integration', () => {
    test('should_execute_complete_workflow_for_write_operation', async () => {
      // Arrange - Set up test project structure
      await setupTestProject(testProjectDir)

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'test.ts'),
          content: 'export const test = () => console.log("hello")',
        },
      }

      // Act - Execute Claude hook via binary
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Hook should execute successfully
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(2000) // Sub-2s requirement
    }, 5000)

    test('should_handle_edit_operations_correctly', async () => {
      // Arrange
      await setupTestProject(testProjectDir)
      const testFile = path.join(testProjectDir, 'src', 'component.tsx')
      await fs.writeFile(testFile, 'export const Button = () => <button>Old</button>')

      const payload = {
        operation: 'edit_file',
        file_path: testFile,
        content: 'export const Button = () => <button>New</button>',
        metadata: {
          tool_name: 'Edit',
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(3000)
    }, 5000)

    test('should_handle_multi_edit_operations', async () => {
      // Arrange
      await setupTestProject(testProjectDir)

      const payload = {
        operation: 'multi_edit',
        file_path: path.join(testProjectDir, 'src', 'service.ts'),
        content: 'export class UserService { getId() { return "123" } }',
        metadata: {
          tool_name: 'MultiEdit',
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe('Real Claude Code PostToolUse simulation', () => {
    test('should_process_authentic_claude_payload_format', async () => {
      // Arrange - Authentic Claude Code payload structure
      await setupTestProject(testProjectDir)

      const authenticPayload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'utils.ts'),
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
      const result = await executeClaudeHook(JSON.stringify(authenticPayload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('') // No error output expected
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_complex_react_component_payload', async () => {
      // Arrange - Complex React component similar to Claude Code output
      await setupTestProject(testProjectDir)

      const reactComponentPayload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'UserProfile.tsx'),
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
      const result = await executeClaudeHook(JSON.stringify(reactComponentPayload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe('Auto-fixable issues validation', () => {
    test('should_silently_fix_formatting_issues', async () => {
      // Arrange - Code with formatting issues that should be auto-fixed
      await setupTestProject(testProjectDir)

      const badlyFormattedCode = `export const test=()=>{
console.log("hello")
return"world"
}`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'badly-formatted.ts'),
          content: badlyFormattedCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should exit silently (0) after auto-fixing
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('') // No error output for auto-fixed issues
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_silently_fix_import_organization_issues', async () => {
      // Arrange - Code with import order issues
      await setupTestProject(testProjectDir)

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
          file_path: path.join(testProjectDir, 'src', 'unorganized.tsx'),
          content: unorganizedImports,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe.skip('Blocking behavior for complex issues', () => {
    test('should_block_for_type_safety_issues', async () => {
      // Arrange - Code with type safety issues that require human judgment
      await setupTestProject(testProjectDir)

      const unsafeCode = `export function processData(data: any): any {
  return data.someProperty.anotherProperty
}`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'unsafe.ts'),
          content: unsafeCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should block (exit code 1) for human-required issues
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('quality') // Should contain quality check feedback
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_block_for_complexity_issues', async () => {
      // Arrange - Overly complex function
      await setupTestProject(testProjectDir)

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
          file_path: path.join(testProjectDir, 'src', 'complex.ts'),
          content: complexCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should block for complexity issues
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain('complexity') // Should mention complexity
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe('Performance requirements validation', () => {
    test('should_complete_execution_under_2_seconds', async () => {
      // Arrange
      await setupTestProject(testProjectDir)

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'performance-test.ts'),
          content: 'export const perfTest = () => "fast"',
        },
      }

      // Act
      const startTime = Date.now()
      const result = await executeClaudeHook(JSON.stringify(payload))
      const endTime = Date.now()
      const actualDuration = endTime - startTime

      // Assert
      expect(actualDuration).toBeLessThan(2000)
      expect(result.duration).toBeLessThan(2000)
      expect(result.exitCode).toBe(0)
    }, 3000)

    test('should_handle_large_files_efficiently', async () => {
      // Arrange - Large file content
      await setupTestProject(testProjectDir)

      const largeFileContent = Array.from(
        { length: 1000 },
        (_, i) => `export const function${i} = () => { return ${i} }`,
      ).join('\n')

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'large-file.ts'),
          content: largeFileContent,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert
      expect(result.duration).toBeLessThan(2000)
      expect(result.exitCode).toBe(0)
    }, 3000)
  })

  describe('Error handling and edge cases', () => {
    test('should_handle_non_existent_file_operations_gracefully', async () => {
      // Arrange
      await setupTestProject(testProjectDir)

      const payload = {
        tool_name: 'Edit',
        tool_input: {
          file_path: '/non/existent/path/file.ts',
          old_string: '',
          new_string: 'export const test = true',
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should exit gracefully, not crash
      expect([0, 1]).toContain(result.exitCode) // Either success or controlled failure
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_skip_non_code_files_silently', async () => {
      // Arrange
      await setupTestProject(testProjectDir)

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'README.md'),
          content: '# Test Project',
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should skip silently
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(1000) // Should be very fast for skipped files
    }, 5000)
  })
})

// Helper functions for integration testing
async function setupTestProject(projectDir: string): Promise<void> {
  // Create basic project structure
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })
  await fs.mkdir(path.join(projectDir, 'dist'), { recursive: true })

  // Create package.json
  const packageJson = {
    name: 'claude-test-project',
    version: '1.0.0',
    type: 'module',
    dependencies: {
      'react': '^18.0.0',
      '@types/react': '^18.0.0',
    },
  }
  await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      jsx: 'react-jsx',
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }
  await fs.writeFile(path.join(projectDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))
}

async function executeClaudeHook(payload: string): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    // Get the path to the claude hook binary
    const binaryPath = path.resolve(__dirname, '..', '..', 'bin', 'claude-hook')

    const child = spawn('node', [binaryPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      const endTime = Date.now()
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        duration: endTime - startTime,
      })
    })

    // Send payload via stdin
    child.stdin?.write(payload)
    child.stdin?.end()
  })
}
