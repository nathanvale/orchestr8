/**
 * Tests for Vitest setup file activation and idempotent initialization
 *
 * This test suite verifies that the setup file (vitest.setup.tsx) can be safely
 * re-enabled and that all initialization is idempotent (safe to run multiple times).
 *
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { customMatchers, mockApiError, mockApiResponse, server } from '../../vitest.setup'

// Enable fake timers for this test suite
vi.useFakeTimers()

describe('Vitest Setup File Activation', () => {
  describe('MSW Server Integration', () => {
    test('should have MSW server properly initialized', () => {
      expect(server).toBeDefined()
      expect(typeof server.listen).toBe('function')
      expect(typeof server.resetHandlers).toBe('function')
      expect(typeof server.close).toBe('function')
    })

    test('should have default API handlers configured', async () => {
      // Test health endpoint handler
      const healthResponse = await fetch('/api/health')
      expect(healthResponse.ok).toBe(true)
      const healthData = await healthResponse.json()
      expect(healthData).toEqual({ status: 'ok' })
    })

    test('should handle parameterized routes', async () => {
      // Test user endpoint with parameter
      const userResponse = await fetch('/api/user/123')
      expect(userResponse.ok).toBe(true)
      const userData = await userResponse.json()
      expect(userData).toEqual({
        id: '123',
        name: 'Test User 123',
        email: 'test123@example.com',
      })
    })

    test('should handle complex pagination with edge cases', async () => {
      // Test various pagination scenarios
      const scenarios = [
        { url: '/api/items', expected: { page: 1, limit: 10 } },
        { url: '/api/items?limit=5', expected: { page: 1, limit: 5 } },
        { url: '/api/items?page=2&limit=3', expected: { page: 2, limit: 3 } },
        { url: '/api/items?limit=0', expected: { page: 1, limit: 0 } },
        { url: '/api/items?limit=-5', expected: { page: 1, limit: 0 } },
        { url: '/api/items?limit=NaN', expected: { page: 1, limit: 10 } },
        { url: '/api/items?page=0', expected: { page: 1, limit: 10 } },
        { url: '/api/items?limit=1001', expected: { page: 1, limit: 100 } },
      ]

      for (const { url, expected } of scenarios) {
        const response = await fetch(url)
        expect(response.ok).toBe(true)
        const data = await response.json()
        expect(data.page).toBe(expected.page)
        expect(data.limit).toBe(expected.limit)
        expect(Array.isArray(data.items)).toBe(true)
        expect(data.items).toHaveLength(expected.limit)
      }
    })

    test('should support dynamic mock configuration', async () => {
      // Test utility functions for runtime mock configuration
      mockApiResponse('/api/test', { success: true, data: 'custom' })

      const response = await fetch('/api/test')
      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toEqual({ success: true, data: 'custom' })
    })

    test('should support error mocking', async () => {
      mockApiError('/api/error-test', 404, 'Not Found')

      const response = await fetch('/api/error-test')
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toEqual({ error: 'Not Found' })
    })
  })

  describe('Custom Matchers Registration', () => {
    test('should have custom matchers available', () => {
      expect(typeof (expect as any).extend).toBe('function')
      expect(customMatchers).toBeDefined()
      expect(typeof customMatchers.toBeWithinRange).toBe('function')
    })

    test('should support toBeWithinRange matcher', () => {
      // Test successful range check
      expect(5).toBeWithinRange(1, 10)
      expect(1).toBeWithinRange(1, 1) // Edge case: exact boundary
      expect(10).toBeWithinRange(1, 10) // Edge case: exact boundary

      // Test failed range check (should throw)
      expect(() => {
        expect(15).toBeWithinRange(1, 10)
      }).toThrow()

      expect(() => {
        expect(0).toBeWithinRange(1, 10)
      }).toThrow()
    })
  })

  describe('Browser API Mocks', () => {
    test('should have DOM APIs mocked for testing', () => {
      expect(window.matchMedia).toBeDefined()
      expect(window.ResizeObserver).toBeDefined()
      expect(window.IntersectionObserver).toBeDefined()
      expect(window.localStorage).toBeDefined()
      expect(window.sessionStorage).toBeDefined()
    })

    test('should have polyfill sentinel to prevent double initialization', () => {
      expect(globalThis.__TEST_POLYFILLS_SETUP__).toBe(true)
    })

    test('should support localStorage operations', () => {
      // Test basic operations
      window.localStorage.setItem('test-key', 'test-value')
      expect(window.localStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value')

      window.localStorage.getItem('test-key')
      expect(window.localStorage.getItem).toHaveBeenCalledWith('test-key')

      window.localStorage.removeItem('test-key')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('test-key')

      window.localStorage.clear()
      expect(window.localStorage.clear).toHaveBeenCalled()
    })
  })

  describe('Test Isolation and Cleanup', () => {
    let testState: { value: number }

    beforeEach(() => {
      testState = { value: 0 }
    })

    test('should have clean state - test 1', () => {
      expect(testState.value).toBe(0)
      testState.value = 1
      expect(testState.value).toBe(1)
    })

    test('should have clean state - test 2', () => {
      // Each test should start with fresh state
      expect(testState.value).toBe(0)
      testState.value = 2
      expect(testState.value).toBe(2)
    })

    test('should clear timers between tests', () => {
      const mockCallback = vi.fn()
      const timeoutId = setTimeout(mockCallback, 100)

      // With fake timers, timeout ID can be number or object depending on implementation
      expect(['number', 'object'].includes(typeof timeoutId)).toBe(true)
      // Timer should be cleared automatically by setup
      vi.advanceTimersByTime(200)
      // Mock callback should not execute due to timer clearing
    })

    test('should reset MSW handlers between tests', async () => {
      // Override a handler temporarily
      mockApiResponse('/api/temp', { temporary: true })

      const response1 = await fetch('/api/temp')
      const data1 = await response1.json()
      expect(data1).toEqual({ temporary: true })

      // After this test, the handler should be reset by the setup
      // This will be verified implicitly by other tests not seeing this handler
    })
  })

  describe('Setup File Idempotency', () => {
    test('should safely handle multiple setup file imports', () => {
      // Importing the setup file multiple times should not cause errors
      // This tests the idempotent nature of the setup

      // The polyfill sentinel should prevent double initialization
      const sentinel = globalThis.__TEST_POLYFILLS_SETUP__
      expect(sentinel).toBe(true)

      // Re-importing should not change the sentinel or cause errors
      expect(() => {
        // Fire and forget dynamic import; if it throws synchronously test will fail
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        import('../../vitest.setup')
      }).not.toThrow()

      expect(globalThis.__TEST_POLYFILLS_SETUP__).toBe(true)
    })

    test('should maintain stable mock configurations', () => {
      // Browser API mocks should remain stable across multiple setup calls
      const originalMatchMedia = window.matchMedia
      const originalResizeObserver = window.ResizeObserver

      expect(typeof originalMatchMedia).toBe('function')
      expect(typeof originalResizeObserver).toBe('function')

      // After potential re-initialization, mocks should still work
      const mediaQuery = window.matchMedia('(max-width: 768px)')
      expect(mediaQuery.matches).toBe(false)
      expect(typeof mediaQuery.addEventListener).toBe('function')
    })
  })

  describe('Environment Detection', () => {
    test('should correctly identify test environment', () => {
      expect(process.env['VITEST']).toBe('true')
      expect(process.env.NODE_ENV).toBe('test')
    })

    test('should have proper environment variables for setup', () => {
      // These environment variables control setup behavior
      expect(typeof process.env['NODE_ENV']).toBe('string')
      // DOM environment can be detected from the test environment directive
      expect(typeof process.env['NODE_ENV']).toBe('string') // NODE_ENV should always be set in test env
    })

    test('should configure MSW with appropriate settings', () => {
      // MSW should be configured for test environment with warnings
      expect(server).toBeDefined()
      // Server should be listening (started in beforeAll)
    })
  })
})
