#!/usr/bin/env tsx

/**
 * Emergency Cleanup Script - Kill All Zombie Processes
 *
 * This script forcefully terminates all node/vitest processes
 * when the normal cleanup mechanisms fail.
 *
 * Usage:
 *   pnpm zombies:kill        # Interactive mode
 *   pnpm zombies:kill:force  # Force mode (no confirmation)
 *   pnpm zombies:check       # Dry run mode (just report)
 */

import { execSync } from 'child_process'
import * as os from 'os'
import * as readline from 'readline'

interface ProcessInfo {
  pid: number
  ppid: number
  command: string
  user: string
  cpu: number
  memory: number
}

class EmergencyCleanup {
  private readonly isDryRun: boolean
  private readonly isForce: boolean
  private readonly platform: NodeJS.Platform

  constructor() {
    const args = process.argv.slice(2)
    this.isDryRun = args.includes('--dry-run') || args.includes('--check')
    this.isForce = args.includes('--force') || args.includes('-f')
    this.platform = os.platform()

    if (this.platform === 'win32') {
      console.error('❌ This script is not supported on Windows')
      console.error('   Please use Task Manager to kill processes manually')
      process.exit(1)
    }
  }

  async run(): Promise<void> {
    console.log('🔍 Searching for zombie processes...\n')

    const zombies = this.findZombieProcesses()

    if (zombies.length === 0) {
      console.log('✅ No zombie processes found!')
      return
    }

    console.log(`⚠️  Found ${zombies.length} potential zombie processes:\n`)
    this.displayProcesses(zombies)

    if (this.isDryRun) {
      console.log('\n📊 Dry run mode - no processes were killed')
      console.log('   Run with --force to kill all processes')
      return
    }

    if (!this.isForce) {
      const confirmed = await this.confirmKill(zombies.length)
      if (!confirmed) {
        console.log('\n❌ Cleanup cancelled')
        return
      }
    }

    this.killProcesses(zombies)
  }

  private findZombieProcesses(): ProcessInfo[] {
    const processes: ProcessInfo[] = []

    try {
      // Different commands for different platforms
      const psCommand =
        this.platform === 'darwin'
          ? "ps aux | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v emergency-cleanup"
          : "ps -ef | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v emergency-cleanup"

      const output = execSync(psCommand, { encoding: 'utf8' }).trim()

      if (!output) {
        return processes
      }

      const lines = output.split('\n').filter(Boolean)

      for (const line of lines) {
        const parts = line.split(/\s+/).filter(Boolean)

        if (this.platform === 'darwin') {
          // macOS ps aux format: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
          if (parts.length >= 11 && parts[0] && parts[1] && parts[2] && parts[3]) {
            processes.push({
              user: parts[0],
              pid: parseInt(parts[1]),
              cpu: parseFloat(parts[2]),
              memory: parseFloat(parts[3]),
              ppid: 0, // Not available in ps aux
              command: parts.slice(10).join(' '),
            })
          }
        } else {
          // Linux ps -ef format: UID PID PPID C STIME TTY TIME CMD
          if (parts.length >= 8 && parts[0] && parts[1] && parts[2] && parts[3]) {
            processes.push({
              user: parts[0],
              pid: parseInt(parts[1]),
              ppid: parseInt(parts[2]),
              cpu: parseFloat(parts[3]),
              memory: 0, // Not available in ps -ef
              command: parts.slice(7).join(' '),
            })
          }
        }
      }

      // Filter out invalid PIDs
      return processes.filter((p) => !isNaN(p.pid) && p.pid > 0)
    } catch {
      // No processes found
      return processes
    }
  }

  private displayProcesses(processes: ProcessInfo[]): void {
    console.log(
      'PID'.padEnd(8) + 'USER'.padEnd(12) + 'CPU%'.padEnd(8) + 'MEM%'.padEnd(8) + 'COMMAND',
    )
    console.log('-'.repeat(80))

    for (const proc of processes) {
      const pid = proc.pid.toString().padEnd(8)
      const user = proc.user.substring(0, 10).padEnd(12)
      const cpu = proc.cpu.toFixed(1).padEnd(8)
      const mem = proc.memory.toFixed(1).padEnd(8)
      const cmd = proc.command.substring(0, 40)

      console.log(`${pid}${user}${cpu}${mem}${cmd}`)
    }
  }

  private async confirmKill(count: number): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(
        `\n⚠️  Are you sure you want to kill ${count} processes? (yes/no): `,
        (answer) => {
          rl.close()
          resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
        },
      )
    })
  }

  private killProcesses(processes: ProcessInfo[]): void {
    console.log('\n🔫 Killing zombie processes...\n')

    let killedCount = 0
    let failedCount = 0

    for (const proc of processes) {
      try {
        // First try SIGTERM
        process.kill(proc.pid, 'SIGTERM')

        // Give it a moment
        execSync('sleep 0.5', { stdio: 'ignore' })

        // Check if still alive and force kill if needed
        try {
          process.kill(proc.pid, 0) // Check if process exists
          // Still alive, force kill
          process.kill(proc.pid, 'SIGKILL')
          console.log(`  ✅ Killed process ${proc.pid} (forced)`)
        } catch {
          console.log(`  ✅ Killed process ${proc.pid}`)
        }

        killedCount++
      } catch (err) {
        // Process might have already exited or we don't have permission
        if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
          console.log(`  ℹ️  Process ${proc.pid} already dead`)
        } else if ((err as NodeJS.ErrnoException).code === 'EPERM') {
          console.log(`  ❌ No permission to kill process ${proc.pid}`)
          failedCount++
        } else {
          console.log(`  ❌ Failed to kill process ${proc.pid}:`, err)
          failedCount++
        }
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Successfully killed: ${killedCount}`)
    if (failedCount > 0) {
      console.log(`   ❌ Failed to kill: ${failedCount}`)
      console.log(`\n💡 Tip: Try running with sudo if you have permission issues`)
    }
  }

  /**
   * Generate a detailed report of zombie processes
   */
  generateReport(): void {
    const zombies = this.findZombieProcesses()

    console.log('📊 Zombie Process Report')
    console.log('='.repeat(50))
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`Platform: ${this.platform}`)
    console.log(`Total Zombies: ${zombies.length}`)
    console.log()

    if (zombies.length === 0) {
      console.log('✅ No zombie processes detected')
      return
    }

    // Group by user
    const byUser = new Map<string, ProcessInfo[]>()
    for (const proc of zombies) {
      const userProcs = byUser.get(proc.user) || []
      userProcs.push(proc)
      byUser.set(proc.user, userProcs)
    }

    console.log('By User:')
    for (const [user, procs] of Array.from(byUser)) {
      console.log(`  ${user}: ${procs.length} processes`)
    }
    console.log()

    // Calculate resource usage
    const totalCpu = zombies.reduce((sum, p) => sum + p.cpu, 0)
    const totalMem = zombies.reduce((sum, p) => sum + p.memory, 0)

    console.log('Resource Usage:')
    console.log(`  Total CPU: ${totalCpu.toFixed(1)}%`)
    console.log(`  Total Memory: ${totalMem.toFixed(1)}%`)
    console.log()

    // List all processes
    console.log('Process List:')
    this.displayProcesses(zombies)
  }
}

// Main execution
const cleanup = new EmergencyCleanup()

if (process.argv.includes('--report')) {
  cleanup.generateReport()
} else {
  cleanup.run().catch((err) => {
    console.error('❌ Emergency cleanup failed:', err)
    process.exit(1)
  })
}
