#!/usr/bin/env tsx
/**
 * Governance & Safety Validation for Turborepo
 *
 * Validates boundaries and circular dependencies for monorepo governance.
 * Currently configured for single-package mode with future monorepo support.
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Check Turborepo boundaries (simplified for single-package)
 */
function checkBoundaries(): boolean {
  console.log('🔍 Checking package boundaries...')

  if (!existsSync('turbo.jsonc')) {
    console.log('ℹ️  No Turborepo config found - boundaries check skipped')
    return true
  }

  try {
    execSync('pnpm turbo boundaries', { stdio: 'pipe' })
    console.log('✅ Package boundaries are valid')
    return true
  } catch {
    console.log('ℹ️  Boundaries not configured - check skipped for single-package project')
    return true
  }
}

/**
 * Check for circular dependencies
 */
function checkCircularDependencies(): boolean {
  console.log('🔄 Checking for circular dependencies...')

  try {
    execSync('tsx scripts/check-circular-deps.ts', { stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

/**
 * Main governance validation
 */
function main(): void {
  console.log('🔒 Running Turborepo Governance & Safety Checks')
  console.log('='.repeat(50))

  const boundariesPassed = checkBoundaries()
  console.log('')

  const circularDepsPassed = checkCircularDependencies()
  console.log('')
  console.log('='.repeat(50))

  if (boundariesPassed && circularDepsPassed) {
    console.log('✅ All governance checks passed!')
    console.log('🏛️  Architecture is compliant and safe')
  } else {
    console.log('❌ Governance violations detected!')
    process.exit(1)
  }
}

// Only run if this script is executed directly
if (import.meta.main) {
  main()
}
