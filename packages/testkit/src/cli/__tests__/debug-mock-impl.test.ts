import { describe, it, vi } from 'vitest'
import * as cp from 'child_process'

describe('Debug mock implementation', () => {
  it('should check mock implementation', () => {
    console.log('cp.spawn is mock?', vi.isMockFunction(cp.spawn))

    if (vi.isMockFunction(cp.spawn)) {
      const mockImpl = cp.spawn.getMockImplementation()
      console.log('Mock implementation exists?', mockImpl !== undefined)
      console.log('Mock implementation type:', typeof mockImpl)
      console.log('Mock implementation first 300 chars:', mockImpl?.toString().substring(0, 300))

      // Check if our debug code is in there
      const implStr = mockImpl?.toString() || ''
      console.log('Contains "[spawn mock]"?', implStr.includes('[spawn mock]'))
      console.log('Contains "DEBUG_TESTKIT"?', implStr.includes('DEBUG_TESTKIT'))
    }
  })
})
