import { average, median, percentile } from '@bun-template/utils'
import { createConsoleLogger } from '@orchestr8/logger'
import { useEffect, useState } from 'react'
import LogDashboard from './components/LogDashboard'
import MetricsPanel from './components/MetricsPanel'
import { fetchServerLogs, fetchServerMetrics } from './services/api'
import type { LogEntry, ServerMetrics } from './types'

const logger = createConsoleLogger({
  name: 'TelemetryDashboard',
  level: 'debug',
})

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        logger.info('Fetching telemetry data')

        const [logsData, metricsData] = await Promise.all([fetchServerLogs(), fetchServerMetrics()])

        setLogs(logsData)

        // Process metrics using utils
        const responseTimes = metricsData.responseTimes
        const processedMetrics: ServerMetrics = {
          ...metricsData,
          stats: {
            averageResponseTime: average(responseTimes),
            medianResponseTime: median(responseTimes),
            p95ResponseTime: percentile(responseTimes, 95),
            p99ResponseTime: percentile(responseTimes, 99),
          },
        }

        setMetrics(processedMetrics)
        logger.info('Telemetry data loaded successfully')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch data'
        logger.error('Failed to fetch telemetry data', { error: message })
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    // Refresh data every 5 seconds
    const interval = setInterval(fetchData, 5000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading && !logs.length) {
    return (
      <div className="loading">
        <h2>Loading telemetry data...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error loading telemetry</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📊 Telemetry Dashboard</h1>
        <p>Real-time monitoring powered by @orchestr8/logger</p>
      </header>

      <main className="app-main">
        {metrics && <MetricsPanel metrics={metrics} />}
        <LogDashboard logs={logs} />
      </main>
    </div>
  )
}

export default App
