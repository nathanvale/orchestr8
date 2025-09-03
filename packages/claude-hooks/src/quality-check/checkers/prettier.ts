/**
 * Prettier formatter checker
 */

import path from 'node:path'

import type { Logger } from '../../utils/logger.js'
import type { ResolvedQualityConfig } from '../config.js'

import { findProjectRoot } from '../../utils/config-loader.js'
import { readFile, writeFile } from '../../utils/file-utils.js'

export interface PrettierChecker {
  check(): Promise<{ errors: string[]; autofixes: string[] }>
}

export async function createPrettierChecker(
  filePath: string,
  config: ResolvedQualityConfig,
  log: Logger,
): Promise<PrettierChecker | null> {
  if (!config.prettierEnabled) {
    return null
  }

  const projectRoot = findProjectRoot(path.dirname(filePath))

  // Try to load Prettier
  let prettier: typeof import('prettier')
  try {
    const prettierPath = path.join(projectRoot, 'node_modules', 'prettier', 'index.cjs')
    const prettierModule = await import(prettierPath)
    // Handle CommonJS default export
    if ('default' in prettierModule && prettierModule.default) {
      prettier = prettierModule.default as typeof import('prettier')
    } else {
      prettier = prettierModule as typeof import('prettier')
    }
  } catch (error) {
    log.debug(`Prettier not found in project - will skip Prettier checks. Error: ${String(error)}`)
    return null
  }

  return {
    async check(): Promise<{ errors: string[]; autofixes: string[] }> {
      const errors: string[] = []
      const autofixes: string[] = []

      log.info('Running Prettier check...')

      try {
        const fileContent = await readFile(filePath)
        const prettierConfig = await prettier.resolveConfig(filePath)

        const isFormatted = await prettier.check(fileContent, {
          ...prettierConfig,
          filepath: filePath,
        })

        if (!isFormatted) {
          if (config.prettierAutofix) {
            log.warning('Prettier formatting issues found, auto-fixing...')

            const formatted = await prettier.format(fileContent, {
              ...prettierConfig,
              filepath: filePath,
            })

            await writeFile(filePath, formatted)
            log.success('Prettier auto-formatted the file!')

            if (config.autofixSilent) {
              autofixes.push('Prettier auto-formatted the file')
            } else {
              errors.push('Prettier formatting was auto-fixed - verify the changes')
            }
          } else {
            errors.push(`Prettier formatting issues in ${filePath}`)
            console.error('Run prettier --write to fix')
          }
        } else {
          log.success('Prettier formatting correct')
        }
      } catch (error) {
        log.debug(
          `Prettier check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }

      return { errors, autofixes }
    },
  }
}
