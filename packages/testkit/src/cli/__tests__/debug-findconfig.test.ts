import { describe, it, expect } from 'vitest'
import { getRegistry } from '../registry.js'
import { findConfig, normalize } from '../normalize.js'
import { spawnUtils } from '../spawn.js'

describe('Debug findConfig', () => {
  it('should find registered config', () => {
    // Register a mock
    spawnUtils.mockCommandSuccess('test-cmd', 'output')

    const registry = getRegistry()
    console.log('Registry spawnMocks:', Array.from(registry.spawnMocks.entries()))

    // Try to find it
    const normalizedInput = normalize('test-cmd')
    console.log('Normalized input:', normalizedInput)

    // Try findConfig
    process.env.DEBUG_TESTKIT = '1'
    const config = findConfig(registry.spawnMocks, 'test-cmd')
    console.log('Found config:', config)

    expect(config).toBeDefined()
  })
})
