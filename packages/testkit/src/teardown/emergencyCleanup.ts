#!/usr/bin/env tsx
import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'

const execAsync = promisify(exec)

async function main() {
  const platform = os.platform()
  if (platform === 'win32') {
    console.error('✖ Emergency cleanup is not supported on Windows')
    process.exit(1)
  }

  console.log('🔍 Finding all node/vitest processes...')
  const ps = platform === 'linux' ? 'ps -ef' : 'ps aux'
  const cmd = `${ps} | grep -E 'node.*vitest|vitest' | grep -v grep`

  try {
    const { stdout } = await execAsync(cmd)
    const out = stdout.trim()
    const lines = out ? out.split('\n').filter(Boolean) : []
    const pids = new Set<number>()

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = Number(platform === 'linux' ? parts[1] : parts[1])
      if (!Number.isNaN(pid) && pid > 1 && pid !== process.pid) {
        pids.add(pid)
      }
    }

    if (pids.size === 0) {
      console.log('✅ No zombie processes found!')
      return
    }

    console.log(`⚠️  Found ${pids.size} zombie processes`)
    console.log('Killing all matching processes...')

    // Kill processes in parallel for better performance
    const killResults = await Promise.allSettled(
      Array.from(pids).map(async (pid) => {
        try {
          process.kill(pid, 'SIGKILL')
          console.log(`  Killed PID ${pid}`)
          return { success: true, pid }
        } catch (err) {
          console.error(`  Failed to kill PID ${pid}: ${String(err)}`)
          return { success: false, pid, error: err }
        }
      }),
    )

    const successful = killResults.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const failed = killResults.length - successful

    console.log(`✅ Cleanup complete! Killed: ${successful}, Failed: ${failed}`)
  } catch (err) {
    console.error('Failed to find processes:', err)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Emergency cleanup failed:', err)
  process.exit(1)
})
