import type { LogEntry, ServerMetrics } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

export async function fetchServerLogs(): Promise<LogEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/logs`)
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`)
  }
  return response.json()
}

export async function fetchServerMetrics(): Promise<ServerMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/metrics`)
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`)
  }
  return response.json()
}
