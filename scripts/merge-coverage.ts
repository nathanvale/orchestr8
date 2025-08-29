#!/usr/bin/env tsx
/**
 * Coverage Merge Script
 * 
 * Merges coverage reports from multiple Vitest projects in the monorepo
 * into a single unified coverage report.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const COVERAGE_DIR = 'test-results/coverage'
const PROJECTS = ['packages', 'server', 'app', 'web']
const OUTPUT_DIR = 'coverage'

interface CoverageSummary {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number }
    statements: { total: number; covered: number; skipped: number; pct: number }
    functions: { total: number; covered: number; skipped: number; pct: number }
    branches: { total: number; covered: number; skipped: number; pct: number }
  }
  [key: string]: any
}

function mergeCoverageSummaries(): void {
  console.log('🔄 Merging coverage reports from all projects...\n')
  
  const mergedSummary: CoverageSummary = {
    total: {
      lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
      statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
      functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
    },
  }
  
  let foundReports = 0
  
  for (const project of PROJECTS) {
    const summaryPath = join(COVERAGE_DIR, project, 'coverage-summary.json')
    
    if (!existsSync(summaryPath)) {
      console.log(`⚠️  No coverage found for ${project}`)
      continue
    }
    
    try {
      const projectSummary: CoverageSummary = JSON.parse(
        readFileSync(summaryPath, 'utf-8')
      )
      
      // Merge totals
      for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
        mergedSummary.total[metric].total += projectSummary.total[metric].total
        mergedSummary.total[metric].covered += projectSummary.total[metric].covered
        mergedSummary.total[metric].skipped += projectSummary.total[metric].skipped
      }
      
      // Merge file-level data
      for (const [file, data] of Object.entries(projectSummary)) {
        if (file !== 'total') {
          mergedSummary[file] = data
        }
      }
      
      foundReports++
      console.log(`✅ Merged coverage from ${project}`)
    } catch (error) {
      console.error(`❌ Failed to process ${project}: ${error}`)
    }
  }
  
  if (foundReports === 0) {
    console.error('❌ No coverage reports found to merge!')
    process.exit(1)
  }
  
  // Calculate percentages
  for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
    const total = mergedSummary.total[metric].total
    const covered = mergedSummary.total[metric].covered
    mergedSummary.total[metric].pct = total > 0 ? (covered / total) * 100 : 0
  }
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  // Write merged summary
  const outputPath = join(OUTPUT_DIR, 'coverage-summary.json')
  writeFileSync(outputPath, JSON.stringify(mergedSummary, null, 2))
  
  console.log(`\n📊 Coverage Summary:`)
  console.log(`   Lines:      ${mergedSummary.total.lines.pct.toFixed(2)}%`)
  console.log(`   Statements: ${mergedSummary.total.statements.pct.toFixed(2)}%`)
  console.log(`   Functions:  ${mergedSummary.total.functions.pct.toFixed(2)}%`)
  console.log(`   Branches:   ${mergedSummary.total.branches.pct.toFixed(2)}%`)
  console.log(`\n✅ Merged coverage saved to ${outputPath}`)
  
  // Check against thresholds
  const THRESHOLDS = {
    lines: 70,
    statements: 70,
    functions: 70,
    branches: 70,
  }
  
  let failed = false
  for (const [metric, threshold] of Object.entries(THRESHOLDS)) {
    const pct = mergedSummary.total[metric as keyof typeof THRESHOLDS].pct
    if (pct < threshold) {
      console.error(`❌ ${metric} coverage (${pct.toFixed(2)}%) is below threshold (${threshold}%)`)
      failed = true
    }
  }
  
  if (failed) {
    process.exit(1)
  }
}

// Run the merge
mergeCoverageSummaries()