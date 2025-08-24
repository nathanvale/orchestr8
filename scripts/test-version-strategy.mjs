#!/usr/bin/env node

/**
 * Comprehensive Version Strategy Test Suite
 *
 * Tests all aspects of the version strategy and pre-release configuration:
 * - Package version compliance
 * - Dist tag strategy validation
 * - Pre-release mode testing
 * - Version graduation workflows
 * - Changeset integration
 */

import {
  validateVersionStrategy,
  validateDistTagStrategy,
} from './validate-version-strategy.mjs'
import {
  validateDistTags,
  displayDistTagStrategy,
  testVersionGraduation,
} from './manage-dist-tags.mjs'
import {
  validatePreReleaseConfig,
  testChangesetPrerelease,
  testVersionCommands,
} from './configure-prerelease.mjs'

async function runComprehensiveTests() {
  console.log('🚀 Running Comprehensive Version Strategy Tests\n')
  console.log('='.repeat(60))

  let allTestsPassed = true
  const testResults = []

  // Test 1: Version Strategy Compliance
  console.log('\n📋 TEST 1: Version Strategy Compliance')
  console.log('-'.repeat(40))
  try {
    await validateVersionStrategy()
    validateDistTagStrategy()
    testResults.push({ name: 'Version Strategy Compliance', status: 'PASS' })
    console.log('✅ Version strategy compliance: PASS')
  } catch (error) {
    console.log('❌ Version strategy compliance: FAIL')
    console.error('  Error:', error.message)
    testResults.push({
      name: 'Version Strategy Compliance',
      status: 'FAIL',
      error: error.message,
    })
    allTestsPassed = false
  }

  // Test 2: Dist Tag Strategy
  console.log('\n📋 TEST 2: NPM Dist Tag Strategy')
  console.log('-'.repeat(40))
  try {
    displayDistTagStrategy()
    const tagsValid = await validateDistTags(true)
    testVersionGraduation()

    if (tagsValid) {
      testResults.push({ name: 'NPM Dist Tag Strategy', status: 'PASS' })
      console.log('✅ NPM dist tag strategy: PASS')
    } else {
      testResults.push({ name: 'NPM Dist Tag Strategy', status: 'FAIL' })
      console.log('❌ NPM dist tag strategy: FAIL')
      allTestsPassed = false
    }
  } catch (error) {
    console.log('❌ NPM dist tag strategy: FAIL')
    console.error('  Error:', error.message)
    testResults.push({
      name: 'NPM Dist Tag Strategy',
      status: 'FAIL',
      error: error.message,
    })
    allTestsPassed = false
  }

  // Test 3: Pre-release Configuration
  console.log('\n📋 TEST 3: Pre-release Configuration')
  console.log('-'.repeat(40))
  try {
    const configValid = validatePreReleaseConfig()
    const preReleaseValid = testChangesetPrerelease()
    testVersionCommands()

    if (configValid && preReleaseValid) {
      testResults.push({ name: 'Pre-release Configuration', status: 'PASS' })
      console.log('✅ Pre-release configuration: PASS')
    } else {
      testResults.push({ name: 'Pre-release Configuration', status: 'FAIL' })
      console.log('❌ Pre-release configuration: FAIL')
      allTestsPassed = false
    }
  } catch (error) {
    console.log('❌ Pre-release configuration: FAIL')
    console.error('  Error:', error.message)
    testResults.push({
      name: 'Pre-release Configuration',
      status: 'FAIL',
      error: error.message,
    })
    allTestsPassed = false
  }

  // Test Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('='.repeat(60))

  for (const result of testResults) {
    const status = result.status === 'PASS' ? '✅' : '❌'
    console.log(`${status} ${result.name}: ${result.status}`)
    if (result.error) {
      console.log(`   💥 Error: ${result.error}`)
    }
  }

  console.log('\n' + '-'.repeat(60))
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED - Version Strategy Ready for Production')
    console.log('\n📋 Version Strategy Summary:')
    console.log(
      '  🔵 Beta RC: @orchestr8/schema, @orchestr8/logger, @orchestr8/resilience (1.0.0-beta.x)',
    )
    console.log(
      '  🟡 Alpha: @orchestr8/core, @orchestr8/cli, @orchestr8/agent-base (0.x.x-alpha.x)',
    )
    console.log('  ⚫ Private: @orchestr8/testing (not published)')

    console.log('\n🏷️  NPM Dist Tags Configured:')
    console.log('  📦 Beta RC packages: @beta, @rc, @latest')
    console.log('  📦 Alpha packages: @alpha, @next')

    console.log('\n⚡ Pre-release Mode Ready:')
    console.log('  🔧 Changeset pre-release commands validated')
    console.log('  🔧 Version graduation workflows tested')
    console.log('  🔧 NPM dist tag strategy implemented')

    console.log('\n🚀 Ready for Task 6: End-to-End Publishing Validation')
  } else {
    console.log('❌ SOME TESTS FAILED - Review errors above')
    process.exit(1)
  }

  return allTestsPassed
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch((error) => {
    console.error('💥 Test suite failed:', error)
    process.exit(1)
  })
}

export { runComprehensiveTests }
