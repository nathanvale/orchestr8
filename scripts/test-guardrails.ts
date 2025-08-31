#!/usr/bin/env tsx
/**
 * Guardrails Testing Script
 *
 * Quick validation script to test all guardrail implementations.
 * Useful for development and ensuring guardrails work correctly.
 */

/* eslint-disable no-console */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  duration: number
}

/**
 * Run a single guardrail test
 */
async function testGuardrail(name: string, command: string): Promise<TestResult> {
  const startTime = Date.now()

  try {
    console.log(`🧪 Testing ${name}...`)

    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000, // 10 second timeout for tests
    })

    const duration = Date.now() - startTime

    return {
      name,
      status: 'pass',
      message: 'Test completed successfully',
      duration,
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    return {
      name,
      status: 'fail',
      message: error.message || 'Test failed',
      duration,
    }
  }
}

/**
 * Test all individual guardrail scripts
 */
async function testIndividualGuardrails(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Test changeset validator (if changesets exist)
  if (existsSync('.changeset')) {
    results.push(await testGuardrail('changeset-validator', 'tsx scripts/changeset-validator.ts'))
  } else {
    results.push({
      name: 'changeset-validator',
      status: 'skip',
      message: 'No .changeset directory found',
      duration: 0,
    })
  }

  // Test security scanner
  results.push(await testGuardrail('security-scan', 'tsx scripts/security-scan.ts'))

  // Test export map linter (if packages exist)
  if (existsSync('packages') || existsSync('apps')) {
    results.push(await testGuardrail('export-map-linter', 'tsx scripts/export-map-linter.ts'))
  } else {
    results.push({
      name: 'export-map-linter',
      status: 'skip',
      message: 'No packages or apps directories found',
      duration: 0,
    })
  }

  // Test governance checks
  results.push(await testGuardrail('governance-check', 'tsx scripts/governance-check.ts'))

  return results
}

/**
 * Test the main pre-release guardrails script
 */
async function testMainGuardrails(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Test quick mode
  results.push(
    await testGuardrail(
      'guardrails-quick',
      'tsx scripts/pre-release-guardrails.ts --quick --warn-only',
    ),
  )

  return results
}

/**
 * Display test results
 */
function displayResults(results: TestResult[]): boolean {
  const passed = results.filter((r) => r.status === 'pass')
  const failed = results.filter((r) => r.status === 'fail')
  const skipped = results.filter((r) => r.status === 'skip')

  console.log('\n🧪 Guardrails Test Results')
  console.log('='.repeat(50))

  for (const result of results) {
    const icon = {
      pass: '✅',
      fail: '❌',
      skip: '⏭️',
    }[result.status]

    console.log(`${icon} ${result.name}: ${result.message} (${result.duration}ms)`)
  }

  console.log('='.repeat(50))

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  console.log(
    `📊 Summary: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  )
  console.log(`⏱️  Total test time: ${totalDuration}ms`)

  if (failed.length > 0) {
    console.error('\n❌ Some guardrail tests failed!')
    console.log('\n💡 Next steps:')
    console.log('   • Check the error messages above')
    console.log('   • Ensure all dependencies are installed: pnpm install')
    console.log('   • Run individual scripts to debug issues')
    console.log('   • Check that the codebase is in a valid state')
    return false
  } else {
    console.log('\n✅ All guardrail tests passed!')
    console.log('🛡️  Pre-release guardrails are working correctly')
    return true
  }
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  console.log('🛡️  Testing Pre-Release Guardrails')
  console.log('   This script validates that all guardrail scripts work correctly')
  console.log('')

  const allResults: TestResult[] = []

  // Test individual scripts
  console.log('🔍 Testing individual guardrail scripts...')
  const individualResults = await testIndividualGuardrails()
  allResults.push(...individualResults)

  // Test main orchestration script
  console.log('\n🎯 Testing main guardrails orchestration...')
  const mainResults = await testMainGuardrails()
  allResults.push(...mainResults)

  // Display results and exit
  const success = displayResults(allResults)

  if (!success) {
    process.exit(1)
  }
}

// Run if this script is executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Guardrails testing failed:', error)
    process.exit(1)
  })
}
