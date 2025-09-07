/* eslint-disable max-lines-per-function */
/**
 * Claude Facade - Entry point for Claude Code hook integration
 * Enhanced with structured logging and end-to-end observability
 */

import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { ExitCodes } from '../core/exit-codes.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { QualityCheckerV2 } from '../core/quality-checker-v2.js'
import { OutputFormatter, OutputMode } from '../formatters/output-formatter.js'
import { createTimer, logger } from '../utils/logger.js'

// Claude Code payload format - matches actual Claude Code structure
interface ClaudeCodePayload {
  tool_name: string // "Write", "Edit", "MultiEdit"
  tool_input: {
    file_path: string
    content?: string // For Write
    old_string?: string // For Edit
    new_string?: string // For Edit
    edits?: Array<{
      // For MultiEdit
      old_string: string
      new_string: string
    }>
  }
}

export async function runClaudeHook(): Promise<void> {
  // Early exit if hook is disabled
  if (process.env.CLAUDE_HOOK_DISABLED === 'true') {
    process.exit(ExitCodes.SUCCESS)
    return
  }

  const hookTimer = createTimer('hook-execution')
  const correlationId = logger.setCorrelationId()

  // We'll determine if we should be silent based on the Autopilot decision
  // So we'll hold off on any output initially

  try {
    logger.debug('Hook started', { correlationId })

    // Read and parse payload from stdin
    const input = await readStdin()
    let payload: ClaudeCodePayload | undefined

    try {
      if (!input || input.trim() === '') {
        logger.warn('Empty stdin payload, exiting gracefully')
        process.exit(ExitCodes.SUCCESS)
        return
      }

      const parsed = JSON.parse(input)
      // Additional safety check for null/undefined parsed content
      if (parsed === null || parsed === undefined) {
        logger.warn('Null/undefined payload after parsing, exiting gracefully')
        process.exit(ExitCodes.SUCCESS)
        return
      }

      payload = parsed as ClaudeCodePayload
      logger.payloadReceived(payload)
      logger.payloadValidation(true)
    } catch (parseError) {
      logger.payloadValidation(false, [(parseError as Error).message])
      logger.warn('Malformed JSON payload, exiting gracefully')
      // Silent exit for malformed payloads
      process.exit(ExitCodes.SUCCESS)
      return
    }

    // Validate required fields (only if we have a valid payload)
    if (!payload || !payload.tool_name || !payload.tool_input || !payload.tool_input.file_path) {
      logger.warn('Invalid payload: missing required fields', {
        hasPayload: !!payload,
        hasToolName: payload ? !!payload.tool_name : false,
        hasFilePath: payload?.tool_input ? !!payload.tool_input.file_path : false,
      })
      process.exit(ExitCodes.SUCCESS)
      return // Additional safety return to satisfy TypeScript and prevent further execution
    }

    // Only process supported operations
    if (!shouldProcessOperation(payload.tool_name)) {
      logger.debug('Skipping unsupported operation', {
        operation: payload.tool_name,
        supportedOps: ['Write', 'Edit', 'MultiEdit'],
      })
      process.exit(ExitCodes.SUCCESS)
      return // Additional safety return
    }

    // Skip non-code files
    if (!isSupportedFileType(payload.tool_input.file_path)) {
      logger.debug('Skipping non-code file', {
        filePath: payload.tool_input.file_path,
        fileExtension: payload.tool_input.file_path.split('.').pop(),
      })
      process.exit(ExitCodes.SUCCESS)
      return // Additional safety return
    }

    // Log hook started only after all skip checks pass
    logger.hookStarted(payload.tool_name, payload.tool_input.file_path)

    // For Write operations, write the file first (skip for test paths)
    if (
      payload.tool_name === 'Write' &&
      payload.tool_input.content &&
      !payload.tool_input.file_path.startsWith('/test/')
    ) {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')

      // Ensure directory exists
      const dir = path.dirname(payload.tool_input.file_path)
      await fs.mkdir(dir, { recursive: true })

      // Write the file
      await fs.writeFile(payload.tool_input.file_path, payload.tool_input.content, 'utf8')
      logger.debug('File written for Write operation', {
        filePath: payload.tool_input.file_path,
        contentLength: payload.tool_input.content.length,
      })
    }

    // Initialize components
    logger.debug('Initializing quality check components')
    const checker = new QualityCheckerV2()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()
    const formatter = new OutputFormatter()

    // Log formatter selection
    const outputMode = formatter.getOutputMode()
    logger.debug('Formatter selected', {
      formatter: 'OutputFormatter',
      defaultMode: outputMode,
      envMode: process.env.QUALITY_CHECK_OUTPUT_MODE,
      correlationId,
    })

    // Run quality check with timing
    logger.qualityCheckStarted(payload.tool_input.file_path)
    const qualityTimer = createTimer('quality-check')
    const result = await checker.check([payload.tool_input.file_path], { fix: false })
    const qualityDuration = qualityTimer.end()

    if (result.success) {
      logger.qualityCheckCompleted(payload.tool_input.file_path, 0, qualityDuration)
      logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), true)

      // Silent success - no output
      process.exit(ExitCodes.SUCCESS)
    }

    // Use issues directly from QualityCheckerV2 result
    const issues = result.issues || []
    logger.qualityCheckCompleted(payload.tool_input.file_path, issues.length, qualityDuration)

    const checkResult = {
      filePath: payload.tool_input.file_path,
      issues,
      hasErrors: !result.success,
      hasWarnings: issues.length > 0,
      fixable: issues.some((issue) => issue.engine === 'eslint' || issue.engine === 'prettier'),
    }

    // Let autopilot decide what to do
    const decision = autopilot.decide(checkResult)
    const reasoning =
      decision.issues?.map((i) => i.ruleId || `${i.engine}-${i.severity}`).join(', ') ||
      'No specific reasoning'

    // Enhanced autopilot decision logging with detailed rationale
    logger.autopilotDecision(
      payload.tool_input.file_path,
      decision.action,
      issues.length,
      reasoning,
    )

    // Log additional decision details for debugging
    logger.debug('Autopilot decision details', {
      action: decision.action,
      totalIssues: issues.length,
      fixableIssues: issues.filter((i) => i.engine === 'eslint' || i.engine === 'prettier').length,
      unfixableIssues: issues.filter((i) => i.engine === 'typescript').length,
      issuesByEngine: {
        typescript: issues.filter((i) => i.engine === 'typescript').length,
        eslint: issues.filter((i) => i.engine === 'eslint').length,
        prettier: issues.filter((i) => i.engine === 'prettier').length,
      },
      decisionIssues: decision.issues?.length || 0,
      correlationId,
    })

    // Determine if we should operate silently
    const isSilentMode = decision.action === 'FIX_SILENTLY' || decision.action === 'CONTINUE'

    // Only output feedback if not in silent mode
    if (!isSilentMode) {
      console.log('🔍 Quality check hook starting...')
      console.error(
        JSON.stringify({
          feedback: 'Quality check started',
          correlationId,
        }),
      )

      const fileName = payload.tool_input?.file_path?.split('/').pop()
      console.log(`📝 Processing: ${fileName}`)
      console.error(
        JSON.stringify({
          feedback: 'Processing file',
          file: fileName,
        }),
      )

      console.log(`🤖 Autopilot: ${decision.action} (${issues.length} issues found)`)
      console.error(
        JSON.stringify({
          feedback: 'Autopilot decision',
          action: decision.action,
          issueCount: issues.length,
        }),
      )

      // Debug output to stderr to see which decision path is taken
      console.error(
        `DEBUG: Autopilot decision = ${decision.action}, issues count = ${issues.length}`,
      )
    }

    switch (decision.action) {
      case 'FIX_SILENTLY': {
        // Operate completely silently - no console output at all
        logger.autoFixStarted(payload.tool_input.file_path)
        const fixTimer = createTimer('auto-fix')
        // Convert V2 result to V1 format for fixer
        const v1Result = {
          success: result.success,
          checkers: {},
        }
        const fixResult = await fixer.autoFix(payload.tool_input.file_path, v1Result)
        fixTimer.end()

        if (fixResult.success) {
          logger.autoFixCompleted(payload.tool_input.file_path, issues.length, 0)
          logger.hookCompleted(
            payload.tool_name,
            payload.tool_input.file_path,
            hookTimer.end(),
            true,
          )

          // Silent success
          process.exit(ExitCodes.SUCCESS)
        }

        // If auto-fix failed, report the issues using XML format for Claude
        logger.error('Auto-fix failed', undefined, { filePath: payload.tool_input.file_path })

        // Even on failure, stay silent in FIX_SILENTLY mode
        // But still need to report to Claude via exit code
        const blockingOutput = formatter.formatForBlockingOutput(issues, {
          context: 'Auto-fix failed, quality issues need attention',
        })
        if (blockingOutput) {
          outputClaudeBlocking(blockingOutput)
          logger.hookCompleted(
            payload.tool_name,
            payload.tool_input.file_path,
            hookTimer.end(),
            false,
          )
          process.exit(ExitCodes.QUALITY_ISSUES)
        }
        break
      }

      case 'CONTINUE':
        logger.info('Continuing despite issues', {
          filePath: payload.tool_input.file_path,
          issueCount: issues.length,
          reason: 'acceptable-issues',
        })
        logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), true)
        process.exit(ExitCodes.SUCCESS)
        break

      case 'REPORT_ONLY': {
        logger.info('Reporting unfixable issues', {
          filePath: payload.tool_input.file_path,
          unfixableCount: decision.issues?.length || 0,
        })

        if (decision.issues && decision.issues.length > 0) {
          logger.warn('Quality issues require manual intervention', {
            filePath: payload.tool_input.file_path,
            issueMessages: decision.issues.map((i) => i.message),
            issueCount: decision.issues.length,
          })

          const blockingOutput = formatter.formatForBlockingOutput(decision.issues, {
            context: 'Quality issues require manual intervention',
          })
          outputClaudeBlocking(blockingOutput)
          logger.hookCompleted(
            payload.tool_name,
            payload.tool_input.file_path,
            hookTimer.end(),
            false,
          )
          process.exit(ExitCodes.QUALITY_ISSUES)
        }

        // No issues to report
        logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), true)
        process.exit(ExitCodes.SUCCESS)
        break
      }

      case 'FIX_AND_REPORT': {
        logger.autoFixStarted(payload.tool_input.file_path)
        const fixTimer = createTimer('fix-and-report')
        // Convert V2 result to V1 format for fixer
        const v1Result = {
          success: result.success,
          checkers: {},
        }
        const fixResult = await fixer.autoFix(payload.tool_input.file_path, v1Result)
        fixTimer.end()

        const fixedCount = issues.length - (decision.issues?.length || 0)
        const remainingCount = decision.issues?.length || 0

        logger.autoFixCompleted(payload.tool_input.file_path, fixedCount, remainingCount)

        if (decision.issues && decision.issues.length > 0) {
          const xmlOutput = formatter.formatIssuesForOutput(decision.issues, {
            mode: OutputMode.XML,
          })

          logger.warn('Some issues remain after auto-fix', {
            filePath: payload.tool_input.file_path,
            remainingIssueMessages: decision.issues.map((i) => i.message),
            remainingCount: decision.issues.length,
          })

          if (xmlOutput) {
            const blockingOutput = formatter.formatForBlockingOutput(decision.issues, {
              context: 'Some issues remain after auto-fix',
            })
            outputClaudeBlocking(blockingOutput)
            logger.hookCompleted(
              payload.tool_name,
              payload.tool_input.file_path,
              hookTimer.end(),
              false,
            )
            process.exit(ExitCodes.QUALITY_ISSUES)
          }
        }

        if (fixResult.success) {
          logger.info('All issues successfully fixed', { filePath: payload.tool_input.file_path })
          logger.hookCompleted(
            payload.tool_name,
            payload.tool_input.file_path,
            hookTimer.end(),
            true,
          )
          process.exit(ExitCodes.SUCCESS)
        }

        logger.error('Fixes partially failed', undefined, {
          filePath: payload.tool_input.file_path,
        })
        logger.hookCompleted(
          payload.tool_name,
          payload.tool_input.file_path,
          hookTimer.end(),
          false,
        )
        process.exit(ExitCodes.QUALITY_ISSUES)
      }
    }

    // If we reach here with errors, report quality issues using formatted text
    const success = result.success
    if (!success) {
      console.error('')
      console.error('🚫 QUALITY CHECK FAILED - Issues Found')
      console.error('='.repeat(60))

      const output = reporter.formatForClaude(result)
      if (output) {
        console.error('')
        console.error(output)
        console.error('')
        console.error('Please fix these issues before proceeding.')
        console.error('='.repeat(60))
      }

      logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), false)
      process.exit(ExitCodes.QUALITY_ISSUES)
    }
    logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), success)
    process.exit(success ? ExitCodes.SUCCESS : ExitCodes.QUALITY_ISSUES)
  } catch (error) {
    // Re-throw test exit errors for proper test handling
    if (error instanceof Error && error.message.startsWith('PROCESS_EXIT_')) {
      throw error
    }

    logger.error('Claude hook error', error as Error, {
      phase: 'hook-error',
      correlationId: logger.getCorrelationId(),
    })

    // Silent error handling - don't output to stderr
    // Exit gracefully - don't block Claude for hook issues
    logger.hookCompleted('unknown', 'unknown', hookTimer.end(), false)
    process.exit(ExitCodes.SUCCESS)
  } finally {
    // Cleanup if needed
    logger.debug('Hook execution completed', { correlationId: logger.getCorrelationId() })
  }
}

/**
 * Read JSON payload from stdin
 */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))

    // Timeout to prevent hanging - return empty object for graceful handling
    setTimeout(() => resolve('{}'), 5000)
  })
}

/**
 * Check if file type is supported for quality checking
 */
function isSupportedFileType(filePath: string): boolean {
  return /\.(js|jsx|ts|tsx)$/.test(filePath)
}

/**
 * Check if operation should be processed
 */
function shouldProcessOperation(operation: string): boolean {
  const supportedOperations = ['Write', 'Edit', 'MultiEdit']
  return supportedOperations.includes(operation)
}

/**
 * Output formatted text to stderr for Claude Code PostToolUse hooks with blocking behavior
 */
function outputClaudeBlocking(formattedOutput: string): void {
  // Output formatted issues to stderr for Claude to process (PostToolUse with exit code 2)
  console.error(formattedOutput)
}
