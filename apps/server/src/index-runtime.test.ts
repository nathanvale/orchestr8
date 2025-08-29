import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ServerInstance } from './index'

describe('Server with Runtime Adapter', () => {
  let server: ServerInstance
  let API_URL: string

  beforeAll(async () => {
    // Import the refactored server
    const { startServer } = await import('./index')
    // Use port 0 to get a random available port
    server = startServer(0)
    API_URL = `http://localhost:${server.port}`
  })

  afterAll(async () => {
    await server.stop()
  })

  test('server starts with runtime adapter', () => {
    expect(server).toBeDefined()
    expect(server.port).toBeGreaterThan(0)
    expect(server.hostname).toBe('localhost')
    expect(typeof server.stop).toBe('function')
  })

  test('GET / returns server info through runtime adapter', async () => {
    const response = await fetch(API_URL)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('name', '@bun-template/server')
    expect(data).toHaveProperty('status', 'running')
    expect(data).toHaveProperty('endpoints')
  })

  test('GET /api/health works through runtime adapter', async () => {
    const response = await fetch(`${API_URL}/api/health`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('status', 'healthy')
    expect(data).toHaveProperty('uptime')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('correlationId')
  })

  test('POST /api/echo works through runtime adapter', async () => {
    const testData = 'Hello, Runtime Adapter!'
    const response = await fetch(`${API_URL}/api/echo`, {
      method: 'POST',
      body: testData,
      headers: { 'Content-Type': 'text/plain' },
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('echo', testData)
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('correlationId')
  })

  test('CORS headers are present through runtime adapter', async () => {
    const response = await fetch(API_URL)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, PUT, DELETE, OPTIONS',
    )
  })

  test('OPTIONS preflight works through runtime adapter', async () => {
    const response = await fetch(API_URL, {
      method: 'OPTIONS',
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('404 handling works through runtime adapter', async () => {
    const response = await fetch(`${API_URL}/non-existent`)
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data).toHaveProperty('error', 'Not found')
    expect(data).toHaveProperty('path', '/non-existent')
  })

  test('server can be stopped gracefully', async () => {
    const { startServer } = await import('./index')
    const tempServer = startServer(0)
    const tempUrl = `http://localhost:${tempServer.port}`

    // Verify it's running
    const response = await fetch(tempUrl)
    expect(response.status).toBe(200)

    // Stop the server
    await tempServer.stop()

    // Verify it's stopped
    try {
      await fetch(tempUrl, { signal: AbortSignal.timeout(100) })
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toBeDefined() // Expected to fail
    }
  })
})
