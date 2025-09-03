/**
 * React App Quality Check Hook
 * Optimized for React applications with sensible defaults
 */

import path from 'node:path'

import type { ClaudePostToolUseEvent, FileToolInput } from '../types/claude.js'

import { HookExitCode } from '../types/claude.js'
import { fileExists, isSourceFile } from '../utils/file-utils.js'
import { colors, createLogger, createQualityLogger } from '../utils/logger.js'
import { createCommonIssuesChecker } from './checkers/common-issues.js'
import { createESLintChecker } from './checkers/eslint.js'
import { createPrettierChecker } from './checkers/prettier.js'
import { createTypeScriptChecker } from './checkers/typescript.js'
import { loadQualityConfig } from './config.js'
import { TypeScriptConfigCache } from './typescript-cache.js'

/**
 * Quality checker for a single file
 */
class QualityChecker {
  private filePath: string
  private fileType: string
  private errors: string[] = []
  private autofixes: string[] = []

  constructor(filePath: string) {
    this.filePath = filePath
    this.fileType = this.detectFileType(filePath)
  }

  /**
   * Detect file type from path
   */
  private detectFileType(filePath: string): string {
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) {
      return 'test'
    }
    if (/\/store\/|\/slices\/|\/reducers\//.test(filePath)) {
      return 'redux'
    }
    if (/\/components\/.*\.(tsx|jsx)$/.test(filePath)) {
      return 'component'
    }
    if (/\.(ts|tsx)$/.test(filePath)) {
      return 'typescript'
    }
    if (/\.(js|jsx)$/.test(filePath)) {
      return 'javascript'
    }
    return 'unknown'
  }

  /**
   * Run all quality checks
   */
  async checkAll(
    config: Awaited<ReturnType<typeof loadQualityConfig>>,
    log: ReturnType<typeof createLogger>,
    tsConfigCache: TypeScriptConfigCache,
  ): Promise<{ errors: string[]; autofixes: string[] }> {
    if (this.fileType === 'unknown') {
      log.info('Unknown file type, skipping detailed checks')
      return { errors: [], autofixes: [] }
    }

    // Create checkers
    const checkers = await Promise.all([
      createTypeScriptChecker(this.filePath, config, log, tsConfigCache),
      createESLintChecker(this.filePath, config, log),
      createPrettierChecker(this.filePath, config, log),
      createCommonIssuesChecker(this.filePath, config, log),
    ])

    // Run checks in parallel
    const results = await Promise.all([
      checkers[0] ? checkers[0].check() : Promise.resolve([]),
      checkers[1]
        ? checkers[1].check()
        : Promise.resolve({ errors: [], autofixes: [], warnings: [] }),
      checkers[2] ? checkers[2].check() : Promise.resolve({ errors: [], autofixes: [] }),
      checkers[3].check(this.fileType),
    ])

    // Collect results
    this.errors.push(...(results[0] as string[]))
    this.errors.push(...results[1].errors)
    this.autofixes.push(...results[1].autofixes)
    this.errors.push(...results[2].errors)
    this.autofixes.push(...results[2].autofixes)
    this.errors.push(...results[3])

    // Check for related tests
    await this.suggestRelatedTests(log)

    return {
      errors: this.errors,
      autofixes: this.autofixes,
    }
  }

  /**
   * Suggest related test files
   */
  private async suggestRelatedTests(log: ReturnType<typeof createLogger>): Promise<void> {
    if (this.fileType === 'test') {
      return
    }

    const baseName = this.filePath.replace(/\.[^.]+$/, '')
    const testExtensions = ['test.ts', 'test.tsx', 'spec.ts', 'spec.tsx']
    let hasTests = false

    for (const ext of testExtensions) {
      if (await fileExists(`${baseName}.${ext}`)) {
        hasTests = true
        log.warning(`💡 Related test found: ${path.basename(baseName)}.${ext}`)
        log.warning('   Consider running the tests to ensure nothing broke')
        break
      }
    }

    // Check __tests__ directory
    if (!hasTests) {
      const dir = path.dirname(this.filePath)
      const fileName = path.basename(this.filePath)
      const baseFileName = fileName.replace(/\.[^.]+$/, '')

      for (const ext of testExtensions) {
        if (await fileExists(path.join(dir, '__tests__', `${baseFileName}.${ext}`))) {
          hasTests = true
          log.warning(`💡 Related test found: __tests__/${baseFileName}.${ext}`)
          log.warning('   Consider running the tests to ensure nothing broke')
          break
        }
      }
    }

    if (!hasTests) {
      log.warning(`💡 No test file found for ${path.basename(this.filePath)}`)
      log.warning('   Consider adding tests for better code quality')
    }

    // Special reminders
    if (/\/state\/slices\//.test(this.filePath)) {
      log.warning('💡 Redux state file! Consider testing state updates')
    } else if (/\/components\//.test(this.filePath)) {
      log.warning('💡 Component file! Consider testing UI behavior')
    } else if (/\/services\//.test(this.filePath)) {
      log.warning('💡 Service file! Consider testing business logic')
    }
  }
}

