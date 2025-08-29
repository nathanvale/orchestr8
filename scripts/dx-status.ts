#!/usr/bin/env tsx
/**
 * DX Status Command
 *
 * ADHD-optimized status dashboard providing instant context recovery in ≤10s.
 * Shows all critical project information at a glance.
 */

import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'

interface StatusData {
  timestamp: string
  changesets: {
    pending: number
    files: string[]
  }
  coverage: {
    percentage: number | null
    lastRun: string | null
  }
  dependencies: {
    outdated: number
    updates: { name: string; current: string; wanted: string; latest: string; updateType: string }[]
  }
  tests: {
    lastRun: string | null
  }
  turbo: {
    status: 'connected' | 'disconnected' | 'unknown'
    cacheHitRate: number | null
  }
}

/**
 * Check for pending changesets in .changeset directory
 */
function getChangesetStatus(): { pending: number; files: string[] } {
  const changesetDir = '.changeset'

  if (!existsSync(changesetDir)) {
    return { pending: 0, files: [] }
  }

  try {
    const files = readdirSync(changesetDir)
    const changesetFiles = files.filter(
      (file) => file.endsWith('.md') && file !== 'README.md' && file !== 'config.json',
    )

    return {
      pending: changesetFiles.length,
      files: changesetFiles,
    }
  } catch (_error) {
    console.warn('⚠️ Unable to read changeset directory')
    return { pending: 0, files: [] }
  }
}

/**
 * Get current test coverage percentage from coverage summary
 */
function getCoverageStatus(): { percentage: number | null; lastRun: string | null } {
  const coverageSummary = 'coverage/coverage-summary.json'

  if (!existsSync(coverageSummary)) {
    return { percentage: null, lastRun: null }
  }

  try {
    const stats = statSync(coverageSummary)
    const lastRun = formatTimestamp(stats.mtime)

    const content = readFileSync(coverageSummary, 'utf-8')
    const summary = JSON.parse(content) as { total: { lines: { pct: number } } }

    const percentage = Math.round(summary.total.lines.pct)

    return { percentage, lastRun }
  } catch (_error) {
    console.warn('⚠️ Unable to read coverage data')
    return { percentage: null, lastRun: null }
  }
}

/**
 * Check for outdated dependencies using npm-check-updates
 */
