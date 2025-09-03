import { API_BASE_URL } from '../env'
import type { LogEntry, ServerMetrics } from '../types'

export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  if (!response.ok) {
    throw new Error(`Failed to fetch health: ${response.statusText}`)
  }
  return response.json() as Promise<{ status: string; uptime: number }>
}

export async function fetchServerLogs(): Promise<LogEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/logs`)
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`)
  }
  return response.json() as Promise<LogEntry[]>
}

export async function fetchServerMetrics(): Promise<ServerMetrics> {
  const response = await fetch(`${API_BASE_URL}/api/metrics`)
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`)
  }
  return response.json() as Promise<ServerMetrics>
}