/**
 * Normalize file path to fix duplicate segments
 * Handles cases where paths like /packages/claude-hooks/packages/claude-hooks/src/file.ts
 * get incorrectly duplicated
 */
function normalizePath(filePath: string, log: ReturnType<typeof createLogger>): string {
  const segments = filePath.split('/')
  const normalized: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    // If current pair is 'packages/claude-hooks' and the last two normalized
    // segments are also 'packages/claude-hooks', skip this duplicate pair.
    if (
      seg === 'packages' &&
      i + 1 < segments.length &&
      segments[i + 1] === 'claude-hooks' &&
      normalized.length >= 2 &&
      normalized[normalized.length - 2] === 'packages' &&
      normalized[normalized.length - 1] === 'claude-hooks'
    ) {
      log.debug('Skipping duplicate segment: packages/claude-hooks')
      i++ // skip 'claude-hooks' as well
      continue
    }

    normalized.push(seg)
  }

  const normalizedPath = normalized.join('/')

  if (normalizedPath !== filePath) {
    log.warning(`Path normalization: Fixed duplicate segments`)
    log.debug(`  Original: ${filePath}`)
    log.debug(`  Normalized: ${normalizedPath}`)
  }

  return normalizedPath
}

/**
 * Extract file path from tool input or PostToolUse event
 */
function extractFilePath(
  input: FileToolInput | ClaudePostToolUseEvent,
  log: ReturnType<typeof createLogger>,
): string | null {
  let filePath: string | null = null

  // Handle PostToolUse event format
  if ('hook_event_name' in input && input.hook_event_name === 'PostToolUse') {
    // Claude Code format - extract from tool_input
    const toolInput = input.tool_input
    if (toolInput) {
      filePath =
        (toolInput.file_path as string) ||
        (toolInput.path as string) ||
        (toolInput.notebook_path as string) ||
        null
    }
    // Fallback to test format in data
    if (!filePath) {
      filePath = input.data?.file_path || null
    }
  }

  // Handle test format PostToolUse event
  else if ('type' in input && input.type === 'PostToolUse') {
    filePath = input.data?.file_path || null
  }

  // Handle legacy FileToolInput format
  else {
    const fileInput = input as FileToolInput
    const { tool_input } = fileInput
    if (tool_input) {
      filePath = tool_input.file_path || tool_input.path || tool_input.notebook_path || null
    }
  }

  // Normalize the path if we found one
  if (filePath) {
    filePath = normalizePath(filePath, log)
  }

  return filePath
}

/**
 * Print summary of errors and autofixes
 */
