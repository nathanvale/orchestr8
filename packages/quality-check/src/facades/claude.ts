/**
 * Claude Facade - Entry point for Claude Code hook integration
 * ~80 lines with autopilot logic
 */

import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { QualityChecker } from '../core/quality-checker.js'
import type { QualityCheckResult, Issue } from '../types.js'

// Claude Code payload format
interface ClaudeCodePayload {
  operation: string
  file_path: string
  content: string
  metadata?: {
    tool_name: string
    timestamp?: string
  }
}

export async function runClaudeHook(): Promise<void> {
  try {
    // Read and parse payload from stdin
    const input = await readStdin()
    let payload: ClaudeCodePayload

    try {
      payload = JSON.parse(input) as ClaudeCodePayload
    } catch {
      // Malformed JSON - exit gracefully
      process.exit(0)
    }

    // Validate required fields
    if (!payload.operation || !payload.file_path) {
      process.exit(0)
    }

    // Only process supported operations
    if (!shouldProcessOperation(payload.operation)) {
      process.exit(0) // Silent pass for non-write operations
    }

    // Skip non-code files
    if (!isSupportedFileType(payload.file_path)) {
      process.exit(0)
    }

    // Initialize components
    const checker = new QualityChecker()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()

    // Run quality check
    const result = await checker.check([payload.file_path], { fix: false })

    if (result.success) {
      process.exit(0) // Silent success - no issues found
    }

    // Convert QualityCheckResult to CheckResult format
    const issues = extractIssuesFromQualityResult(result, payload.file_path)
    const checkResult = {
      filePath: payload.file_path,
      issues,
      hasErrors: !result.success,
      hasWarnings: issues.length > 0,
      fixable: issues.some((issue) => issue.fixable),
    }

    // Let autopilot decide what to do
    const decision = autopilot.decide(checkResult)

    switch (decision.action) {
      case 'FIX_SILENTLY': {
        // Apply safe fixes automatically
        const fixResult = await fixer.autoFix(payload.file_path, result)
        if (fixResult.success) {
          process.exit(0) // Fixed silently
        }
        // Fall through if fix failed
        break
      }

      case 'CONTINUE':
        // Let it through despite issues
        process.exit(0)
        break

      case 'REPORT_ONLY': {
        // Show unfixable issues to user
        const output = reporter.formatForClaude(result)
        if (output) {
          console.error(output)
          process.exit(1) // Block with message
        }
        break
      }

      case 'FIX_AND_REPORT': {
        // Apply fixes then show remaining issues
        await fixer.autoFix(payload.file_path, result)
        if (decision.issues && decision.issues.length > 0) {
          const output2 = reporter.formatForClaude(result)
          if (output2) {
            console.error(output2)
            process.exit(1) // Block with message about remaining issues
          }
        }
        process.exit(0)
      }
    }

    process.exit(0)
  } catch {
    // Never crash Claude - fail silently for any unexpected errors
    process.exit(0)
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
    setTimeout(() => resolve('{}'), 100)
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
  const supportedOperations = ['write_file', 'edit_file', 'multi_edit', 'create_file']
  return supportedOperations.includes(operation)
}

/**
 * Extract issues from QualityCheckResult and convert to Autopilot Issue format
 */
function extractIssuesFromQualityResult(result: QualityCheckResult, filePath: string): Issue[] {
  const issues: Issue[] = []

  // Extract ESLint issues
  if (result.checkers.eslint && result.checkers.eslint.errors) {
    for (const error of result.checkers.eslint.errors) {
      // Parse ESLint error format to extract rule
      const ruleMatch = error.match(/\(([^)]+)\)$/)
      const rule = ruleMatch ? ruleMatch[1] : 'eslint-error'

      issues.push({
        rule,
        fixable: true, // Most ESLint rules are fixable
        message: error,
        file: filePath,
      })
    }
  }

  // Extract TypeScript issues
  if (result.checkers.typescript && result.checkers.typescript.errors) {
    for (const error of result.checkers.typescript.errors) {
      issues.push({
        rule: 'typescript-error',
        fixable: false, // TypeScript errors usually require human intervention
        message: error,
        file: filePath,
      })
    }
  }

  // Extract Prettier issues
  if (result.checkers.prettier && result.checkers.prettier.errors) {
    for (const error of result.checkers.prettier.errors) {
      issues.push({
        rule: 'prettier/prettier',
        fixable: true, // Prettier issues are always auto-fixable
        message: error,
        file: filePath,
      })
    }
  }

  return issues
}
