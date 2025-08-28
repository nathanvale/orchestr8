import { describe, expect, test } from 'vitest'
import { customMatchers, mockApiResponse } from '../../vitest.setup'

// Fast-fail sanity test to verify core Vitest functionality
// This test ensures alias resolution, MSW, and custom matchers work correctly
describe('vitest sanity check', () => {
  test('alias resolution works for @ paths', async () => {
    // Test that package imports resolve correctly
    const { sum } = await import('@bun-template/utils')
    expect(sum([1, 2, 3])).toBe(6)
  })

  test('MSW handlers function correctly', async () => {
    // Test that MSW server responds to API calls
    mockApiResponse('/api/test', { message: 'success' }, 200)

    const response = await fetch('/api/test')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ message: 'success' })
  })

  test('custom matchers are registered', () => {
    // Test that custom matchers from setup are available
    expect(typeof customMatchers.toBeWithinRange).toBe('function')
    expect(5).toBeWithinRange(1, 10)
  })

  test('environment setup is correct', () => {
    // Verify test environment variables and globals
    expect(process.env.NODE_ENV).toBe('test')
    expect(typeof window).toBe('object')
    expect(typeof document).toBe('object')
  })

  test('DOM APIs are mocked', () => {
    // Verify browser API mocks are in place
    expect(window.matchMedia).toBeDefined()
    expect(window.localStorage).toBeDefined()
    expect(global.ResizeObserver).toBeDefined()
    expect(global.IntersectionObserver).toBeDefined()
  })
})
