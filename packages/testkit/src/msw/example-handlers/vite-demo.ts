/**
 * Example MSW handlers for Vite demo application
 * These handlers provide mock APIs for logs and metrics
 */

import { http } from 'msw'
import type { RequestHandler } from 'msw'
import { createSuccessResponse } from '../handlers'

// Types for the Vite demo app
export interface LogEntry {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  correlationId?: string
  metadata?: Record<string, unknown>
}

export interface ServerMetrics {
  totalRequests: number
  errorCount: number
  uptime: number
  responseTimes: number[]
  stats: {
    averageResponseTime: number
    medianResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
  }
}

const API_BASE_URL = 'http://localhost:3001' // Use fixed URL for mocks

/**
 * Generate mock log data for the demo
 */
function generateMockLogs(): LogEntry[] {
  const levels: ('debug' | 'info' | 'warn' | 'error')[] = ['debug', 'info', 'warn', 'error']
  const messages = [
    'Server started successfully',
    'Processing request',
    'Database connection established',
    'Cache miss, fetching from database',
    'Request completed',
    'Rate limit warning',
    'Authentication failed',
    'Memory usage high',
    'Request timeout',
    'Connection pool exhausted',
  ]

  const logs: LogEntry[] = []
  const now = Date.now()

  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now - i * 10000).toISOString()
    const level = levels[Math.floor(Math.random() * levels.length)] ?? 'info'
    const message = messages[Math.floor(Math.random() * messages.length)] ?? 'Unknown message'

    logs.push({
      id: `log-${i}`,
      timestamp,
      level,
      message,
      correlationId:
        Math.random() > 0.5 ? `req-${Math.random().toString(36).slice(2, 11)}` : undefined,
      metadata: Math.random() > 0.7 ? { userId: 'user-123', endpoint: '/api/data' } : undefined,
    })
  }

  return logs.reverse()
}

/**
 * Generate mock metrics data for the demo
 */
function generateMockMetrics(): ServerMetrics {
  const responseTimes: number[] = []

  // Generate realistic response times
  for (let i = 0; i < 100; i++) {
    // Most requests are fast (20-100ms)
    if (Math.random() < 0.8) {
      responseTimes.push(20 + Math.random() * 80)
    }
    // Some are slower (100-500ms)
    else if (Math.random() < 0.95) {
      responseTimes.push(100 + Math.random() * 400)
    }
    // Few are very slow (500-2000ms)
    else {
      responseTimes.push(500 + Math.random() * 1500)
    }
  }

  return {
    totalRequests: Math.floor(Math.random() * 10000) + 1000,
    errorCount: Math.floor(Math.random() * 50),
    uptime: Math.floor(Math.random() * 86400), // Random uptime up to 24 hours
    responseTimes,
    stats: {
      averageResponseTime: 0, // Will be calculated by the app
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
    },
  }
}

/**
 * Vite demo app handlers
 */
export const viteDemoHandlers: RequestHandler[] = [
  http.get(`${API_BASE_URL}/api/logs`, () => {
    return createSuccessResponse(generateMockLogs())
  }),

  http.get(`${API_BASE_URL}/api/metrics`, () => {
    return createSuccessResponse(generateMockMetrics() as unknown as Record<string, unknown>)
  }),
]

export default viteDemoHandlers
