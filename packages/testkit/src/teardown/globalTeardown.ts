import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { processSpawningManager } from '../utils/concurrency.js'

const execAsync = promisify(exec)

type Proc = { pid: number; user: string; command: string }

async function dirExists(p: string): Promise<boolean> {
  try {
    const stats = await fs.stat(p)
    return stats.isDirectory()
  } catch {
    return false
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const stats = await fs.stat(p)
    return stats.isFile()
  } catch {
    return false
  }
}

async function findNearestProjectRoot(startDir: string): Promise<string> {
  let current = startDir
  const { root } = path.parse(startDir)
  while (true) {
    if (await dirExists(path.join(current, '.git'))) return current
    if (await fileExists(path.join(current, 'pnpm-workspace.yaml'))) return current
    if ((await fileExists(path.join(current, 'package.json'))) && !current.includes('node_modules'))
      return current
    if (current === root) break
    current = path.dirname(current)
  }
  return startDir
}

async function resolveLogFile(): Promise<string> {
  // 1) Explicit overrides
  const envLogFile = process.env['LOG_FILE']
  if (envLogFile && envLogFile.trim().length > 0) return envLogFile

  const envRoot =
    process.env['AGENT_LOG_ROOT'] ||
    process.env['TEST_LOG_ROOT'] ||
    process.env['TEST_RESULTS_DIR'] ||
    ''

  let baseDir = envRoot

  // 2) Try git root
  if (!baseDir) {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel')
      baseDir = stdout.trim().replace(/\r?\n/g, '')
    } catch {
      // ignore
    }
  }

  // 3) Nearest project root
  if (!baseDir) {
    baseDir = await findNearestProjectRoot(process.cwd())
  }

  // 4) Fallback to cwd
  if (!baseDir) baseDir = process.cwd()

  const dir = path.join(baseDir, 'logs', 'agentic-tests')
  return path.join(dir, 'agentic-test-zombies.log')
}

async function ensureLogDir(filePath: string): Promise<void> {
  const dir = filePath.replace(/\/[^/]*$/, '')
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // ignore
  }
}

async function appendLog(line: string, logFile: string): Promise<void> {
  try {
    await fs.appendFile(logFile, line + '\n')
  } catch {
    // fallback to stdout
    console.log(line)
  }
}

async function findZombieProcesses(): Promise<Proc[]> {
  const platform = os.platform()
  let psCommand =
    "ps aux | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v globalTeardown"
  if (platform === 'linux') {
    psCommand =
      "ps -ef | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v globalTeardown"
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
    return procs.filter(
      (p) => p.user === currentUser && !isNaN(p.pid) && p.pid > 1 && p.pid !== process.pid,
    )
  } catch {
    return []
  }
}

async function killProcesses(
  procs: Proc[],
  logFile: string,
): Promise<{ killed: number; failed: number }> {
  let killed = 0
  let failed = 0

  // Process kills in parallel with concurrency control for better performance
  const killFunctions = procs.map((p) => async () => {
    try {
      process.kill(p.pid, 'SIGTERM')

      // Use setTimeout instead of execSync('sleep 0.25') for non-blocking delay
      await new Promise((resolve) => setTimeout(resolve, 250))

      try {
        process.kill(p.pid, 0) // Check if process still exists
        process.kill(p.pid, 'SIGKILL')
        await appendLog(`  Killed PID ${p.pid} (forced) - ${p.command}`, logFile)
      } catch {
        await appendLog(`  Killed PID ${p.pid} - ${p.command}`, logFile)
      }
      return { success: true, pid: p.pid }
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e && e.code === 'ESRCH') {
        await appendLog(`  PID ${p.pid} already dead`, logFile)
        return { success: true, pid: p.pid }
      } else {
        await appendLog(`  Failed to kill PID ${p.pid}: ${String(err)}`, logFile)
        return { success: false, pid: p.pid, error: err }
      }
    }
  })
  const killResults = await processSpawningManager.batch(killFunctions, (fn) => fn())

  // Count results
  for (const result of killResults) {
    if (result.success) {
      killed++
    } else {
      failed++
    }
  }

  return { killed, failed }
}

export default async function globalTeardown() {
  try {
    const logFile = await resolveLogFile()
    await ensureLogDir(logFile)
    const timestamp = new Date().toISOString()
    await appendLog(`=== Cleanup run: ${timestamp}`, logFile)
    await appendLog(`Mode: non-interactive; LOG_FILE=${logFile}`, logFile)

    const procs = await findZombieProcesses()
    await appendLog(`Found ${procs.length} matching processes`, logFile)
    for (const p of procs) {
      await appendLog(`  PID=${p.pid} USER=${p.user} CMD=${p.command}`, logFile)
    }

    if (procs.length === 0) {
      await appendLog('Nothing to kill', logFile)
      // Always write a summary line for consistent parsing
      await appendLog('Summary: killed=0 failed=0', logFile)
      await appendLog('', logFile)
      return
    }

    const { killed, failed } = await killProcesses(procs, logFile)
    await appendLog(`Summary: killed=${killed} failed=${failed}`, logFile)
    await appendLog('', logFile)
  } catch (err) {
    try {
      const fallback = await resolveLogFile()
      await ensureLogDir(fallback)
      await appendLog(`[error] globalTeardown failed: ${String(err)}`, fallback)
    } catch {
      // ignore
    }
  }
}
