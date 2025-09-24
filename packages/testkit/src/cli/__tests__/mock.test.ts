import * as cp from 'child_process'
import { describe, expect, it } from 'vitest'
import { commonCommands } from '../spawn.js'

describe('Direct mock test', () => {
  it('should work with direct execSync mock', () => {
    // Register a mock using common helper for consistency
    commonCommands.git.statusClean()

    // Call execSync
    const result = cp.execSync('git status')

    // Check result
    expect(result).toBeDefined()
    expect(result.toString()).toBe('nothing to commit, working tree clean')
  })
})