function printSummary(errors: string[], autofixes: string[]): void {
  // Show auto-fixes if any
  if (autofixes.length > 0) {
    console.error(`\n${colors.blue}═══ Auto-fixes Applied ═══${colors.reset}`)
    for (const fix of autofixes) {
      console.error(`${colors.green}✨${colors.reset} ${fix}`)
    }
    console.error(
      `${colors.green}Automatically fixed ${autofixes.length} issue(s) for you!${colors.reset}`,
    )
  }

  // Show errors if any
  if (errors.length > 0) {
    console.error(`\n${colors.blue}═══ Quality Check Summary ═══${colors.reset}`)
    for (const error of errors) {
      console.error(`${colors.red}❌${colors.reset} ${String(error)}`)
    }

    console.error(
      `\n${colors.red}Found ${errors.length} issue(s) that MUST be fixed!${colors.reset}`,
    )
    console.error(`${colors.red}════════════════════════════════════════════${colors.reset}`)
    console.error(`${colors.red}❌ ALL ISSUES ARE BLOCKING ❌${colors.reset}`)
    console.error(`${colors.red}════════════════════════════════════════════${colors.reset}`)
    console.error(`${colors.red}Fix EVERYTHING above until all checks are ✅ GREEN${colors.reset}`)
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Load auto-config from .claude/hooks/quality-check.config.json
  // Note: Auto-config loading available but not currently used

  // Use auto-config path or fallback to legacy path
  const configPath = path.join(process.cwd(), '.claude/hooks/quality-check.config.json')
  const config = await loadQualityConfig(configPath)
  const { logger: structuredLogger, legacy: log } = createQualityLogger('quality-check')

  // Add configuration context to structured logger for debugging
  structuredLogger.debug('Quality check configuration loaded', {
    configPath,
    debug: config.debug,
    hookVersion: config.fileConfig.version || '1.0.0',
  })

  // Show header
  const hookVersion = config.fileConfig.version || '1.0.0'
  console.error('')
  console.error(`⚛️  React App Quality Check v${hookVersion} - Starting...`)
  console.error('────────────────────────────────────────────')

  // Debug: show loaded configuration
  log.debug(`Loaded config: ${JSON.stringify(config, null, 2)}`)

  // Parse input - handle both FileToolInput and PostToolUse event formats
  // Read JSON directly to avoid type constraint issues
  let inputData = ''
  for await (const chunk of process.stdin) {
    inputData += chunk
  }

  let input: FileToolInput | ClaudePostToolUseEvent | null = null
  if (inputData.trim()) {
    try {
      input = JSON.parse(inputData) as FileToolInput | ClaudePostToolUseEvent
    } catch {
      input = null
    }
  }

  const filePath = input ? extractFilePath(input, log) : null

  if (!filePath) {
    log.warning('No file path found in JSON input. Tool might not be file-related.')
    log.debug(`JSON input was: ${JSON.stringify(input)}`)
    console.error(
      `\n${colors.yellow}👉 No file to check - tool may not be file-related.${colors.reset}`,
    )
    process.exit(HookExitCode.Success)
  }

  // Check if file exists
  if (!(await fileExists(filePath))) {
    log.info(`File does not exist: ${filePath} (may have been deleted)`)
    console.error(`\n${colors.yellow}👉 File skipped - doesn't exist.${colors.reset}`)
    process.exit(HookExitCode.Success)
  }

  // For non-source files, exit successfully
  if (!isSourceFile(filePath)) {
    log.info(`Skipping non-source file: ${filePath}`)
    console.error(`\n${colors.yellow}👉 File skipped - not a source file.${colors.reset}`)
    console.error(
      `\n${colors.green}✅ No checks needed for ${path.basename(filePath)}${colors.reset}`,
    )
    process.exit(HookExitCode.Success)
  }

  // Update header with file name
  console.error('')
  console.error(`🔍 Validating: ${path.basename(filePath)}`)
  console.error('────────────────────────────────────────────')
  log.info(`Checking: ${filePath}`)

  // Create TypeScript config cache
  const tsConfigCache = new TypeScriptConfigCache(process.cwd())

  // Run quality checks
  const checker = new QualityChecker(filePath)
  const { errors, autofixes } = await checker.checkAll(config, log, tsConfigCache)

  // Print summary with optional sub-agent enhancement
  // Try to use enhanced version if available, otherwise fall back to standard
  try {
    log.debug('Attempting to load enhanced print summary...')
    const { printSummaryWithSubAgent } = await import('./print-summary-enhanced.js')
    log.debug('Enhanced print summary loaded successfully')
    await printSummaryWithSubAgent(errors, autofixes, filePath, tsConfigCache)
  } catch (error) {
    // Fall back to standard printSummary if enhanced version is not available
    log.debug(
      `Enhanced print summary failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    printSummary(errors, autofixes)
  }

  // Check if all issues were auto-fixed silently
  const allAutoFixed = config.autofixSilent && autofixes.length > 0 && errors.length === 0

  // Separate edited file errors from other issues
  const editedFileErrors = errors.filter(
    (e) =>
      e.includes('edited file') ||
      e.includes('ESLint found issues') ||
      e.includes('Prettier formatting issues') ||
      e.includes('console statements') ||
      e.includes("'as any' usage") ||
      e.includes('were auto-fixed'),
  )

  const dependencyWarnings = errors.filter((e) => !editedFileErrors.includes(e))

  // Exit with appropriate code
  if (editedFileErrors.length > 0 && !allAutoFixed) {
    // Critical - blocks immediately (unless everything was auto-fixed)
    console.error(`\n${colors.red}🛑 FAILED - Fix issues in your edited file! 🛑${colors.reset}`)
    console.error(`${colors.cyan}💡 CLAUDE.md CHECK:${colors.reset}`)
    console.error(
      `${colors.cyan}  → What CLAUDE.md pattern would have prevented this?${colors.reset}`,
    )
    console.error(`${colors.cyan}  → Are you following JSDoc batching strategy?${colors.reset}`)
    console.error(`${colors.yellow}📋 NEXT STEPS:${colors.reset}`)
    console.error(`${colors.yellow}  1. Fix the issues listed above${colors.reset}`)
    console.error(`${colors.yellow}  2. The hook will run again automatically${colors.reset}`)
    console.error(
      `${colors.yellow}  3. Continue with your original task once all checks pass${colors.reset}`,
    )
    process.exit(HookExitCode.QualityIssues)
  } else if (dependencyWarnings.length > 0) {
    // Warning - shows but doesn't block
    console.error(`\n${colors.yellow}⚠️ WARNING - Dependency issues found${colors.reset}`)
    console.error(
      `${colors.yellow}These won't block your progress but should be addressed${colors.reset}`,
    )
    console.error(
      `\n${colors.green}✅ Quality check passed for ${path.basename(filePath)}${colors.reset}`,
    )

    if (autofixes.length > 0 && config.autofixSilent) {
      console.error(
        `\n${colors.yellow}👉 File quality verified. Auto-fixes applied. Continue with your task.${colors.reset}`,
      )
    } else {
      console.error(
        `\n${colors.yellow}👉 File quality verified. Continue with your task.${colors.reset}`,
      )
    }
    process.exit(HookExitCode.Success)
  } else {
    console.error(
      `\n${colors.green}✅ Quality check passed for ${path.basename(filePath)}${colors.reset}`,
    )

    if (autofixes.length > 0 && config.autofixSilent) {
      console.error(
        `\n${colors.yellow}👉 File quality verified. Auto-fixes applied. Continue with your task.${colors.reset}`,
      )
    } else {
      console.error(
        `\n${colors.yellow}👉 File quality verified. Continue with your task.${colors.reset}`,
      )
    }
    process.exit(HookExitCode.Success)
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  const log = createLogger('INFO', false)
  log.error(`Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exit(HookExitCode.GeneralError)
})

// Export main for bin entry
export { main }

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const log = createLogger('INFO', false)
    log.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(HookExitCode.GeneralError)
  })
}
