import { describe, it, expect } from 'vitest'
import { getRegistry as getRegistryFromRegistry } from '../registry.js'
import { trackProcess as trackProcessFromRegistry } from '../registry.js'
import { MockChildProcess } from '../process-mock.js'

describe('Debug imports', () => {
  it('should verify trackProcess works', () => {
    const registry = getRegistryFromRegistry()

    console.log('Initial spawnedProcesses:', registry.spawnedProcesses.length)

    const proc = new MockChildProcess({ stdout: 'test' })
    console.log('Created process:', proc.constructor.name)

    trackProcessFromRegistry(proc)
    console.log('After trackProcess, spawnedProcesses:', registry.spawnedProcesses.length)

    expect(registry.spawnedProcesses).toHaveLength(1)
  })
})
