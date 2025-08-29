import { useMemo, useState } from 'react'
import type { LogEntry } from '../types'

interface LogDashboardProps {
  logs: LogEntry[]
}

function LogDashboard({ logs }: LogDashboardProps) {
  const [filter, setFilter] = useState<string>('')
  const [levelFilter, setLevelFilter] = useState<string>('all')

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesText =
        filter === '' ||
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.correlationId?.includes(filter)

      const matchesLevel = levelFilter === 'all' || log.level === levelFilter

      return matchesText && matchesLevel
    })
  }, [logs, filter, levelFilter])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff4444'
      case 'warn':
        return '#ffaa00'
      case 'info':
        return '#44aaff'
      case 'debug':
        return '#888888'
      default:
        return '#cccccc'
    }
  }

  return (
    <div className="log-dashboard">
      <div className="log-header">
        <h2>📝 Server Logs</h2>
        <div className="log-filters">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-input"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="level-select"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <div className="log-container">
        {filteredLogs.length === 0 ? (
          <div className="no-logs">No logs to display</div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="log-entry">
              <span className="log-timestamp">{log.timestamp}</span>
              <span className="log-level" style={{ color: getLevelColor(log.level) }}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="log-message">{log.message}</span>
              {log.correlationId && <span className="log-correlation">({log.correlationId})</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default LogDashboard
