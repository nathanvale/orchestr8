import { describe, it, expect } from 'vitest'
import * as cp from 'child_process'
import { spawnUtils } from '../spawn.js'

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
