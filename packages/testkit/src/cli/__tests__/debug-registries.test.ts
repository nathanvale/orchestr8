import { describe, it } from 'vitest'
import * as cp from 'child_process'
import { getRegistry } from '../registry.js'
import { spawnUtils } from '../spawn.js'

describe('Debug multiple registries', () => {
  it('should check registry instances', () => {
    // Check global before any registration
    console.log('Global registry before:', globalThis.__testkit_process_mock_registry__)

    // Get registry and add to it
    const registry1 = getRegistry()
    console.log('Registry1 instance ID:', registry1)
    console.log('Global registry after getRegistry:', globalThis.__testkit_process_mock_registry__)
    console.log('Same instance?', registry1 === globalThis.__testkit_process_mock_registry__)

    // Use spawnUtils to register a mock
    spawnUtils.mockCommandSuccess('test-cmd', 'output')
    console.log('After spawnUtils.mockCommandSuccess:')
    console.log('  Registry1 spawnMocks size:', registry1.spawnMocks.size)
    console.log(
      '  Global spawnMocks size:',
      globalThis.__testkit_process_mock_registry__?.spawnMocks.size,
    )

    // Try to spawn and see which registry the mock uses
    console.log('\nSpawning test-cmd...')
    cp.spawn('test-cmd')

    // Check registry state after spawn
    const registry2 = getRegistry()
    console.log('\nAfter spawn:')
    console.log('  Registry1 === Registry2?', registry1 === registry2)
    console.log('  Registry2 spawnMocks size:', registry2.spawnMocks.size)
    console.log('  Registry2 spawnedProcesses:', registry2.spawnedProcesses.length)
    console.log(
      '  Global spawnedProcesses:',
      globalThis.__testkit_process_mock_registry__?.spawnedProcesses.length,
    )
  })
})
