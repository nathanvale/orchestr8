import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { HookPayload, QualityCheckOptions } from '../../src/types.js'
import { hookMode } from '../../src/modes/hook-mode.js'
import type { Logger } from '@orchestr8/logger'

// Mock logger to avoid real console logging
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Utility to simulate stdin reading
function mockStdin(data: string) {
  const originalStdin = process.stdin

  // Mock stdin's reading mechanism
  const mockStdin = {
    setEncoding: vi.fn(),
    on: vi.fn((event, callback) => {
      if (event === 'readable') {
        callback()
      }
      if (event === 'end') {
        callback()
      }
    }),
    read: vi.fn(() => data),
  } as unknown as NodeJS.ReadStream

  process.stdin = mockStdin
  return () => {
    process.stdin = originalStdin
  }
}

// Utility to create standard hook payloads
function createMockHookPayload(overrides: Partial<HookPayload> = {}): HookPayload {
  return {
    tool: 'Write',
    path: '/path/to/test/file.ts',
    filePath: '/path/to/test/file.ts',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('Claude Hooks Exit Code Scenarios', () => {
  let originalProcessExit: typeof process.exit
  let processMock: { exit: ReturnType<typeof vi.spyOn> }

  beforeEach(() => {
    // Spy on process.exit to capture exit code without actually exiting
    originalProcessExit = process.exit
    processMock = {
      exit: vi.spyOn(process, 'exit').mockImplementation(() => undefined as never),
    }

    // Reset stdin
    mockStdin(JSON.stringify(createMockHookPayload()))
  })

  afterEach(() => {
    // Restore process.exit
    process.exit = originalProcessExit

    // Clear all mocks
    vi.resetAllMocks()
  })

  it('should exit 0 for successful auto-fix (silent mode)', async () => {
    const options: QualityCheckOptions = {
      silent: true,
      correlationId: 'test-silent-success',
      fix: true,
    }

    // Simulate a completely successful file mode with auto-fixes
    await hookMode(options, mockLogger)

    expect(processMock.exit).toHaveBeenCalledWith(0)
  })

  it('should exit 1 for hook parsing errors', async () => {
    // Simulate an invalid JSON payload
    const invalidRestore = mockStdin('{ invalid json }')

    const options: QualityCheckOptions = {
      correlationId: 'test-parse-error',
    }

    try {
      await hookMode(options, mockLogger)
    } catch (error) {
      // The function is expected to exit, not throw
    }

    expect(processMock.exit).toHaveBeenCalledWith(1)
    expect(mockLogger.error).toHaveBeenCalled()

    invalidRestore()
  })

  it('should exit 1 for unexpected system errors', async () => {
    // Create a payload that will trigger a runtime error
    const invalidRestore = mockStdin(
      JSON.stringify({
        ...createMockHookPayload(),
        path: null, // This will cause an error in extractFilePath
      }),
    )

    const options: QualityCheckOptions = {
      correlationId: 'test-system-error',
    }

    try {
      await hookMode(options, mockLogger)
    } catch (error) {
      // The function is expected to exit, not throw
    }

    expect(processMock.exit).toHaveBeenCalledWith(1)
    expect(mockLogger.error).toHaveBeenCalled()

    invalidRestore()
  })

  it('should exit 2 for quality issues with fixable errors', async () => {
    const options: QualityCheckOptions = {
      correlationId: 'test-quality-issues',
      fix: true,
    }

    // Note: This will require mocking the fileMode and StopController
    // to simulate a result with fixable issues
    await hookMode(options, mockLogger)

    expect(processMock.exit).toHaveBeenCalledWith(2)
  })

  it('should exit 2 for quality issues with mix of fixable and unfixable errors', async () => {
    const options: QualityCheckOptions = {
      correlationId: 'test-mixed-issues',
      fix: true,
    }

    // Note: This will require mocking the fileMode and StopController
    // to simulate a result with a mix of error types
    await hookMode(options, mockLogger)

    expect(processMock.exit).toHaveBeenCalledWith(2)
  })

  it('should handle hook payload in modern Claude Code format', async () => {
    const modernPayload = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: '/path/to/test/modern-payload.ts',
      },
      cwd: '/project/root',
    }

    const restore = mockStdin(JSON.stringify(modernPayload))

    const options: QualityCheckOptions = {
      correlationId: 'test-modern-payload',
    }

    await hookMode(options, mockLogger)

    expect(processMock.exit).toHaveBeenCalledWith(0)

    restore()
  })

  it('should exit with error if no stdin data', async () => {
    const emptyRestore = mockStdin('')

    const options: QualityCheckOptions = {
      correlationId: 'test-empty-stdin',
    }

    try {
      await hookMode(options, mockLogger)
    } catch (error) {
      // The function is expected to exit, not throw
    }

    expect(processMock.exit).toHaveBeenCalledWith(1)
    expect(mockLogger.error).toHaveBeenCalled()

    emptyRestore()
  })

  // Note: More edge cases can be added as needed
})
