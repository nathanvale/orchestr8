import { describe, expect, it, vi } from 'vitest'
import fs from 'fs/promises'
import { runCommand } from './run.js'
import type { OrchestrationEngine } from '@orchestr8/core'

vi.mock('fs/promises')
vi.mock('@orchestr8/core', () => {
  class MockOrchestrationEngine {
    execute() {
      return Promise.resolve({
        executionId: 'test-run-id',
        status: 'completed',
        output: { data: 'test result' },
      })
    }
  }

  class MockJsonExecutionModel {
    serializeWorkflow(workflow: any) {
      return {
        id: workflow.id,
        name: workflow.name,
        steps: workflow.steps || [],
      }
    }
  }

  return {
    OrchestrationEngine: MockOrchestrationEngine,
    JsonExecutionModel: MockJsonExecutionModel,
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

describe('run command', () => {
  it('executes workflow from JSON file', async () => {
    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [
            {
              id: 'step1',
              name: 'First Step',
              type: 'action',
              agentId: 'test-agent',
              input: { message: 'hello' },
            },
          ],
        }),
      ),
    )

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await runCommand.parseAsync(['node', 'test', './workflow.json'])

    expect(mockReadFile).toHaveBeenCalledWith('./workflow.json', 'utf-8')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Executing workflow: Test Workflow'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ Workflow completed'),
    )
  })

  it('validates workflow before execution', async () => {
    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() => Promise.resolve('{ invalid json'))

    // Mock process.exit for test environment
    const exitSpy = vi.spyOn(process, 'exit')
    exitSpy.mockImplementation(() => {
      throw new Error('process.exit called')
    })

    const consoleSpy = vi.spyOn(console, 'error')
    consoleSpy.mockImplementation(() => {})

    try {
      await runCommand.parseAsync(['node', 'test', './invalid.json'])
    } catch (error) {
      // Expected to throw due to mocked process.exit
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse workflow'),
    )
  })

  it('saves execution result when output specified', async () => {
    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [],
        }),
      ),
    )

    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    await runCommand.parseAsync([
      'node',
      'test',
      './workflow.json',
      '--output',
      './result.json',
    ])

    expect(mockWriteFile).toHaveBeenCalledWith(
      './result.json',
      expect.stringContaining('"runId": "test-run-id"'),
      'utf-8',
    )
  })

  it('watches workflow file for changes', async () => {
    const mockReadFile = vi.mocked(fs.readFile)
    mockReadFile.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({
          id: 'test-workflow',
          name: 'Test Workflow',
          steps: [],
        }),
      ),
    )

    // Mock fs.watch to prevent actual file watching
    // Mock fs.watch
    const mockWatch = vi.fn().mockReturnValue({
      close: vi.fn(),
    })
    vi.doMock('fs', () => ({
      watch: mockWatch,
    }))

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    // Mock process.on to handle the keep-alive promise
    const processOnSpy = vi.spyOn(process, 'on')
    processOnSpy.mockImplementation((event, handler) => {
      if (event === 'SIGINT') {
        // Immediately call handler to exit
        setTimeout(() => handler(), 0)
      }
      return process
    })

    const exitSpy = vi.spyOn(process, 'exit')
    exitSpy.mockImplementation(() => {
      throw new Error('process.exit called')
    })

    try {
      await runCommand.parseAsync([
        'node',
        'test',
        './workflow.json',
        '--watch',
      ])
    } catch (error) {
      // Expected to exit
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Watching for changes'),
    )
  })
})
