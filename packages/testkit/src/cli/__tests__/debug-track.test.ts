import { describe, it, expect } from 'vitest'
import { MockChildProcess } from '../process-mock.js'
import { trackProcess, getRegistry } from '../registry.js'

describe('Debug trackProcess', () => {
  it('should track process directly', () => {
    const registry = getRegistry()
    console.log('Before track: spawnedProcesses.length =', registry.spawnedProcesses.length)

    const mockProcess = new MockChildProcess({ stdout: 'test' })
    console.log('Created process:', mockProcess.constructor.name)

    trackProcess(mockProcess)
    console.log('After track: spawnedProcesses.length =', registry.spawnedProcesses.length)
    console.log('Registry spawnedProcesses:', registry.spawnedProcesses)

    expect(registry.spawnedProcesses).toHaveLength(1)
    expect(registry.spawnedProcesses[0]).toBe(mockProcess)
  })
})
