/**
 * Zombie Process Prevention Setup
 *
 * This file is loaded by Vitest's setupFiles to ensure zombie processes
 * are tracked and cleaned up properly during test execution.
 */

import { afterAll, beforeAll } from 'vitest'
import { processTracker } from '../../packages/quality-check/src/process-tracker.js'

// Initialize process tracking when test suite starts
beforeAll(() => {
  processTracker.reset()

  if (process.env['PROCESS_DEBUG'] === 'true' && !process.env['VITEST_SILENT']) {
    console.log('🛡️ Zombie process prevention enabled for test suite')
  }
})

// Clean up all tracked processes when test suite ends
afterAll(async () => {
  const stats = processTracker.getStats()
  const currentlyTracked = stats.totalSpawned - stats.totalCleaned

  if (currentlyTracked > 0) {
    if (!process.env['VITEST_SILENT']) {
      console.log(`🧹 Cleaning up ${currentlyTracked} tracked processes...`)
    }

    try {
      await processTracker.cleanupAll()

      if (!process.env['VITEST_SILENT']) {
        const finalStats = processTracker.getStats()
        const remaining = finalStats.totalSpawned - finalStats.totalCleaned
        console.log(`✅ Cleaned up processes. Remaining: ${remaining}`)
      }
    } catch (error) {
      console.error('❌ Error during process cleanup:', error)
    }
  }

  // Reset tracker after cleanup
  processTracker.reset()
})

// Register process exit handlers to ensure cleanup even on unexpected exit
const exitHandler = async (signal: string) => {
  if (!process.env['VITEST_SILENT']) {
    console.log(`\n🛑 Received ${signal}, cleaning up processes...`)
  }

  try {
    await processTracker.cleanupAll()
  } catch (error) {
    console.error('❌ Error during emergency cleanup:', error)
  }

  process.exit(signal === 'SIGINT' ? 130 : 1)
}

// Only register exit handlers once
if (!process.env['_ZOMBIE_PREVENTION_REGISTERED']) {
  process.env['_ZOMBIE_PREVENTION_REGISTERED'] = 'true'

  process.once('SIGINT', () => exitHandler('SIGINT'))
  process.once('SIGTERM', () => exitHandler('SIGTERM'))
  process.once('uncaughtException', async (error) => {
    console.error('❌ Uncaught exception:', error)
    await exitHandler('uncaughtException')
  })
  process.once('unhandledRejection', async (reason) => {
    console.error('❌ Unhandled rejection:', reason)
    await exitHandler('unhandledRejection')
  })
}
