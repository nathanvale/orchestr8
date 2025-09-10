#!/usr/bin/env node

/**
 * CI Performance Check Script
 * 
 * Validates CI job execution times against defined thresholds
 * and posts warnings when thresholds are exceeded.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Valid job names
type JobName = 'lint' | 'format' | 'typecheck' | 'build' | 'testQuick' | 'testFocused' | 'testFull'

// Performance thresholds in seconds
const THRESHOLDS: Record<JobName, number> = {
  lint: 60, // 1 minute
  format: 30, // 30 seconds
  typecheck: 90, // 1.5 minutes
  build: 180, // 3 minutes
  testQuick: 30, // 30 seconds
  testFocused: 60, // 1 minute
  testFull: 300, // 5 minutes
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const

interface ParsedArgs {
  job: string | null
  duration: number | null
  verbose: boolean
}

interface PerformanceResult {
  passed: boolean
  threshold: number | null
  percentage: number | null
}

interface PerformanceRun {
  job: string
  duration: number
  passed: boolean
  timestamp: string
  threshold: number | null
}

interface PerformanceData {
  runs: PerformanceRun[]
}

/**
 * Parse command line arguments
 */
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  const options: ParsedArgs = {
    job: null,
    duration: null,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--job' && args[i + 1]) {
      options.job = args[++i] || null
    } else if (arg === '--duration' && args[i + 1]) {
      const durationStr = args[++i]
      if (durationStr !== undefined) {
        options.duration = parseFloat(durationStr)
      }
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
${colors.cyan}CI Performance Check${colors.reset}

Usage: node scripts/ci-performance-check.ts [options]

Options:
  --job <name>        Job name to check (e.g., lint, build, test)
  --duration <secs>   Duration of the job in seconds
  --verbose, -v       Show detailed output
  --help, -h         Show this help message

Thresholds:
${Object.entries(THRESHOLDS)
  .map(([job, threshold]) => `  ${job}: ${threshold}s`)
  .join('\n')}

Examples:
  node scripts/ci-performance-check.ts --job lint --duration 45
  node scripts/ci-performance-check.ts --job build --duration 200 -v
`)
}

/**
 * Check performance against threshold
 */
function checkPerformance(job: string, duration: number): PerformanceResult {
  const threshold = THRESHOLDS[job as JobName]

  if (!threshold) {
    console.warn(
      `${colors.yellow}⚠️  Warning: No threshold defined for job '${job}'${colors.reset}`
    )
    return { passed: true, threshold: null, percentage: null }
  }

  const passed = duration <= threshold
  const percentage = Math.round((duration / threshold) * 100)

  return { passed, threshold, percentage }
}

/**
 * Generate performance report
 */
function generateReport(
  job: string,
  duration: number,
  result: PerformanceResult,
  verbose: boolean
): boolean {
  const { passed, threshold, percentage } = result

  const emoji = passed ? '✅' : '❌'
  const color = passed ? colors.green : colors.red

  console.log('\n' + '='.repeat(50))
  console.log(`${colors.cyan}🚀 CI Performance Check Results${colors.reset}`)
  console.log('='.repeat(50))

  console.log(`\nJob: ${colors.blue}${job}${colors.reset}`)
  console.log(`Duration: ${color}${duration}s${colors.reset}`)

  if (threshold) {
    console.log(`Threshold: ${threshold}s`)
    console.log(`Performance: ${color}${percentage}%${colors.reset} of threshold`)
    console.log(`Status: ${emoji} ${color}${passed ? 'PASSED' : 'FAILED'}${colors.reset}`)

    if (!passed) {
      const excess = duration - threshold
      console.log(
        `\n${colors.red}⚠️  Job exceeded threshold by ${excess}s${colors.reset}`
      )
      console.log(`\n${colors.yellow}💡 Optimization Tips:${colors.reset}`)

      // Job-specific tips
      const tips = getOptimizationTips(job)
      tips.forEach((tip: string) => console.log(`   • ${tip}`))
    }
  }

  if (verbose) {
    console.log('\n📊 Performance Metrics:')
    console.log(`   • Start time: ${new Date().toISOString()}`)
    console.log(`   • Job type: ${job}`)
    console.log(`   • Actual duration: ${duration}s`)
    console.log(`   • Expected max: ${threshold || 'N/A'}s`)
    console.log(`   • Performance ratio: ${percentage || 'N/A'}%`)
  }

  console.log('\n' + '='.repeat(50))

  return passed
}

/**
 * Get optimization tips for specific jobs
 */
function getOptimizationTips(job: string): string[] {
  const tips: Record<JobName, string[]> = {
    lint: [
      'Use ESLint cache (--cache flag)',
      'Reduce number of rules or plugins',
      'Check for expensive custom rules',
      'Consider using parallel linting',
    ],
    format: [
      'Use Prettier cache (--cache flag)',
      'Format only changed files in PRs',
      'Check for large files that slow down formatting',
    ],
    typecheck: [
      'Use incremental compilation (--incremental)',
      'Check tsconfig for unnecessary includes',
      'Consider project references for monorepos',
      'Review strict mode settings',
    ],
    build: [
      'Enable build caching (Turbo, Webpack cache)',
      'Use incremental builds',
      'Optimize bundle size',
      'Check for unnecessary dependencies',
      'Consider parallel builds',
    ],
    testQuick: [
      'Reduce test scope for quick checks',
      'Use bail-fast on first failure',
      'Mock expensive operations',
      'Skip coverage for quick tests',
    ],
    testFocused: [
      'Only test changed files',
      'Use test.only during development',
      'Optimize test setup/teardown',
    ],
    testFull: [
      'Use parallel test execution',
      'Optimize database/fixture setup',
      'Consider test sharding for large suites',
      'Review slow test queries',
    ],
  }

  return (
    tips[job as JobName] || [
      'Review job configuration for optimization opportunities',
      'Check for unnecessary steps or dependencies',
      'Consider caching strategies',
    ]
  )
}

/**
 * Save performance data for trending
 */
function savePerformanceData(job: string, duration: number, passed: boolean): void {
  const dataFile = join(process.cwd(), '.ci-performance-data.json')
  let data: PerformanceData = { runs: [] }

  try {
    if (existsSync(dataFile)) {
      const content = readFileSync(dataFile, 'utf-8')
      data = JSON.parse(content) as PerformanceData
    }
  } catch {
    console.warn(
      `${colors.yellow}Warning: Could not load existing performance data${colors.reset}`
    )
  }

  // Add new run
  data.runs.push({
    job,
    duration,
    passed,
    timestamp: new Date().toISOString(),
    threshold: THRESHOLDS[job as JobName] || null,
  })

  // Keep only last 100 runs per job
  const jobRuns: Record<string, PerformanceRun[]> = {}
  data.runs.forEach((run) => {
    if (!jobRuns[run.job]) jobRuns[run.job] = []
    jobRuns[run.job]!.push(run)
  })

  data.runs = []
  Object.entries(jobRuns).forEach(([, runs]) => {
    const recentRuns = runs.slice(-100)
    data.runs.push(...recentRuns)
  })

  try {
    writeFileSync(dataFile, JSON.stringify(data, null, 2))
  } catch {
    console.warn(`${colors.yellow}Warning: Could not save performance data${colors.reset}`)
  }
}

/**
 * Main execution
 */
function main(): void {
  const options = parseArgs()

  if (!options.job || options.duration === null || options.duration === undefined) {
    console.error(`${colors.red}Error: --job and --duration are required${colors.reset}`)
    console.log('Use --help for usage information')
    process.exit(1)
  }

  // Check performance
  const result = checkPerformance(options.job, options.duration)

  // Generate report
  const passed = generateReport(options.job, options.duration, result, options.verbose)

  // Save data for trending
  savePerformanceData(options.job, options.duration, passed)

  // Exit with appropriate code
  if (!passed && result.threshold !== null) {
    console.log(`\n${colors.red}❌ Performance check failed!${colors.reset}`)
    console.log(
      `Consider the optimization tips above to improve ${options.job} performance.\n`
    )
    process.exit(1)
  } else {
    console.log(`\n${colors.green}✅ Performance check passed!${colors.reset}\n`)
    process.exit(0)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { THRESHOLDS, checkPerformance, getOptimizationTips }
