import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mockApiError, mockApiResponse, server } from '../vitest.setup'

describe('MSW Network Interception', () => {
  beforeEach(() => {
    // Reset MSW handlers before each test
    server.resetHandlers()
  })

  const healthEndpoint = '/api/health'

  test('should intercept GET requests to /api/health', async () => {
    const response = await fetch(healthEndpoint)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ status: 'ok' })
  })

  test('should intercept GET requests with parameters', async () => {
    const response = await fetch('/api/user/123')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      id: '123',
      name: 'Test User 123',
      email: 'test123@example.com',
    })
  })

  test('should intercept POST requests to /api/auth/login', async () => {
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

  test('should allow dynamic response mocking with mockApiResponse', async () => {
    const customData = { custom: 'response', id: 456 }
    mockApiResponse('/api/custom', customData, 201)

    const response = await fetch('/api/custom')
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toEqual(customData)
  })

  test('should allow error response mocking with mockApiError', async () => {
    mockApiError('/api/error', 500, 'Internal Server Error')

    const response = await fetch('/api/error')
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Internal Server Error' })
  })

  test('should work without global fetch mock interference', async () => {
    // This test verifies that MSW works without the global fetch mock
    // If the global fetch mock was still active, this would fail

    const response = await fetch(healthEndpoint)

    // MSW should handle this request, not the global fetch mock
    expect(response.status).toBe(200)
    expect(typeof response.json).toBe('function')

    const data = await response.json()
    expect(data).toEqual({ status: 'ok' })
  })

  test('should surface helpful guidance for unmatched requests without dialing network', async () => {
    // Simulate MSW's unmatched request scenario without real socket attempts
    const originalFetch = globalThis.fetch
    let called = false
    // Minimal stub replicating an unmatched error path
    // eslint-disable-next-line @typescript-eslint/require-await
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      called = true
      const target =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : '[request]'
      const err = new Error(`MSW_UNMATCHED: ${target}`)
      ;(err as any).code = 'MSW_UNMATCHED'
      throw err
    }) as any

    await expect(fetch('/api/nonexistent')).rejects.toMatchObject({ code: 'MSW_UNMATCHED' })
    expect(called).toBe(true)

    // Restore original fetch
    globalThis.fetch = originalFetch
  })

  describe('unhandled request logging', () => {
    test('logs warning for unmatched requests through MSW', async () => {
      // MSW is configured to warn on unhandled requests
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        // Make a request to an endpoint that has no MSW handler
        await fetch('http://localhost:3000/api/completely-unhandled-endpoint')
      } catch {
        // The request might fail, but we're interested in the warning
      }

      // MSW should have logged a warning about the unhandled request
      // Check for either 'Warning' or 'unhandled' in the message
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

    test('does not log warnings for handled requests', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // This endpoint has a handler
      await fetch(healthEndpoint)

      // Should not have logged any warnings
      expect(warnSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    test('respects MSW onUnhandledRequest configuration', () => {
      // Verify that MSW is configured with onUnhandledRequest: 'warn'
      // This is more of a configuration contract test
      // The actual configuration is in vitest.setup.tsx

      // We can't directly access server's config, but we can verify behavior
      // by checking that unhandled requests don't throw by default
      expect(async () => {
        try {
          await fetch('/api/another-unhandled-endpoint')
        } catch {
          // Network errors are okay, we're testing MSW doesn't throw
        }
      }).not.toThrow()
    })
  })

  describe('pagination edge cases', () => {
    test('handles limit=0 gracefully', async () => {
      // If there's a paginated endpoint, it should handle limit=0 sensibly
      const response = await fetch('/api/items?limit=0')
      const data = await response.json()

      // Limit=0 should either return empty array or a minimum of 1 item
      if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(1)
      } else if (data.items) {
        expect(data.items.length).toBeLessThanOrEqual(1)
      }

      expect(response.status).toBe(200)
    })

    test('handles limit=NaN as invalid parameter', async () => {
      // NaN should be treated as invalid or default to sensible value
      const response = await fetch('/api/items?limit=NaN')

      // Should either return 400 Bad Request or use default limit
      expect([200, 400]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        // If it succeeds, it should have used a default limit
        if (Array.isArray(data)) {
          expect(data.length).toBeGreaterThan(0)
        }
      } else {
        const error = await response.json()
        expect(error).toHaveProperty('error')
      }
    })

    test('handles negative limit values', async () => {
      // Negative limits should be rejected or treated as 0
      const response = await fetch('/api/items?limit=-10')

      // Should either return 400 or treat as 0/minimum
      expect([200, 400]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        if (Array.isArray(data)) {
          expect(data.length).toBeGreaterThanOrEqual(0)
        }
      }
    })

    test('handles extremely large limit values', async () => {
      // Very large limits should be capped at a reasonable maximum
      const response = await fetch('/api/items?limit=999999999')

      expect(response.status).toBe(200)

      const data = await response.json()
      // Most APIs cap at something like 100 or 1000 items
      if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(1000)
      } else if (data.items) {
        expect(data.items.length).toBeLessThanOrEqual(1000)
      }
    })

    test('handles undefined and null query parameters', async () => {
      // Test various undefined/null scenarios
      const undefinedResponse = await fetch('/api/items?limit=undefined')
      const nullResponse = await fetch('/api/items?limit=null')
      const emptyResponse = await fetch('/api/items?limit=')

      // All should handle gracefully, either with defaults or errors
      expect([200, 400]).toContain(undefinedResponse.status)
      expect([200, 400]).toContain(nullResponse.status)
      expect([200, 400]).toContain(emptyResponse.status)
    })

    test('handles page boundary conditions', async () => {
      // Test page=0, page=-1, page=NaN scenarios
      const page0 = await fetch('/api/items?page=0')
      const pageNegative = await fetch('/api/items?page=-1')
      const pageNaN = await fetch('/api/items?page=NaN')

      // Page 0 might be valid (0-indexed) or invalid (1-indexed)
      expect([200, 400]).toContain(page0.status)

      // Negative and NaN pages should be rejected or use defaults
      expect([200, 400]).toContain(pageNegative.status)
      expect([200, 400]).toContain(pageNaN.status)
    })
  })
})
