/**
 * Configuration utility for logging components
 * Centralizes log directory and configuration management
 */

import { EventLogger, type EventLoggerConfig } from './event-logger.js'
import { TranscriptParser, type TranscriptParserConfig } from './transcript-parser.js'

export interface LogConfigOptions {
  useLocal?: boolean
  logDir?: string
  maxFileSize?: number
  retentionDays?: number
}

/**
 * Centralized configuration for all logging components
 */
export class LogConfig {
  /**
   * Get default configuration options
   */
  static getDefaultOptions(): Required<LogConfigOptions> {
    return {
      useLocal: false,
      logDir: '', // Will be determined by useLocal flag
      maxFileSize: 10 * 1024 * 1024, // 10MB
      retentionDays: 30,
    }
  }

  /**
   * Generate EventLogger configuration from options
   */
  static getEventLoggerConfig(options: LogConfigOptions = {}): EventLoggerConfig {
    const defaults = LogConfig.getDefaultOptions()

    const config: EventLoggerConfig = {
      maxFileSize: options.maxFileSize ?? defaults.maxFileSize,
      retentionDays: options.retentionDays ?? defaults.retentionDays,
    }

    if (options.logDir != null && options.logDir !== '') {
      config.logDir = options.logDir
      config.useLocalDir = false
    } else {
      config.useLocalDir = options.useLocal ?? defaults.useLocal
    }

    return config
  }

  /**
   * Generate TranscriptParser configuration from options
   */
  static getTranscriptParserConfig(options: LogConfigOptions = {}): TranscriptParserConfig {
    const defaults = LogConfig.getDefaultOptions()

    const config: TranscriptParserConfig = {}

    if (options.logDir != null && options.logDir !== '') {
      config.storageDir = options.logDir
      config.useLocalDir = false
    } else {
      config.useLocalDir = options.useLocal ?? defaults.useLocal
    }

    return config
  }

  /**
   * Create a configured EventLogger instance
   */
  static createConfiguredEventLogger(options: LogConfigOptions = {}): EventLogger {
    const config = LogConfig.getEventLoggerConfig(options)
    return new EventLogger(config)
  }

  /**
   * Create a configured TranscriptParser instance
   */
  static createConfiguredTranscriptParser(options: LogConfigOptions = {}): TranscriptParser {
    const config = LogConfig.getTranscriptParserConfig(options)
    return new TranscriptParser(config)
  }

  /**
   * Get common log directories for reference
   */
  static getLogDirectories(): Record<string, Record<string, string>> {
    return {
      global: {
        events: '~/.claude/logs/events',
        transcripts: '~/.claude/logs/transcripts',
      },
      local: {
        events: './.claude/logs/events',
        transcripts: './.claude/logs/transcripts',
      },
    }
  }

  /**
   * Create both logger and parser with consistent configuration
   */
  static createLoggingComponents(options: LogConfigOptions = {}): {
    eventLogger: EventLogger
    transcriptParser: TranscriptParser
  } {
    return {
      eventLogger: LogConfig.createConfiguredEventLogger(options),
      transcriptParser: LogConfig.createConfiguredTranscriptParser(options),
    }
  }
}
