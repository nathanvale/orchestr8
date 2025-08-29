import { average, median, percentile } from '@template/utils'
import { createConsoleLogger } from '@orchestr8/logger'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { argv } from 'node:process'

const logger = createConsoleLogger({
  name: 'Server',
  level: 'debug',
})

const PORT = process.env.PORT ?? '3333'
const startTime = Date.now()

// Simple metrics collector
class MetricsCollector {
  private responseTimes: number[] = []
  private totalRequests = 0
  private errorCount = 0

  recordRequest(responseTime: number, isError: boolean): void {
    this.responseTimes.push(responseTime)
    this.totalRequests++
    if (isError) this.errorCount++
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift()
    }
  }

  getMetrics(): {
    totalRequests: number
    errorCount: number
    responseTimes: number[]
  } {
    return {
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      responseTimes: [...this.responseTimes],
    }
  }
}

const metrics = new MetricsCollector()

// Simple correlation ID generator
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

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
  stop: () => Promise<void>
}

// Route handlers
function handleRoot(correlationId: string): { status: number; body: string; headers: Record<string, string> } {
  logger.debug('Serving root endpoint', { correlationId })
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '@template/server',
      version: '0.1.0',
      status: 'running',
      endpoints: [
        '/demo',
        '/api/health',
        '/api/logs',
        '/api/metrics',
        '/api/echo',
        '/api/calculate',
      ],
    }),
  }
}

function handleHealth(correlationId: string): { status: number; body: string; headers: Record<string, string> } {
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  logger.debug('Health check requested', { correlationId, uptime })

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'healthy',
      uptime,
      timestamp: new Date().toISOString(),
      correlationId,
    }),
  }
}

function handleLogs(correlationId: string): { status: number; body: string; headers: Record<string, string> } {
  logger.debug('Logs requested', { correlationId, count: logStore.length })

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logStore.slice(-20)), // Return last 20 logs
  }
}

function handleMetrics(correlationId: string): { status: number; body: string; headers: Record<string, string> } {
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

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...metricsData,
      uptime,
      stats,
    }),
  }
}

async function handleEcho(body: string, correlationId: string): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  logger.info('Echo request received', { correlationId, bodyLength: body.length })

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      echo: body,
      timestamp: new Date().toISOString(),
      correlationId,
    }),
  }
}

async function handleCalculate(body: string, correlationId: string): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  try {
    const data = JSON.parse(body) as { numbers: number[] }

    if (!Array.isArray(data.numbers)) {
      throw new Error('Invalid input: expected array of numbers')
    }

    logger.info('Calculate request received', {
      correlationId,
      count: data.numbers.length,
    })

    const result = {
      sum: data.numbers.reduce((a, b) => a + b, 0),
      average: average(data.numbers),
      median: median(data.numbers),
      p95: percentile(data.numbers, 95),
      correlationId,
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (error) {
    logger.error('Failed to process calculate request', { correlationId, error })
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Invalid request',
        correlationId,
      }),
    }
  }
}

function handleDemo(correlationId: string): { status: number; body: string; headers: Record<string, string> } {
  logger.debug('Serving demo page', { correlationId })
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Node.js Server API Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .card h2 {
            color: #667eea;
            margin-bottom: 15px;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
        }
        button:hover { opacity: 0.9; }
        .response {
            margin-top: 15px;
            padding: 15px;
            background: #f7fafc;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.9rem;
            white-space: pre-wrap;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Node.js Server Demo</h1>
        <div class="grid">
            <div class="card">
                <h2>Health Check</h2>
                <button onclick="fetch('/api/health').then(r=>r.json()).then(d=>document.getElementById('health').textContent=JSON.stringify(d,null,2))">Check Health</button>
                <div id="health" class="response"></div>
            </div>
            <div class="card">
                <h2>Server Metrics</h2>
                <button onclick="fetch('/api/metrics').then(r=>r.json()).then(d=>document.getElementById('metrics').textContent=JSON.stringify(d,null,2))">Get Metrics</button>
                <div id="metrics" class="response"></div>
            </div>
        </div>
    </div>
</body>
</html>`

  return {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  }
}

function handle404(correlationId: string, path: string): { status: number; body: string; headers: Record<string, string> } {
  logger.warn('404 - Route not found', { correlationId, path })

  return {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not found',
      path,
      correlationId,
    }),
  }
}

export function startServer(port: number | string = PORT): ServerInstance {
  const numericPort = typeof port === 'string' ? parseInt(port, 10) : port
  
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${numericPort}`)
    const correlationId = generateCorrelationId()
    const requestStartTime = performance.now()

    logger.info(`Incoming ${req.method} request to ${url.pathname}`, { correlationId })

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value)
      })
      res.writeHead(204)
      res.end()
      return
    }

    // Collect body for POST requests
    let body = ''
    if (req.method === 'POST') {
      await new Promise<void>((resolve) => {
        req.on('data', chunk => { body += chunk.toString() })
        req.on('end', () => resolve())
      })
    }

    // Route handling
    let response: { status: number; body: string; headers: Record<string, string> }

    switch (url.pathname) {
      case '/':
        response = handleRoot(correlationId)
        break
      case '/demo':
        response = handleDemo(correlationId)
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
        response = await handleEcho(body, correlationId)
        break
      case '/api/calculate':
        response = await handleCalculate(body, correlationId)
        break
      default:
        response = handle404(correlationId, url.pathname)
    }

    // Track metrics
    const responseTime = performance.now() - requestStartTime
    metrics.recordRequest(responseTime, response.status >= 400)

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value)
    })

    // Set response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })

    logger.info(`Request completed in ${responseTime.toFixed(2)}ms`, {
      correlationId,
      status: response.status,
      responseTime,
    })

    res.writeHead(response.status)
    res.end(response.body)
  })

  server.listen(numericPort, () => {
    logger.info(`🚀 Server running at http://localhost:${numericPort}`)
    logger.info('Available endpoints:', {
      endpoints: [
        `http://localhost:${numericPort}/`,
        `http://localhost:${numericPort}/demo`,
        `http://localhost:${numericPort}/api/health`,
        `http://localhost:${numericPort}/api/logs`,
        `http://localhost:${numericPort}/api/metrics`,
        `http://localhost:${numericPort}/api/echo`,
        `http://localhost:${numericPort}/api/calculate`,
      ],
    })
  })

  return {
    port: numericPort,
    hostname: 'localhost',
    stop: () => new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('Server stopped')
        resolve()
      })
    }),
  }
}

// Start server only when running directly (not when imported for testing)
// In ES modules, check if this file is the entry point
if (import.meta.url === `file://${argv[1]}` || fileURLToPath(import.meta.url) === argv[1]) {
  startServer()
}