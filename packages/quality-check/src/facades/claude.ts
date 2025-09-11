/* eslint-disable max-lines-per-function */
/**
 * Claude Facade - Entry point for Claude Code hook integration
 * Enhanced with structured logging and end-to-end observability
 */

import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { ExitCodes } from '../core/exit-codes.js'
import { QualityChecker } from '../core/quality-checker.js'
import { OutputFormatter } from '../services/OutputFormatter.js'
import type { ErrorReport } from '../utils/logger.js'
import type { Issue } from '../types/issue-types.js'
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

  const input = await readStdin()
  return runClaudeHookWithPayload(input)
}

/**
 * Test-friendly version of runClaudeHook that accepts payload directly
 * Returns results instead of calling process.exit for easier testing
 */
export async function runClaudeHookForTesting(
  payloadInput: string,
  options: { skipFileWrite?: boolean; tempDir?: string } = {},
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}> {
  const startTime = Date.now()
  let exitCode = 0
  let stdout = ''
  let stderr = ''

  // Capture console output
  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  const originalProcessExit = process.exit

  console.log = (message: unknown) => {
    stdout += String(message) + '\n'
  }
  console.error = (message: unknown) => {
    stderr += String(message) + '\n'
  }
  process.exit = ((code?: number) => {
    exitCode = code || 0
    throw new Error(`PROCESS_EXIT_${code || 0}`)
  }) as typeof process.exit

  try {
    await runClaudeHookWithPayload(payloadInput, options)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('PROCESS_EXIT_')) {
      // Expected process.exit call - extract exit code
      exitCode = parseInt(error.message.replace('PROCESS_EXIT_', ''), 10) || 0
    } else {
      // Unexpected error
      exitCode = 1
      stderr += error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    // Restore original functions
    console.log = originalConsoleLog
    console.error = originalConsoleError
    process.exit = originalProcessExit
  }

  return {
    exitCode,
    stdout,
    stderr,
    duration: Date.now() - startTime,
  }
}

/**
 * Core Claude hook logic extracted for reuse by both entry points
 */
async function runClaudeHookWithPayload(
  input: string,
  options: { skipFileWrite?: boolean; tempDir?: string } = {},
): Promise<void> {
  // Early exit if hook is disabled (but allow in test environment)
  if (process.env.NODE_ENV !== 'test' && process.env.CLAUDE_HOOK_DISABLED === 'true') {
    process.exit(ExitCodes.SUCCESS)
    return
  }

  const hookTimer = createTimer('hook-execution')
  const correlationId = logger.setCorrelationId()

  // We'll determine if we should be silent based on the Autopilot decision
  // So we'll hold off on any output initially

  try {
    logger.debug('Hook started', { correlationId })

    // Use provided input instead of reading from stdin
    let payload: ClaudeCodePayload | undefined

    try {
      if (!input || input.trim() === '') {
        logger.warn('Empty input payload, exiting gracefully')
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
      // Only log if not in silent mode
      if (process.env.CLAUDE_HOOK_SILENT_OUTPUT !== 'true') {
        logger.warn('Invalid payload: missing required fields', {
          hasPayload: !!payload,
          hasToolName: payload ? !!payload.tool_name : false,
          hasFilePath: payload?.tool_input ? !!payload.tool_input.file_path : false,
        })
      }
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

    // For Write operations, write the file first (unless skipped for testing)
    if (
      payload.tool_name === 'Write' &&
      payload.tool_input.content &&
      !options.skipFileWrite &&
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
    const checker = new QualityChecker()
    const autopilot = new Autopilot()
    const fixer = new Fixer()
    // We use the new OutputFormatter directly in outputClaudeBlocking for all error output

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

    // Use issues directly from QualityChecker result
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
      if (process.env.CLAUDE_HOOK_DEBUG) {
        console.error(
          `DEBUG: Autopilot decision = ${decision.action}, issues count = ${issues.length}`,
        )
      }
    }

    switch (decision.action) {
      case 'FIX_SILENTLY': {
        // Operate completely silently - no console output at all
        logger.autoFixStarted(payload.tool_input.file_path)
        const fixTimer = createTimer('auto-fix')
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

          // Silent success
          process.exit(ExitCodes.SUCCESS)
        }

        // If auto-fix failed, report the issues using XML format for Claude
        logger.error('Auto-fix failed', undefined, { filePath: payload.tool_input.file_path })

        // Even on failure, stay silent in FIX_SILENTLY mode
        // But still need to report to Claude via exit code
        if (issues.length > 0) {
          // Use new colored formatter directly
          outputClaudeBlocking('', issues)
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

          // Use new colored formatter directly, no need for old XML format
          outputClaudeBlocking('', decision.issues)
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
        const fixResult = await fixer.autoFix(payload.tool_input.file_path, result)
        fixTimer.end()

        const fixedCount = issues.length - (decision.issues?.length || 0)
        const remainingCount = decision.issues?.length || 0

        logger.autoFixCompleted(payload.tool_input.file_path, fixedCount, remainingCount)

        if (decision.issues && decision.issues.length > 0) {
          logger.warn('Some issues remain after auto-fix', {
            filePath: payload.tool_input.file_path,
            remainingIssueMessages: decision.issues.map((i) => i.message),
            remainingCount: decision.issues.length,
          })

          // Use new colored formatter directly
          outputClaudeBlocking('', decision.issues)
          logger.hookCompleted(
            payload.tool_name,
            payload.tool_input.file_path,
            hookTimer.end(),
            false,
          )
          process.exit(ExitCodes.QUALITY_ISSUES)
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
    if (!success && result.issues && result.issues.length > 0) {
      // Use new colored formatter directly
      outputClaudeBlocking('', result.issues)
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
 * Convert issues to ErrorReport format for new OutputFormatter
 */
function issuesToErrorReport(issues: Issue[]): ErrorReport {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  // Group issues by file
  const fileMap = new Map<string, Issue[]>()
  for (const issue of issues) {
    if (!fileMap.has(issue.file)) {
      fileMap.set(issue.file, [])
    }
    fileMap.get(issue.file)!.push(issue)
  }

  const files = Array.from(fileMap.entries()).map(([path, fileIssues]) => ({
    path,
    errors: fileIssues.map((issue) => ({
      line: issue.line,
      column: issue.col,
      message: issue.message,
      ruleId: issue.ruleId,
      severity: issue.severity as 'error' | 'warning',
    })),
  }))

  return {
    timestamp: new Date().toISOString(),
    tool: 'quality-check' as 'eslint' | 'typescript' | 'prettier',
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success',
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      filesAffected: fileMap.size,
    },
    details: { files },
    raw: '',
  }
}

/**
 * Output formatted text to stderr for Claude Code PostToolUse hooks with blocking behavior
 * Now uses new ANSI-colored formatter for concise output when possible
 */
function outputClaudeBlocking(formattedOutput: string, issues?: Issue[]): void {
  // If we have issues, use the new formatter for colored concise output
  if (issues && issues.length > 0) {
    const errorReport = issuesToErrorReport(issues)
    const conciseSummary = OutputFormatter.formatMinimalConsole(errorReport, {
      colored: true,
    })

    console.error('')
    console.error('🚫 BLOCKING: Quality issues detected')
    console.error('')
    console.error(conciseSummary)
    console.error('')
    console.error('❌ DO NOT PROCEED until these issues are resolved.')
    console.error('')
    console.error(
      'To fix these issues automatically, Claude will use the quality-check-fixer agent.',
    )
    console.error('')
    return
  }

  // Fallback to old format if no issues provided (shouldn't happen anymore)
  console.error(formattedOutput)
}
