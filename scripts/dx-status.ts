#!/usr/bin/env tsx
/**
 * DX Status Command - Enhanced with P2 Improvements
 *
 * ADHD-optimized status dashboard providing instant context recovery in ≤10s.
 * Now with structured JSON output, progress indicators, and CI-friendly formatting.
 */

import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { applyEnvironmentOverrides, loadConfig } from './lib/config-loader'
import {
  createResult,
  emitGitHubAnnotation,
  formatDuration,
  formatOutput,
  parseOutputArgs,
  ProgressIndicator,
  type OutputOptions,
  type OutputResult,
} from './lib/output-formatter'
import { discoverWorkspacePackages, isCI, isGitHubActions } from './lib/workspace-utils'

interface StatusData {
  timestamp: string
  changesets: {
    pending: number
    files: string[]
    stale?: Array<{ file: string; age: number }>
  }
  coverage: {
    percentage: number | null
    lastRun: string | null
    trends?: { lines: number; branches: number; functions: number; statements: number }
  }
  dependencies: {
    outdated: number
    updates: Array<{
      name: string
      current: string
      wanted: string
      latest: string
      updateType: string
    }>
  }
  tests: {
    lastRun: string | null
    passRate?: number
    duration?: number
  }
  lint: {
    lastRun: string | null
    success: boolean | null
    duration?: number
    fileCount?: number
  }
  turbo: {
    status: 'connected' | 'disconnected' | 'unknown'
    cacheHitRate: number | null
  }
  workspace: {
    totalPackages: number
    publicPackages: number
    privatePackages: number
  }
}

/**
 * Check for pending changesets in .changeset directory
 */
async function getChangesetStatus(config: any): Promise<{
  pending: number
  files: string[]
  stale: Array<{ file: string; age: number }>
}> {
  const changesetDir = '.changeset'

  if (!existsSync(changesetDir)) {
    return { pending: 0, files: [], stale: [] }
  }

  try {
    const files = readdirSync(changesetDir)
    const changesetFiles = files.filter(
      (file) => file.endsWith('.md') && file !== 'README.md' && file !== 'config.json',
    )

    // Check for stale changesets
    const now = Date.now()
    const staleWarningMs = config.thresholds.staleChangeset.warningDays * 24 * 60 * 60 * 1000
    const stale: Array<{ file: string; age: number }> = []

    for (const file of changesetFiles) {
      const filePath = join(changesetDir, file)
      const stats = statSync(filePath)
      const ageMs = now - stats.mtimeMs

      if (ageMs > staleWarningMs) {
        stale.push({
          file,
          age: Math.round(ageMs / (24 * 60 * 60 * 1000)), // Convert to days
        })
      }
    }

    return { pending: changesetFiles.length, files: changesetFiles, stale }
  } catch {
    return { pending: 0, files: [], stale: [] }
  }
}

/**
 * Get test coverage percentage from coverage summary
 */
