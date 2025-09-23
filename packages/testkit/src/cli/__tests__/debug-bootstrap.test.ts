import { describe, it } from 'vitest'
import * as cp from 'child_process'
import { getRegistry } from '../registry.js'

describe('Debug bootstrap registry', () => {
  it('should check if mock sees registry changes', () => {
    const registry = getRegistry()

    console.log('Initial registry spawnMocks size:', registry.spawnMocks.size)

    // Add a mock directly to the registry
    registry.spawnMocks.set('direct-test', { stdout: 'direct output' })
    console.log('After direct add, size:', registry.spawnMocks.size)

    // Now try to spawn and see if it finds the mock
    console.log('Calling spawn with direct-test...')
    const proc = cp.spawn('direct-test')

    console.log('Process created:', proc !== null)
    console.log('Process type:', proc.constructor.name)

    // Check if process was tracked
    console.log('Spawned processes:', registry.spawnedProcesses.length)

    // If the process was created with the config, check its stdout
    if (proc && 'stdout' in proc) {
      console.log('Process has stdout:', proc.stdout !== null)
    }
  })
})
