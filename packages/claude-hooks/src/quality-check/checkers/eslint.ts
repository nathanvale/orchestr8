/**
 * ESLint checker with smart import resolution for TDD
 */

import path from 'node:path'

import type { Logger } from '../../utils/logger.js'
import type { ResolvedQualityConfig } from '../config.js'

import { findProjectRoot } from '../../utils/config-loader.js'
import { fileExists, readFile, writeFile } from '../../utils/file-utils.js'
import { createDummyFile } from '../dummy-generator.js'
import {
  determineFileExtension,
  extractImportErrors,
  parseImportStatement,
  resolveImportPath,
} from '../import-parser.js'

export interface ESLintChecker {
  check(): Promise<{
    errors: string[]
    autofixes: string[]
    warnings: string[]
  }>
}

export async function createESLintChecker(
  filePath: string,
  config: ResolvedQualityConfig,
  log: Logger,
): Promise<ESLintChecker | null> {
  if (!config.eslintEnabled) {
    return null
  }

  const projectRoot = findProjectRoot(path.dirname(filePath))
  const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)

  // Try to load ESLint using standard import
  let ESLint: typeof import('eslint').ESLint

  try {
    const eslintModule = await import('eslint')
    ESLint = eslintModule.ESLint
  } catch (error) {
    log.debug(`Failed to load ESLint: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return null
  }

  return {
    async check(): Promise<{
      errors: string[]
      autofixes: string[]
      warnings: string[]
    }> {
      const errors: string[] = []
      const autofixes: string[] = []
      const warnings: string[] = []

      log.info('Running ESLint...')

      try {
        const eslint = new ESLint({
          fix: config.eslintAutofix,
          cwd: process.cwd(), // Use monorepo root for ESLint
        })

        let results = await eslint.lintFiles([filePath])
        let result = results[0]

        // Handle import errors in test files during TDD
        if (isTestFile && result?.messages) {
          const importErrors = extractImportErrors(result.messages)

          if (importErrors.length > 0) {
            log.info(
              'Detected import errors in test file, checking if dummy implementations needed...',
            )
            let dummiesCreated = false

            try {
              // Read the test file to find import statements
              const fileContent = await readFile(filePath)
              const lines = fileContent.split('\n')

              for (const importError of importErrors) {
                if (!importError.importPath) continue

                // Find the import statement on the error line
                const importLine = lines[importError.line - 1]
                if (!importLine) continue

                const parsedImport = parseImportStatement(importLine)
                if (!parsedImport?.isRelative) continue

                // Resolve the import path
                const resolvedPath = resolveImportPath(
                  parsedImport.importPath,
                  filePath,
                  projectRoot,
                )

                // Determine file extension
                const ext = determineFileExtension(resolvedPath, parsedImport.isTypeOnly, filePath)

                const fullPath = path.join(projectRoot, resolvedPath + ext)

                // Check if file exists
                if (!(await fileExists(fullPath))) {
                  // Create dummy implementation
                  const created = await createDummyFile(fullPath, parsedImport, (msg) =>
                    log.info(msg),
                  )

                  if (created) {
                    dummiesCreated = true
                  }
                }
              }

              // Re-lint if we created any dummy files
              if (dummiesCreated) {
                log.info('Re-running ESLint after creating dummy implementations...')
                results = await eslint.lintFiles([filePath])
                result = results[0]
              }
            } catch (error) {
              log.debug(
                `Error handling import errors: ${error instanceof Error ? error.message : 'Unknown error'}`,
              )
            }
          }
        }

        // Check for unused variable errors that might be incorrectly "fixed" with underscores
        if (result?.messages) {
          const unusedVarErrors = result.messages.filter(
            (msg) => msg.ruleId === '@typescript-eslint/no-unused-vars',
          )

          if (unusedVarErrors.length > 0) {
            // Analyze if these are legitimate underscore cases or code that should be deleted
            for (const error of unusedVarErrors) {
              const line = error.line
              const varName = error.message.match(/'([^']+)'/)?.[1]

              if (varName && !varName.startsWith('_')) {
                // This is a genuinely unused variable that should be considered for deletion
                warnings.push(
                  `Line ${line}: Variable '${varName}' is unused. Consider deleting it instead of adding an underscore prefix.`,
                )
              } else if (varName?.startsWith('_')) {
                // Check if this underscore usage is legitimate
                const fileContent = await readFile(filePath)
                const lines = fileContent.split('\n')
                const codeLine = lines[line - 1]

                // Check for legitimate underscore patterns
                const isDestructuring = /\[.*_.*\]|\{.*_.*\}/.test(codeLine)
                const isCatchBlock = /catch.*\(_/.test(codeLine)
                const isFunctionParam = /function.*\(.*_|=>.*\(.*_/.test(codeLine)

                if (!isDestructuring && !isCatchBlock && !isFunctionParam) {
                  warnings.push(
                    `Line ${line}: Variable '${varName}' uses underscore prefix but may not be a legitimate case. Consider deletion.`,
                  )
                }
              }
            }
          }
        }

        if (result && (result.errorCount > 0 || result.warningCount > 0)) {
          if (config.eslintAutofix) {
            log.warning('ESLint issues found, attempting auto-fix...')

            // Write the fixed output
            if (result.output) {
              await writeFile(filePath, result.output)

              // Re-lint to see if issues remain
              const resultsAfterFix = await eslint.lintFiles([filePath])
              const resultAfterFix = resultsAfterFix[0]

              if (
                resultAfterFix &&
                resultAfterFix.errorCount === 0 &&
                resultAfterFix.warningCount === 0
              ) {
                log.success('ESLint auto-fixed all issues!')
                if (config.autofixSilent) {
                  autofixes.push('ESLint auto-fixed formatting/style issues')
                } else {
                  errors.push('ESLint issues were auto-fixed - verify the changes')
                }
              } else {
                errors.push(`ESLint found issues that couldn't be auto-fixed in ${filePath}`)
                const formatter = await eslint.loadFormatter('stylish')
                const output = await formatter.format(resultsAfterFix)
                console.error(output)
              }
            } else {
              errors.push(`ESLint found issues in ${filePath}`)
              const formatter = await eslint.loadFormatter('stylish')
              const output = await formatter.format(results)
              console.error(output)
            }
          } else {
            errors.push(`ESLint found issues in ${filePath}`)
            const formatter = await eslint.loadFormatter('stylish')
            const output = await formatter.format(results)
            console.error(output)
          }
        } else {
          log.success('ESLint passed')
        }
      } catch (error) {
        log.debug(`ESLint check error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Add warnings to errors if we found potential misuse of underscores
      if (warnings.length > 0) {
        errors.push(`\n⚠️  Potential misuse of underscore prefix detected:\n${warnings.join('\n')}`)
      }

      return { errors, autofixes, warnings }
    },
  }
}
