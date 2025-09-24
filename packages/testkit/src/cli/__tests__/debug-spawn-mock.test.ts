import { describe, it, expect, vi } from 'vitest'
import * as cp from 'child_process'
import { getRegistry } from '../registry.js'
import { spawnUtils } from '../spawn.js'

describe('Debug spawn mock', () => {
  it('should debug spawn mock execution', () => {
    console.log('Starting test...')
    console.log('cp.spawn is mock?', vi.isMockFunction(cp.spawn))

    // Register a mock
    spawnUtils.mockCommandSuccess('echo hello', 'hello\n', '', 0)

    const registry = getRegistry()
    console.log('Registry spawnMocks after registration:', registry.spawnMocks.size)
    console.log('Keys:', Array.from(registry.spawnMocks.keys()))

    // Now spawn and log what happens
    console.log('\nCalling spawn...')

    // Add temporary debugging to understand what's happening in the mock
    const originalWarn = console.warn
    console.warn = (...args) => {
      console.log('[WARN INTERCEPTED]:', ...args)
      // Check registry state when warning is issued
      const reg = getRegistry()
      console.log('  Registry at warn time - size:', reg.spawnMocks.size)
      console.log('  Registry at warn time - keys:', Array.from(reg.spawnMocks.keys()))
      originalWarn(...args)
    }

    const proc = cp.spawn('echo', ['hello'])

    console.warn = originalWarn

    console.log('Process created:', proc !== null)
    console.log('Registry spawnedProcesses:', registry.spawnedProcesses.length)

    expect(registry.spawnedProcesses).toHaveLength(1)
  })
})
