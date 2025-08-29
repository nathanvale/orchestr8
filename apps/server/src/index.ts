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
      `http://localhost:${String(server.port)}/demo`,
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
      endpoints: [
        '/demo',
        '/api/health',
        '/api/logs',
        '/api/metrics',
        '/api/echo',
        '/api/calculate',
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// eslint-disable-next-line max-lines-per-function
function getDemoHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bun Server API Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
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
            margin-bottom: 20px;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }
        .card h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.5rem;
        }
        .endpoint {
            background: #f7fafc;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            margin-bottom: 15px;
            color: #2d3748;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: opacity 0.2s;
            width: 100%;
        }
        button:hover {
            opacity: 0.9;
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .response {
            margin-top: 15px;
            padding: 15px;
            background: #f7fafc;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .success { border-left: 4px solid #48bb78; }
        .error { border-left: 4px solid #f56565; }
        .input-group {
            margin-bottom: 15px;
        }
        input, textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 1rem;
            font-family: inherit;
        }
        textarea {
            resize: vertical;
            min-height: 80px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #4a5568;
            font-weight: 500;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        .stat {
            text-align: center;
            padding: 10px;
            background: #edf2f7;
            border-radius: 6px;
        }
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            font-size: 0.8rem;
            color: #718096;
            margin-top: 5px;
        }
        .log-entry {
            padding: 8px;
            margin-bottom: 5px;
            background: white;
            border-radius: 4px;
            font-size: 0.85rem;
        }
        .log-entry.info { border-left: 3px solid #4299e1; }
        .log-entry.error { border-left: 3px solid #f56565; }
        .log-entry.warn { border-left: 3px solid #ed8936; }
        .log-entry.debug { border-left: 3px solid #9f7aea; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Bun Server API Demo</h1>
        
        <div class="grid">
            <!-- Health Check -->
            <div class="card">
                <h2>❤️ Health Check</h2>
                <div class="endpoint">GET /api/health</div>
                <button onclick="checkHealth()">Check Health</button>
                <div id="health-response" class="response" style="display:none;"></div>
            </div>

            <!-- Server Metrics -->
            <div class="card">
                <h2>📊 Server Metrics</h2>
                <div class="endpoint">GET /api/metrics</div>
                <button onclick="getMetrics()">Get Metrics</button>
                <div id="metrics-response" class="response" style="display:none;"></div>
                <div id="metrics-stats" class="stats" style="display:none;"></div>
            </div>

            <!-- Echo Test -->
            <div class="card">
                <h2>🔊 Echo Test</h2>
                <div class="endpoint">POST /api/echo</div>
                <div class="input-group">
                    <label for="echo-input">Message:</label>
                    <textarea id="echo-input" placeholder="Enter your message here...">Hello from the demo page!</textarea>
                </div>
                <button onclick="echoTest()">Send Echo</button>
                <div id="echo-response" class="response" style="display:none;"></div>
            </div>

            <!-- Calculator -->
            <div class="card">
                <h2>🧮 Calculator</h2>
                <div class="endpoint">POST /api/calculate</div>
                <div class="input-group">
                    <label for="calc-input">Numbers (comma-separated):</label>
                    <input type="text" id="calc-input" placeholder="1, 2, 3, 4, 5" value="10, 20, 30, 40, 50">
                </div>
                <button onclick="calculate()">Calculate Stats</button>
                <div id="calc-response" class="response" style="display:none;"></div>
            </div>

            <!-- Server Logs -->
            <div class="card">
                <h2>📝 Server Logs</h2>
                <div class="endpoint">GET /api/logs</div>
                <button onclick="getLogs()">Fetch Recent Logs</button>
                <div id="logs-response" class="response" style="display:none; max-height: 400px;"></div>
            </div>

            <!-- Server Info -->
            <div class="card">
                <h2>ℹ️ Server Info</h2>
                <div class="endpoint">GET /</div>
                <button onclick="getServerInfo()">Get Server Info</button>
                <div id="info-response" class="response" style="display:none;"></div>
            </div>
        </div>
    </div>

    <script>
        const apiUrl = window.location.origin;

        async function makeRequest(endpoint, options = {}) {
            try {
                const response = await fetch(\`\${apiUrl}\${endpoint}\`, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });
                const data = await response.json();
                return { success: response.ok, data, status: response.status };
            } catch (error) {
                return { success: false, data: { error: error.message }, status: 0 };
            }
        }

        function showResponse(elementId, response, formatter) {
            const element = document.getElementById(elementId);
            element.style.display = 'block';
            element.className = 'response ' + (response.success ? 'success' : 'error');
            
            const formatted = formatter ? formatter(response.data) : JSON.stringify(response.data, null, 2);
            element.textContent = formatted;
        }

        async function checkHealth() {
            const response = await makeRequest('/api/health');
            showResponse('health-response', response, (data) => {
                return \`Status: \${data.status}
Uptime: \${data.uptime} seconds
Timestamp: \${new Date(data.timestamp).toLocaleString()}
Correlation ID: \${data.correlationId}\`;
            });
        }

        async function getMetrics() {
            const response = await makeRequest('/api/metrics');
            showResponse('metrics-response', response);
            
            if (response.success) {
                const stats = document.getElementById('metrics-stats');
                stats.style.display = 'grid';
                stats.innerHTML = \`
                    <div class="stat">
                        <div class="stat-value">\${response.data.totalRequests}</div>
                        <div class="stat-label">Total Requests</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">\${response.data.errorCount}</div>
                        <div class="stat-label">Errors</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">\${response.data.stats?.averageResponseTime?.toFixed(2) || 0}ms</div>
                        <div class="stat-label">Avg Response</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">\${response.data.stats?.p95ResponseTime?.toFixed(2) || 0}ms</div>
                        <div class="stat-label">P95 Response</div>
                    </div>
                \`;
            }
        }

        async function echoTest() {
            const message = document.getElementById('echo-input').value;
            const response = await makeRequest('/api/echo', {
                method: 'POST',
                body: message,
                headers: { 'Content-Type': 'text/plain' }
            });
            showResponse('echo-response', response, (data) => {
                return \`Echo: \${data.echo}
Timestamp: \${new Date(data.timestamp).toLocaleString()}
Correlation ID: \${data.correlationId}\`;
            });
        }

        async function calculate() {
            const input = document.getElementById('calc-input').value;
            const numbers = input.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
            
            const response = await makeRequest('/api/calculate', {
                method: 'POST',
                body: JSON.stringify({ numbers })
            });
            
            showResponse('calc-response', response, (data) => {
                if (data.error) return \`Error: \${data.error}\`;
                return \`Sum: \${data.sum}
Average: \${data.average}
Median: \${data.median}
95th Percentile: \${data.p95}
Correlation ID: \${data.correlationId}\`;
            });
        }

        async function getLogs() {
            const response = await makeRequest('/api/logs');
            const element = document.getElementById('logs-response');
            element.style.display = 'block';
            element.className = 'response ' + (response.success ? 'success' : 'error');
            
            if (response.success && Array.isArray(response.data)) {
                element.innerHTML = response.data.map(log => \`
                    <div class="log-entry \${log.level}">
                        <strong>[\${new Date(log.timestamp).toLocaleTimeString()}]</strong> 
                        <span style="color: \${log.level === 'error' ? '#f56565' : log.level === 'warn' ? '#ed8936' : '#4a5568'}">[\${log.level.toUpperCase()}]</span> 
                        \${log.message}
                        \${log.correlationId ? \`<small>(ID: \${log.correlationId})</small>\` : ''}
                    </div>
                \`).join('');
            } else {
                element.textContent = JSON.stringify(response.data, null, 2);
            }
        }

        async function getServerInfo() {
            const response = await makeRequest('/');
            showResponse('info-response', response);
        }

        // Auto-refresh metrics every 5 seconds when page is visible
        let metricsInterval;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(metricsInterval);
            } else {
                metricsInterval = setInterval(() => {
                    if (document.getElementById('metrics-stats').style.display !== 'none') {
                        getMetrics();
                    }
                }, 5000);
            }
        });
    </script>
</body>
</html>`
}

function handleDemo(correlationId: string): Response {
  logger.debug('Serving demo page', { correlationId })

  const html = getDemoHTML()

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
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
// For Node.js, check if this file is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}
