#!/usr/bin/env tsx
import { execSync } from 'child_process'
import * as os from 'os'

function main() {
  const platform = os.platform()
  if (platform === 'win32') {
    console.error('✖ Emergency cleanup is not supported on Windows')
    process.exit(1)
  }

  console.log('🔍 Finding all node/vitest processes...')
  const ps = platform === 'linux' ? 'ps -ef' : 'ps aux'
  const cmd = `${ps} | grep -E 'node.*vitest|vitest' | grep -v grep`
  const out = execSync(cmd, { encoding: 'utf8' }).trim()
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
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
      console.log(`  Killed PID ${pid}`)
    } catch (err) {
      console.error(`  Failed to kill PID ${pid}: ${String(err)}`)
    }
  }
  console.log('✅ Cleanup complete!')
}

main()
