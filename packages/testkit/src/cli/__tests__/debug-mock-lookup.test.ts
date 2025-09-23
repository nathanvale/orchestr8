import { describe, it, expect } from 'vitest'
import { getRegistry } from '../registry.js'
import { findConfig } from '../normalize.js'
import { spawnUtils } from '../spawn.js'

describe('Debug mock lookup', () => {
  it('should find registered mock', () => {
    // Register the mock
    spawnUtils.mockCommandSuccess('echo hello', 'hello\n', '', 0)

    const registry = getRegistry()
    console.log('Registry spawnMocks after registration:')
    console.log('  Size:', registry.spawnMocks.size)
    console.log('  Keys:', Array.from(registry.spawnMocks.keys()))

    // Try different lookups
    const directLookup = registry.spawnMocks.get('echo hello')
    console.log('Direct lookup for "echo hello":', directLookup)

    // Try using findConfig
    const foundConfig = findConfig(registry.spawnMocks, 'echo hello')
    console.log('findConfig for "echo hello":', foundConfig)

    // Check what the spawn mock would see
    const commandParts = 'echo hello'
    const foundFromSpawn = findConfig(registry.spawnMocks, commandParts)
    console.log('findConfig as spawn would use:', foundFromSpawn)

    expect(directLookup).toBeDefined()
    expect(foundConfig).toBeDefined()
    expect(foundFromSpawn).toBeDefined()
  })
})
