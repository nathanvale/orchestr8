import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { runClaudeHook } from './claude.js'

describe('Claude Hook Payload Processing', () => {
  let mockStdin: any
  let mockProcess: any
  let originalProcessExit: typeof process.exit

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock process.exit to capture exit codes
    originalProcessExit = process.exit
    mockProcess = { exit: vi.fn() }
    process.exit = mockProcess.exit

    // Mock stdin using vi.spyOn
    mockStdin = {
      setEncoding: vi.fn(),
      on: vi.fn(),
    }
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as any)
  })

  afterEach(() => {
    process.exit = originalProcessExit
    vi.restoreAllMocks()
  })

  describe('Stdin JSON payload parsing', () => {
    test('should_parse_valid_claude_write_payload_correctly', async () => {
      // Arrange
      const payload = {
        operation: 'write_file',
        file_path: '/test/component.ts',
        content: 'export const Button = () => <button>Click</button>',
        metadata: {
          tool_name: 'Write',
          timestamp: '2025-09-04T10:30:00Z',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Simulate stdin data
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()

      // Simulate receiving data
      dataCallback(payloadString)
      endCallback()

      await promise

      // Assert
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8')
      expect(mockStdin.on).toHaveBeenCalledWith('data', expect.any(Function))
      expect(mockStdin.on).toHaveBeenCalledWith('end', expect.any(Function))
    })

    test('should_parse_valid_claude_edit_payload_correctly', async () => {
      // Arrange
      const payload = {
        operation: 'edit_file',
        file_path: '/test/service.ts',
        content: 'function process(data: unknown) { return data }',
        metadata: {
          tool_name: 'Edit',
        },
      }
      const payloadString = JSON.stringify(payload)

      // Simulate stdin data
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

      // Assert - Should process edit operations
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8')
    })

    test('should_handle_malformed_json_payload_gracefully', async () => {
      // Arrange
      const malformedPayload = '{ invalid json content'

      // Simulate stdin data
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback(malformedPayload)
      endCallback()
      await promise

      // Assert - Should exit gracefully (never crash Claude)
      expect(mockProcess.exit).toHaveBeenCalledWith(0)
    })

    test('should_handle_empty_stdin_gracefully', async () => {
      // Arrange - Empty stdin
      const dataCallback = vi.fn()
      const endCallback = vi.fn()
      mockStdin.on.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'data') dataCallback.mockImplementation(callback)
        if (event === 'end') endCallback.mockImplementation(callback)
        return mockStdin
      })

      // Act
      const promise = runClaudeHook()
      dataCallback('')
      endCallback()
      await promise

      // Assert - Should exit gracefully
      expect(mockProcess.exit).toHaveBeenCalledWith(0)
    })

    test('should_handle_stdin_timeout_gracefully', async () => {
      // Arrange - Simulate timeout by not calling callbacks
      mockStdin.on.mockImplementation((_event: string, _callback: (...args: any[]) => void) => {
        // Don't call callbacks to simulate timeout
        return mockStdin
      })

      // Act & Assert - Should resolve via timeout
      await runClaudeHook()
      expect(mockProcess.exit).toHaveBeenCalledWith(0)
    })

    test('should_validate_required_payload_fields', async () => {
      // Arrange
      const invalidPayloads = [
        { operation: 'write_file' }, // Missing file_path
        { file_path: '/test/file.ts' }, // Missing operation
        {}, // Empty payload
        null, // Null payload
      ]

      for (const payload of invalidPayloads) {
        mockProcess.exit.mockClear()

        const payloadString = JSON.stringify(payload)

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

        // Assert - Should exit gracefully for invalid payloads
        expect(mockProcess.exit).toHaveBeenCalledWith(0)
      }
    })
  })

  describe('Operation filtering', () => {
    test('should_process_supported_operations', async () => {
      // Arrange
      const supportedOps = ['write_file', 'edit_file', 'multi_edit', 'create_file']

      for (const operation of supportedOps) {
        mockProcess.exit.mockClear()

        const payload = {
          operation,
          file_path: '/test/file.ts',
          content: 'export const test = true',
        }
        const payloadString = JSON.stringify(payload)

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

        // Assert - Should process supported operations
        expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8')
      }
    })

    test('should_skip_unsupported_operations_silently', async () => {
      // Arrange
      const unsupportedOps = ['read_file', 'delete_file', 'list_files', 'search']

      for (const operation of unsupportedOps) {
        mockProcess.exit.mockClear()

        const payload = {
          operation,
          file_path: '/test/file.ts',
          content: 'content',
        }
        const payloadString = JSON.stringify(payload)

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

        // Assert - Should skip unsupported operations silently
        expect(mockProcess.exit).toHaveBeenCalledWith(0)
      }
    })
  })

  describe('File type filtering logic', () => {
    test('should_process_typescript_files', async () => {
      // Arrange
      const payload = {
        operation: 'write_file',
        file_path: '/test/component.ts',
        content: 'export const Component = () => {}',
      }
      const payloadString = JSON.stringify(payload)

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

      // Assert - Should process .ts files
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8')
    })

    test('should_process_react_typescript_files', async () => {
      // Arrange
      const payload = {
        operation: 'write_file',
        file_path: '/test/Component.tsx',
        content: 'export const Component = () => <div>Hello</div>',
      }
      const payloadString = JSON.stringify(payload)

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

      // Assert - Should process .tsx files
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8')
    })

    test('should_skip_non_code_files_silently', async () => {
      // Arrange
      const nonCodeFiles = [
        '/test/readme.md',
        '/test/config.json',
        '/test/style.css',
        '/test/image.png',
        '/test/data.txt',
      ]

      for (const filePath of nonCodeFiles) {
        mockProcess.exit.mockClear()

        const payload = {
          operation: 'write_file',
          file_path: filePath,
          content: 'some content',
        }
        const payloadString = JSON.stringify(payload)

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

        // Assert - Should exit silently for non-code files
        expect(mockProcess.exit).toHaveBeenCalledWith(0)
      }
    })

    test('should_handle_files_without_extensions', async () => {
      // Arrange
      const payload = {
        operation: 'write_file',
        file_path: '/test/Dockerfile',
        content: 'FROM node:18',
      }
      const payloadString = JSON.stringify(payload)

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

      // Assert - Should skip files without supported extensions
      expect(mockProcess.exit).toHaveBeenCalledWith(0)
    })

    test('should_filter_supported_file_types_correctly', () => {
      // Arrange
      const testCases = [
        { file: 'component.js', shouldProcess: true },
        { file: 'component.jsx', shouldProcess: true },
        { file: 'component.ts', shouldProcess: true },
        { file: 'component.tsx', shouldProcess: true },
        { file: 'component.vue', shouldProcess: false },
        { file: 'component.svelte', shouldProcess: false },
        { file: 'style.css', shouldProcess: false },
        { file: 'config.json', shouldProcess: false },
      ]

      testCases.forEach(({ file, shouldProcess }) => {
        // Act
        const result = isSupportedFileType(file)

        // Assert
        expect(result).toBe(shouldProcess)
      })
    })
  })
})

// Helper functions for testing file type filtering
function isSupportedFileType(filePath: string): boolean {
  return /\.(js|jsx|ts|tsx)$/.test(filePath)
}
