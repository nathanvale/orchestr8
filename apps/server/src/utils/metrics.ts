/**
 * Simple in-memory metrics collector
 */
export interface MetricsCollector {
  recordRequest(responseTime: number, isError: boolean): void
  getMetrics(): {
    totalRequests: number
    errorCount: number
    responseTimes: number[]
  }
}

export function createMetricsCollector(): MetricsCollector {
  let totalRequests = 0
  let errorCount = 0
  const responseTimes: number[] = []
  const maxResponseTimes = 1000 // Keep last 1000 response times

  return {
    recordRequest(responseTime: number, isError: boolean) {
      totalRequests++

      if (isError) {
        errorCount++
      }

      responseTimes.push(responseTime)

      // Keep only the last N response times
      if (responseTimes.length > maxResponseTimes) {
        responseTimes.shift()
      }
    },

    getMetrics() {
      return {
        totalRequests,
        errorCount,
        responseTimes: [...responseTimes], // Return a copy
      }
    },
  }
}
