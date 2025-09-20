import { describe, it, expect, vi } from 'vitest'

// Mock child_process before importing it
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
  execSync: vi.fn(),
  fork: vi.fn(),
}))

import * as cp from 'child_process'
import { setupChildProcessMocks } from '../process-mock.js'
import { spawnUtils } from '../spawn.js'

// Setup mocks
setupChildProcessMocks(cp)

describe('Direct mock test', () => {
  it('should work with direct execSync mock', () => {
    // Register a mock
    spawnUtils.mockCommandSuccess('git status', 'nothing to commit')

    // Call execSync
    const result = cp.execSync('git status')

    // Check result
    expect(result).toBeDefined()
    expect(result.toString()).toBe('nothing to commit')
  })
})
