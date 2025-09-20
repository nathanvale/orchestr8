/**
 * Vitest Global Setup - Zombie Process Prevention
 *
 * Initializes process tracking and cleanup mechanisms before test suite runs
 */

import { processTracker } from './packages/quality-check/src/process-tracker'

export default async function setup() {
  console.log('🚀 Initializing zombie process prevention...')

  // Reset tracker to clean state
  processTracker.reset()

  // Store original process.env
  process.env.VITEST_PROCESS_TRACKING = 'true'
  process.env.VITEST_START_TIME = Date.now().toString()

  // Log initial state
  console.log('✅ Process tracker initialized')
  console.log(`📊 Starting test suite at ${new Date().toISOString()}`)

  // Return teardown function (optional, we'll use globalTeardown instead)
  return async () => {
    // This runs after all tests complete
    console.log('🏁 Test suite completed')
  }
}