function getCoverageInfo(): { percentage: number | null; lastRun: string | null; trends?: any } {
  const possiblePaths = [
    'coverage/coverage-summary.json',
    'test-results/coverage/root/coverage-summary.json',
    'packages/utils/test-results/coverage/utils/coverage-summary.json',
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        const summary = JSON.parse(readFileSync(path, 'utf-8'))
        const stats = statSync(path)
        const lastRun = new Date(stats.mtime).toISOString()

        const total = summary.total || {}
        const lines = total.lines?.pct ?? 0
        const branches = total.branches?.pct ?? 0
        const functions = total.functions?.pct ?? 0
        const statements = total.statements?.pct ?? 0

        const average = (lines + branches + functions + statements) / 4

        return {
          percentage: Math.round(average * 10) / 10,
          lastRun,
          trends: { lines, branches, functions, statements },
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return { percentage: null, lastRun: null }
}

/**
 * Check for outdated dependencies
 */
async function getDependencyStatus(progress?: ProgressIndicator): Promise<{
  outdated: number
  updates: any[]
}> {
  try {
    progress?.update({ message: 'Checking dependencies...' })

    const output = execSync('pnpm outdated --format json 2>/dev/null || true', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    if (!output) return { outdated: 0, updates: [] }

    const data = JSON.parse(output)
    const updates = Object.entries(data).map(([name, info]: [string, any]) => ({
      name,
      current: info.current || 'not installed',
      wanted: info.wanted || info.current,
      latest: info.latest || info.wanted,
      updateType:
        info.current !== info.latest ? (info.current !== info.wanted ? 'minor' : 'major') : 'none',
    }))

    return { outdated: updates.length, updates }
  } catch {
    return { outdated: 0, updates: [] }
  }
}

/**
 * Get lint metrics from .lint-metrics.json
 */
function getLintInfo(): {
  lastRun: string | null
  success: boolean | null
  duration?: number
  fileCount?: number
} {
  const metricsPath = '.lint-metrics.json'

  if (!existsSync(metricsPath)) {
    return { lastRun: null, success: null }
  }

  try {
    const metrics = JSON.parse(readFileSync(metricsPath, 'utf-8'))
    return {
      lastRun: metrics.timestamp || null,
      success: metrics.success ?? null,
      duration: metrics.durationMs || 0,
      fileCount: metrics.fileCount || 0,
    }
  } catch {
    return { lastRun: null, success: null }
  }
}

/**
 * Check when tests were last run
 */
function getTestInfo(): { lastRun: string | null; passRate?: number; duration?: number } {
  const junitPaths = [
    'test-results/coverage/root/junit.xml',
    'packages/utils/test-results/coverage/utils/junit.xml',
  ]

  for (const path of junitPaths) {
    if (existsSync(path)) {
      try {
        const stats = statSync(path)
        const content = readFileSync(path, 'utf-8')

        // Parse basic JUnit stats
        const testsMatch = content.match(/tests="(\d+)"/)
        const failuresMatch = content.match(/failures="(\d+)"/)
        const timeMatch = content.match(/time="([\d.]+)"/)

        const tests = testsMatch ? parseInt(testsMatch[1], 10) : 0
        const failures = failuresMatch ? parseInt(failuresMatch[1], 10) : 0
        const duration = timeMatch ? parseFloat(timeMatch[1]) * 1000 : 0

        return {
          lastRun: new Date(stats.mtime).toISOString(),
          passRate: tests > 0 ? Math.round(((tests - failures) / tests) * 100) : 0,
          duration,
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return { lastRun: null }
}

/**
 * Check Turborepo remote cache status
 */
function getTurboStatus(): {
  status: 'connected' | 'disconnected' | 'unknown'
  cacheHitRate: number | null
} {
  try {
    // Check if TURBO_TOKEN is set
    const hasToken = !!process.env.TURBO_TOKEN

    // Try to get cache status from turbo
    const output = execSync('pnpm turbo run build --dry-run=json 2>/dev/null || true', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    if (output) {
      const data = JSON.parse(output)
      const tasks = data.tasks || []
      const cached = tasks.filter((t: any) => t.cache?.status === 'HIT').length
      const total = tasks.length
      const hitRate = total > 0 ? Math.round((cached / total) * 100) : null

      return {
        status: hasToken ? 'connected' : 'disconnected',
        cacheHitRate: hitRate,
      }
    }

    return {
      status: hasToken ? 'connected' : 'disconnected',
      cacheHitRate: null,
    }
  } catch {
    return { status: 'unknown', cacheHitRate: null }
  }
}

/**
 * Get workspace information
 */
async function getWorkspaceInfo(progress?: ProgressIndicator): Promise<{
  totalPackages: number
  publicPackages: number
  privatePackages: number
}> {
  try {
    progress?.update({ message: 'Analyzing workspace...' })
    const workspace = await discoverWorkspacePackages()

    return {
      totalPackages: workspace.packages.length,
      publicPackages: workspace.packages.filter((p) => !p.isPrivate).length,
      privatePackages: workspace.packages.filter((p) => p.isPrivate).length,
    }
  } catch {
    return { totalPackages: 0, publicPackages: 0, privatePackages: 0 }
  }
}

/**
 * Format status for text output
 */
function formatStatusText(data: StatusData, options: OutputOptions): string {
  const colors = {
    reset: options.color === false ? '' : '\x1b[0m',
    bold: options.color === false ? '' : '\x1b[1m',
    dim: options.color === false ? '' : '\x1b[2m',
    red: options.color === false ? '' : '\x1b[31m',
    green: options.color === false ? '' : '\x1b[32m',
    yellow: options.color === false ? '' : '\x1b[33m',
    blue: options.color === false ? '' : '\x1b[34m',
    cyan: options.color === false ? '' : '\x1b[36m',
  }

  const lines: string[] = [
    '',
    `${colors.bold}${colors.cyan}📊 DX Status Dashboard${colors.reset}`,
    `${colors.dim}${data.timestamp}${colors.reset}`,
    '',
  ]

  // Changesets
  const changesetColor = data.changesets.pending > 0 ? colors.yellow : colors.green
  const changesetIcon = data.changesets.pending > 0 ? '📝' : '✓'
  lines.push(
    `${changesetIcon} ${colors.bold}Changesets:${colors.reset} ${changesetColor}${data.changesets.pending} pending${colors.reset}`,
  )

  if (data.changesets.stale && data.changesets.stale.length > 0) {
    lines.push(
      `   ${colors.yellow}⚠ ${data.changesets.stale.length} stale changesets (${data.changesets.stale[0].age}+ days old)${colors.reset}`,
    )
  }

  if (options.verbose && data.changesets.files.length > 0) {
    data.changesets.files.forEach((file) => {
      lines.push(`   ${colors.dim}- ${file}${colors.reset}`)
    })
  }

  // Coverage
  const coverageColor = data.coverage.percentage
    ? data.coverage.percentage >= 80
      ? colors.green
      : data.coverage.percentage >= 60
        ? colors.yellow
        : colors.red
    : colors.dim

  const coverageText =
    data.coverage.percentage !== null ? `${data.coverage.percentage}%` : 'No data'

  lines.push(
    `📈 ${colors.bold}Coverage:${colors.reset} ${coverageColor}${coverageText}${colors.reset}`,
  )

  if (data.coverage.trends && options.verbose) {
    lines.push(
      `   ${colors.dim}Lines: ${data.coverage.trends.lines}% | Branches: ${data.coverage.trends.branches}% | Functions: ${data.coverage.trends.functions}%${colors.reset}`,
    )
  }

  if (data.coverage.lastRun) {
    const age = Date.now() - new Date(data.coverage.lastRun).getTime()
    lines.push(`   ${colors.dim}Last run: ${formatDuration(age)} ago${colors.reset}`)
  }

  // Dependencies
  const depColor = data.dependencies.outdated > 0 ? colors.yellow : colors.green
  const depIcon = data.dependencies.outdated > 0 ? '📦' : '✓'

  lines.push(
    `${depIcon} ${colors.bold}Dependencies:${colors.reset} ${depColor}${data.dependencies.outdated} outdated${colors.reset}`,
  )

  if (options.verbose && data.dependencies.updates.length > 0) {
    data.dependencies.updates.slice(0, 5).forEach((dep) => {
      const arrow = dep.updateType === 'major' ? colors.red : colors.yellow
      lines.push(
        `   ${colors.dim}${dep.name}: ${dep.current} → ${arrow}${dep.latest}${colors.reset}`,
      )
    })

    if (data.dependencies.updates.length > 5) {
      lines.push(
        `   ${colors.dim}...and ${data.dependencies.updates.length - 5} more${colors.reset}`,
      )
    }
  }

  // Tests
  const testIcon = data.tests.passRate && data.tests.passRate === 100 ? '✓' : '🧪'
  lines.push(
    `${testIcon} ${colors.bold}Tests:${colors.reset} ${data.tests.lastRun ? colors.green : colors.yellow}${data.tests.lastRun ? 'Recent' : 'No recent run'}${colors.reset}`,
  )

  if (data.tests.passRate !== undefined) {
    const passColor =
      data.tests.passRate === 100
        ? colors.green
        : data.tests.passRate >= 90
          ? colors.yellow
          : colors.red
    lines.push(`   ${passColor}Pass rate: ${data.tests.passRate}%${colors.reset}`)
  }

  if (data.tests.duration) {
    lines.push(`   ${colors.dim}Duration: ${formatDuration(data.tests.duration)}${colors.reset}`)
  }

  // Lint
  const lintIcon = data.lint.success === true ? '✓' : data.lint.success === false ? '❌' : '🔍'
  const lintStatusText =
    data.lint.success === true
      ? 'Passing'
      : data.lint.success === false
        ? 'Failed'
        : 'No recent run'
  const lintColor =
    data.lint.success === true
      ? colors.green
      : data.lint.success === false
        ? colors.red
        : colors.yellow

  lines.push(
    `${lintIcon} ${colors.bold}Lint:${colors.reset} ${lintColor}${lintStatusText}${colors.reset}`,
  )

  if (data.lint.duration !== undefined && data.lint.duration > 0) {
    const duration =
      data.lint.duration < 1000
        ? `${data.lint.duration}ms`
        : `${(data.lint.duration / 1000).toFixed(1)}s`
    lines.push(`   ${colors.dim}Duration: ${duration}${colors.reset}`)
  }

  if (data.lint.fileCount && data.lint.fileCount > 0) {
    lines.push(`   ${colors.dim}Files checked: ${data.lint.fileCount}${colors.reset}`)
  }

  if (data.lint.lastRun) {
    const age = Date.now() - new Date(data.lint.lastRun).getTime()
    lines.push(`   ${colors.dim}Last run: ${formatDuration(age)} ago${colors.reset}`)
  }

  // Turbo Cache
  const turboIcon = data.turbo.status === 'connected' ? '🚀' : '⚠'
  const turboColor = data.turbo.status === 'connected' ? colors.green : colors.yellow

  lines.push(
    `${turboIcon} ${colors.bold}Turbo Cache:${colors.reset} ${turboColor}${data.turbo.status}${colors.reset}`,
  )

  if (data.turbo.cacheHitRate !== null) {
    const hitColor =
      data.turbo.cacheHitRate >= 85
        ? colors.green
        : data.turbo.cacheHitRate >= 50
          ? colors.yellow
          : colors.red
    lines.push(`   ${hitColor}Cache hit rate: ${data.turbo.cacheHitRate}%${colors.reset}`)
  }

  // Workspace
  lines.push(
    `📁 ${colors.bold}Workspace:${colors.reset} ${colors.blue}${data.workspace.totalPackages} packages${colors.reset}`,
  )
  lines.push(
    `   ${colors.dim}Public: ${data.workspace.publicPackages} | Private: ${data.workspace.privatePackages}${colors.reset}`,
  )

  lines.push('')

  // Quick actions
  if (!options.quiet) {
    lines.push(`${colors.bold}Quick Actions:${colors.reset}`)

    if (data.changesets.pending > 0) {
      lines.push(`  ${colors.dim}• Review changesets: pnpm changeset status${colors.reset}`)
    }

    if (data.dependencies.outdated > 0) {
      lines.push(`  ${colors.dim}• Update deps: pnpm update --interactive${colors.reset}`)
    }

    if (!data.tests.lastRun) {
      lines.push(`  ${colors.dim}• Run tests: pnpm test${colors.reset}`)
    }

    if (data.turbo.status === 'disconnected') {
      lines.push(`  ${colors.dim}• Connect cache: export TURBO_TOKEN=...${colors.reset}`)
    }

    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const startTime = Date.now()
  const options = parseOutputArgs()

  // Load and apply configuration
  const config = applyEnvironmentOverrides(loadConfig())

  // Override options from config if not set via CLI
  if (options.format === undefined) {
    options.format = config.output.format
  }
  if (options.verbose === undefined) {
    options.verbose = config.output.verbose
  }
  if (options.color === undefined) {
    options.color = config.output.colorize === 'auto' ? undefined : config.output.colorize
  }

  // Don't show progress in JSON mode
  const isJsonMode = options.format === 'json' || (options.format === 'auto' && isCI())
  const progress =
    config.output.showProgress && !options.quiet && !isJsonMode
      ? new ProgressIndicator(options)
      : undefined

  try {
    progress?.start('Gathering status information')

    // Gather all status data
    const [changesets, coverage, dependencies, tests, lint, turbo, workspace] = await Promise.all([
      getChangesetStatus(config),
      getCoverageInfo(),
      getDependencyStatus(progress),
      getTestInfo(),
      getLintInfo(),
      getTurboStatus(),
      getWorkspaceInfo(progress),
    ])

    progress?.stop('Status check complete')

    const statusData: StatusData = {
      timestamp: new Date().toISOString(),
      changesets,
      coverage,
      dependencies,
      tests,
      lint,
      turbo,
      workspace,
    }

    // Format output based on options
    if (options.format === 'json' || (options.format === 'auto' && isCI())) {
      const result: OutputResult = createResult(true, 'Status check complete', statusData)
      result.metadata!.duration = Date.now() - startTime

      console.log(formatOutput(result, options))

      // Emit GitHub annotations if applicable
      if (isGitHubActions() && config.output.githubAnnotations) {
        if (changesets.stale.length > 0) {
          emitGitHubAnnotation(
            'warning',
            `Found ${changesets.stale.length} stale changesets (${changesets.stale[0].age}+ days old)`,
          )
        }

        if (dependencies.outdated > 10) {
          emitGitHubAnnotation(
            'warning',
            `${dependencies.outdated} packages are outdated and need updating`,
          )
        }
      }
    } else {
      // Text output
      console.log(formatStatusText(statusData, options))
    }

    // Exit with appropriate code
    const hasWarnings = changesets.stale.length > 0 || dependencies.outdated > 5
    process.exit(config.features.strictMode.enabled && hasWarnings ? 1 : 0)
  } catch (error) {
    progress?.error('Status check failed')

    const result = createResult(false, 'Status check failed', undefined)
    result.errors = [
      {
        code: 'STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
    ]

    console.error(formatOutput(result, options))
    process.exit(1)
  }
}

// Run if executed directly
main().catch(console.error)
