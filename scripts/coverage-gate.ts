#!/usr/bin/env bun
/**
 * Coverage gate for changed files
 *
 * This script:
 * 1. Gets the list of changed files from git
 * 2. Maps them to coverage data
 * 3. Enforces a minimum coverage threshold on changed files
 * 4. Exits with non-zero code if threshold is not met
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

interface FileCoverage {
  path: string
  lines: {
    total: number
    covered: number
    pct: number
  }
}

interface CoverageReport {
  total: {
    lines: { total: number; covered: number; pct: number }
  }
  [key: string]: unknown
}

// Configuration
const COVERAGE_THRESHOLD = 50 // Line coverage threshold for changed files
const BASE_BRANCH = process.env['BASE_BRANCH'] ?? 'main'

/**
 * Get list of changed files from git
 */
function getChangedFiles(): string[] {
  try {
    // Get files changed compared to base branch
    const output = execSync(`git diff --name-only ${BASE_BRANCH}...HEAD`, { encoding: 'utf-8' })

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  } catch (error) {
    console.error('Error getting changed files:', error)
    // If we can't get diff (e.g., in CI without full history), return empty
    return []
  }
}

/**
 * Filter to only source files that should have coverage
 */
function filterSourceFiles(files: string[]): string[] {
  const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
  const excludePatterns = [
    /node_modules/,
    /\.test\./,
    /\.spec\./,
    /\.d\.ts$/,
    /\.config\./,
    /^tests\//,
    /^scripts\//,
    /^docs\//,
  ]

  return files.filter((file) => {
    const hasSourceExt = sourceExtensions.some((ext) => file.endsWith(ext))
    const isExcluded = excludePatterns.some((pattern) => pattern.test(file))
    return hasSourceExt && !isExcluded
  })
}

/**
 * Load coverage data from JSON files
 */
function loadCoverageData(): Map<string, FileCoverage> {
  const coverageMap = new Map<string, FileCoverage>()

  // Look for coverage in different locations
  const coverageFiles = [
    'coverage/coverage-final.json',
    'coverage/root/coverage-final.json',
    'coverage/utils/coverage-final.json',
    'coverage/app/coverage-final.json',
    'coverage/server/coverage-final.json',
  ]

  for (const coverageFile of coverageFiles) {
    const fullPath = path.join(process.cwd(), coverageFile)
    if (!existsSync(fullPath)) {
      continue
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const data = JSON.parse(content) as Record<string, unknown>

      // Process each file in the coverage report
      for (const [filePath, fileData] of Object.entries(data)) {
        if (typeof fileData !== 'object' || fileData === null) continue

        const coverage = fileData as Record<string, unknown>
        const statementMap = coverage['s'] as Record<string, number> | undefined

        if (!statementMap) continue

        // Calculate line coverage from statement coverage
        const total = Object.keys(statementMap).length
        const covered = Object.values(statementMap).filter((count) => count > 0).length
        const pct = total > 0 ? (covered / total) * 100 : 0

        // Get relative path
        const relativePath = path.relative(process.cwd(), filePath)

        coverageMap.set(relativePath, {
          path: relativePath,
          lines: {
            total,
            covered,
            pct: Math.round(pct * 100) / 100,
          },
        })
      }
    } catch (error) {
      console.warn(`Warning: Could not parse ${coverageFile}:`, error)
    }
  }

  return coverageMap
}

/**
 * Check coverage for changed files
 */
function checkCoverage(): void {
  console.log('🔍 Checking coverage for changed files...')

  // Get changed files
  const changedFiles = getChangedFiles()
  const sourceFiles = filterSourceFiles(changedFiles)

  if (sourceFiles.length === 0) {
    console.log('✅ No source files changed, skipping coverage check')
    process.exit(0)
  }

  console.log(`Found ${sourceFiles.length} changed source files`)

  // Load coverage data
  const coverageMap = loadCoverageData()

  if (coverageMap.size === 0) {
    console.warn('⚠️  No coverage data found. Run tests with coverage first.')
    console.log('   Run: bun test:coverage')
    process.exit(1)
  }

  // Check each changed file
  const results: { file: string; coverage: number; passed: boolean }[] = []
  let totalLines = 0
  let coveredLines = 0

  for (const file of sourceFiles) {
    const coverage = coverageMap.get(file)

    if (!coverage) {
      // File has no coverage (new or uncovered)
      results.push({
        file,
        coverage: 0,
        passed: false,
      })
      console.log(`  ❌ ${file}: 0% (no coverage data)`)
    } else {
      const passed = coverage.lines.pct >= COVERAGE_THRESHOLD
      results.push({
        file,
        coverage: coverage.lines.pct,
        passed,
      })

      totalLines += coverage.lines.total
      coveredLines += coverage.lines.covered

      const icon = passed ? '✅' : '❌'
      console.log(`  ${icon} ${file}: ${coverage.lines.pct}%`)
    }
  }

  // Calculate overall coverage for changed files
  const overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
  const overallPct = Math.round(overallCoverage * 100) / 100

  console.log('\n📊 Summary:')
  console.log(`  Threshold: ${COVERAGE_THRESHOLD}%`)
  console.log(`  Overall coverage for changed files: ${overallPct}%`)

  // Check if all files pass
  const failedFiles = results.filter((r) => !r.passed)

  if (failedFiles.length > 0) {
    console.error('\n❌ Coverage gate failed!')
    console.error(`${failedFiles.length} file(s) below ${COVERAGE_THRESHOLD}% threshold:`)
    for (const failed of failedFiles) {
      console.error(`  - ${failed.file}: ${failed.coverage}%`)
    }
    process.exit(1)
  }

  console.log('\n✅ All changed files meet coverage threshold!')
}

// Run if called directly
if (import.meta.main) {
  checkCoverage()
}

export { checkCoverage, filterSourceFiles, getChangedFiles, loadCoverageData }
export type { CoverageReport, FileCoverage }
