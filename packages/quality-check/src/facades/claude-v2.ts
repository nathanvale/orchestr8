/* eslint-disable max-lines-per-function */
/**
 * Claude Facade V2 - Entry point for Claude Code hook integration
 * Migrated to use QualityCheckerV2 architecture with structured Issue format
 */

import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { ExitCodes } from '../core/exit-codes.js'
import { QualityChecker } from '../core/quality-checker.js'
import { ClaudeFormatter } from '../formatters/claude-formatter.js'
import type { Issue } from '../types/issue-types.js'
import type { Issue as AutopilotIssue, QualityCheckResult } from '../types.js'
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

export async function runClaudeHookV2(): Promise<void> {
  const hookTimer = createTimer('hook-execution')
  const correlationId = logger.setCorrelationId()

  try {
    logger.debug('Hook started (V2)', { correlationId })

    // Read and parse payload from stdin
    const input = await readStdin()
    let payload: ClaudeCodePayload | undefined

    try {
      payload = JSON.parse(input) as ClaudeCodePayload
      logger.payloadReceived(payload)
      logger.payloadValidation(true)
    } catch (parseError) {
      logger.payloadValidation(false, [(parseError as Error).message])
      logger.warn('Malformed JSON payload, exiting gracefully')
      process.exit(ExitCodes.SUCCESS)
    }

    // Validate required fields
    if (!payload || !payload.tool_name || !payload.tool_input?.file_path) {
      logger.warn('Invalid payload: missing required fields', {
        hasPayload: !!payload,
        hasToolName: payload ? !!payload.tool_name : false,
        hasFilePath: payload ? !!payload.tool_input?.file_path : false,
      })
      process.exit(ExitCodes.SUCCESS)
    }

    // Only process supported operations
    if (!shouldProcessOperation(payload.tool_name)) {
      logger.debug('Skipping unsupported operation', {
        operation: payload.tool_name,
        supportedOps: ['Write', 'Edit', 'MultiEdit'],
      })
      process.exit(ExitCodes.SUCCESS)
    }

    // Skip non-code files
    if (!isSupportedFileType(payload.tool_input.file_path)) {
      logger.debug('Skipping non-code file', {
        filePath: payload.tool_input.file_path,
        fileExtension: payload.tool_input.file_path.split('.').pop(),
      })
      process.exit(ExitCodes.SUCCESS)
    }

    logger.hookStarted(payload.tool_name, payload.tool_input.file_path)

    // Initialize components with V2 architecture (using V1 for now due to V2 issues)
    logger.debug('Initializing quality check V2 components')
    const checker = new QualityChecker()
    const claudeFormatter = new ClaudeFormatter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()

    // Run quality check
    logger.qualityCheckStarted(payload.tool_input.file_path)
    const qualityTimer = createTimer('quality-check')
    const result = await checker.check([payload.tool_input.file_path], { fix: false })
    const qualityDuration = qualityTimer.end()

    if (result.success) {
      logger.qualityCheckCompleted(payload.tool_input.file_path, 0, qualityDuration)
      logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), true)
      process.exit(ExitCodes.SUCCESS)
    }

    // Convert QualityCheckResult to structured Issue[] format
    const issues = extractIssuesFromQualityResult(result, payload.tool_input.file_path)
    logger.qualityCheckCompleted(payload.tool_input.file_path, issues.length, qualityDuration)

    // Convert to Autopilot format
    const autopilotIssues = convertToAutopilotIssues(issues, payload.tool_input.file_path)

    const checkResult = {
      filePath: payload.tool_input.file_path,
      issues: autopilotIssues,
      hasErrors: issues.some((i) => i.severity === 'error'),
      hasWarnings: issues.some((i) => i.severity === 'warning'),
      fixable: determineFixability(issues),
    }

    // Let autopilot decide what to do
    const decision = autopilot.decide(checkResult)
    const reasoning = decision.issues?.map((i) => i.rule).join(', ') || 'No specific reasoning'
    logger.autopilotDecision(
      payload.tool_input.file_path,
      decision.action,
      issues.length,
      reasoning,
    )

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

      console.error(
        `DEBUG: Autopilot decision = ${decision.action}, issues count = ${issues.length}`,
      )
    }

    switch (decision.action) {
      case 'FIX_SILENTLY': {
        logger.autoFixStarted(payload.tool_input.file_path)
        const fixTimer = createTimer('auto-fix')

        // Use fixer for auto-fix
        const fixResult = await fixer.autoFix(payload.tool_input.file_path, result)
        fixTimer.end()

        if (fixResult.success) {
          logger.autoFixCompleted(payload.tool_input.file_path, issues.length, 0)
          logger.hookCompleted(
            payload.tool_name,
            payload.tool_input.file_path,
            hookTimer.end(),
            true,
          )
          process.exit(ExitCodes.SUCCESS)
        }

        // If auto-fix failed, report using ClaudeFormatter
        logger.error('Auto-fix failed', undefined, { filePath: payload.tool_input.file_path })

        const output = claudeFormatter.format(issues)
        if (output) {
          outputClaudeBlocking(output, 'Auto-fix failed, quality issues need attention')
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
          const relevantIssues = issues.filter((issue) =>
            decision.issues?.some(
              (di) => di.message?.includes(issue.message) || di.rule === issue.ruleId,
            ),
          )

          if (relevantIssues.length > 0) {
            const output = claudeFormatter.formatDetailed(relevantIssues)
            outputClaudeBlocking(output, 'Quality issues require manual intervention')
            logger.hookCompleted(
              payload.tool_name,
              payload.tool_input.file_path,
              hookTimer.end(),
              false,
            )
            process.exit(ExitCodes.QUALITY_ISSUES)
          }
        }

        logger.hookCompleted(payload.tool_name, payload.tool_input.file_path, hookTimer.end(), true)
        process.exit(ExitCodes.SUCCESS)
        break
      }

      case 'FIX_AND_REPORT': {
        logger.autoFixStarted(payload.tool_input.file_path)
        const fixTimer = createTimer('fix-and-report')

        // Use fixer for auto-fix
        const fixResult = await fixer.autoFix(payload.tool_input.file_path, result)
        fixTimer.end()

        const fixedCount = issues.length
        const remainingCount = decision.issues?.length || 0

        logger.autoFixCompleted(payload.tool_input.file_path, fixedCount, remainingCount)

        if (decision.issues && decision.issues.length > 0) {
          const remainingIssues = issues.filter((issue) =>
            decision.issues?.some(
              (di) => di.message?.includes(issue.message) || di.rule === issue.ruleId,
            ),
          )

          if (remainingIssues.length > 0) {
            const output = claudeFormatter.formatDetailed(remainingIssues)
            outputClaudeBlocking(output, 'Some issues remain after auto-fix')
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

    // If we reach here with errors, report using ClaudeFormatter
    const success = result.success
    if (!success) {
      console.error('')
      console.error('🚫 QUALITY CHECK FAILED - Issues Found')
      console.error('='.repeat(60))

      const output = claudeFormatter.format(issues)
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
    logger.error('Claude hook V2 error', error as Error, {
      phase: 'hook-error',
      correlationId: logger.getCorrelationId(),
    })

    // Silent error handling - don't block Claude for hook issues
    logger.hookCompleted('unknown', 'unknown', hookTimer.end(), false)
    process.exit(ExitCodes.SUCCESS)
  } finally {
    logger.debug('Hook V2 execution completed', { correlationId: logger.getCorrelationId() })
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

    // Timeout to prevent hanging
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
 * Convert V2 Issue[] to Autopilot Issue[] format
 */
function convertToAutopilotIssues(issues: Issue[], filePath: string): AutopilotIssue[] {
  return issues.map((issue) => ({
    rule: issue.ruleId || `${issue.engine}-${issue.severity}`,
    fixable: determineIssueFixability(issue),
    message: issue.message,
    file: filePath,
  }))
}

/**
 * Determine if issues are fixable based on engine type
 */
function determineFixability(issues: Issue[]): boolean {
  return issues.some((issue) => determineIssueFixability(issue))
}

/**
 * Determine if a specific issue is fixable
 */
function determineIssueFixability(issue: Issue): boolean {
  // ESLint and Prettier issues are generally fixable
  if (issue.engine === 'eslint' || issue.engine === 'prettier') {
    return true
  }

  // TypeScript errors are generally not auto-fixable
  if (issue.engine === 'typescript') {
    return false
  }

  return false
}

/**
 * Extract issues from V1 QualityCheckResult and convert to V2 Issue format
 */
function extractIssuesFromQualityResult(result: QualityCheckResult, filePath: string): Issue[] {
  const issues: Issue[] = []

  // Extract ESLint issues
  if (result.checkers?.eslint?.errors) {
    for (const error of result.checkers.eslint.errors) {
      // Parse ESLint error format to extract rule and position
      const ruleMatch = error.match(/\(([^)]+)\)$/)
      const rule = ruleMatch ? ruleMatch[1] : undefined

      // Try to extract line/column from error message
      const locationMatch = error.match(/:(\d+):(\d+)/)
      const line = locationMatch ? parseInt(locationMatch[1], 10) : 1
      const col = locationMatch ? parseInt(locationMatch[2], 10) : 1

      issues.push({
        engine: 'eslint',
        severity: 'error',
        ruleId: rule,
        file: filePath,
        line,
        col,
        message: error,
      })
    }
  }

  // Extract TypeScript issues
  if (result.checkers?.typescript?.errors) {
    for (const error of result.checkers.typescript.errors) {
      // Try to extract line/column from error message
      const locationMatch = error.match(/:(\d+):(\d+)/)
      const line = locationMatch ? parseInt(locationMatch[1], 10) : 1
      const col = locationMatch ? parseInt(locationMatch[2], 10) : 1

      // Try to extract TypeScript error code
      const codeMatch = error.match(/TS(\d+)/)
      const rule = codeMatch ? `TS${codeMatch[1]}` : undefined

      issues.push({
        engine: 'typescript',
        severity: 'error',
        ruleId: rule,
        file: filePath,
        line,
        col,
        message: error,
      })
    }
  }

  // Extract Prettier issues
  if (result.checkers?.prettier?.errors) {
    for (const error of result.checkers.prettier.errors) {
      issues.push({
        engine: 'prettier',
        severity: 'error',
        file: filePath,
        line: 1,
        col: 1,
        message: error,
      })
    }
  }

  return issues
}

/**
 * Output formatted text to stderr for Claude Code PostToolUse hooks with blocking behavior
 */
function outputClaudeBlocking(reason: string, additionalContext?: string): void {
  console.error('')
  console.error('🚫 BLOCKING: You must fix these issues before proceeding:')
  console.error('')

  // Output the formatted reason directly
  console.error(reason)
  console.error('')

  if (additionalContext && additionalContext !== reason) {
    console.error(`CONTEXT: ${additionalContext}`)
    console.error('')
  }

  console.error('❌ DO NOT PROCEED until all issues are resolved. Update your code now.')
  console.error('')
}
