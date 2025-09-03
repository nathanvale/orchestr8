/**
 * Common code issues checker
 */

import path from 'node:path'

import type { Logger } from '../../utils/logger.js'
import type { ResolvedQualityConfig } from '../config.js'

import { readFile } from '../../utils/file-utils.js'

export interface CommonIssuesChecker {
  check(fileType: string): Promise<string[]>
}

export async function createCommonIssuesChecker(
  filePath: string,
  config: ResolvedQualityConfig,
  log: Logger,
): Promise<CommonIssuesChecker> {
  return {
    async check(fileType: string): Promise<string[]> {
      const errors: string[] = []
      log.info('Checking for common issues...')

      try {
        const content = await readFile(filePath)
        const lines = content.split('\n')
        let foundIssues = false

        // Check for 'as any' in TypeScript files
        const asAnyRule = config.fileConfig.rules?.asAny || {}
        if (
          (fileType === 'typescript' || fileType === 'component') &&
          asAnyRule.enabled !== false
        ) {
          for (const [index, line] of lines.entries()) {
            // Check for 'as any' but exclude string literals and comments
            const asAnyRegex = /\bas\s+any\b/
            // Remove string literals and comments from the line for checking
            const lineWithoutStrings = line
              .replace(/"[^"]*"/g, '') // Remove double-quoted strings
              .replace(/'[^']*'/g, '') // Remove single-quoted strings
              .replace(/`[^`]*`/g, '') // Remove template literals
              .replace(/\/\/.*$/, '') // Remove single-line comments
              .replace(/\/\*.*?\*\//g, '') // Remove inline comments

            if (asAnyRegex.test(lineWithoutStrings)) {
              const severity = asAnyRule.severity || 'error'
              const message =
                asAnyRule.message || 'Prefer proper types or "as unknown" for type assertions'

              if (severity === 'error') {
                errors.push(`Found 'as any' usage in ${filePath} - ${message}`)
                console.error(`  Line ${index + 1}: ${line.trim()}`)
                foundIssues = true
              } else {
                log.warning(`'as any' usage at line ${index + 1}: ${message}`)
              }
            }
          }
        }

        // Check for console statements
        const consoleRule = config.fileConfig.rules?.console || {}
        let allowConsole = false

        if (consoleRule.enabled === false) {
          allowConsole = true
        } else {
          // Check allowed paths
          const allowedPaths = consoleRule.allowIn?.paths || []
          if (allowedPaths.some((allowPath) => filePath.includes(allowPath))) {
            allowConsole = true
          }

          // Check allowed file types
          const allowedFileTypes = consoleRule.allowIn?.fileTypes || []
          if (allowedFileTypes.includes(fileType)) {
            allowConsole = true
          }

          // Check allowed patterns
          const allowedPatterns = consoleRule.allowIn?.patterns || []
          const fileName = path.basename(filePath)
          if (
            allowedPatterns.some((pattern) => {
              const regex = new RegExp(pattern.replace(/\*/g, '.*'))
              return regex.test(fileName)
            })
          ) {
            allowConsole = true
          }
        }

        if (!allowConsole && consoleRule.enabled !== false) {
          for (const [index, line] of lines.entries()) {
            if (/console\./.test(line)) {
              const severity = consoleRule.severity || 'info'
              const message = consoleRule.message || 'Consider using a logging library'

              if (severity === 'error') {
                errors.push(`Found console statements in ${filePath} - ${message}`)
                console.error(`  Line ${index + 1}: ${line.trim()}`)
                foundIssues = true
              } else {
                log.warning(`Console usage at line ${index + 1}: ${message}`)
              }
            }
          }
        }

        // Check for TODO/FIXME comments
        for (const [index, line] of lines.entries()) {
          if (/TODO|FIXME/.test(line)) {
            log.warning(`Found TODO/FIXME comment at line ${index + 1}`)
          }
        }

        if (!foundIssues) {
          log.success('No common issues found')
        }
      } catch (error) {
        log.debug(
          `Common issues check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }

      return errors
    },
  }
}
