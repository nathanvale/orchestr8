/**
 * ProcessTracker - Zombie Process Prevention System
 *
 * Tracks all child processes spawned during test execution and ensures
 * they are properly terminated to prevent zombie accumulation.
 */

import { ChildProcess } from 'child_process'
import * as path from 'path'

interface TrackedProcess {
  pid: number
  process: ChildProcess
  command: string
  args: string[]
  startTime: Date
  testFile?: string
  cleaned: boolean
}

interface ProcessStats {
  totalSpawned: number
  totalCleaned: number
  totalZombies: number
  byTestFile: Map<string, number>
  longestLived: { pid: number; duration: number } | null
}

export class ProcessTracker {
  private static instance: ProcessTracker | null = null
  private processes: Map<number, TrackedProcess> = new Map()
  private testFileStack: string[] = []
  private stats: ProcessStats = {
    totalSpawned: 0,
    totalCleaned: 0,
    totalZombies: 0,
    byTestFile: new Map(),
    longestLived: null,
  }
  private cleanupTimeouts: Map<number, NodeJS.Timeout> = new Map()
  private readonly DEFAULT_TIMEOUT = 30000 // 30 seconds

  private constructor() {
    this.setupProcessInterception()
    this.setupSignalHandlers()
  }

  static getInstance(): ProcessTracker {
    if (!ProcessTracker.instance) {
      ProcessTracker.instance = new ProcessTracker()
    }
    return ProcessTracker.instance
  }

  /**
   * Intercept all process spawning methods to track child processes
   */
  private setupProcessInterception(): void {
    // Note: This method is currently disabled as it causes issues with module exports
    // The ProcessTracker can still be used by manually calling trackProcess
    // TODO: Find a better way to intercept process spawning without breaking module exports
  }

  /**
   * Setup signal handlers for emergency cleanup
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP']

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n⚠️ Received ${signal}, cleaning up processes...`)
        await this.cleanupAll(true)
        process.exit(signal === 'SIGTERM' ? 0 : 1)
      })
    })

    process.on('beforeExit', async () => {
      await this.cleanupAll()
    })
  }

  /**
   * Track a spawned child process
   */
  public trackProcess(child: ChildProcess, command: string, args: string[]): void {
    if (!child.pid) return

    const tracked: TrackedProcess = {
      pid: child.pid,
      process: child,
      command,
      args,
      startTime: new Date(),
      testFile: this.getCurrentTestFile(),
      cleaned: false,
    }

    this.processes.set(child.pid, tracked)
    this.stats.totalSpawned++

    // Update per-test stats
    if (tracked.testFile) {
      const count = this.stats.byTestFile.get(tracked.testFile) || 0
      this.stats.byTestFile.set(tracked.testFile, count + 1)
    }

    // Set timeout for automatic cleanup
    const timeout = setTimeout(() => {
      if (!tracked.cleaned && child.pid) {
        console.warn(`⚠️ Process ${child.pid} (${command}) exceeded timeout, terminating...`)
        this.cleanupProcess(child.pid, true).catch((err) => {
          console.error(`Failed to cleanup process ${child.pid}:`, err)
        })
      }
    }, this.DEFAULT_TIMEOUT)

    if (child.pid) {
      this.cleanupTimeouts.set(child.pid, timeout)
    }

    // Listen for natural process exit
    child.on('exit', () => {
      if (child.pid) {
        this.handleProcessExit(child.pid)
      }
    })

    child.on('error', (err) => {
      console.error(`Process ${child.pid} error:`, err)
      if (child.pid) {
        this.handleProcessExit(child.pid)
      }
    })
  }

  /**
   * Handle natural process exit
   */
  private handleProcessExit(pid: number): void {
    const tracked = this.processes.get(pid)
    if (!tracked) return

    tracked.cleaned = true
    this.stats.totalCleaned++

    // Clear timeout
    const timeout = this.cleanupTimeouts.get(pid)
    if (timeout) {
      clearTimeout(timeout)
      this.cleanupTimeouts.delete(pid)
    }

    // Update longest lived
    const duration = Date.now() - tracked.startTime.getTime()
    if (!this.stats.longestLived || duration > this.stats.longestLived.duration) {
      this.stats.longestLived = { pid, duration }
    }

    this.processes.delete(pid)
  }

  /**
   * Push test file to stack (called when entering a test file)
   */
  pushTestFile(testFile: string): void {
    this.testFileStack.push(testFile)
  }

