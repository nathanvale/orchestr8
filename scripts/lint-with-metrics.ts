#!/usr/bin/env tsx

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

/**
 * Wrapper script that runs ESLint with timing metrics
 * Stores results in .lint-metrics.json for dx:status consumption
 */

const main = (): void => {
  const start = performance.now()
  let exitCode = 0
  let fileCount = 0

  try {
    // Run ESLint with cache enabled and capture output
    const output = execSync('eslint . --cache --cache-location .eslintcache', {
      stdio: 'inherit',
      encoding: 'utf8',
    })

    // Try to count files from ESLint output (best effort)
    // This is approximate - ESLint doesn't always report file count
    const outputStr = output?.toString() || ''
    const fileMatches = outputStr.match(/(\d+)\s+files?/i)
    fileCount = fileMatches ? parseInt(fileMatches[1], 10) : 0
  } catch (error) {
    exitCode = 1
    console.error('ESLint failed:', error)
  } finally {
    const durationMs = Math.round(performance.now() - start)
    const timestamp = new Date().toISOString()

    // Write metrics for dx:status consumption
    const metrics = {
      durationMs,
      timestamp,
      fileCount,
      success: exitCode === 0,
      command: 'eslint . --cache --cache-location .eslintcache',
    }

    try {
      writeFileSync('.lint-metrics.json', JSON.stringify(metrics, null, 2), 'utf8')
    } catch (writeError) {
      console.warn('Failed to write lint metrics:', writeError)
    }

    if (exitCode === 0) {
      console.log(`✅ Lint completed in ${durationMs}ms`)
    } else {
      console.error(`❌ Lint failed after ${durationMs}ms`)
    }
  }

  process.exitCode = exitCode
}

main()
