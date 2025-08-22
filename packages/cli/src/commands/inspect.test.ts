import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'

// Mock fs/promises
vi.mock('fs/promises')

// Mock @orchestr8/core - must be done before import
vi.mock('@orchestr8/core', () => {
  const mockJournal = {
    getExecutionIds: vi.fn(() => ['test-run-id']),
    exportExecution: vi.fn((id) => {
      if (id === 'test-run-id') {
        return {
          executionId: 'test-run-id',
          workflowId: 'test-workflow',
          startTime: Date.parse('2025-01-01T00:00:00Z'),
          endTime: Date.parse('2025-01-01T00:00:10Z'),
          duration: 10000,
          entries: [
            {
              timestamp: Date.parse('2025-01-01T00:00:01Z'),
              stepId: 'step1',
              type: 'step.started',
              data: {},
            },
            {
              timestamp: Date.parse('2025-01-01T00:00:05Z'),
              stepId: 'step1',
              type: 'step.completed',
              data: { output: { data: 'test' } },
            },
          ],
          summary: {
            totalEvents: 2,
            stepCount: 1,
            retryCount: 0,
            errorCount: 0,
            status: 'completed',
          },
        }
      }
      return null
    }),
  }

  return {
    JournalManager: {
      getGlobalJournal: vi.fn(() => mockJournal),
    },
  }
})

import { inspectCommand } from './inspect.js'

describe('inspect command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays execution details for given run ID', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await inspectCommand.parseAsync(['node', 'test', 'test-run-id'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Execution Details'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Run ID: test-run-id'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Workflow: test-workflow'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Status: ✅ completed'),
    )
  })

  it('shows step details with verbose flag', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await inspectCommand.parseAsync([
      'node',
      'test',
      'test-run-id',
      '--verbose',
    ])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Step Details:'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('step1'))
  })

  it('exports execution to JSON file', async () => {
    const mockWriteFile = vi.mocked(fs.writeFile)
    mockWriteFile.mockImplementation(() => Promise.resolve())

    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await inspectCommand.parseAsync([
      'node',
      'test',
      'test-run-id',
      '--export',
      './execution.json',
    ])

    expect(mockWriteFile).toHaveBeenCalledWith(
      './execution.json',
      expect.stringContaining('"test-run-id"'),
      'utf-8',
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exported to: ./execution.json'),
    )
  })

  it('lists all executions when no run ID provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await inspectCommand.parseAsync(['node', 'test'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Recent Executions:'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('test-run-id'),
    )
  })

  it('shows timeline view with timeline flag', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    consoleSpy.mockImplementation(() => {})

    await inspectCommand.parseAsync([
      'node',
      'test',
      'test-run-id',
      '--timeline',
    ])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Execution Timeline:'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\d{2}:\d{2}:\d{2}/),
    )
  })
})
