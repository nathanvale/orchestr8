/**
 * Safe Process Execution Utilities
 *
 * Provides safe wrappers around process execution with built-in timeouts,
 * resource tracking, and error handling for integration tests.
 */

import { execSync, spawn } from 'child_process'
import type { ExecSyncOptions, SpawnOptions } from 'child_process'
import { TestResourceGuard } from './test-resource-guard.js'

interface SafeExecOptions extends ExecSyncOptions {
  /** Command timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Kill signal to use on timeout (default: 'SIGTERM') */
  killSignal?: NodeJS.Signals
  /** Maximum buffer size in bytes (default: 10MB) */
  maxBuffer?: number
  /** Whether to throw on non-zero exit code (default: true) */
  throwOnError?: boolean
}

interface SafeSpawnOptions extends SpawnOptions {
  /** Command timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Resource guard to track the process (optional) */
  guard?: TestResourceGuard
}

/**
 * Safe wrapper around execSync with built-in timeouts and resource limits
 */
export function execSyncSafe(command: string, options: SafeExecOptions = {}): Buffer | string {
  const {
    timeout = 30000,
    killSignal = 'SIGTERM',
    maxBuffer = 10 * 1024 * 1024, // 10MB
    throwOnError = true,
    ...execOptions
  } = options

  const safeOptions: ExecSyncOptions = {
    timeout,
    killSignal,
    maxBuffer,
    ...execOptions,
  }

  try {
    return execSync(command, safeOptions)
  } catch (error) {
    if (!throwOnError) {
      // Return empty buffer if not throwing on error
      return Buffer.alloc(0)
    }
    throw error
  }
}

/**
 * Safe wrapper around spawn with automatic process tracking
 */
export function spawnSafe(command: string, args: string[] = [], options: SafeSpawnOptions = {}) {
  const { timeout = 30000, guard, ...spawnOptions } = options

  const child = spawn(command, args, spawnOptions)

  // Track process with guard if provided
  if (guard && child.pid) {
    guard.trackProcess(child, `${command} ${args.join(' ')}`, timeout)
  }

  return child
}

/**
 * Execute command with automatic timeout and cleanup
 */
export async function execWithTimeout(
  command: string,
  args: string[] = [],
  timeoutMs = 30000,
  guard?: TestResourceGuard,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawnSafe(command, args, {
      timeout: timeoutMs,
      guard,
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
      })
    })

    child.on('error', (error) => {
      reject(new Error(`Process execution failed: ${error.message}`))
    })

    // Set timeout manually if not handled by spawn
    const timeoutHandle = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL')
        }
      }, 5000) // Force kill after 5 seconds
      reject(new Error(`Process timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on('exit', () => {
      clearTimeout(timeoutHandle)
    })
  })
}

/**
 * Safe command execution for tests with common defaults
 */
export function execSyncTest(command: string, options: Partial<SafeExecOptions> = {}): string {
  const result = execSyncSafe(command, {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
    throwOnError: true,
    ...options,
  })

  return typeof result === 'string' ? result : result.toString('utf8')
}

/**
 * Execute command and return only success/failure
 */
export function execSyncQuiet(command: string, options: Partial<SafeExecOptions> = {}): boolean {
  try {
    execSyncSafe(command, {
      stdio: 'ignore',
      timeout: 30000,
      throwOnError: true,
      ...options,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Check if a command is available
 */
export function isCommandAvailable(command: string): boolean {
  try {
    execSyncSafe(`which ${command}`, {
      stdio: 'ignore',
      timeout: 5000,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Safe process execution with retries
 */
export async function execWithRetry(
  command: string,
  args: string[] = [],
  options: {
    retries?: number
    retryDelay?: number
    timeout?: number
    guard?: TestResourceGuard
  } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { retries = 3, retryDelay = 1000, timeout = 30000, guard } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await execWithTimeout(command, args, timeout, guard)
    } catch (error) {
      lastError = error as Error
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}

/**
 * Process execution factory for tests
 */
export class TestProcessManager {
  constructor(private guard?: TestResourceGuard) {}

  execSync(command: string, options?: Partial<SafeExecOptions>): string {
    return execSyncTest(command, options)
  }

  execQuiet(command: string, options?: Partial<SafeExecOptions>): boolean {
    return execSyncQuiet(command, options)
  }

  async exec(
    command: string,
    args: string[] = [],
    timeout = 30000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return execWithTimeout(command, args, timeout, this.guard)
  }

  spawn(command: string, args: string[] = [], options?: SafeSpawnOptions) {
    return spawnSafe(command, args, { guard: this.guard, ...options })
  }

  isAvailable(command: string): boolean {
    return isCommandAvailable(command)
  }
}
