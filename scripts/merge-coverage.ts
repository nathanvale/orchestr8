#!/usr/bin/env bun
/**
 * Merge coverage JSON summaries from multiple packages
 * 
 * This script:
 * 1. Finds all coverage-summary.json files in package subdirectories
 * 2. Merges them into a single aggregated summary
 * 3. Outputs to coverage/coverage-summary.json
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

interface CoverageMetric {
  total: number
  covered: number
  skipped: number
  pct: number
}

interface CoverageSummary {
  lines: CoverageMetric
  statements: CoverageMetric
  functions: CoverageMetric
  branches: CoverageMetric
}

interface CoverageReport {
  total: CoverageSummary
  [key: string]: CoverageSummary
}

// Coverage root directory
const COVERAGE_ROOT = path.join(process.cwd(), 'coverage')

// Packages to check for coverage
const PACKAGE_DIRS = ['root', 'utils', 'app', 'server']

/**
 * Read a coverage summary JSON file
 */
function readCoverageSummary(filePath: string): CoverageReport | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as CoverageReport
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
    return null
  }
}

/**
 * Merge multiple coverage metrics
 */
function mergeMetrics(metrics: CoverageMetric[]): CoverageMetric {
  const total = metrics.reduce((sum, m) => sum + m.total, 0)
  const covered = metrics.reduce((sum, m) => sum + m.covered, 0)
  const skipped = metrics.reduce((sum, m) => sum + m.skipped, 0)
  const pct = total > 0 ? (covered / total) * 100 : 0

  return {
    total,
    covered,
    skipped,
    pct: Math.round(pct * 100) / 100, // Round to 2 decimal places
  }
}

/**
 * Merge multiple coverage summaries
 */
function mergeSummaries(summaries: CoverageSummary[]): CoverageSummary {
  return {
    lines: mergeMetrics(summaries.map(s => s.lines)),
    statements: mergeMetrics(summaries.map(s => s.statements)),
    functions: mergeMetrics(summaries.map(s => s.functions)),
    branches: mergeMetrics(summaries.map(s => s.branches)),
  }
}

/**
 * Main function to merge coverage from all packages
 */
function mergeCoverage(): void {
  console.log('🔍 Searching for coverage summaries...')
  
  const summaries: CoverageSummary[] = []
  const fileDetails: CoverageSummary[] = []
  const foundPackages: string[] = []

  // Look for coverage summaries in each package directory
  for (const pkg of PACKAGE_DIRS) {
    const summaryPath = path.join(COVERAGE_ROOT, pkg, 'coverage-summary.json')
    const report = readCoverageSummary(summaryPath)
    
    if (report?.total) {
      summaries.push(report.total)
      foundPackages.push(pkg)
      console.log(`  ✅ Found coverage for ${pkg}`)
      
      // Collect file-level details if present
      for (const [key, value] of Object.entries(report)) {
        if (key !== 'total' && typeof value === 'object') {
          fileDetails.push(value as CoverageSummary)
        }
      }
    } else {
      console.log(`  ⏭️  No coverage found for ${pkg}`)
    }
  }

  if (summaries.length === 0) {
    console.log('\n❌ No coverage summaries found to merge')
    process.exit(1)
  }

  // Merge all summaries
  const mergedTotal = mergeSummaries(summaries)
  
  // Create the merged report
  const mergedReport: CoverageReport = {
    total: mergedTotal,
  }

  // Optionally include file details (commented out for now to keep summary simple)
  // if (fileDetails.length > 0) {
  //   mergedReport['[aggregated-files]'] = mergeSummaries(fileDetails)
  // }

  // Ensure output directory exists
  if (!existsSync(COVERAGE_ROOT)) {
    mkdirSync(COVERAGE_ROOT, { recursive: true })
  }

  // Write merged summary
  const outputPath = path.join(COVERAGE_ROOT, 'coverage-summary.json')
  writeFileSync(outputPath, JSON.stringify(mergedReport, null, 2))

  // Print summary
  console.log('\n📊 Coverage Summary:')
  console.log(`  Packages: ${foundPackages.join(', ')}`)
  console.log(`  Lines:     ${mergedTotal.lines.pct}% (${mergedTotal.lines.covered}/${mergedTotal.lines.total})`)
  console.log(`  Statements: ${mergedTotal.statements.pct}% (${mergedTotal.statements.covered}/${mergedTotal.statements.total})`)
  console.log(`  Functions: ${mergedTotal.functions.pct}% (${mergedTotal.functions.covered}/${mergedTotal.functions.total})`)
  console.log(`  Branches:  ${mergedTotal.branches.pct}% (${mergedTotal.branches.covered}/${mergedTotal.branches.total})`)
  console.log(`\n✅ Merged coverage written to: ${outputPath}`)
  
  // Check against thresholds (matches vitest.config.ts defaults)
  const thresholds = {
    lines: 80,
    statements: 80,
    functions: 70,
    branches: 50,
  }
  
  let failed = false
  if (mergedTotal.lines.pct < thresholds.lines) {
    console.error(`\n❌ Line coverage ${mergedTotal.lines.pct}% is below threshold of ${thresholds.lines}%`)
    failed = true
  }
  if (mergedTotal.statements.pct < thresholds.statements) {
    console.error(`❌ Statement coverage ${mergedTotal.statements.pct}% is below threshold of ${thresholds.statements}%`)
    failed = true
  }
  if (mergedTotal.functions.pct < thresholds.functions) {
    console.error(`❌ Function coverage ${mergedTotal.functions.pct}% is below threshold of ${thresholds.functions}%`)
    failed = true
  }
  if (mergedTotal.branches.pct < thresholds.branches) {
    console.error(`❌ Branch coverage ${mergedTotal.branches.pct}% is below threshold of ${thresholds.branches}%`)
    failed = true
  }
  
  if (failed) {
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.main) {
  mergeCoverage()
}

export { mergeCoverage, mergeMetrics, mergeSummaries, readCoverageSummary }
export type { CoverageMetric, CoverageReport, CoverageSummary }