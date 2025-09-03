import React from 'react'
import type { ServerMetrics } from '../types'

interface MetricsPanelProps {
  metrics: ServerMetrics
}

function MetricsPanel({ metrics }: MetricsPanelProps): React.JSX.Element {
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const formatResponseTime = (ms: number): string => {
    return `${ms.toFixed(2)}ms`
  }

  const errorRate =
    metrics.totalRequests > 0
      ? ((metrics.errorCount / metrics.totalRequests) * 100).toFixed(2)
      : '0.00'

  return (
    <div className="metrics-panel">
      <h2>📈 Server Metrics</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Requests</div>
          <div className="metric-value">{metrics.totalRequests.toLocaleString()}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Error Rate</div>
          <div className="metric-value error">{errorRate}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Uptime</div>
          <div className="metric-value">{formatUptime(metrics.uptime)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Avg Response</div>
          <div className="metric-value">
            {formatResponseTime(metrics.stats.averageResponseTime)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Median Response</div>
          <div className="metric-value">{formatResponseTime(metrics.stats.medianResponseTime)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">P95 Response</div>
          <div className="metric-value">{formatResponseTime(metrics.stats.p95ResponseTime)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">P99 Response</div>
          <div className="metric-value">{formatResponseTime(metrics.stats.p99ResponseTime)}</div>
        </div>
      </div>
    </div>
  )
}

export default MetricsPanel
