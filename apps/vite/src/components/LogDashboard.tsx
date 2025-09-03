import React, { useMemo, useState } from 'react'
import type { LogEntry } from '../types'

interface LogDashboardProps {
  logs: LogEntry[]
}

function LogDashboard({ logs }: LogDashboardProps): React.JSX.Element {
  const [filter, setFilter] = useState<string>('')
  const [levelFilter, setLevelFilter] = useState<string>('all')

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesText =
        filter === '' ||
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        (log.correlationId?.includes(filter) ?? false)

      const matchesLevel = levelFilter === 'all' || log.level === levelFilter

      return matchesText && matchesLevel
    })
  }, [logs, filter, levelFilter])

  const getLevelColor = (level: string): string => {
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
      <LogHeader
        filter={filter}
        setFilter={setFilter}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
      />
      <LogList logs={filteredLogs} getLevelColor={getLevelColor} />
    </div>
  )
}

interface LogHeaderProps {
  filter: string
  setFilter: (value: string) => void
  levelFilter: string
  setLevelFilter: (value: string) => void
}

function LogHeader({
  filter,
  setFilter,
  levelFilter,
  setLevelFilter,
}: LogHeaderProps): React.JSX.Element {
  return (
    <div className="log-header">
      <h2>📝 Server Logs</h2>
      <div className="log-filters">
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
          }}
          className="filter-input"
        />
        <select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value)
          }}
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
  )
}

interface LogListProps {
  logs: LogEntry[]
  getLevelColor: (level: string) => string
}

function LogList({ logs, getLevelColor }: LogListProps): React.JSX.Element {
  return (
    <div className="log-container">
      {logs.length === 0 ? (
        <div className="no-logs">No logs to display</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="log-entry">
            <span className="log-timestamp">{log.timestamp}</span>
            <span className="log-level" style={{ color: getLevelColor(log.level) }}>
              [{log.level.toUpperCase()}]
            </span>
            <span className="log-message">{log.message}</span>
            {log.correlationId != null && (
              <span className="log-correlation">({log.correlationId})</span>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default LogDashboard
