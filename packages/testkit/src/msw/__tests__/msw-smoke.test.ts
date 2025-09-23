/**
 * Smoke tests for MSW server lifecycle
 * Ensures basic MSW functionality is working
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

describe('MSW Smoke Tests', () => {
  // Create server instance
  const server = setupServer()

  beforeAll(() => {
    // Start server before tests
    server.listen({ onUnhandledRequest: 'bypass' })
  })

  afterEach(() => {
    // Reset handlers after each test
    server.resetHandlers()
  })

  afterAll(() => {
    // Clean up server after tests
    server.close()
  })

  describe('Server Lifecycle', () => {
    it('should start and stop server without errors', () => {
      // Server should be running
      expect(server).toBeDefined()
      expect(server.listen).toBeDefined()
      expect(server.close).toBeDefined()
    })

    it('should reset handlers without errors', () => {
      // Add a handler
      server.use(
        http.get('https://api.example.com/test', () => {
          return HttpResponse.json({ message: 'test' })
        }),
      )

      // Reset should work without errors
      expect(() => server.resetHandlers()).not.toThrow()
    })

    it('should support runtime handler registration', () => {
      // Register a handler at runtime
      server.use(
        http.get('https://api.example.com/runtime', () => {
          return HttpResponse.json({ runtime: true })
        }),
      )

      // Handler should be registered (no direct way to test, but no errors)
      expect(() => server.resetHandlers()).not.toThrow()
    })
  })

  describe('Handler Registration', () => {
    it('should register GET handlers', () => {
      const handler = http.get('https://api.example.com/get', () => {
        return HttpResponse.json({ method: 'GET' })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should register POST handlers', () => {
      const handler = http.post('https://api.example.com/post', () => {
        return HttpResponse.json({ method: 'POST' })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should register PUT handlers', () => {
      const handler = http.put('https://api.example.com/put', () => {
        return HttpResponse.json({ method: 'PUT' })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should register DELETE handlers', () => {
      const handler = http.delete('https://api.example.com/delete', () => {
        return HttpResponse.json({ method: 'DELETE' })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should register PATCH handlers', () => {
      const handler = http.patch('https://api.example.com/patch', () => {
        return HttpResponse.json({ method: 'PATCH' })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support wildcard paths', () => {
      const handler = http.get('https://api.example.com/*', () => {
        return HttpResponse.json({ wildcard: true })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support regex paths', () => {
      const handler = http.get(/.*\.example\.com\/.*/, () => {
        return HttpResponse.json({ regex: true })
      })

      expect(() => server.use(handler)).not.toThrow()
    })
  })

  describe('Response Types', () => {
    it('should support JSON responses', () => {
      const handler = http.get('https://api.example.com/json', () => {
        return HttpResponse.json({ type: 'json' }, { status: 200 })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support text responses', () => {
      const handler = http.get('https://api.example.com/text', () => {
        return HttpResponse.text('plain text response', { status: 200 })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support error responses', () => {
      const handler = http.get('https://api.example.com/error', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support custom headers', () => {
      const handler = http.get('https://api.example.com/headers', () => {
        return HttpResponse.json(
          { data: 'test' },
          {
            headers: {
              'X-Custom-Header': 'custom-value',
              'Content-Type': 'application/json',
            },
          },
        )
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support network errors', () => {
      const handler = http.get('https://api.example.com/network-error', () => {
        return HttpResponse.error()
      })

      expect(() => server.use(handler)).not.toThrow()
    })
  })

  describe('Request Interception', () => {
    it('should support request parameter extraction', () => {
      const handler = http.get('https://api.example.com/users/:id', ({ params }) => {
        return HttpResponse.json({ userId: params.id })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support query parameter extraction', () => {
      const handler = http.get('https://api.example.com/search', ({ request }) => {
        const url = new URL(request.url)
        const query = url.searchParams.get('q')
        return HttpResponse.json({ query })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support request body extraction', () => {
      const handler = http.post('https://api.example.com/data', async ({ request }) => {
        const body = await request.json()
        return HttpResponse.json({ received: body })
      })

      expect(() => server.use(handler)).not.toThrow()
    })

    it('should support request header extraction', () => {
      const handler = http.get('https://api.example.com/auth', ({ request }) => {
        const auth = request.headers.get('Authorization')
        return HttpResponse.json({ authorized: !!auth })
      })

      expect(() => server.use(handler)).not.toThrow()
    })
  })

  describe('Handler Overrides', () => {
    it('should support one-time handler overrides', () => {
      // Original handler
      server.use(
        http.get('https://api.example.com/override', () => {
          return HttpResponse.json({ original: true })
        }),
      )

      // Override with once
      server.use(
        http.get(
          'https://api.example.com/override',
          () => {
            return HttpResponse.json({ overridden: true })
          },
          { once: true },
        ),
      )

      // Should not throw
      expect(() => server.resetHandlers()).not.toThrow()
    })

    it('should support permanent handler overrides', () => {
      // Original handler
      server.use(
        http.get('https://api.example.com/permanent', () => {
          return HttpResponse.json({ version: 1 })
        }),
      )

      // Override permanently
      server.use(
        http.get('https://api.example.com/permanent', () => {
          return HttpResponse.json({ version: 2 })
        }),
      )

      // Should not throw
      expect(() => server.resetHandlers()).not.toThrow()
    })
  })

  describe('Multiple Servers', () => {
    it('should support creating multiple server instances', () => {
      const server1 = setupServer()
      const server2 = setupServer()

      expect(server1).toBeDefined()
      expect(server2).toBeDefined()
      expect(server1).not.toBe(server2)

      // Cleanup
      server1.close()
      server2.close()
    })
  })
})
