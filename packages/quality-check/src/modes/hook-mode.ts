/**
 * Hook mode for processing Claude Code hook payloads
 */

import type { Logger } from '@orchestr8/logger'
import { generateCorrelationId } from '@orchestr8/logger'

import type { HookPayload, QualityCheckOptions, QualityCheckResult } from '../types.js'
import { fileMode } from './file-mode.js'

export async function hookMode(
  options: QualityCheckOptions,
  logger: Logger,
): Promise<QualityCheckResult> {
  const startTime = performance.now()
  const correlationId = options.correlationId ?? generateCorrelationId('hook')

  logger.debug('Starting hook mode processing', { correlationId })

  try {
    // Read JSON from stdin
    const stdinData = await readStdin()

    if (!stdinData.trim()) {
      throw new Error('No data received from stdin')
    }

    // Parse Claude Code hook payload (support modern and legacy formats)
    const payload = parseHookPayload(stdinData)
    const filePath = extractFilePath(payload)

    logger.debug('Parsed hook payload', {
      correlationId,
      payload: {
        tool: payload.tool,
        path: payload.path ?? payload.filePath,
        hasProjectDir: Boolean(payload.projectDir),
      },
    })

    // Call fileMode with extracted path
    const result = await fileMode(filePath, { ...options, correlationId }, logger)

    // Return result with correlation ID and updated timing
    const duration = performance.now() - startTime
    return {
      ...result,
      correlationId,
      duration: Math.round(duration),
    }
  } catch (error) {
    const duration = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Hook mode processing failed', {
      correlationId,
      error: errorMessage,
      duration: Math.round(duration),
    })

    return {
      success: false,
      errors: [`Hook mode error: ${errorMessage}`],
      warnings: [],
      autofixes: [],
      correlationId,
      duration: Math.round(duration),
      checkers: {},
    }
  }
}

/**
 * Read all data from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''

    process.stdin.setEncoding('utf8')

    process.stdin.on('readable', () => {
      let chunk: string | null
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk
      }
    })

    process.stdin.on('end', () => {
      resolve(data)
    })

    process.stdin.on('error', (error) => {
      reject(new Error(`Failed to read stdin: ${error.message}`))
    })

    // Set a reasonable timeout for stdin reading
    const timeout = setTimeout(() => {
      reject(new Error('Timeout reading from stdin'))
    }, 5000)

    process.stdin.on('end', () => {
      clearTimeout(timeout)
    })
  })
}

/**
 * Parse Claude Code hook payload supporting both modern and legacy formats
 */
function parseHookPayload(data: string): HookPayload {
  try {
    const parsed = JSON.parse(data) as unknown

    // Validate that we have an object
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Hook payload must be a JSON object')
    }

    const payload = parsed as Record<string, unknown>

    // Extract tool name (required)
    if (typeof payload.tool !== 'string') {
      throw new Error('Hook payload must include "tool" field')
    }

    // Extract file path - support both modern (path) and legacy (filePath) formats
    const path = typeof payload.path === 'string' ? payload.path : undefined
    const filePath = typeof payload.filePath === 'string' ? payload.filePath : undefined

    if (!path && !filePath) {
      throw new Error('Hook payload must include either "path" or "filePath" field')
    }

    // Extract optional fields
    const projectDir = typeof payload.projectDir === 'string' ? payload.projectDir : undefined
    const timestamp = typeof payload.timestamp === 'string' ? payload.timestamp : undefined

    return {
      tool: payload.tool,
      path,
      filePath,
      projectDir,
      timestamp,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse hook payload: ${error.message}`)
    }
    throw new Error('Failed to parse hook payload: Unknown error')
  }
}

/**
 * Extract file path from hook payload, preferring modern format
 */
function extractFilePath(payload: HookPayload): string {
  // Prefer modern 'path' field over legacy 'filePath'
  const filePath = payload.path ?? payload.filePath

  if (!filePath) {
    throw new Error('No file path found in hook payload')
  }

  // Validate the file path
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('File path must be a non-empty string')
  }

  // Basic security check - prevent path traversal attempts
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw new Error('Invalid file path - path traversal or absolute paths not allowed')
  }

  return filePath.trim()
}
