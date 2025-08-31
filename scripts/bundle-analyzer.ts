#!/usr/bin/env node
/**
 * Bundle Analysis Script
 *
 * Analyzes built package files to track bundle sizes,
 * detect size regressions, and provide insights into bundle composition.
 */

import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

interface BundleAnalysis {
  timestamp: string
  packages: PackageAnalysis[]
  totalBundleSize: number
  gitCommit: string
}

interface PackageAnalysis {
  package: string
  entries: EntryAnalysis[]
  totalSize: number
  formats: ('cjs' | 'esm')[]
}

interface EntryAnalysis {
  entry: string
  format: 'cjs' | 'esm'
  outputFile: string
  size: number
}

/**
 * Get current Git commit hash
 */
function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Find all built packages in the monorepo
 */
function findBuiltPackages(rootDir: string): string[] {
  const packageDirs: string[] = []

  // Look in packages and apps directories
  const searchDirs = ['packages', 'apps']

  for (const searchDir of searchDirs) {
    const searchPath = join(rootDir, searchDir)
    if (existsSync(searchPath)) {
      try {
        const entries = readdirSync(searchPath)
        for (const entry of entries) {
          const fullPath = join(searchPath, entry)
          const distPath = join(fullPath, 'dist')

          // Only include packages that have been built (have dist directory)
          if (existsSync(distPath)) {
            packageDirs.push(fullPath)
          }
        }
      } catch {
        // Directory might not be accessible, skip
      }
    }
  }

  return packageDirs
}

/**
 * Analyze built files in a package's dist directory
 */
