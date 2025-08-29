import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ServerInstance } from './index'
import { startServer } from './index'

let server: ServerInstance
let API_URL: string

describe('Server API', () => {
  beforeAll(() => {
    // Use port 0 to get a random available port
    server = startServer(0)
    API_URL = `http://localhost:${server.port}`
  })

  afterAll(async () => {
    await server.stop()
  })
  test('GET / returns server info', async () => {
    const response = await fetch(API_URL)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('name', '@bun-template/server')
    expect(data).toHaveProperty('status', 'running')
    expect(data).toHaveProperty('endpoints')
    expect(Array.isArray(data.endpoints)).toBe(true)
    expect(data.endpoints).toContain('/demo')
  })

  test('GET /demo returns HTML page', async () => {
    const response = await fetch(`${API_URL}/demo`)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')

    const html = await response.text()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Bun Server API Demo')
    expect(html).toContain('Check Health')
    expect(html).toContain('/api/health')
  })

  test('GET /api/health returns health status', async () => {
    const response = await fetch(`${API_URL}/api/health`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('status', 'healthy')
    expect(data).toHaveProperty('uptime')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('correlationId')
  })

  test('GET /api/logs returns log entries', async () => {
    const response = await fetch(`${API_URL}/api/logs`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)

    if (data.length > 0) {
      const log = data[0]
      expect(log).toHaveProperty('id')
      expect(log).toHaveProperty('timestamp')
      expect(log).toHaveProperty('level')
      expect(log).toHaveProperty('message')
    }
  })

  test('GET /api/metrics returns server metrics', async () => {
    const response = await fetch(`${API_URL}/api/metrics`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('totalRequests')
    expect(data).toHaveProperty('errorCount')
    expect(data).toHaveProperty('responseTimes')
    expect(data).toHaveProperty('uptime')
    expect(data).toHaveProperty('stats')
    expect(Array.isArray(data.responseTimes)).toBe(true)
  })

  test('POST /api/echo echoes the request body', async () => {
    const testData = 'Hello, Server!'
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

  test('POST /api/calculate performs calculations', async () => {
    const numbers = [1, 2, 3, 4, 5]
    const response = await fetch(`${API_URL}/api/calculate`, {
      method: 'POST',
      body: JSON.stringify({ numbers }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('sum', 15)
    expect(data).toHaveProperty('average', 3)
    expect(data).toHaveProperty('median', 3)
    expect(data).toHaveProperty('p95')
    expect(data).toHaveProperty('correlationId')
  })

  test('GET /api/unknown returns 404', async () => {
    const response = await fetch(`${API_URL}/api/unknown`)
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data).toHaveProperty('error', 'Not found')
    expect(data).toHaveProperty('path', '/api/unknown')
    expect(data).toHaveProperty('correlationId')
  })

  test('POST /api/calculate with invalid data returns 400', async () => {
    const response = await fetch(`${API_URL}/api/calculate`, {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('correlationId')
  })
})
