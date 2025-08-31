/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { ServerInstance } from './index'
import { startServer } from './index'

describe('Server', () => {
  let server: ServerInstance
  const API_URL = 'http://localhost:8081'

  beforeAll(async () => {
    // Configure MSW to not intercept our server requests
    const originalFetch = globalThis.fetch
    globalThis.fetch = originalFetch

    server = startServer(8081)
    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    await server.stop()
  })

  test('GET / returns server info', async () => {
    const response = await fetch(API_URL, { method: 'GET' })
    expect(response.status).toBe(200)

    const data = (await response.json()) as { name: string; status: string; endpoints: string[] }
    expect(data).toHaveProperty('name', '@template/server')
    expect(data).toHaveProperty('status', 'running')
    expect(data).toHaveProperty('endpoints')
    expect(Array.isArray(data.endpoints)).toBe(true)
    expect(data.endpoints).toContain('/demo')
  })

  test('GET /demo returns HTML page', async () => {
    const response = await fetch(`${API_URL}/demo`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('Node.js Server Demo')
  })

  test('GET /api/health returns health status', async () => {
    const response = await fetch(`${API_URL}/api/health`)
    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      status: string
      uptime: number
      timestamp: string
      correlationId: string
    }
    expect(data).toHaveProperty('status', 'healthy')
    expect(data).toHaveProperty('uptime')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('correlationId')
  })

  test('GET /api/metrics returns server metrics', async () => {
    const response = await fetch(`${API_URL}/api/metrics`)
    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      totalRequests: number
      errorCount: number
      responseTimes: number[]
      stats: { averageResponseTime: number }
    }
    expect(data).toHaveProperty('totalRequests')
    expect(data).toHaveProperty('errorCount')
    expect(data).toHaveProperty('responseTimes')
    expect(data).toHaveProperty('stats')
    expect(data.stats).toHaveProperty('averageResponseTime')
  })

  test('POST /api/echo returns echoed message', async () => {
    const testMessage = 'Hello from test!'
    const response = await fetch(`${API_URL}/api/echo`, {
      method: 'POST',
      body: testMessage,
      headers: { 'Content-Type': 'text/plain' },
    })
    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      echo: string
      timestamp: string
      correlationId: string
    }
    expect(data).toHaveProperty('echo', testMessage)
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('correlationId')
  })

  test('POST /api/calculate performs calculations', async () => {
    const numbers = [1, 2, 3, 4, 5]
    const response = await fetch(`${API_URL}/api/calculate`, {
      method: 'POST',
      body: JSON.stringify({ numbers }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      sum: number
      average: number
      median: number
      p95: number
      correlationId: string
    }
    expect(data).toHaveProperty('sum', 15)
    expect(data).toHaveProperty('average', 3)
    expect(data).toHaveProperty('median', 3)
    expect(data).toHaveProperty('p95')
    expect(data).toHaveProperty('correlationId')
  })

  test('GET /api/logs returns recent logs', async () => {
    const response = await fetch(`${API_URL}/api/logs`)
    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      id: string
      timestamp: string
      level: string
      message: string
    }[]
    expect(Array.isArray(data)).toBe(true)
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id')
      expect(data[0]).toHaveProperty('timestamp')
      expect(data[0]).toHaveProperty('level')
      expect(data[0]).toHaveProperty('message')
    }
  })

  test('GET /nonexistent returns 404', async () => {
    const response = await fetch(`${API_URL}/nonexistent`)
    expect(response.status).toBe(404)

    const data = (await response.json()) as { error: string; path: string }
    expect(data).toHaveProperty('error', 'Not found')
    expect(data).toHaveProperty('path', '/nonexistent')
  })

  test('OPTIONS request returns CORS headers', async () => {
    const response = await fetch(API_URL, {
      method: 'OPTIONS',
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})
