import { average, median, percentile } from '@bun-template/utils'
import { createConsoleLogger } from '@orchestr8/logger'
import { createRuntime } from './runtime'
import { generateCorrelationId } from './utils/correlation'
import { createMetricsCollector } from './utils/metrics'

const logger = createConsoleLogger({
  name: 'Server',
  level: 'debug',
})

const PORT = process.env.PORT ?? '3333'
const startTime = Date.now()
const metrics = createMetricsCollector()

// Enable CORS for development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Store logs in memory (for demo purposes)
const logStore: {
  id: string
  timestamp: string
  level: string
  message: string
  correlationId?: string
  metadata?: Record<string, unknown>
}[] = []

// Store logs in memory for the /api/logs endpoint
function recordLog(level: string, message: string, meta?: Record<string, unknown>): void {
  const logEntry = {
    id: `log-${String(Date.now())}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: meta?.correlationId as string | undefined,
    metadata: meta,
  }

  logStore.push(logEntry)

  // Keep only last 100 logs
  if (logStore.length > 100) {
    logStore.shift()
  }
}

// Intercept logger calls to store logs
const originalInfo = logger.info.bind(logger)
const originalError = logger.error.bind(logger)
const originalWarn = logger.warn.bind(logger)
const originalDebug = logger.debug.bind(logger)

logger.info = (message: string, meta?: Record<string, unknown>) => {
  recordLog('info', message, meta)
  originalInfo(message, meta)
}

logger.error = (message: string, meta?: Record<string, unknown>) => {
  recordLog('error', message, meta)
  originalError(message, meta)
}

logger.warn = (message: string, meta?: Record<string, unknown>) => {
  recordLog('warn', message, meta)
  originalWarn(message, meta)
}

logger.debug = (message: string, meta?: Record<string, unknown>) => {
  recordLog('debug', message, meta)
  originalDebug(message, meta)
}

export interface ServerInstance {
  port: number
  hostname: string
  stop: () => void | Promise<void>
}

export function startServer(port: number | string = PORT): ServerInstance {
  const runtime = createRuntime()
  const server = runtime.serve({
    port,
    async fetch(request: Request) {
      const url = new URL(request.url)
      const correlationId = generateCorrelationId()
      const startTime = performance.now()

      logger.info(`Incoming ${request.method} request to ${url.pathname}`, { correlationId })

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        })
      }

      // Route handling
      let response: Response

      switch (url.pathname) {
        case '/':
          response = handleRoot(correlationId)
          break

        case '/api/health':
          response = handleHealth(correlationId)
          break

        case '/api/logs':
          response = handleLogs(correlationId)
          break

        case '/api/metrics':
          response = handleMetrics(correlationId)
          break

        case '/api/echo':
          response = await handleEcho(request, correlationId)
          break

        case '/api/calculate':
          response = await handleCalculate(request, correlationId)
          break

        default:
          response = handle404(correlationId, url.pathname)
      }

      // Track metrics
      const responseTime = performance.now() - startTime
      metrics.recordRequest(responseTime, response.status >= 400)

      // Add CORS headers to all responses
      const headers = new Headers(response.headers)
      for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value)
      }

      logger.info(`Request completed in ${responseTime.toFixed(2)}ms`, {
        correlationId,
        status: response.status,
        responseTime,
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    },
  })

  logger.info(`🚀 Server running at http://localhost:${String(server.port)}`)
  logger.info('Available endpoints:', {
    endpoints: [
      `http://localhost:${String(server.port)}/`,
      `http://localhost:${String(server.port)}/api/health`,
      `http://localhost:${String(server.port)}/api/logs`,
      `http://localhost:${String(server.port)}/api/metrics`,
      `http://localhost:${String(server.port)}/api/echo`,
      `http://localhost:${String(server.port)}/api/calculate`,
    ],
  })

  return server
}

function handleRoot(correlationId: string): Response {
  logger.debug('Serving root endpoint', { correlationId })
  return new Response(
    JSON.stringify({
      name: '@bun-template/server',
      version: '0.1.0',
      status: 'running',
      endpoints: ['/api/health', '/api/logs', '/api/metrics', '/api/echo', '/api/calculate'],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

function handleHealth(correlationId: string): Response {
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  logger.debug('Health check requested', { correlationId, uptime })

  return new Response(
    JSON.stringify({
      status: 'healthy',
      uptime,
      timestamp: new Date().toISOString(),
      correlationId,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

function handleLogs(correlationId: string): Response {
  logger.debug('Logs requested', { correlationId, count: logStore.length })

  return new Response(
    JSON.stringify(logStore.slice(-20)), // Return last 20 logs
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

function handleMetrics(correlationId: string): Response {
  const metricsData = metrics.getMetrics()
  const uptime = Math.floor((Date.now() - startTime) / 1000)

  logger.debug('Metrics requested', { correlationId, totalRequests: metricsData.totalRequests })

  // Calculate statistics using utils
  const stats = {
    averageResponseTime: average(metricsData.responseTimes),
    medianResponseTime: median(metricsData.responseTimes),
    p95ResponseTime: percentile(metricsData.responseTimes, 95),
    p99ResponseTime: percentile(metricsData.responseTimes, 99),
  }

  return new Response(
    JSON.stringify({
      ...metricsData,
      uptime,
      stats,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

async function handleEcho(request: Request, correlationId: string): Promise<Response> {
  try {
    const body = await request.text()
    logger.info('Echo request received', { correlationId, bodyLength: body.length })

    return new Response(
      JSON.stringify({
        echo: body,
        timestamp: new Date().toISOString(),
        correlationId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Failed to process echo request', { correlationId, error })
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleCalculate(request: Request, correlationId: string): Promise<Response> {
  try {
    const body = (await request.json()) as { numbers: number[] }

    if (!Array.isArray(body.numbers)) {
      throw new Error('Invalid input: expected array of numbers')
    }

    logger.info('Calculate request received', {
      correlationId,
      count: body.numbers.length,
    })

    const result = {
      sum: body.numbers.reduce((a, b) => a + b, 0),
      average: average(body.numbers),
      median: median(body.numbers),
      p95: percentile(body.numbers, 95),
      correlationId,
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error('Failed to process calculate request', { correlationId, error })
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Invalid request',
        correlationId,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

function handle404(correlationId: string, path: string): Response {
  logger.warn('404 - Route not found', { correlationId, path })

  return new Response(
    JSON.stringify({
      error: 'Not found',
      path,
      correlationId,
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// Start server only when running directly (not when imported for testing)
if (import.meta.main) {
  startServer()
}
