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
