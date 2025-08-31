#!/usr/bin/env tsx
/**
 * Coverage Ratcheting System
 *
 * Automatically tracks and increases coverage thresholds to prevent regression.
 * Only allows threshold increases, never decreases.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const BASELINE_FILE = 'coverage-baseline.json'
const COVERAGE_SUMMARY = 'coverage/coverage-summary.json'
const VITEST_CONFIG = 'vitest.config.ts'

interface CoverageMetrics {
  lines: number
  statements: number
  functions: number
  branches: number
}

interface CoverageSummary {
  total: {
    lines: { pct: number }
    statements: { pct: number }
    functions: { pct: number }
    branches: { pct: number }
  }
}

interface BaselineData {
  timestamp: string
  thresholds: CoverageMetrics
  lastUpdate: string
}

function loadBaseline(): BaselineData | null {
  if (!existsSync(BASELINE_FILE)) {
    return null
  }

  try {
    const content = readFileSync(BASELINE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`❌ Failed to load baseline: ${error}`)
    return null
  }
}

function saveBaseline(data: BaselineData): void {
  writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2))
}

function loadCurrentCoverage(): CoverageMetrics | null {
  if (!existsSync(COVERAGE_SUMMARY)) {
    console.error(`❌ Coverage summary not found at ${COVERAGE_SUMMARY}`)
    console.log('   Run tests with coverage first: pnpm test:coverage')
    return null
  }

  try {
    const content = readFileSync(COVERAGE_SUMMARY, 'utf-8')
    const summary: CoverageSummary = JSON.parse(content)

    return {
      lines: Math.floor(summary.total.lines.pct),
      statements: Math.floor(summary.total.statements.pct),
      functions: Math.floor(summary.total.functions.pct),
      branches: Math.floor(summary.total.branches.pct),
    }
  } catch (error) {
    console.error(`❌ Failed to load coverage summary: ${error}`)
    return null
  }
}

function updateVitestConfig(thresholds: CoverageMetrics): boolean {
  if (!existsSync(VITEST_CONFIG)) {
    console.error(`❌ Vitest config not found at ${VITEST_CONFIG}`)
    return false
  }

  try {
    let content = readFileSync(VITEST_CONFIG, 'utf-8')

    // Update threshold values in the config
    content = content.replace(/branches:\s*\d+/g, `branches: ${thresholds.branches}`)
    content = content.replace(/functions:\s*\d+/g, `functions: ${thresholds.functions}`)
    content = content.replace(/lines:\s*\d+/g, `lines: ${thresholds.lines}`)
    content = content.replace(/statements:\s*\d+/g, `statements: ${thresholds.statements}`)

    writeFileSync(VITEST_CONFIG, content)
    return true
  } catch (error) {
    console.error(`❌ Failed to update Vitest config: ${error}`)
    return false
  }
}

function main(): void {
  console.log('📈 Coverage Ratcheting System\n')

  // Load current coverage
  const currentCoverage = loadCurrentCoverage()
  if (!currentCoverage) {
    process.exit(1)
  }

  console.log('📊 Current Coverage:')
  console.log(`   Lines:      ${currentCoverage.lines}%`)
  console.log(`   Statements: ${currentCoverage.statements}%`)
  console.log(`   Functions:  ${currentCoverage.functions}%`)
  console.log(`   Branches:   ${currentCoverage.branches}%`)
  console.log()

  // Load baseline
  const baseline = loadBaseline()

  if (!baseline) {
    // First run - create baseline
    console.log('🆕 Creating initial baseline...')

    const newBaseline: BaselineData = {
      timestamp: new Date().toISOString(),
      thresholds: currentCoverage,
      lastUpdate: new Date().toISOString(),
    }

    saveBaseline(newBaseline)
    updateVitestConfig(currentCoverage)

    console.log('✅ Baseline created successfully!')
    console.log(`   Thresholds set to current coverage levels`)
    return
  }

  console.log('📈 Baseline Thresholds:')
  console.log(`   Lines:      ${baseline.thresholds.lines}%`)
  console.log(`   Statements: ${baseline.thresholds.statements}%`)
  console.log(`   Functions:  ${baseline.thresholds.functions}%`)
  console.log(`   Branches:   ${baseline.thresholds.branches}%`)
  console.log()

  // Check for improvements
  let improved = false
  const newThresholds: CoverageMetrics = { ...baseline.thresholds }

  for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
    if (currentCoverage[metric] > baseline.thresholds[metric]) {
      console.log(
        `🎉 ${metric} coverage improved: ${baseline.thresholds[metric]}% → ${currentCoverage[metric]}%`,
      )
      newThresholds[metric] = currentCoverage[metric]
      improved = true
    } else if (currentCoverage[metric] < baseline.thresholds[metric]) {
      console.log(
        `⚠️  ${metric} coverage decreased: ${baseline.thresholds[metric]}% → ${currentCoverage[metric]}%`,
      )
      console.log(`   (Threshold remains at ${baseline.thresholds[metric]}%)`)
    }
  }

  if (improved) {
    console.log('\n🔄 Updating thresholds...')

    const updatedBaseline: BaselineData = {
      timestamp: baseline.timestamp,
      thresholds: newThresholds,
      lastUpdate: new Date().toISOString(),
    }

    saveBaseline(updatedBaseline)

    if (updateVitestConfig(newThresholds)) {
      console.log('✅ Coverage thresholds ratcheted up successfully!')
      console.log('   Coverage will never go below these new levels')
    } else {
      console.log('⚠️  Failed to update Vitest config, but baseline saved')
    }
  } else {
    console.log('\n✅ Coverage is at or below baseline - no changes made')
  }

  // Check if current coverage meets thresholds
  let failed = false
  for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
    if (currentCoverage[metric] < newThresholds[metric]) {
      console.error(
        `\n❌ ${metric} coverage (${currentCoverage[metric]}%) is below threshold (${newThresholds[metric]}%)`,
      )
      failed = true
    }
  }

  if (failed) {
    console.log('\n💡 Tip: Improve test coverage to meet thresholds')
    process.exit(1)
  }
}

// Run the ratcheting system
main()
