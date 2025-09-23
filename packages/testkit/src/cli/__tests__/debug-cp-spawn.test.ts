import { describe, it, vi } from 'vitest'
import * as cp from 'child_process'

describe('Debug cp.spawn', () => {
  it('should check what cp.spawn is', () => {
    console.log('Type of cp.spawn:', typeof cp.spawn)
    console.log('Is mock function?', vi.isMockFunction(cp.spawn))
    console.log('Constructor name:', cp.spawn.constructor.name)
    console.log('Function toString (first 200 chars):', cp.spawn.toString().substring(0, 200))

    // Try calling it
    console.log('\nCalling cp.spawn("test")...')
    const result = cp.spawn('test')
    console.log('Result type:', typeof result)
    console.log('Result constructor:', result?.constructor?.name)
  })
})
