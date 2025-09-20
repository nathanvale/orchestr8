/**
 * TestResourceGuard - Comprehensive Resource Cleanup for Tests
 *
 * Tracks and ensures cleanup of test resources including:
 * - Child processes
 * - Timers and intervals
 * - Temporary directories
 * - File handles
 * - Custom cleanup functions
 */

import { ChildProcess } from 'child_process'
import { rm } from 'fs/promises'
import { existsSync } from 'fs'

interface CleanupFunction {
  name: string
  cleanup: () => Promise<void> | void
  priority: number // Higher number = higher priority (cleanup first)
}

interface TrackedProcess {
  process: ChildProcess
  command: string
  timeout?: NodeJS.Timeout
}

interface ResourceStats {
  processesTracked: number
  processesKilled: number
  timersCleared: number
  tempDirsRemoved: number
  customCleanups: number
  errors: string[]
}

interface FileHandle {
  close?: () => Promise<void> | void
  destroy?: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export class TestResourceGuard {
  private cleanupFns: CleanupFunction[] = []
  private processes: Map<number, TrackedProcess> = new Map()
  private timers: Set<NodeJS.Timeout> = new Set()
  private intervals: Set<NodeJS.Timeout> = new Set()
  private tempDirs: Set<string> = new Set()
  private fileHandles: Set<FileHandle> = new Set()
  private stats: ResourceStats = {
    processesTracked: 0,
    processesKilled: 0,
    timersCleared: 0,
    tempDirsRemoved: 0,
    customCleanups: 0,
    errors: [],
  }
  private isCleaningUp = false

  /**
   * Register a custom cleanup function
   */
  registerCleanup(name: string, fn: () => Promise<void> | void, priority = 0): void {
    if (this.isCleaningUp) {
      console.warn(`⚠️ Cannot register cleanup '${name}' during cleanup phase`)
      return
    }

    this.cleanupFns.push({ name, cleanup: fn, priority })
    // Sort by priority (highest first)
    this.cleanupFns.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Track a spawned child process with optional timeout
   */
  trackProcess(proc: ChildProcess, command: string, timeoutMs = 30000): void {
    if (!proc.pid) {
      console.warn(`⚠️ Cannot track process without PID: ${command}`)
      return
    }

    const tracked: TrackedProcess = {
      process: proc,
      command,
    }

    // Set automatic timeout
    if (timeoutMs > 0) {
      tracked.timeout = setTimeout(() => {
        if (proc.pid && this.processes.has(proc.pid)) {
          console.warn(`⚠️ Process ${proc.pid} (${command}) exceeded timeout, terminating...`)
          this.killProcess(proc.pid, true).catch((err) => {
            this.stats.errors.push(`Timeout kill failed for ${proc.pid}: ${getErrorMessage(err)}`)
          })
        }
      }, timeoutMs)
    }

    this.processes.set(proc.pid, tracked)
    this.stats.processesTracked++

    // Listen for natural process exit
    proc.on('exit', () => {
      if (proc.pid) {
        this.handleProcessExit(proc.pid)
      }
    })

    proc.on('error', (err) => {
      console.error(`Process ${proc.pid} error:`, err.message)
      if (proc.pid) {
        this.handleProcessExit(proc.pid)
      }
    })
  }

  /**
   * Track a timer and ensure it gets cleared
   */
  trackTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.timers.add(timer)
    return timer
  }

  /**
   * Track an interval and ensure it gets cleared
   */
  trackInterval(interval: NodeJS.Timeout): NodeJS.Timeout {
    this.intervals.add(interval)
    return interval
  }

  /**
   * Track a temporary directory for cleanup
   */
  trackTempDir(dir: string): void {
    this.tempDirs.add(dir)
  }

  /**
   * Track a file handle for cleanup
   */
  trackFileHandle(handle: FileHandle): void {
    this.fileHandles.add(handle)
  }

  /**
   * Handle natural process exit
   */
  private handleProcessExit(pid: number): void {
    const tracked = this.processes.get(pid)
    if (!tracked) return

    // Clear timeout if exists
    if (tracked.timeout) {
      clearTimeout(tracked.timeout)
    }

    this.processes.delete(pid)
  }

  /**
   * Kill a specific process
   */
  private async killProcess(pid: number, force = false): Promise<void> {
    const tracked = this.processes.get(pid)
    if (!tracked) return

    try {
      if (!force) {
        // Try graceful termination first
        tracked.process.kill('SIGTERM')

        // Wait briefly for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Check if process still exists
        try {
          process.kill(pid, 0) // Throws if process doesn't exist
          // Still alive, force kill
          tracked.process.kill('SIGKILL')
        } catch {
          // Process already dead
        }
      } else {
        // Force kill immediately
        tracked.process.kill('SIGKILL')
      }

      this.stats.processesKilled++
    } catch (err: unknown) {
      this.stats.errors.push(`Failed to kill process ${pid}: ${getErrorMessage(err)}`)
    } finally {
      this.handleProcessExit(pid)
    }
  }

  /**
   * Clean up all tracked resources
   */
  async cleanup(): Promise<void> {
    if (this.isCleaningUp) {
      console.warn('⚠️ Cleanup already in progress, skipping duplicate call')
      return
    }

    this.isCleaningUp = true

    try {
      // 1. Custom cleanup functions (highest priority first)
      await this.runCustomCleanups()

      // 2. Kill tracked processes
      await this.killAllProcesses()

      // 3. Clear timers and intervals
      this.clearTimers()

      // 4. Clean up temporary directories
      await this.cleanupTempDirs()

      // 5. Close file handles
      await this.closeFileHandles()
    } catch (err: unknown) {
      this.stats.errors.push(`Cleanup failed: ${getErrorMessage(err)}`)
      console.error('❌ TestResourceGuard cleanup failed:', err)
    } finally {
      this.isCleaningUp = false
    }
  }

  /**
   * Run all custom cleanup functions
   */
  private async runCustomCleanups(): Promise<void> {
    for (const { name, cleanup } of this.cleanupFns) {
      try {
        await cleanup()
        this.stats.customCleanups++
      } catch (err: unknown) {
        this.stats.errors.push(`Custom cleanup '${name}' failed: ${getErrorMessage(err)}`)
        console.error(`❌ Custom cleanup '${name}' failed:`, err)
      }
    }
  }

  /**
   * Kill all tracked processes
   */
  private async killAllProcesses(): Promise<void> {
    const killPromises: Promise<void>[] = []

    for (const [pid] of this.processes) {
      killPromises.push(this.killProcess(pid))
    }

    await Promise.allSettled(killPromises)
  }

  /**
   * Clear all tracked timers and intervals
   */
  private clearTimers(): void {
    // Clear timeouts
    for (const timer of this.timers) {
      try {
        clearTimeout(timer)
        this.stats.timersCleared++
      } catch (err: unknown) {
        this.stats.errors.push(`Failed to clear timer: ${getErrorMessage(err)}`)
      }
    }
    this.timers.clear()

    // Clear intervals
    for (const interval of this.intervals) {
      try {
        clearInterval(interval)
        this.stats.timersCleared++
      } catch (err: unknown) {
        this.stats.errors.push(`Failed to clear interval: ${getErrorMessage(err)}`)
      }
    }
    this.intervals.clear()
  }

  /**
   * Clean up temporary directories
   */
  private async cleanupTempDirs(): Promise<void> {
    const cleanupPromises = Array.from(this.tempDirs).map(async (dir) => {
      try {
        if (existsSync(dir)) {
          await rm(dir, { recursive: true, force: true })
          this.stats.tempDirsRemoved++
        }
      } catch (err: unknown) {
        this.stats.errors.push(`Failed to remove temp dir ${dir}: ${getErrorMessage(err)}`)
      }
    })

    await Promise.allSettled(cleanupPromises)
    this.tempDirs.clear()
  }

  /**
   * Close tracked file handles
   */
  private async closeFileHandles(): Promise<void> {
    for (const handle of this.fileHandles) {
      try {
        if (handle && typeof handle.close === 'function') {
          await handle.close()
        } else if (handle && typeof handle.destroy === 'function') {
          handle.destroy()
        }
      } catch (err: unknown) {
        this.stats.errors.push(`Failed to close file handle: ${getErrorMessage(err)}`)
      }
    }
    this.fileHandles.clear()
  }

  /**
   * Get cleanup statistics
   */
  getStats(): ResourceStats {
    return { ...this.stats }
  }

  /**
   * Get list of currently tracked processes
   */
  getActiveProcesses(): Array<{ pid: number; command: string }> {
    return Array.from(this.processes.entries()).map(([pid, tracked]) => ({
      pid,
      command: tracked.command,
    }))
  }

  /**
   * Reset the guard (useful for testing)
   */
  async reset(): Promise<void> {
    await this.cleanup()
    this.cleanupFns = []
    this.stats = {
      processesTracked: 0,
      processesKilled: 0,
      timersCleared: 0,
      tempDirsRemoved: 0,
      customCleanups: 0,
      errors: [],
    }
  }

  /**
   * Generate a summary report
   */
  generateReport(): string {
    const stats = this.getStats()
    const active = this.getActiveProcesses()

    let report = '🛡️ TestResourceGuard Report\n'
    report += '='.repeat(40) + '\n'
    report += `Processes Tracked: ${stats.processesTracked}\n`
    report += `Processes Killed: ${stats.processesKilled}\n`
    report += `Timers Cleared: ${stats.timersCleared}\n`
    report += `Temp Dirs Removed: ${stats.tempDirsRemoved}\n`
    report += `Custom Cleanups: ${stats.customCleanups}\n`
    report += `Active Processes: ${active.length}\n`

    if (stats.errors.length > 0) {
      report += `\n❌ Errors (${stats.errors.length}):\n`
      stats.errors.forEach((error) => {
        report += `  - ${error}\n`
      })
    }

    if (active.length > 0) {
      report += '\n⚠️ Still Active:\n'
      active.forEach((proc) => {
        report += `  - PID ${proc.pid}: ${proc.command}\n`
      })
    }

    return report
  }
}