function analyzePackageFiles(packageDir: string): EntryAnalysis[] {
  const distDir = join(packageDir, 'dist')
  const analyses: EntryAnalysis[] = []

  try {
    const files = readdirSync(distDir)

    for (const file of files) {
      const filePath = join(distDir, file)
      const stat = statSync(filePath)

      // Skip directories, source maps, and type definition files
      if (
        stat.isDirectory() ||
        file.endsWith('.map') ||
        file.endsWith('.d.ts') ||
        file.endsWith('.d.cts')
      ) {
        continue
      }

      // Only analyze JS/CJS files
      if (file.endsWith('.js') || file.endsWith('.cjs')) {
        const format: 'cjs' | 'esm' = file.endsWith('.cjs') ? 'cjs' : 'esm'
        const entryName = file.replace(/\.(js|cjs)$/, '')

        analyses.push({
          entry: entryName,
          format,
          outputFile: file,
          size: stat.size,
        })
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to analyze package ${basename(packageDir)}:`, (error as Error).message)
  }

  return analyses
}

/**
 * Get package name from package directory
 */
function getPackageNameFromDir(packageDir: string): string {
  try {
    const packageJsonPath = join(packageDir, 'package.json')
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
      return packageJson.name || basename(packageDir)
    }
  } catch {
    // Fallback to directory name
  }

  const parts = packageDir.split('/')
  const dirName = parts[parts.length - 1]
  const scope = parts.includes('packages') ? '@template' : '@template'
  return `${scope}/${dirName}`
}

/**
 * Analyze all packages in the monorepo
 */
function analyzeAllPackages(): BundleAnalysis {
  console.log('🔍 Analyzing bundle sizes from built files...')

  const rootDir = process.cwd()
  const packageDirs = findBuiltPackages(rootDir)

  if (packageDirs.length === 0) {
    console.log('⚠️  No built packages found. Make sure to run builds first.')
    process.exit(1)
  }

  console.log(`   Found ${packageDirs.length} built package(s)`)

  const packages: PackageAnalysis[] = []
  let totalBundleSize = 0

  for (const packageDir of packageDirs) {
    const packageName = getPackageNameFromDir(packageDir)
    const entries = analyzePackageFiles(packageDir)

    if (entries.length > 0) {
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
      const formats = [...new Set(entries.map((e) => e.format))] as ('cjs' | 'esm')[]

      packages.push({
        package: packageName,
        entries,
        totalSize,
        formats,
      })

      totalBundleSize += totalSize
    }
  }

  return {
    timestamp: new Date().toISOString(),
    packages,
    totalBundleSize,
    gitCommit: getGitCommit(),
  }
}

/**
 * Load previous analysis for comparison
 */
function loadPreviousAnalysis(): BundleAnalysis | null {
  const analysisPath = join('docs', 'bundle-analysis.json')

  if (existsSync(analysisPath)) {
    try {
      return JSON.parse(readFileSync(analysisPath, 'utf8'))
    } catch {
      console.log('⚠️  Could not parse previous bundle analysis')
    }
  }

  return null
}

/**
 * Save analysis results
 */
function saveAnalysis(analysis: BundleAnalysis): void {
  const analysisPath = join('docs', 'bundle-analysis.json')

  // Ensure docs directory exists
  try {
    execSync('mkdir -p docs', { stdio: 'ignore' })
  } catch {
    // Directory might already exist
  }

  writeFileSync(analysisPath, JSON.stringify(analysis, null, 2))
  console.log(`📄 Bundle analysis saved to: ${analysisPath}`)
}

/**
 * Compare current analysis with previous
 */
function compareAnalyses(current: BundleAnalysis, previous: BundleAnalysis | null): void {
  if (!previous) {
    console.log('📊 No previous analysis found - establishing baseline')
    return
  }

  console.log('')
  console.log('📊 Bundle Size Changes:')

  const currentTotal = current.totalBundleSize
  const previousTotal = previous.totalBundleSize
  const totalChange = ((currentTotal - previousTotal) / previousTotal) * 100

  if (Math.abs(totalChange) > 1) {
    const changeIndicator = totalChange > 0 ? '📈' : '📉'
    console.log(
      `   ${changeIndicator} Total: ${formatBytes(currentTotal)} (${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)}%)`,
    )
  } else {
    console.log(`   ✅ Total: ${formatBytes(currentTotal)} (no significant change)`)
  }

  // Package-level changes
  for (const currentPkg of current.packages) {
    const previousPkg = previous.packages.find((p) => p.package === currentPkg.package)

    if (previousPkg) {
      const change = ((currentPkg.totalSize - previousPkg.totalSize) / previousPkg.totalSize) * 100

      if (Math.abs(change) > 5) {
        const changeIndicator = change > 0 ? '📈' : '📉'
        console.log(
          `   ${changeIndicator} ${currentPkg.package}: ${formatBytes(currentPkg.totalSize)} (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`,
        )
      }
    } else {
      console.log(`   ✨ ${currentPkg.package}: ${formatBytes(currentPkg.totalSize)} (new package)`)
    }
  }
}

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Print bundle analysis summary
 */
function printSummary(analysis: BundleAnalysis): void {
  console.log('')
  console.log('📦 Bundle Analysis Summary:')
  console.log(`   Total Bundle Size: ${formatBytes(analysis.totalBundleSize)}`)
  console.log(`   Packages Analyzed: ${analysis.packages.length}`)
  console.log(`   Git Commit: ${analysis.gitCommit.slice(0, 7)}`)

  // Package breakdown
  for (const pkg of analysis.packages.sort((a, b) => b.totalSize - a.totalSize)) {
    console.log(`   • ${pkg.package}: ${formatBytes(pkg.totalSize)} (${pkg.formats.join(', ')})`)

    // Show entries if verbose
    if (process.argv.includes('--verbose')) {
      for (const entry of pkg.entries.sort((a, b) => b.size - a.size)) {
        console.log(`     - ${entry.entry} (${entry.format}): ${formatBytes(entry.size)}`)
      }
    }
  }
}

/**
 * Check for size regression alerts
 */
function checkRegressionAlerts(current: BundleAnalysis, previous: BundleAnalysis | null): boolean {
  if (!previous) return false

  const totalChange =
    ((current.totalBundleSize - previous.totalBundleSize) / previous.totalBundleSize) * 100

  // Alert on >10% total bundle size increase
  if (totalChange > 10) {
    console.log('')
    console.log('🚨 BUNDLE SIZE REGRESSION ALERT:')
    console.log(`   Total bundle size increased by ${totalChange.toFixed(1)}%`)
    console.log(`   Consider investigating dependency changes or build optimizations`)
    return true
  }

  // Alert on individual package increases >25%
  let hasPackageRegression = false
  for (const currentPkg of current.packages) {
    const previousPkg = previous.packages.find((p) => p.package === currentPkg.package)

    if (previousPkg) {
      const change = ((currentPkg.totalSize - previousPkg.totalSize) / previousPkg.totalSize) * 100

      if (change > 25) {
        if (!hasPackageRegression) {
          console.log('')
          console.log('🚨 PACKAGE SIZE REGRESSION ALERT:')
          hasPackageRegression = true
        }
        console.log(`   ${currentPkg.package} increased by ${change.toFixed(1)}%`)
      }
    }
  }

  return totalChange > 10 || hasPackageRegression
}

/**
 * Main execution
 */
function main(): void {
  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    console.log('Bundle Analysis Script')
    console.log('')
    console.log('Usage: pnpm run build:analyze [options]')
    console.log('')
    console.log('Analyzes bundle sizes from built files and detects regressions:')
    console.log('  - Total bundle size tracking')
    console.log('  - Per-package size breakdown')
    console.log('  - Size regression alerts (>10% total, >25% per package)')
    console.log('  - Bundle composition analysis')
    console.log('')
    console.log('Options:')
    console.log('  --verbose    Show detailed entry-level breakdown')
    console.log('  --help       Show this help message')
    console.log('')
    console.log('Analysis results are saved to docs/bundle-analysis.json')
    return
  }

  console.log('📊 Bundle Size Analysis')
  console.log('='.repeat(50))

  const currentAnalysis = analyzeAllPackages()
  const previousAnalysis = loadPreviousAnalysis()

  printSummary(currentAnalysis)
  compareAnalyses(currentAnalysis, previousAnalysis)

  const hasRegression = checkRegressionAlerts(currentAnalysis, previousAnalysis)

  saveAnalysis(currentAnalysis)

  console.log('')
  console.log('✅ Bundle analysis complete')

  // Exit with non-zero code if there are regressions (for CI)
  if (hasRegression && process.env.CI) {
    console.log('💡 Run with --verbose for detailed breakdown')
    process.exit(1)
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
