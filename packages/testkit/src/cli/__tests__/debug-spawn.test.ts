import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import * as cp from 'child_process'
import { getRegistry } from '../registry.js'
import { spawnUtils } from '../spawn.js'

describe('Debug spawn registry', () => {
  beforeAll(() => {
    console.log('Child process spawn:', typeof cp.spawn)
  })

  afterEach(() => {
    spawnUtils.restore()
  })

  it('should register and find mock correctly', () => {
    // Register the mock
    console.log('BEFORE registration:')
    const registry = getRegistry()
    console.log('  Registry spawnMocks size:', registry.spawnMocks.size)

    spawnUtils.mockCommandSuccess('echo hello', 'hello\n', '', 0)

    console.log('AFTER registration:')
    console.log('  Registry spawnMocks size:', registry.spawnMocks.size)
    console.log('  Registry spawnMocks keys:', Array.from(registry.spawnMocks.keys()))

    // Check if mock can be found
    const mockConfig = registry.spawnMocks.get('echo hello')
    console.log('  Found mock config:', mockConfig)

    // Try to spawn
    console.log('SPAWNING command...')
    const proc = cp.spawn('echo', ['hello'])
    console.log('  Process created:', proc !== null)
    console.log('  Process is MockChildProcess:', proc.constructor.name)

    // Check spawned processes
    console.log('CHECKING spawned processes:')
    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    console.log('  Registry spawnedProcesses:', registry.spawnedProcesses.length)
    console.log('  spawnUtils.getSpawnedProcesses():', spawnedProcesses.length)

    expect(spawnedProcesses).toHaveLength(1)
  })
})
