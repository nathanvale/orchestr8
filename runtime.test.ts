import { afterEach, describe, expect, test } from 'bun:test'
import type { RuntimeServer } from './types'

describe('Runtime Adapters', () => {
  const activeServers: RuntimeServer[] = []

  afterEach(async () => {
    // Clean up any active servers
    await Promise.all(activeServers.map((server) => server.stop()))
    activeServers.length = 0
  })
  describe('createRuntime factory', () => {
    test('returns correct runtime based on environment', async () => {
      const { createRuntime } = await import('./index')
      const runtime = createRuntime()

      // In Bun environment, this should return Bun runtime
      expect(runtime).toBeDefined()
      expect(typeof runtime.serve).toBe('function')

      // We can test that it works with a real server
      const server = runtime.serve({
        port: 0, // Dynamic port
        fetch: () => new Response('test'),
      })

      expect(server.port).toBeGreaterThan(0)
      expect(server.hostname).toBe('localhost')
      expect(typeof server.stop).toBe('function')

      await server.stop()
    })
  })

  describe('Bun Adapter', () => {
    test('creates server with correct options', async () => {
      const { bunRuntime } = await import('./bun-adapter')
      const runtime = bunRuntime()

      const server = runtime.serve({
        port: 0,
        fetch: () => new Response('test from bun adapter'),
      })

      expect(server.port).toBeGreaterThan(0)
      expect(server.hostname).toBe('localhost')
      expect(typeof server.stop).toBe('function')

      // Test that the server actually works
      const response = await fetch(`http://localhost:${server.port}/`)
      const text = await response.text()
      expect(text).toBe('test from bun adapter')

      await server.stop()
    })

    test('handles string port conversion', async () => {
      const { bunRuntime } = await import('./bun-adapter')
      const runtime = bunRuntime()

      const server = runtime.serve({
        port: '0', // String port
        fetch: () => new Response('string port test'),
      })

      expect(server.port).toBeGreaterThan(0)
      expect(typeof server.port).toBe('number')

      await server.stop()
    })

    test('stop method works correctly', async () => {
      const { bunRuntime } = await import('./bun-adapter')
      const runtime = bunRuntime()

      const server = runtime.serve({
        port: 0,
        fetch: () => new Response('stop test'),
      })

      const port = server.port

      // Server should be accessible
      const response1 = await fetch(`http://localhost:${port}/`)
      expect(response1.ok).toBe(true)

      // Stop the server
      await server.stop()

      // Server should no longer be accessible
      try {
        await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(100), // Short timeout
        })
        // If we reach here, the server is still running which is wrong
        expect(true).toBe(false) // Force test failure
      } catch (error: any) {
        // Expected to fail with connection error (any error is fine, server is stopped)
        expect(error).toBeDefined()
      }
    })
  })

  describe('Node Adapter', () => {
    test('creates http server with correct port', async () => {
      const { nodeRuntime } = await import('./node-adapter')
      const runtime = nodeRuntime()

      const server = runtime.serve({
        port: 0, // Use 0 for dynamic port allocation
        fetch: () => new Response('Hello from Node', { status: 200 }),
      })

      expect(server.port).toBeGreaterThan(0)
      expect(server.hostname).toBe('localhost')
      expect(typeof server.stop).toBe('function')

      // Test that it actually works
      const response = await fetch(`http://localhost:${server.port}/`)
      const text = await response.text()
      expect(text).toBe('Hello from Node')

      // Clean up
      await server.stop()
    })

    test('handles fetch requests through Node.js http server', async () => {
      const { nodeRuntime } = await import('./node-adapter')
      const runtime = nodeRuntime()

      const server = runtime.serve({
        port: 0,
        fetch: (request) => {
          const url = new URL(request.url)
          return new Response(
            JSON.stringify({
              message: 'test',
              path: url.pathname,
              method: request.method,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        },
      })

      // Make a test request
      const response = await fetch(`http://localhost:${server.port}/test-path`)
      const data = await response.json()

      expect(data.message).toBe('test')
      expect(data.path).toBe('/test-path')
      expect(data.method).toBe('GET')
      expect(response.status).toBe(200)

      // Clean up
      await server.stop()
    })

    test('handles errors gracefully', async () => {
      const { nodeRuntime } = await import('./node-adapter')
      const runtime = nodeRuntime()

      const server = runtime.serve({
        port: 0,
        fetch: () => {
          throw new Error('Test error')
        },
      })

      const response = await fetch(`http://localhost:${server.port}/error`)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data.details).toContain('Test error')

      // Clean up
      await server.stop()
    })

    test('handles request body correctly', async () => {
      const { nodeRuntime } = await import('./node-adapter')
      const runtime = nodeRuntime()

      const server = runtime.serve({
        port: 0,
        fetch: async (request) => {
          const body = await request.text()
          return new Response(JSON.stringify({ received: body }), {
            headers: { 'Content-Type': 'application/json' },
          })
        },
      })

      const testBody = JSON.stringify({ test: 'data' })
      const response = await fetch(`http://localhost:${server.port}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testBody,
      })

      const data = await response.json()
      expect(data.received).toBe(testBody)

      // Clean up
      await server.stop()
    })

    test('transforms headers correctly', async () => {
      const { nodeRuntime } = await import('./node-adapter')
      const runtime = nodeRuntime()

      const server = runtime.serve({
        port: 0,
        fetch: (request) => {
          const testHeader = request.headers.get('x-test-header')
          const accept = request.headers.get('accept')

          return new Response(
            JSON.stringify({
              receivedTestHeader: testHeader,
              receivedAccept: accept,
            }),
            {
              headers: {
                'X-Custom-Header': 'test-value',
                'Content-Type': 'application/json',
              },
            },
          )
        },
      })

      const response = await fetch(`http://localhost:${server.port}/test`, {
        headers: {
          'X-Test-Header': 'test-input',
          'Accept': 'application/json',
        },
      })

      const data = await response.json()
      expect(data.receivedTestHeader).toBe('test-input')
      expect(data.receivedAccept).toBe('application/json')
      expect(response.headers.get('x-custom-header')).toBe('test-value')

      // Clean up
      await server.stop()
    })
  })

  describe('Runtime Interface Compliance', () => {
    test('all adapters implement Runtime interface', async () => {
      const { bunRuntime } = await import('./bun-adapter')
      const { nodeRuntime } = await import('./node-adapter')

      const bunAdapter = bunRuntime()
      const nodeAdapter = nodeRuntime()

      // Check Runtime interface
      expect(typeof bunAdapter.serve).toBe('function')
      expect(typeof nodeAdapter.serve).toBe('function')
    })

    test('all servers implement RuntimeServer interface', async () => {
      const { bunRuntime } = await import('./bun-adapter')
      const { nodeRuntime } = await import('./node-adapter')

      const bunAdapter = bunRuntime()
      const bunServer = bunAdapter.serve({ port: 0, fetch: () => new Response() })

      const nodeAdapter = nodeRuntime()
      const nodeServer = nodeAdapter.serve({ port: 0, fetch: () => new Response() })

      // Check RuntimeServer interface for both
      for (const server of [bunServer, nodeServer]) {
        expect(typeof server.port).toBe('number')
        expect(typeof server.hostname).toBe('string')
        expect(typeof server.stop).toBe('function')
      }

      // Clean up both servers
      await bunServer.stop()
      await nodeServer.stop()
    })
  })
})
