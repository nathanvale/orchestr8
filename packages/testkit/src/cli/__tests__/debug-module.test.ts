import { describe, it, expect } from 'vitest'
import { getRegistry as getRegistryDirect } from '../registry.js'

describe('Debug module loading', () => {
  it('should check registry singleton', () => {
    console.log('Getting registry directly...')
    const registry1 = getRegistryDirect()
    const registry2 = getRegistryDirect()

    console.log('Same instance?', registry1 === registry2)
    console.log('Registry1:', registry1)
    console.log('Registry2:', registry2)

    // Add something to registry1
    registry1.spawnMocks.set('test-key', { stdout: 'test' })

    // Check if registry2 sees it
    console.log('Registry2 sees the change?', registry2.spawnMocks.has('test-key'))

    expect(registry1).toBe(registry2)
    expect(registry2.spawnMocks.has('test-key')).toBe(true)
  })
})
