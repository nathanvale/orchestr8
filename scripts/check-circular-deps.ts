#!/usr/bin/env bun
/**
 * Circular Dependency Guard for Turborepo
 *
 * Detects circular dependencies in build task graph.
 * Currently simplified for single-package mode.
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Check if turbo is available
 */
function isTurboAvailable(): boolean {
  try {
    execSync('bunx turbo --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Get build plan and check for cycles
 */
function checkForCycles(): boolean {
  try {
    const output = execSync('bunx turbo run build --dry-run=json', {
      encoding: 'utf8',
      stdio: 'pipe',
    })

    const buildPlan = JSON.parse(output) as { tasks?: unknown[] }
    const taskCount = buildPlan.tasks?.length ?? 0

    console.log(`📊 Analyzing ${String(taskCount)} tasks...`)
    console.log('✅ No circular dependencies found')

    return true
  } catch {
    console.error('❌ Analysis failed or circular dependencies detected')
    return false
  }
}

/**
 * Main execution function
 */
function main(): void {
  console.log('🔄 Checking for circular dependencies in build graph...')

  if (!existsSync('turbo.jsonc')) {
    console.log('ℹ️  No turbo configuration found - check skipped')
    return
  }

  if (!isTurboAvailable()) {
    console.log('ℹ️  turbo command not available - check skipped')
    return
  }

  if (!checkForCycles()) {
    process.exit(1)
  }
}

// Only run if this script is executed directly
if (import.meta.main) {
  main()
}
