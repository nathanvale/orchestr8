/**
 * Vitest Global Teardown - Zombie Process Cleanup
 *
 * Ensures all spawned processes are terminated after test suite completes
 */

import { processTracker } from './packages/quality-check/src/process-tracker'
import { execSync } from 'child_process'
import * as os from 'os'

export default async function teardown() {
  console.log('\n🧹 Starting global teardown...')

  const startTime = process.env.VITEST_START_TIME
    ? parseInt(process.env.VITEST_START_TIME)
    : Date.now()
  const duration = Date.now() - startTime

  console.log(`⏱️  Test suite duration: ${(duration / 1000).toFixed(2)}s`)

  // Generate process tracking report
  const report = processTracker.generateReport()
  console.log('\n' + report)

  // Get active processes before cleanup
  const activeProcesses = processTracker.getActiveProcesses()

  if (activeProcesses.length > 0) {
    console.log(`\n⚠️  Found ${activeProcesses.length} active processes, cleaning up...`)

    // Cleanup all tracked processes
    await processTracker.cleanupAll()

    // Wait a moment for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Double-check with system commands
    if (os.platform() !== 'win32') {
      try {
        // Check for any remaining node/vitest processes
        const psCommand =
          os.platform() === 'darwin'
            ? "ps aux | grep -E 'node.*vitest|vitest' | grep -v grep || true"
            : "ps -ef | grep -E 'node.*vitest|vitest' | grep -v grep || true"

        const remaining = execSync(psCommand, { encoding: 'utf8' }).trim()

        if (remaining) {
          console.log('⚠️  System check found potential zombie processes:')
          console.log(remaining)

          // Try to extract PIDs and kill them
          const lines = remaining.split('\n').filter(Boolean)
          for (const line of lines) {
            const parts = line.split(/\s+/)
            const pid = os.platform() === 'darwin' ? parts[1] : parts[1]
            if (pid && /^\d+$/.test(pid)) {
              try {
                process.kill(parseInt(pid), 'SIGKILL')
                console.log(`  ✅ Killed zombie process ${pid}`)
              } catch {
                // Process might have already exited
              }
            }
          }
        } else {
          console.log('✅ No zombie processes detected by system check')
        }
      } catch (err) {
        console.error('Error during system process check:', err)
      }
    }
  } else {
    console.log('✅ No active processes to clean up')
  }

  // Get final stats
  const stats = processTracker.getStats()

  if (stats.totalZombies > 0) {
    console.warn(
      `\n⚠️  WARNING: ${stats.totalZombies} zombie processes were detected during this test run`,
    )
    console.warn('   Consider investigating tests that spawn processes without proper cleanup')
  } else {
    console.log('\n✅ Zero zombie processes - all processes cleaned up properly!')
  }

  console.log('\n🏁 Global teardown complete')
}