function getDependencyStatus(): {
  outdated: number
  updates: { name: string; current: string; wanted: string; latest: string; updateType: string }[]
} {
  try {
    const output = execSync('npx npm-check-updates --format json --timeout 5000', {
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    const updates = JSON.parse(output) as Record<string, unknown>
    const updateList = Object.entries(updates).map(([name, latest]) => ({
      name,
      current: 'unknown',
      wanted: 'unknown',
      latest: String(latest),
      updateType: getUpdateType(String(latest)),
    }))

    return {
      outdated: updateList.length,
      updates: updateList.slice(0, 5), // Show top 5 updates
    }
  } catch (_error) {
    // Fallback: check if there are updates without detailed info
    try {
      execSync('npx npm-check-updates --errorLevel 2', { stdio: 'pipe' })
      return { outdated: 0, updates: [] }
    } catch {
      return { outdated: -1, updates: [] } // Unknown, likely has updates
    }
  }
}

/**
 * Get last test run timestamp
 */
function getTestStatus(): { lastRun: string | null } {
  const testDirs = ['coverage', 'test-results']
  let latestTime: Date | null = null

  for (const dir of testDirs) {
    if (!existsSync(dir)) continue

    try {
      const stats = statSync(dir)
      if (!latestTime || stats.mtime > latestTime) {
        latestTime = stats.mtime
      }
    } catch {
      // Ignore errors
    }
  }

  return {
    lastRun: latestTime ? formatTimestamp(latestTime) : null,
  }
}

/**
 * Get Turborepo cache status
 */
function getTurboStatus(): {
  status: 'connected' | 'disconnected' | 'unknown'
  cacheHitRate: number | null
} {
  try {
    // Check if turbo daemon is running
    execSync('turbo daemon status', { stdio: 'pipe' })

    // Try to get cache info - this is approximate since turbo doesn't expose hit rates easily
    return {
      status: 'connected',
      cacheHitRate: null, // Would need historical data to calculate
    }
  } catch {
    return {
      status: 'disconnected',
      cacheHitRate: null,
    }
  }
}

/**
 * Determine if update is major, minor, or patch
 */
function getUpdateType(version: string): string {
  // Simple heuristic - would need current version to be accurate
  if (version.includes('^')) return 'minor'
  if (version.includes('~')) return 'patch'
  return 'major'
}

/**
 * Format timestamp into human-readable relative time
 */
function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toISOString().split('T')[0]
}

/**
 * Get changeset status display
 */
function getChangesetDisplay(data: StatusData): string {
  const icon = data.changesets.pending > 0 ? '📦' : '✅'
  const text =
    data.changesets.pending === 0
      ? 'No pending releases'
      : `${data.changesets.pending} pending release${data.changesets.pending > 1 ? 's' : ''}`
  return `${icon} Changesets:     ${text}`
}

/**
 * Get coverage status display
 */
function getCoverageDisplay(data: StatusData): string {
  const icon =
    data.coverage.percentage === null ? '❓' : data.coverage.percentage >= 80 ? '📊' : '⚠️'
  const text =
    data.coverage.percentage === null
      ? 'No coverage data (run: pnpm test:coverage)'
      : `${data.coverage.percentage}%${data.coverage.lastRun !== null ? ` (${data.coverage.lastRun})` : ''}`
  return `${icon} Coverage:       ${text}`
}

/**
 * Get dependencies status display
 */
function getDependenciesDisplay(data: StatusData): string {
  const icon =
    data.dependencies.outdated === 0 ? '✅' : data.dependencies.outdated === -1 ? '❓' : '📅'
  const text =
    data.dependencies.outdated === 0
      ? 'All up to date'
      : data.dependencies.outdated === -1
        ? 'Check needed (slow network?)'
        : `${data.dependencies.outdated} update${data.dependencies.outdated > 1 ? 's' : ''} available`
  return `${icon} Dependencies:   ${text}`
}

/**
 * Display main status metrics
 */
function displayMainStatus(data: StatusData): void {
  console.info(`🎯 DX Status Dashboard - ${new Date().toLocaleString()}\n`)
  console.info(getChangesetDisplay(data))
  console.info(getCoverageDisplay(data))
  console.info(getDependenciesDisplay(data))

  // Tests and Turbo (simple enough to keep inline)
  const testIcon = data.tests.lastRun !== null ? '⚡' : '❓'
  const testText = data.tests.lastRun ?? 'No recent test run'
  console.info(`${testIcon} Last Test:      ${testText}`)

  const turboIcon = data.turbo.status === 'connected' ? '🔄' : '❌'
  const turboText = data.turbo.status === 'connected' ? 'Connected' : 'Disconnected'
  console.info(`${turboIcon} Turbo Cache:    ${turboText}`)
}

/**
 * Display available updates
 */
function displayUpdates(data: StatusData): void {
  if (data.dependencies.outdated > 0 && data.dependencies.updates.length > 0) {
    console.info('\n📦 Top Updates:')
    for (const update of data.dependencies.updates.slice(0, 3)) {
      console.info(`   ${update.name}: ${update.latest}`)
    }
    if (data.dependencies.outdated > 3) {
      console.info(`   ... and ${data.dependencies.outdated - 3} more`)
    }
  }
}

/**
 * Display actionable quick commands
 */
function displayQuickCommands(data: StatusData): void {
  console.info('\n🚀 Quick Commands:')
  if (data.changesets.pending > 0) {
    console.info('   pnpm changeset version  # Version and release')
  }
  if (data.coverage.percentage === null) {
    console.info('   pnpm test:coverage      # Generate coverage')
  }
  if (data.dependencies.outdated > 0) {
    console.info('   pnpm update             # Update dependencies')
  }
  if (data.tests.lastRun === null) {
    console.info('   pnpm test               # Run test suite')
  }
}

/**
 * Format status output with ADHD-friendly visual indicators
 */
function formatStatus(data: StatusData): void {
  displayMainStatus(data)
  displayUpdates(data)
  displayQuickCommands(data)
}

// Main execution with top-level await
const startTime = Date.now()

try {
  // Collect all status data
  const data: StatusData = {
    timestamp: new Date().toISOString(),
    changesets: getChangesetStatus(),
    coverage: getCoverageStatus(),
    dependencies: getDependencyStatus(),
    tests: getTestStatus(),
    turbo: getTurboStatus(),
  }

  // Format and display
  formatStatus(data)

  // Show performance timing
  const duration = Date.now() - startTime
  console.info(`\n⏱️  Status checked in ${duration}ms`)

  // Alert if we're exceeding ADHD target of 10s
  if (duration > 10000) {
    console.warn('⚠️  Status check took >10s - consider optimizing for ADHD workflows')
  }
} catch (error) {
  console.error('❌ Status check failed:', error)
  process.exit(1)
}
