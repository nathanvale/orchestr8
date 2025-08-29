import { http, HttpResponse } from 'msw'
import type { LogEntry, ServerMetrics } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Generate mock log data
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
    const level = levels[Math.floor(Math.random() * levels.length)]
    const message = messages[Math.floor(Math.random() * messages.length)]

    logs.push({
      id: `log-${i}`,
      timestamp,
      level,
      message,
      correlationId:
        Math.random() > 0.5 ? `req-${Math.random().toString(36).substr(2, 9)}` : undefined,
      metadata: Math.random() > 0.7 ? { userId: 'user-123', endpoint: '/api/data' } : undefined,
    })
  }

  return logs.reverse()
}

// Generate mock metrics data
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

export const handlers = [
  http.get(`${API_BASE_URL}/api/logs`, () => {
    return HttpResponse.json(generateMockLogs())
  }),

  http.get(`${API_BASE_URL}/api/metrics`, () => {
    return HttpResponse.json(generateMockMetrics())
  }),
]
