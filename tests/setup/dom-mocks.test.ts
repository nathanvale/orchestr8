/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

describe('DOM Mock Environment Checks', () => {
  test('should only mock browser APIs in test environment', () => {
    expect(process.env['VITEST']).toBe('true')
    expect(process.env.NODE_ENV).toBe('test')
  })

  test('should have matchMedia mock available', () => {
    expect(window.matchMedia).toBeDefined()
    expect(typeof window.matchMedia).toBe('function')

    const mediaQuery = window.matchMedia('(max-width: 768px)')
    expect(mediaQuery).toHaveProperty('matches')
    expect(mediaQuery).toHaveProperty('media')
    expect(mediaQuery).toHaveProperty('addListener')
    expect(mediaQuery).toHaveProperty('removeListener')
  })

  test('should have ResizeObserver mock available', () => {
    expect(window.ResizeObserver).toBeDefined()
    expect(typeof window.ResizeObserver).toBe('function')

    const observer = new window.ResizeObserver(vi.fn())
    expect(observer).toHaveProperty('observe')
    expect(observer).toHaveProperty('unobserve')
    expect(observer).toHaveProperty('disconnect')
  })

  test('should have IntersectionObserver mock available', () => {
    expect(window.IntersectionObserver).toBeDefined()
    expect(typeof window.IntersectionObserver).toBe('function')

    const observer = new window.IntersectionObserver(vi.fn())
    expect(observer).toHaveProperty('observe')
    expect(observer).toHaveProperty('unobserve')
    expect(observer).toHaveProperty('disconnect')
  })

  test('should have localStorage mock available', () => {
    expect(window.localStorage).toBeDefined()
    expect(window.localStorage).toHaveProperty('getItem')
    expect(window.localStorage).toHaveProperty('setItem')
    expect(window.localStorage).toHaveProperty('removeItem')
    expect(window.localStorage).toHaveProperty('clear')
  })

  test('should have sessionStorage mock available', () => {
    expect(window.sessionStorage).toBeDefined()
    expect(window.sessionStorage).toHaveProperty('getItem')
    expect(window.sessionStorage).toHaveProperty('setItem')
    expect(window.sessionStorage).toHaveProperty('removeItem')
    expect(window.sessionStorage).toHaveProperty('clear')
  })

  test('should have configurable mock properties', () => {
    // Test that mocks are configurable for cleanup
    const originalMatchMedia = window.matchMedia

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })

    expect(window.matchMedia('(min-width: 768px)')).toEqual({ matches: true })

    // Restore original
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    })
  })

  describe('Mock Clearing Verification', () => {
    let mockFn: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockFn = vi.fn()
    })

    test('should clear mocks between tests - first test', () => {
      mockFn('test1')
      expect(mockFn).toHaveBeenCalledWith('test1')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    test('should clear mocks between tests - second test', () => {
      // This should start with a clean mock state
      expect(mockFn).toHaveBeenCalledTimes(0)
      mockFn('test2')
      expect(mockFn).toHaveBeenCalledWith('test2')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })
})
