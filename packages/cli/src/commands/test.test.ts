import { describe, expect, it, vi } from 'vitest'
import fs from 'fs/promises'
import { testCommand } from './test.js'

vi.mock('fs/promises')
vi.mock('@orchestr8/core', () => {
  class MockOrchestrationEngine {
    execute() {
      return Promise.resolve({
        executionId: 'test-run-id',
        status: 'completed',
        result: { data: 'test' },
      })
    }
  }

  return {
    OrchestrationEngine: MockOrchestrationEngine,
  }
})

vi.mock('@orchestr8/schema', () => {
  class MockWorkflowValidator {
    validate(data: any) {
      return {
        valid: true,
        data: {
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [],
          version: '1.0.0',
          schemaVersion: '1.0.0',
          schemaHash: 'test-hash',
          metadata: {
            id: 'test-workflow',
            name: 'Test Workflow',
            createdAt: new Date().toISOString(),
          },
        },
        errors: [],
      }
    }
  }

  return {
    WorkflowValidator: MockWorkflowValidator,
  }
})

describe('test command', () => {
  it('runs workflow tests in test directory', async () => {
    // Mock process.exit
    const exitSpy = vi.spyOn(process, 'exit')
    exitSpy.mockImplementation(() => {})
    const mockReaddir = vi.mocked(fs.readdir)
    mockReaddir.mockImplementation(() =>
      Promise.resolve([
        { name: 'workflow1.test.json', isFile: () => true },
        { name: 'workflow2.test.json', isFile: () => true },
        { name: 'not-a-test.json', isFile: () => true },
      ] as any),
    )

    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [],
          assertions: [
            {
              type: 'output',
              expected: { data: 'test' },
            },
          ],
        }),
      ),
    )

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await testCommand.parseAsync(['node', 'test'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Running 2 workflow tests'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ All tests passed'),
    )

    exitSpy.mockRestore()
  })

  it('runs specific test file', async () => {
    // Mock process.exit
    const exitSpy = vi.spyOn(process, 'exit')
    exitSpy.mockImplementation(() => {})
    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [],
          assertions: [],
        }),
      ),
    )

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await testCommand.parseAsync(['node', 'test', './my-test.json'])

    expect(mockReadFile).toHaveBeenCalledWith('./my-test.json', 'utf-8')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Testing: Test Workflow'),
    )

    exitSpy.mockRestore()
  })

  it('reports test failures', async () => {
    // Mock process.exit
    const exitSpy = vi.spyOn(process, 'exit')
    exitSpy.mockImplementation(() => {})
    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [],
          assertions: [
            {
              type: 'output',
              expected: { data: 'expected' },
            },
          ],
        }),
      ),
    )

    const consoleSpy = vi.spyOn(console, 'error')
    consoleSpy.mockImplementation(() => {})

    await testCommand.parseAsync(['node', 'test', './failing-test.json'])

    exitSpy.mockRestore()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌'))
  })
})
