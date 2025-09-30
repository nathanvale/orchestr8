#!/usr/bin/env tsx
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as os from 'os'
import { pathToFileURL } from 'url'

const execAsync = promisify(exec)

type Proc = { pid: number; user: string; command: string }

const LOG_FILE = process.env['LOG_FILE'] || 'logs/agentic-tests/zombies.log'

function ensureLogDir(path: string) {
  const dir = path.replace(/\/[^/]*$/, '')
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // ignore
  }
}

function appendLog(line: string) {
  try {
    fs.appendFileSync(LOG_FILE, line + '\n')
  } catch {
    // fallback to stdout
    console.log(line)
  }
}

async function findZombieProcesses(): Promise<Proc[]> {
  const platform = os.platform()
  let psCommand =
    "ps aux | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v cleanup-teardown | grep -v emergency-cleanup"
  if (platform === 'linux') {
    psCommand =
      "ps -ef | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v cleanup-teardown | grep -v emergency-cleanup"
  }

  try {
    const { stdout } = await execAsync(psCommand)
    const output = stdout.trim()
    if (!output) return []
    const lines = output.split('\n').filter(Boolean)
    const procs: Proc[] = []

    for (const line of lines) {
      const parts = line.split(/\s+/).filter(Boolean)
      if (platform === 'darwin') {
        if (parts.length >= 11 && parts[1]) {
          const pid = Number(parts[1])
          const user = parts[0] ?? ''
          const cmd = parts.slice(10).join(' ')
          procs.push({ pid, user, command: cmd })
        }
      } else {
        if (parts.length >= 8 && parts[1]) {
          const pid = Number(parts[1])
          const user = parts[0] ?? ''
          const cmd = parts.slice(7).join(' ')
          procs.push({ pid, user, command: cmd })
        }
      }
    }

    const currentUser = process.env['USER'] || process.env['LOGNAME'] || ''
    // filter to current user only to reduce collateral damage
    return procs.filter(
      (p) => p.user === currentUser && !isNaN(p.pid) && p.pid > 1 && p.pid !== process.pid,
    )
  } catch {
    return []
  }
}

async function killProcesses(procs: Proc[]) {
  let killed = 0
  let failed = 0

  for (const p of procs) {
    try {
      process.kill(p.pid, 'SIGTERM')
      // small pause using setTimeout instead of execSync('sleep')
      await new Promise((resolve) => setTimeout(resolve, 250))
      // if still exists, force
      try {
        process.kill(p.pid, 0)
        process.kill(p.pid, 'SIGKILL')
        appendLog(`  Killed PID ${p.pid} (forced) - ${p.command}`)
      } catch {
        appendLog(`  Killed PID ${p.pid} - ${p.command}`)
      }
      killed++
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e && e.code === 'ESRCH') {
        appendLog(`  PID ${p.pid} already dead`)
      } else {
        appendLog(`  Failed to kill PID ${p.pid}: ${String(err)}`)
        failed++
      }
    }
  }

  return { killed, failed }
}

async function main() {
  ensureLogDir(LOG_FILE)
  const timestamp = new Date().toISOString()
  appendLog(`=== Cleanup run: ${timestamp}`)
  appendLog(`Mode: non-interactive; LOG_FILE=${LOG_FILE}`)

  const procs = await findZombieProcesses()
  appendLog(`Found ${procs.length} matching processes`)
  for (const p of procs) {
    appendLog(`  PID=${p.pid} USER=${p.user} CMD=${p.command}`)
  }

  if (procs.length === 0) {
    appendLog('Nothing to kill')
    appendLog('')
    return
  }

  const { killed, failed } = await killProcesses(procs)
  appendLog(`Summary: killed=${killed} failed=${failed}`)
  appendLog('')
}

// Export a default function for Vitest globalTeardown
export default async function teardown() {
  try {
    await main()
  } catch (err) {
    // Swallow errors to avoid masking test results; log instead
    try {
      appendLog(`[error] Cleanup teardown failed: ${String(err)}`)
    } catch {
      // ignore
    }
  }
}

// If invoked directly via `tsx scripts/cleanup-teardown.ts`, run immediately
try {
  const isCli =
    import.meta && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  if (isCli) {
    console.log('Running cleanup-teardown in CLI mode')
    await teardown()
  }
} catch {
  // ignore
}
