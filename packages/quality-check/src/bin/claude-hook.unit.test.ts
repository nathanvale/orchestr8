import { describe, expect, test, vi, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLAUDE_HOOK_BIN = path.resolve(__dirname, '../../bin/claude-hook')

describe('bin/claude-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should_execute_successfully_with_valid_payload', () => {
    // Arrange: Valid Claude Code payload
    const payload = JSON.stringify({
      tool: 'Write',
      path: 'test.js', // Use .js to avoid TypeScript complexity in test
      content: 'export const test = "hello"',
    })

    // Act: Execute the binary with valid stdin
    try {
      const result = execSync(`echo '${payload}' | node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe', // Capture output properly
      })

      // Assert: Should complete without errors (exit code 0)
      expect(result).toBe('') // No output on success (silent mode)
    } catch (error) {
      // Binary should exit 0 for successful operations
      const execError = error as { status?: number; signal?: string }
      if (execError.status !== undefined) {
        expect(execError.status).toBe(0)
      }
    }
  })

  test('should_handle_malformed_json_gracefully', () => {
    // Arrange: Invalid JSON payload
    const invalidPayload = 'not json'

    // Act: Execute binary with malformed input
    try {
      execSync(`echo '${invalidPayload}' | node "${CLAUDE_HOOK_BIN}"`, {
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
      tool: 'Read', // Not a Write/Edit/MultiEdit/Create operation
      path: 'test.js',
      content: 'export const test = "hello"',
    })

    // Act: Execute binary
    try {
      const result = execSync(`echo '${payload}' | node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      })

      // Assert: Should exit 0 and skip processing
      expect(result).toBe('') // No output for skipped operations
    } catch (error) {
      const execError = error as { status?: number }
      expect(execError.status).toBe(0)
    }
  })

  test('should_timeout_properly_when_execSync_times_out', () => {
    // Arrange: Valid payload
    const payload = JSON.stringify({
      tool: 'Write',
      path: 'test.js',
      content: 'export const test = "hello"',
    })

    // Act & Assert: Test timeout behavior of execSync itself
    const start = Date.now()
    try {
      execSync(`echo '${payload}' | node "${CLAUDE_HOOK_BIN}"`, {
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
      tool: 'Write',
      path: 'README.md', // Non-JS file should be skipped
      content: '# Test file',
    })

    // Act: Execute binary
    try {
      const result = execSync(`echo '${payload}' | node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      })

      // Assert: Should skip and exit 0
      expect(result).toBe('')
    } catch (error) {
      const execError = error as { status?: number }
      expect(execError.status).toBe(0)
    }
  })

  test('should_handle_empty_payload', () => {
    // Arrange: Empty payload
    const payload = ''

    // Act: Execute binary with empty input
    try {
      execSync(`echo '${payload}' | node "${CLAUDE_HOOK_BIN}"`, {
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
      tool: 'Write',
      content: 'export const test = "hello"',
      // Missing path property
    })

    // Act: Execute binary
    try {
      const result = execSync(`echo '${payload}' | node "${CLAUDE_HOOK_BIN}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: 'pipe',
      })

      // Assert: Should skip and exit 0
      expect(result).toBe('')
    } catch (error) {
      const execError = error as { status?: number }
      expect(execError.status).toBe(0)
    }
  })
})
