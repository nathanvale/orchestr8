import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

type Proc = { pid: number; user: string; command: string }

function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function findNearestProjectRoot(startDir: string): string {
  let current = startDir
  const { root } = path.parse(startDir)
  while (true) {
    if (dirExists(path.join(current, '.git'))) return current
    if (fileExists(path.join(current, 'pnpm-workspace.yaml'))) return current
    if (fileExists(path.join(current, 'package.json')) && !current.includes('node_modules'))
      return current
    if (current === root) break
    current = path.dirname(current)
  }
  return startDir
}

function resolveLogFile(): string {
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
      baseDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' })
        .trim()
        .replace(/\r?\n/g, '')
    } catch {
      // ignore
    }
  }

  // 3) Nearest project root
  if (!baseDir) {
    baseDir = findNearestProjectRoot(process.cwd())
  }

  // 4) Fallback to cwd
  if (!baseDir) baseDir = process.cwd()

  const dir = path.join(baseDir, 'logs', 'agentic-tests')
  return path.join(dir, 'agentic-test-zombies.log')
}

function ensureLogDir(filePath: string) {
  const dir = filePath.replace(/\/[^/]*$/, '')
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // ignore
  }
}

function appendLog(line: string, logFile: string) {
  try {
    fs.appendFileSync(logFile, line + '\n')
  } catch {
    // fallback to stdout
    console.log(line)
  }
}

function findZombieProcesses(): Proc[] {
  const platform = os.platform()
  let psCommand =
    "ps aux | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v globalTeardown"
  if (platform === 'linux') {
    psCommand =
      "ps -ef | grep -E 'node.*vitest|vitest|node.*test' | grep -v grep | grep -v globalTeardown"
  }

  try {
    const output = execSync(psCommand, { encoding: 'utf8' }).trim()
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

function killProcesses(procs: Proc[], logFile: string) {
  let killed = 0
  let failed = 0

  for (const p of procs) {
    try {
      process.kill(p.pid, 'SIGTERM')
      try {
        execSync('sleep 0.25')
      } catch {
        // ignore
      }
      try {
        process.kill(p.pid, 0)
        process.kill(p.pid, 'SIGKILL')
        appendLog(`  Killed PID ${p.pid} (forced) - ${p.command}`, logFile)
      } catch {
        appendLog(`  Killed PID ${p.pid} - ${p.command}`, logFile)
      }
      killed++
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e && e.code === 'ESRCH') {
        appendLog(`  PID ${p.pid} already dead`, logFile)
      } else {
        appendLog(`  Failed to kill PID ${p.pid}: ${String(err)}`, logFile)
        failed++
      }
    }
  }

  return { killed, failed }
}

export default async function globalTeardown() {
  try {
    const logFile = resolveLogFile()
    ensureLogDir(logFile)
    const timestamp = new Date().toISOString()
    appendLog(`=== Cleanup run: ${timestamp}`, logFile)
    appendLog(`Mode: non-interactive; LOG_FILE=${logFile}`, logFile)

    const procs = findZombieProcesses()
    appendLog(`Found ${procs.length} matching processes`, logFile)
    for (const p of procs) {
      appendLog(`  PID=${p.pid} USER=${p.user} CMD=${p.command}`, logFile)
    }

    if (procs.length === 0) {
      appendLog('Nothing to kill', logFile)
      // Always write a summary line for consistent parsing
      appendLog('Summary: killed=0 failed=0', logFile)
      appendLog('', logFile)
      return
    }

    const { killed, failed } = killProcesses(procs, logFile)
    appendLog(`Summary: killed=${killed} failed=${failed}`, logFile)
    appendLog('', logFile)
  } catch (err) {
    try {
      const fallback = resolveLogFile()
      ensureLogDir(fallback)
      appendLog(`[error] globalTeardown failed: ${String(err)}`, fallback)
    } catch {
      // ignore
    }
  }
}
