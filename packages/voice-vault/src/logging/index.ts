/**
 * Voice Vault Logging Infrastructure
 * Provides structured logging with correlation IDs for complete operation tracing
 */

// Import types and functions from @orchestr8/logger
import type { Logger, LogFields, LogLevel, LoggerOptions } from '@orchestr8/logger'

// Conditionally import based on Node.js version to maintain CI compatibility
let createLogger: (options?: LoggerOptions) => Promise<Logger>
let createLoggerSync: (options?: LoggerOptions) => Logger

try {
  const module = await import('@orchestr8/logger')
  createLogger = module.createLogger
  createLoggerSync = module.createLoggerSync
} catch {
  // Fallback for environments where @orchestr8/logger isn't available
  createLogger = async () => {
    return {
      child: () => createLoggerSync(),
      trace: () => {},
      debug: () => {},
      info: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    } satisfies Logger
  }
  createLoggerSync = () => {
    return {
      child: () => createLoggerSync(),
      trace: () => {},
      debug: () => {},
      info: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    } satisfies Logger
  }
}
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Get the package root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = join(__dirname, '..', '..')

// Default log directory
const DEFAULT_LOG_DIR = join(packageRoot, 'logs')

/**
 * Voice Vault specific log fields
 * Extended to support all logging scenarios across cache, providers, and audio
 */
export interface VoiceVaultLogFields extends LogFields {
  correlationId: string
  component?: 'cache' | 'provider' | 'audio' | 'api' | 'voice-vault'
  operation?: string
  cacheStatus?: 'hit' | 'miss' | 'skip' | 'error'
  provider?: string
  voice?: string
  durationMs?: number
  textLength?: number
  cacheKey?: string
  filePath?: string
  format?: string
  error?: string
  retryCount?: number
  apiCallsSaved?: number
  // Additional fields for flexible logging
  [key: string]: unknown
}

/**
 * Voice Vault logger configuration
 */
export interface VoiceVaultLoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  dir?: string
  pretty?: boolean
  enabled?: boolean
}

/**
 * Generate a Voice Vault correlation ID
 * Format: vv-[random-6]-[timestamp-6]
 */
export function generateCorrelationId(): string {
  const random = Math.random().toString(36).substring(2, 8)
  const timestamp = Date.now().toString(36).substring(0, 6)
  return `vv-${random}-${timestamp}`
}

/**
 * Extract correlation ID from various sources
 */
export function extractCorrelationId(source: unknown): string {
  if (typeof source === 'string' && source.startsWith('vv-')) {
    return source
  }
  if (typeof source === 'object' && source !== null) {
    const obj = source as Record<string, unknown>
    if (typeof obj.correlationId === 'string') {
      return obj.correlationId
    }
  }
  // Generate new ID if none found
  return generateCorrelationId()
}

/**
 * Create a Voice Vault logger instance
 */
export async function createVoiceVaultLogger(config: VoiceVaultLoggerConfig = {}): Promise<Logger> {
  const {
    level = (process.env['LOG_LEVEL'] as LogLevel) || 'info',
    dir = process.env['VOICE_VAULT_LOG_DIR'] || DEFAULT_LOG_DIR,
    pretty = process.env['LOG_PRETTY'] === 'true' || process.env['NODE_ENV'] !== 'production',
    enabled = process.env['LOG_LEVEL'] !== 'none' && process.env['LOG_LEVEL'] !== 'silent',
  } = config

  // Ensure log directory exists
  if (enabled && dir) {
    await mkdir(dir, { recursive: true })
  }

  // Create logger with Voice Vault defaults
  const logger = await createLogger({
    name: 'voice-vault',
    level: enabled ? level : 'error', // Use 'error' when disabled (highest level)
    pretty,
    defaultFields: {
      service: 'voice-vault',
      version: '0.1.0',
    },
  })

  return logger
}

/**
 * Create a synchronous Voice Vault logger
 * Note: Directory creation happens asynchronously in background
 */
export function createVoiceVaultLoggerSync(config: VoiceVaultLoggerConfig = {}): Logger {
  const {
    level = (process.env['LOG_LEVEL'] as LogLevel) || 'info',
    dir = process.env['VOICE_VAULT_LOG_DIR'] || DEFAULT_LOG_DIR,
    pretty = process.env['LOG_PRETTY'] === 'true' || process.env['NODE_ENV'] !== 'production',
    enabled = process.env['LOG_LEVEL'] !== 'none' && process.env['LOG_LEVEL'] !== 'silent',
  } = config

  // Ensure log directory exists (async in background)
  if (enabled && dir) {
    mkdir(dir, { recursive: true }).catch((err) => {
      console.error('Failed to create log directory:', err)
    })
  }

  // Create logger with Voice Vault defaults
  const logger = createLoggerSync({
    name: 'voice-vault',
    level: enabled ? level : 'error', // Use 'error' when disabled (highest level)
    pretty,
    defaultFields: {
      service: 'voice-vault',
      version: '0.1.0',
    },
  })

  return logger
}

/**
 * Log cache statistics to JSON file
 */
export async function logCacheStatistics(
  stats: {
    totalRequests: number
    cacheHits: number
    cacheMisses: number
    hitRate: number
    totalCachedFiles: number
    totalSizeMB: number
    oldestEntryDays: number
    newestEntryDays: number
    apiCallsSaved: number
    correlationIds: string[]
  },
  logDir = DEFAULT_LOG_DIR,
): Promise<void> {
  const statsFile = join(logDir, 'cache-stats.json')
  const timestamp = new Date().toISOString()

  const entry = {
    timestamp,
    ...stats,
  }

  try {
    await mkdir(logDir, { recursive: true })
    const { writeFile } = await import('node:fs/promises')

    // Read existing stats if file exists
    let allStats: Array<typeof entry> = []
    try {
      const { readFile } = await import('node:fs/promises')
      const existing = await readFile(statsFile, 'utf-8')
      allStats = JSON.parse(existing)
    } catch {
      // File doesn't exist yet
    }

    // Add new entry
    allStats.push(entry)

    // Keep only last 1000 entries
    if (allStats.length > 1000) {
      allStats = allStats.slice(-1000)
    }

    // Write back
    await writeFile(statsFile, JSON.stringify(allStats, null, 2))
  } catch (error) {
    console.error('Failed to log cache statistics:', error)
  }
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(
  parent: Logger,
  component: VoiceVaultLogFields['component'],
  correlationId?: string,
): Logger {
  return parent.child({
    component,
    correlationId: correlationId || generateCorrelationId(),
  })
}

// Re-export useful types
export type { LogFields, Logger, LogLevel }
