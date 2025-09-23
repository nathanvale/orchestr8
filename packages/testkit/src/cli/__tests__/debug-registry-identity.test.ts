import { describe, it } from 'vitest'
import * as cp from 'child_process'
import { getRegistry } from '../registry.js'
import { spawnUtils } from '../spawn.js'

describe('Debug registry identity', () => {
  it('should use same registry instance', () => {
    // Get registry from our side
    const ourRegistry = getRegistry()
    console.log('Our registry ID:', ourRegistry)

    // Register a mock
    spawnUtils.mockCommandSuccess('test-command', 'output', '', 0)
    console.log('Our registry after registration:', ourRegistry.spawnMocks.size)

    // Now check what the mocked child_process sees
    console.log('cp.spawn type:', typeof cp.spawn)
    console.log('cp.spawn toString:', cp.spawn.toString().substring(0, 100))

    // Check if the mock has access to __processMockRegistry
    const mockedModule = cp as any
    if (mockedModule.__processMockRegistry) {
      console.log('Mock registry found:', mockedModule.__processMockRegistry)
      console.log(
        'Mock registry spawnMocks size:',
        mockedModule.__processMockRegistry.spawnMocks.size,
      )
      console.log('Same registry?', mockedModule.__processMockRegistry === ourRegistry)
    } else {
      console.log('No __processMockRegistry found on mocked module')
    }

    // Try spawning to see what happens
    const proc = cp.spawn('test-command')
    console.log('Process created:', proc !== null)

    const spawnedProcesses = spawnUtils.getSpawnedProcesses()
    console.log('Spawned processes:', spawnedProcesses.length)
  })
})
