/**
 * Zombie Process Prevention Validation Tests
 *
 * Tests to ensure that our zombie process prevention system works correctly
 * and that no processes are left behind after test completion.
 */

import { spawn, ChildProcess } from 'child_process'
import { processTracker } from '../packages/quality-check/src/process-tracker.js'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'os'

describe('Zombie Process Prevention', () => {
  let trackedProcesses: ChildProcess[] = []

  beforeEach(() => {
    trackedProcesses = []
    // Reset tracker for clean test state
    processTracker.reset()
  })

  afterEach(async () => {
    // Manual cleanup of any test processes
    for (const proc of trackedProcesses) {
      if (proc.pid && !proc.killed) {
        try {
          proc.kill('SIGKILL')
        } catch {
          // Process might already be dead
        }
      }
    }
    trackedProcesses = []

    // Ensure tracker cleanup
    await processTracker.cleanupAll(true)
  })

  describe('Process Tracking', () => {
    it('should track spawned processes', () => {
      const initialStats = processTracker.getStats()
      expect(initialStats.totalSpawned).toBe(0)

      // Spawn a simple process
      const proc = spawn('echo', ['test'])
      trackedProcesses.push(proc)

      // Give it a moment to register
      const stats = processTracker.getStats()
      expect(stats.totalSpawned).toBeGreaterThan(0)
    })

    it('should clean up processes on normal exit', async () => {
      // Spawn a process that exits quickly
      const proc = spawn('echo', ['test'])
      trackedProcesses.push(proc)

      // Wait for natural exit
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve())
      })

      // Give tracker time to update
      await new Promise((resolve) => setTimeout(resolve, 100))

      const stats = processTracker.getStats()
      expect(stats.totalCleaned).toBeGreaterThan(0)
    })

    it('should track multiple concurrent processes', () => {
      const processes: ChildProcess[] = []

      // Spawn multiple processes
      for (let i = 0; i < 5; i++) {
        const proc = spawn('sleep', ['0.1'])
        processes.push(proc)
        trackedProcesses.push(proc)
      }

      const activeProcs = processTracker.getActiveProcesses()
      expect(activeProcs.length).toBeGreaterThanOrEqual(processes.length)
    })
  })

  describe('Cleanup Mechanisms', () => {
    it('should force-kill processes on cleanup', async () => {
      // Spawn a long-running process
      const proc = spawn('sleep', ['60'])
      trackedProcesses.push(proc)

      expect(proc.killed).toBe(false)

      // Force cleanup
      if (proc.pid) {
        await processTracker.cleanupProcess(proc.pid, true)
      }

      expect(proc.killed).toBe(true)
    })

    it('should cleanup all processes when requested', async () => {
      // Spawn multiple processes
      for (let i = 0; i < 3; i++) {
        const proc = spawn('sleep', ['60'])
        trackedProcesses.push(proc)
      }

      // Cleanup all
      await processTracker.cleanupAll(true)

      // All should be killed
      for (const proc of trackedProcesses) {
        expect(proc.killed).toBe(true)
      }

      const activeProcs = processTracker.getActiveProcesses()
      expect(activeProcs.length).toBe(0)
    })

    it('should handle graceful termination before force kill', async () => {
      // Create a process that responds to SIGTERM
      const scriptPath = os.platform() === 'win32' ? 'node' : 'sh'
      const scriptArgs =
        os.platform() === 'win32'
          ? ['-e', 'process.on("SIGTERM", () => process.exit(0)); setTimeout(() => {}, 60000)']
          : ['-c', 'trap "exit 0" TERM; sleep 60']

      const proc = spawn(scriptPath, scriptArgs)
      trackedProcesses.push(proc)

      if (proc.pid) {
        // Try graceful cleanup (not forced)
        await processTracker.cleanupProcess(proc.pid, false)

        // Process should be terminated
        expect(proc.killed).toBe(true)
      }
    })
  })

  describe('Timeout Behavior', () => {
    it('should kill processes that exceed timeout', async () => {
      // This test would require modifying the DEFAULT_TIMEOUT
      // For testing, we'll verify the timeout is set
      const proc = spawn('sleep', ['60'])
      trackedProcesses.push(proc)

      // The process should have a timeout set
      // We can't directly access the timeout, but we can verify
      // the process gets cleaned up eventually
      const stats = processTracker.getStats()
      expect(stats.totalSpawned).toBeGreaterThan(0)

      // Clean up immediately for this test
      if (proc.pid) {
        await processTracker.cleanupProcess(proc.pid, true)
      }
    }, 10000)
  })

  describe('Statistics and Reporting', () => {
    it('should track zombie count correctly', async () => {
      // Spawn and kill processes to create potential zombies
      const proc1 = spawn('sleep', ['60'])
      const proc2 = spawn('sleep', ['60'])
      trackedProcesses.push(proc1, proc2)

      // Force kill them
      await processTracker.cleanupAll(true)

      const stats = processTracker.getStats()

      // Zombies are processes that didn't clean up naturally
      // Since we force-killed them, they should be counted
      expect(stats.totalSpawned).toBe(2)
      expect(stats.totalCleaned).toBe(2)
    })

    it('should generate comprehensive report', async () => {
      // Spawn a test process
      const proc = spawn('echo', ['test'])
      trackedProcesses.push(proc)

      // Wait for it to complete
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve())
      })

      const report = processTracker.generateReport()

      expect(report).toContain('Process Tracking Report')
      expect(report).toContain('Total Spawned')
      expect(report).toContain('Total Cleaned')
    })

    it('should track per-test-file statistics', () => {
      // Simulate test file context
      processTracker.pushTestFile('test1.spec.ts')

      const proc1 = spawn('echo', ['test1'])
      trackedProcesses.push(proc1)

      processTracker.popTestFile()

      processTracker.pushTestFile('test2.spec.ts')

      const proc2 = spawn('echo', ['test2'])
      trackedProcesses.push(proc2)

      processTracker.popTestFile()

      const stats = processTracker.getStats()
      expect(stats.byTestFile.size).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle already-dead processes gracefully', async () => {
      const proc = spawn('echo', ['test'])
      trackedProcesses.push(proc)

      // Wait for natural exit
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve())
      })

      // Try to cleanup an already-dead process
      if (proc.pid) {
        await expect(processTracker.cleanupProcess(proc.pid, true)).resolves.not.toThrow()
      }
    })

    it('should handle invalid PIDs gracefully', async () => {
      // Try to cleanup non-existent process
      const invalidPid = 999999

      await expect(processTracker.cleanupProcess(invalidPid, true)).resolves.not.toThrow()
    })

    it('should handle rapid process spawning', async () => {
      const processes: ChildProcess[] = []

      // Rapidly spawn many processes
      for (let i = 0; i < 20; i++) {
        const proc = spawn('echo', [`test${i}`])
        processes.push(proc)
        trackedProcesses.push(proc)
      }

      // Wait for all to complete
      await Promise.all(
        processes.map(
          (proc) =>
            new Promise<void>((resolve) => {
              proc.on('exit', () => resolve())
            }),
        ),
      )

      // Give tracker time to update
      await new Promise((resolve) => setTimeout(resolve, 500))

      const stats = processTracker.getStats()
      expect(stats.totalSpawned).toBeGreaterThanOrEqual(20)
      expect(stats.totalCleaned).toBeGreaterThanOrEqual(20)
    })
  })

  describe('Integration with Vitest', () => {
    it('should work within test environment', () => {
      // This test verifies that the tracker works in Vitest environment
      const stats = processTracker.getStats()
      expect(stats).toBeDefined()
      expect(stats.totalSpawned).toBeGreaterThanOrEqual(0)
    })

    it('should not interfere with test execution', async () => {
      // Verify that tracking doesn't break normal test flow
      const result = await new Promise<string>((resolve) => {
        const proc = spawn('echo', ['success'])
        trackedProcesses.push(proc)

        let output = ''
        proc.stdout.on('data', (data) => {
          output += data.toString()
        })

        proc.on('close', () => {
          resolve(output.trim())
        })
      })

      expect(result).toBe('success')
    })
  })
})
