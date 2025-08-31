/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { customMatchers, mockApiError, mockApiResponse, server } from '../vitest.setup'

/**
 * Template Smoke Tests
 *
 * Comprehensive smoke tests to verify the template's core functionality works correctly.
 * Combines the best parts of the sanity tests into a single, maintainable suite.
 */
describe('Template Smoke Tests', () => {
  describe('Core Vitest Setup', () => {
    test('basic arithmetic works', () => {
      expect(1 + 1).toBe(2)
    })

    test('supports mocking with vi', () => {
      const mockFn = vi.fn()
      mockFn('test')

      expect(mockFn).toHaveBeenCalledWith('test')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    test('supports async tests', async () => {
      const promise = Promise.resolve('success')
      await expect(promise).resolves.toBe('success')
    })

    test('supports timers', () => {
      vi.useFakeTimers()

      const callback = vi.fn()
      setTimeout(() => callback(), 1000)

      vi.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Package Resolution & Imports', () => {
    test('alias resolution works for @ paths', async () => {
      // Test that package imports resolve correctly
      const { sum } = await import('@template/utils')
      expect(sum([1, 2, 3])).toBe(6)
    })

    test('custom matchers are registered', () => {
      // Test that custom matchers from setup are available
      expect(typeof customMatchers.toBeWithinRange).toBe('function')
      expect(5).toBeWithinRange(1, 10)
    })
  })

  describe('Test Environment Setup', () => {
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

  describe('MSW Network Interception', () => {
    beforeEach(() => {
      server.resetHandlers()
    })

    test('intercepts GET requests correctly', async () => {
      const response = await fetch('/api/health')
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ status: 'ok' })
    })

    test('intercepts POST requests correctly', async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'password' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        token: 'mock-jwt-token',
        user: { id: '1', name: 'Test User' },
      })
    })

    test('supports dynamic response mocking', async () => {
      const customData = { custom: 'response', id: 456 }
      mockApiResponse('/api/custom', customData, 201)

      const response = await fetch('/api/custom')
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual(customData)
    })

    test('supports error response mocking', async () => {
      mockApiError('/api/error', 500, 'Internal Server Error')

      const response = await fetch('/api/error')
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toEqual({ error: 'Internal Server Error' })
    })

    test('logs warnings for unhandled requests', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        await fetch('/api/completely-unhandled-endpoint')
      } catch {
        // The request might fail, but we're interested in the warning
      }

      const warnCalls = warnSpy.mock.calls
      const hasUnhandledWarning = warnCalls.some((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' &&
            (arg.toLowerCase().includes('warning') || arg.toLowerCase().includes('unhandled')),
        ),
      )

      expect(hasUnhandledWarning).toBe(true)

      warnSpy.mockRestore()
    })
  })

  describe('API Edge Cases', () => {
    test('handles invalid limit parameters gracefully', async () => {
      const responses = await Promise.all([
        fetch('/api/items?limit=0'),
        fetch('/api/items?limit=-10'),
        fetch('/api/items?limit=NaN'),
        fetch('/api/items?limit=undefined'),
      ])

      responses.forEach((response) => {
        expect([200, 400]).toContain(response.status)
      })
    })

    test('handles extremely large limit values', async () => {
      const response = await fetch('/api/items?limit=999999999')

      expect(response.status).toBe(200)

      const data = await response.json()
      if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(1000)
      } else if (data.items) {
        expect(data.items.length).toBeLessThanOrEqual(1000)
      }
    })
  })
})