  /**
   * Pop test file from stack (called when exiting a test file)
   */
  popTestFile(): void {
    const testFile = this.testFileStack.pop()
    if (testFile) {
      // Cleanup all processes associated with this test file
      this.cleanupByTestFile(testFile)
    }
  }

  /**
   * Get current test file from stack
   */
  private getCurrentTestFile(): string | undefined {
    return this.testFileStack[this.testFileStack.length - 1]
  }

  /**
   * Cleanup processes associated with a specific test file
   */
  private async cleanupByTestFile(testFile: string): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [pid, tracked] of this.processes) {
      if (tracked.testFile === testFile && !tracked.cleaned) {
        promises.push(this.cleanupProcess(pid))
      }
    }

    await Promise.all(promises)
  }

  /**
   * Cleanup a specific process
   */
  async cleanupProcess(pid: number, force = false): Promise<void> {
    const tracked = this.processes.get(pid)
    if (!tracked || tracked.cleaned) return

    try {
      // Try graceful termination first
      if (!force) {
        tracked.process.kill('SIGTERM')

        // Wait a bit for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Check if process is still alive
        try {
          process.kill(pid, 0) // This throws if process doesn't exist
          // Process still alive, force kill
          tracked.process.kill('SIGKILL')
        } catch {
          // Process already dead, that's good
        }
      } else {
        // Force kill immediately
        tracked.process.kill('SIGKILL')
      }

      this.handleProcessExit(pid)
    } catch (err) {
      console.error(`Failed to cleanup process ${pid}:`, err)
    }
  }

  /**
   * Cleanup all tracked processes
   */
  async cleanupAll(force = false): Promise<void> {
    console.log(`🧹 Cleaning up ${this.processes.size} tracked processes...`)

    const promises: Promise<void>[] = []

    for (const [pid, tracked] of this.processes) {
      if (!tracked.cleaned) {
        promises.push(this.cleanupProcess(pid, force))
      }
    }

    await Promise.all(promises)

    // Count zombies (processes that didn't clean up naturally)
    this.stats.totalZombies = this.stats.totalSpawned - this.stats.totalCleaned
  }

  /**
   * Get process statistics
   */
  getStats(): ProcessStats {
    return { ...this.stats }
  }

  /**
   * Get list of currently tracked processes
   */
  getActiveProcesses(): Array<{ pid: number; command: string; duration: number }> {
    const now = Date.now()
    return Array.from(this.processes.values())
      .filter((p) => !p.cleaned)
      .map((p) => ({
        pid: p.pid,
        command: `${p.command} ${p.args.join(' ')}`,
        duration: now - p.startTime.getTime(),
      }))
  }

  /**
   * Generate a report of process tracking
   */
  generateReport(): string {
    const stats = this.getStats()
    const active = this.getActiveProcesses()

    let report = '📊 Process Tracking Report\n'
    report += '='.repeat(50) + '\n\n'

    report += `Total Spawned: ${stats.totalSpawned}\n`
    report += `Total Cleaned: ${stats.totalCleaned}\n`
    report += `Total Zombies: ${stats.totalZombies}\n`
    report += `Currently Active: ${active.length}\n\n`

    if (stats.longestLived) {
      report += `Longest Lived Process:\n`
      report += `  PID: ${stats.longestLived.pid}\n`
      report += `  Duration: ${(stats.longestLived.duration / 1000).toFixed(2)}s\n\n`
    }

    if (stats.byTestFile.size > 0) {
      report += 'Processes by Test File:\n'
      for (const [file, count] of stats.byTestFile) {
        report += `  ${path.basename(file)}: ${count}\n`
      }
      report += '\n'
    }

    if (active.length > 0) {
      report += 'Currently Active Processes:\n'
      for (const proc of active) {
        report += `  PID ${proc.pid}: ${proc.command} (${(proc.duration / 1000).toFixed(2)}s)\n`
      }
    }

    return report
  }

  /**
   * Reset the tracker (useful for testing)
   */
  reset(): void {
    this.cleanupAll(true).catch((err) => {
      console.error('Failed to cleanup all processes during reset:', err)
    })
    this.processes.clear()
    this.testFileStack = []
    this.cleanupTimeouts.clear()
    this.stats = {
      totalSpawned: 0,
      totalCleaned: 0,
      totalZombies: 0,
      byTestFile: new Map(),
      longestLived: null,
    }
  }
}

// Export singleton instance
export const processTracker = ProcessTracker.getInstance()
