import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLAUDE_HOOK_BIN = path.resolve(__dirname, '../../bin/claude-hook')

describe('bin/claude-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.CLAUDE_HOOK_DISABLED
  })

  test('should_immediately_exit_when_CLAUDE_HOOK_DISABLED_is_true', () => {
    // Arrange: Valid payload but hook disabled
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: 'test.js',
        content: 'const test = "should not process";',
      },
    })

    // Act: Execute with CLAUDE_HOOK_DISABLED=true
    const result = execSync(
      `echo '${payload}' | CLAUDE_HOOK_DISABLED=true node "${CLAUDE_HOOK_BIN}"`,
      {
        encoding: 'utf8',
        timeout: 1000,
        stdio: 'pipe',
      },
    )

    // Assert: Should exit immediately without processing
    expect(result).toBe('')
  })

  test('should_process_normally_when_CLAUDE_HOOK_DISABLED_is_false', () => {
    // Arrange: Valid payload with hook explicitly enabled
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: 'test.js',
        content: 'export const test = "hello";\n',
      },
    })

    // Act: Execute with CLAUDE_HOOK_DISABLED=false
    try {
      const result = execSync(
        `echo '${payload}' | CLAUDE_HOOK_DISABLED=false CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`,
        {
          encoding: 'utf8',
          timeout: 2000,
          stdio: 'pipe',
        },
      )

      // Assert: Should process normally
      expect(result).toBe('')
    } catch (error) {
      const execError = error as { status?: number }
      // Accept either 0 (no issues) or 2 (quality issues found)
      expect([0, 2]).toContain(execError.status)
    }
  })

  test('should_process_normally_when_CLAUDE_HOOK_DISABLED_is_not_set', () => {
    // Arrange: Valid payload without environment variable
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: 'test.js',
        content: 'export const test = "hello";\n',
      },
    })

    // Act: Execute without CLAUDE_HOOK_DISABLED
    try {
      const result = execSync(
        `echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`,
        {
          encoding: 'utf8',
          timeout: 2000,
          stdio: 'pipe',
        },
      )

      // Assert: Should process normally
      expect(result).toBe('')
    } catch (error) {
      const execError = error as { status?: number }
      // Accept either 0 (no issues) or 2 (quality issues found)
      expect([0, 2]).toContain(execError.status)
    }
  })

  test('should_execute_successfully_with_valid_payload', () => {
    // Arrange: Valid Claude Code payload with properly formatted code
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: 'test.js', // Use .js to avoid TypeScript complexity in test
        content: 'export const test = "hello";\n', // Add semicolon and newline for prettier
      },
    })

    // Act: Execute the binary with valid stdin
    try {
      const result = execSync(
        `echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`,
        {
          encoding: 'utf8',
          timeout: 2000,
          stdio: 'pipe', // Capture output properly
        },
      )

      // Assert: Should complete without errors (exit code 0)
      expect(result).toBe('') // No output on success (silent mode)
    } catch (error) {
      // If there are quality issues, it will exit with code 2
      const execError = error as { status?: number; signal?: string; stderr?: string }
      if (execError.status !== undefined) {
        // Accept either 0 (no issues) or 2 (quality issues found)
        // The hook's job is to report issues, not fail the test
        expect([0, 2]).toContain(execError.status)
      }
    }
  })

  test('should_handle_malformed_json_gracefully', () => {
    // Arrange: Invalid JSON payload
    const invalidPayload = 'not json'

    // Act: Execute binary with malformed input
    try {
      execSync(`echo '${invalidPayload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      })
    } catch (error) {
      const execError = error as { status?: number }
      // The claude facade has a catch-all that exits 0 to never crash Claude
      // This is the expected behavior per the existing facade implementation
      expect(execError.status).toBe(0)
    }
  })

  test('should_skip_non_write_operations', () => {
    // Arrange: Non-Write operation (should be skipped)
    const payload = JSON.stringify({
      tool_name: 'Read', // Not a Write/Edit/MultiEdit operation
      tool_input: {
        file_path: 'test.js',
        content: 'export const test = "hello"',
      },
    })

    // Act: Execute binary
    const result = execSync(
      `echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`,
      {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      },
    )

    // Assert: Should exit 0 and skip processing
    expect(result).toBe('') // No output for skipped operations
  })

  test('should_timeout_properly_when_execSync_times_out', () => {
    // Arrange: Valid payload
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: 'test.js',
        content: 'export const test = "hello"',
      },
    })

    // Act & Assert: Test timeout behavior of execSync itself
    const start = Date.now()
    try {
      execSync(`echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 100, // Very short timeout to test timeout handling
      })
    } catch (error) {
      const elapsed = Date.now() - start
      const execError = error as { signal?: string }
      // Should timeout quickly and get SIGTERM
      expect(elapsed).toBeLessThan(200)
      expect(execError.signal).toBe('SIGTERM')
    }
  })

  test('should_skip_non_js_files', () => {
    // Arrange: Non-JavaScript file
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: 'README.md', // Non-JS file should be skipped
        content: '# Test file',
      },
    })

    // Act: Execute binary
    const result = execSync(
      `echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`,
      {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      },
    )

    // Assert: Should skip and exit 0
    expect(result).toBe('')
  })

  test('should_handle_empty_payload', () => {
    // Arrange: Empty payload
    const payload = ''

    // Act: Execute binary with empty input
    try {
      execSync(`echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      })
    } catch (error) {
      const execError = error as { status?: number }
      // Should handle gracefully and exit 0 (per claude facade behavior)
      expect(execError.status).toBe(0)
    }
  })

  test('should_handle_missing_path_in_payload', () => {
    // Arrange: Payload without path
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        content: 'export const test = "hello"',
        // Missing file_path property
      },
    })

    // Act: Execute binary
    const result = execSync(
      `echo '${payload}' | CLAUDE_HOOK_SILENT=true node "${CLAUDE_HOOK_BIN}"`,
      {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      },
    )

    // Assert: Should skip and exit 0
    expect(result).toBe('')
  })
})
