import { describe, it, expect, vi } from 'vitest'
import * as cp from 'child_process'
import { getRegistry } from '../registry.js'
import { spawnUtils } from '../spawn.js'

describe('Debug spawn call', () => {
  it('should track what happens when spawn is called', () => {
    // Register a mock
    spawnUtils.mockCommandSuccess('test-command', 'output', '', 0)

    const registry = getRegistry()
    console.log('Registry before spawn:')
    console.log('  spawnMocks size:', registry.spawnMocks.size)
    console.log('  spawnedProcesses:', registry.spawnedProcesses.length)

    // Now call spawn and see what happens
    console.log('\nCalling cp.spawn...')
    const proc = cp.spawn('test-command')

    console.log('\nAfter spawn:')
    console.log('  Process created:', proc !== null)
    console.log('  Process constructor:', proc.constructor.name)
    console.log('  spawnedProcesses:', registry.spawnedProcesses.length)

    // Check if spawn was called
    if (vi.isMockFunction(cp.spawn)) {
      console.log('  spawn.mock.calls:', cp.spawn.mock.calls.length)
      console.log('  spawn.mock.results:', cp.spawn.mock.results)
    }

    // Log the actual spawned processes array
    console.log('\nActual spawnedProcesses array:', registry.spawnedProcesses)

    expect(registry.spawnedProcesses).toHaveLength(1)
  })
})
