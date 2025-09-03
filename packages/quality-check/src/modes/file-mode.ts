/**
 * File mode for processing individual files
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'

import type { Logger } from '@orchestr8/logger'

import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckOptions, QualityCheckResult } from '../types.js'

export async function fileMode(
  filePath: string,
  options: QualityCheckOptions,
  logger: Logger,
): Promise<QualityCheckResult> {
  const startTime = performance.now()
  const correlationId = options.correlationId ?? 'file-mode'

  logger.debug('Starting file mode processing', {
    correlationId,
    filePath: path.relative(process.cwd(), filePath),
  })

  try {
    // Validate file exists and is readable
    await validateFile(filePath, logger)

    // Create QualityChecker instance
    const checker = new QualityChecker(filePath, options, logger)

    // Run checks
    const result = await checker.check()

    const duration = performance.now() - startTime
    logger.debug('File mode processing completed', {
      correlationId,
      duration: Math.round(duration),
      success: result.success,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      autofixCount: result.autofixes.length,
    })

    return {
      ...result,
      correlationId,
      duration: Math.round(duration),
    }
  } catch (error) {
    const duration = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('File mode processing failed', {
      correlationId,
      error: errorMessage,
      filePath: path.relative(process.cwd(), filePath),
      duration: Math.round(duration),
    })

    return {
      success: false,
      errors: [`File processing error: ${errorMessage}`],
      warnings: [],
      autofixes: [],
      correlationId,
      duration: Math.round(duration),
      checkers: {},
    }
  }
}

/**
 * Validate that the file exists and is readable
 */
async function validateFile(filePath: string, logger: Logger): Promise<void> {
  try {
    // Resolve to absolute path
    const absolutePath = path.resolve(filePath)

    // Check if file exists
    const stats = await fs.stat(absolutePath)

    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`)
    }

    // Check if file is readable
    await fs.access(absolutePath, fs.constants.R_OK)

    // Check file size (prevent processing very large files)
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    if (stats.size > maxFileSize) {
      throw new Error(
        `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max: ${maxFileSize / 1024 / 1024}MB)`,
      )
    }

    // Check file extension (only process known file types)
    const ext = path.extname(absolutePath).toLowerCase()
    const supportedExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.json',
      '.md',
      '.yaml',
      '.yml',
      '.html',
      '.css',
      '.scss',
      '.less',
    ]

    if (!supportedExtensions.includes(ext)) {
      logger.debug(`Skipping unsupported file type: ${ext}`, { filePath })
      throw new Error(`Unsupported file type: ${ext}`)
    }

    logger.debug('File validation passed', {
      filePath: path.relative(process.cwd(), absolutePath),
      size: `${(stats.size / 1024).toFixed(1)}KB`,
      extension: ext,
    })
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw validation errors with context
      throw new Error(`File validation failed: ${error.message}`)
    }
    throw new Error('File validation failed: Unknown error')
  }
}
