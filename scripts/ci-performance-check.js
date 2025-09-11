#!/usr/bin/env node
/* eslint-env node */

// Simple CI performance check aligned with CI-ADHD optimization spec
// Provides real performance guards without unnecessary complexity

/** @type {Record<string, number>} */
const THRESHOLDS = {
  'lint': 60000, // 1 minute
  'format': 30000, // 30 seconds
  'typecheck': 90000, // 1.5 minutes
  'build': 180000, // 3 minutes
  'test:quick': 30000, // 30 seconds
  'test:focused': 300000, // 5 minutes
}

/**
 * Check if a job's performance is within acceptable thresholds
 * @param {string} job - The job name to check
 * @param {string} duration - The duration in milliseconds as a string
 * @returns {boolean} Whether the job passed the performance check
 */
function checkPerformance(job, duration) {
  const threshold = THRESHOLDS[job]
  if (!threshold) {
    console.log(`⚠️  No threshold defined for job: ${job}`)
    return true
  }

  const durationMs = parseInt(duration, 10)
  if (isNaN(durationMs)) {
    console.error(`❌ Invalid duration: ${duration}`)
    process.exit(1)
  }

  if (durationMs > threshold) {
    console.error(`❌ ${job} took ${durationMs}ms (threshold: ${threshold}ms)`)
    console.log('\n💡 Optimization tips:')

    if (job === 'lint') {
      console.log('  - Check ESLint cache is working')
      console.log('  - Consider using --cache flag')
    } else if (job === 'typecheck') {
      console.log('  - Ensure incremental compilation is enabled')
      console.log('  - Check tsconfig for unnecessary includes')
    } else if (job === 'build') {
      console.log('  - Verify Turbo cache is working')
      console.log('  - Check for unnecessary rebuilds')
    }

    return false
  }

  console.log(`✅ ${job} completed in ${durationMs}ms (threshold: ${threshold}ms)`)
  return true
}

// Parse CLI arguments
const args = process.argv.slice(2)
const jobIndex = args.indexOf('--job')
const durationIndex = args.indexOf('--duration')

if (jobIndex === -1 || durationIndex === -1) {
  console.log('Usage: node scripts/ci-performance-check.js --job <job> --duration <ms>')
  console.log('Example: node scripts/ci-performance-check.js --job lint --duration 45000')
  process.exit(1)
}

const job = args[jobIndex + 1]
const duration = args[durationIndex + 1]

if (!job || !duration) {
  console.error('❌ Missing job or duration argument')
  process.exit(1)
}

const success = checkPerformance(job, duration)
process.exit(success ? 0 : 1)
