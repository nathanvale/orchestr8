/**
 * Event logger for Claude Code hooks
 * Logs events to JSON files with rotation support
 */

import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import type { ClaudeEvent } from '../types/claude.js'

export interface EventLoggerConfig {
  logDir?: string
  useLocalDir?: boolean
  maxFileSize?: number
  retentionDays?: number
}

export interface LoggedEvent {
  timestamp: string
  event: ClaudeEvent
  metadata?: Record<string, unknown>
}

export interface ReadEventOptions {
  type?: string
}

export class EventLogger {
  private readonly config: EventLoggerConfig
  private readonly logDir: string

  constructor(config: EventLoggerConfig = {}) {
    this.config = config

    if (config.logDir != null && config.logDir !== '') {
      this.logDir = config.logDir
    } else if (config.useLocalDir === true) {
      this.logDir = path.join(process.cwd(), '.claude', 'logs', 'events')
    } else {
      this.logDir = path.join(os.homedir(), '.claude', 'logs', 'events')
    }
  }

  /**
   * Log an event to a JSON file
   */
  async logEvent(event: ClaudeEvent, metadata?: Record<string, unknown>): Promise<void> {
    try {
      // Ensure log directory exists
      await fs.mkdir(this.logDir, { recursive: true })

      // Get current date for file name
      const date = new Date()
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
      const logFile = path.join(this.logDir, `${dateStr}.jsonl`)

      // Check if we need to rotate the file
      try {
        const stats = await fs.stat(logFile)
        if (this.config.maxFileSize != null && stats.size > this.config.maxFileSize) {
          // File too large, rotate it
          const rotatedFile = this.getRotatedFileName(logFile)
          await fs.rename(logFile, rotatedFile)
        }
      } catch {
        // File doesn't exist yet, that's fine
      }

      // Create log entry
      const logEntry: LoggedEvent = {
        timestamp: date.toISOString(),
        event,
      }

      if (metadata) {
        logEntry.metadata = metadata
      }

      // Append to log file
      await fs.writeFile(logFile, `${JSON.stringify(logEntry)}\n`, {
        flag: 'a',
      })
    } catch {
      // Silently fail - we don't want logging to break the hook
      // In production, we might want to log this to stderr
    }
  }

  /**
   * Read events from a log file
   */
  async readEvents(date: string, options: ReadEventOptions = {}): Promise<LoggedEvent[]> {
    try {
      const logFile = path.join(this.logDir, `${date}.jsonl`)
      const content = await fs.readFile(logFile, 'utf-8')

      const events: LoggedEvent[] = []
      const lines = content.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as LoggedEvent

          // Filter by type if specified
          if (options.type != null && options.type !== '' && event.event.type !== options.type) {
            continue
          }

          events.push(event)
        } catch {
          // Skip malformed entries
        }
      }

      return events
    } catch {
      // Return empty array if file doesn't exist or can't be read
      return []
    }
  }

  /**
   * Generate a rotated file name with timestamp
   */
  private getRotatedFileName(originalFile: string): string {
    const dir = path.dirname(originalFile)
    const ext = path.extname(originalFile)
    const baseName = path.basename(originalFile, ext)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return path.join(dir, `${baseName}-${timestamp}${ext}`)
  }

  /**
   * Clean up old log files based on retention policy
   */
  async cleanupOldLogs(): Promise<void> {
    if (this.config.retentionDays == null || this.config.retentionDays <= 0) {
      return
    }

    try {
      const files = await fs.readdir(this.logDir)
      const now = Date.now()
      const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000 // days to ms

      for (const file of files) {
        if (!file.endsWith('.jsonl')) {
          continue
        }

        const filePath = path.join(this.logDir, file)
        const stats = await fs.stat(filePath)

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
        }
      }
    } catch {
      // Silently fail cleanup
    }
  }
}
