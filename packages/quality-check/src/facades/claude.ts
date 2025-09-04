/**
 * Claude Facade - Entry point for Claude Code hook integration
 * ~80 lines with autopilot logic
 */

import { QualityChecker } from '../core/quality-checker.js'
import { IssueReporter } from '../core/issue-reporter.js'
import { Autopilot } from '../adapters/autopilot.js'
import { Fixer } from '../adapters/fixer.js'

interface ClaudeHookPayload {
  tool: string
  path?: string
  content?: string
}

export async function runClaudeHook(): Promise<void> {
  try {
    // Read from stdin
    const input = await readStdin()
    const payload = JSON.parse(input) as ClaudeHookPayload

    // Only process write operations
    if (!['Write', 'Edit', 'MultiEdit', 'Create'].includes(payload.tool)) {
      process.exit(0) // Silent pass for non-write operations
    }

    if (!payload.path) {
      process.exit(0) // No file path, nothing to check
    }

    // Skip non-code files
    if (!/\.(js|jsx|ts|tsx)$/.test(payload.path)) {
      process.exit(0)
    }

    // Initialize components
    const checker = new QualityChecker()
    const reporter = new IssueReporter()
    const autopilot = new Autopilot()
    const fixer = new Fixer()

    // Run quality check
    const result = await checker.check([payload.path], { fix: false })

    if (result.success) {
      process.exit(0) // Silent success
    }

    // Let autopilot decide what to do
    const decision = autopilot.decide(result)

    switch (decision) {
      case 'FIX_SILENTLY':
        // Apply safe fixes automatically
        const fixResult = await fixer.autoFix(payload.path, result)
        if (fixResult.success) {
          process.exit(0) // Fixed silently
        }
        // Fall through if fix failed
        break

      case 'CONTINUE':
        // Let it through despite issues
        process.exit(0)

      case 'REPORT_ISSUES':
        // Show unfixable issues to user
        const output = reporter.formatForClaude(result)
        if (output) {
          console.error(output)
          process.exit(1) // Block with message
        }
        break
    }

    process.exit(0)
  } catch (error) {
    // Never crash Claude - fail silently
    process.exit(0)
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))

    // Timeout to prevent hanging
    setTimeout(() => resolve('{}'), 1000)
  })
}
