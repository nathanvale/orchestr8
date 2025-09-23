/**
 * Core process mocking utilities for testing CLI commands
 * Provides comprehensive mocking of child_process methods (spawn, exec, execSync, fork)
 */

import type * as cp from 'child_process'
import { EventEmitter } from 'events'
import { findConfig, normalize } from './normalize.js'
import { clearCalls, getRegistry, resetAll } from './registry.js'

/**
 * Mock stream implementation for stdin/stdout/stderr
 */
export class MockStream extends EventEmitter {
  private buffer: string[] = []
  private closed = false

  write(data: string | Buffer): boolean {
    if (this.closed) {
      return false
    }
    const content = data.toString()
    this.buffer.push(content)
    this.emit('data', content)
    return true
  }

  end(data?: string | Buffer): void {
    if (data) {
      this.write(data)
    }
    this.closed = true
    this.emit('end')
  }

  close(): void {
    this.closed = true
    this.emit('close')
  }

  getBuffer(): string {
    return this.buffer.join('')
  }

  clear(): void {
    this.buffer = []
  }

  isClosed(): boolean {
    return this.closed
  }
}

/**
 * Mock process configuration
 */
export interface ProcessMockConfig {
  /** Exit code to return (default: 0) */
  exitCode?: number
  /** Stdout output */
  stdout?: string
  /** Stderr output */
  stderr?: string
  /** Error to throw */
  error?: Error
  /** Delay before process completion (ms) */
  delay?: number
  /** Process PID */
  pid?: number
  /** Whether process should be killed */
  killed?: boolean
  /** Signal to simulate */
  signal?: NodeJS.Signals | null
}

// Counter for deterministic PID generation
let pidCounter = 1000

/**
 * Mock child process implementation
 */
export class MockChildProcess extends EventEmitter {
  public readonly stdout: MockStream
  public readonly stderr: MockStream
  public readonly stdin: MockStream
  public readonly pid: number
  public exitCode: number | null = null
  public signalCode: NodeJS.Signals | null = null
  public killed = false
  private config: ProcessMockConfig

  constructor(config: ProcessMockConfig = {}) {
    super()
    this.config = config
    this.stdout = new MockStream()
    this.stderr = new MockStream()
    this.stdin = new MockStream()

    // Use deterministic PID generation by default, random only if explicitly requested
    if (typeof config.pid === 'number') {
      this.pid = config.pid
    } else if (process.env.RANDOM_PIDS === 'true') {
      this.pid = Math.floor(Math.random() * 10000) + 1000
    } else {
      // Deterministic incremental PID
      this.pid = ++pidCounter
    }

    // Simulate process execution asynchronously
    // Use setImmediate to ensure events are emitted after listeners are attached
    setImmediate(() => {
      this.simulateExecution()
    })
  }

  private async simulateExecution(): Promise<void> {
    // Add delay if specified
    if (this.config.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay))
    }

    // Check if process was killed during delay
    if (this.killed) {
      return
    }

    // Write stdout output
    if (this.config.stdout) {
      this.stdout.write(this.config.stdout)
    }

    // Write stderr output
    if (this.config.stderr) {
      this.stderr.write(this.config.stderr)
    }

    // Close streams
    this.stdout.end()
    this.stderr.end()
    this.stdin.end()

    // Emit error if configured
    if (this.config.error) {
      // Only emit error if there are listeners to avoid unhandled rejections
      if (this.listenerCount('error') > 0) {
        this.emit('error', this.config.error)
      }
      // Still need to signal that the process ended with error
      this.exitCode = 1
      this.emit('exit', this.exitCode, null)
      this.emit('close', this.exitCode, null)
      return
    }

    // Set exit code and/or signal. When terminated by signal, exitCode should be null
    if (this.config.signal) {
      this.exitCode = null
      this.signalCode = this.config.signal
    } else if (this.config.exitCode !== undefined) {
      this.exitCode = this.config.exitCode
      this.signalCode = null
    } else {
      // default success when no explicit instruction
      this.exitCode = 0
      this.signalCode = null
    }

    // Emit exit event
    this.emit('exit', this.exitCode, this.signalCode)
    this.emit('close', this.exitCode, this.signalCode)
  }

  kill(signal?: NodeJS.Signals): boolean {
    if (this.killed) {
      return false
    }

    this.killed = true
    this.signalCode = signal ?? 'SIGTERM'
    this.exitCode = null

    // Close streams
    this.stdout.close()
    this.stderr.close()
    this.stdin.close()

    // Emit exit events
    this.emit('exit', null, this.signalCode)
    this.emit('close', null, this.signalCode)

    return true
  }

  ref(): this {
    return this
  }

  unref(): this {
    return this
  }
}

/**
 * Process mocker interface - now uses the singleton registry
 */
export interface ProcessMocker {
  /**
   * Register a mock for a specific command across multiple methods
   * By default registers for spawn, exec, execSync, and fork (quad-register pattern)
   *
   * @param command - Command pattern to match (string or RegExp)
   * @param config - Mock configuration
   * @param options - Optional registration options
   *
   * @example
   * // Register for all methods (default)
   * mocker.register('npm install', { stdout: 'installed' })
   *
   * // Register only for specific methods
   * mocker.register('git', { stdout: 'output' }, { methods: ['spawn', 'exec'] })
   */
  register(
    command: string | RegExp,
    config: ProcessMockConfig,
    options?: { methods?: Array<'spawn' | 'exec' | 'execSync' | 'fork'> },
  ): void
  /** Register a mock for spawn calls */
  registerSpawn(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for exec calls */
  registerExec(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for execSync calls */
  registerExecSync(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for fork calls */
  registerFork(modulePath: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for execFile calls */
  registerExecFile(file: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for execFileSync calls */
  registerExecFileSync(file: string | RegExp, config: ProcessMockConfig): void
  /** Clear all registered mocks */
  clear(): void
  /** Restore original child_process methods (no longer needed but kept for compatibility) */
  restore(): void
  /** Get all spawned processes */
  getSpawnedProcesses(): MockChildProcess[]
  /** Get all exec calls */
  getExecCalls(): Array<{ command: string; options?: cp.ExecOptions }>
  /** Get all execSync calls */
  getExecSyncCalls(): Array<{ command: string; options?: cp.ExecSyncOptions }>
  /** Get all fork calls */
  getForkCalls(): Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }>
  /** Get all execFile calls */
  getExecFileCalls(): Array<{ file: string; args?: string[]; options?: cp.ExecFileOptions }>
  /** Get all execFileSync calls */
  getExecFileSyncCalls(): Array<{ file: string; args?: string[]; options?: cp.ExecFileSyncOptions }>
  /** Find mock configuration for a command */
  findMockConfig(
    mocks: Map<string | RegExp, ProcessMockConfig>,
    input: string,
  ): ProcessMockConfig | undefined
}

/**
 * Process mocker implementation using singleton registry
 *
 * This implementation uses the unified singleton registry to eliminate
 * parallel registry issues and ensure consistent registration/lookup.
 */
export class ProcessMockerImpl implements ProcessMocker {
  constructor() {
    // Use singleton registry directly - no runtime patching needed
  }

  register(
    command: string | RegExp,
    config: ProcessMockConfig,
    options?: {
      methods?: Array<'spawn' | 'exec' | 'execSync' | 'fork' | 'execFile' | 'execFileSync'>
    },
  ): void {
    const methods: Array<'spawn' | 'exec' | 'execSync' | 'fork' | 'execFile' | 'execFileSync'> =
      options?.methods || ['spawn', 'exec', 'execSync', 'fork', 'execFile', 'execFileSync']

    if (methods.includes('spawn')) {
      this.registerSpawn(command, config)
    }
    if (methods.includes('exec')) {
      this.registerExec(command, config)
    }
    if (methods.includes('execSync')) {
      this.registerExecSync(command, config)
    }
    if (methods.includes('fork')) {
      this.registerFork(command, config)
    }
    if (methods.includes('execFile')) {
      this.registerExecFile(command as string | RegExp, config)
    }
    if (methods.includes('execFileSync')) {
      this.registerExecFileSync(command as string | RegExp, config)
    }
  }

  registerSpawn(command: string | RegExp, config: ProcessMockConfig): void {
    const registry = getRegistry()
    registry.spawnMocks.set(command, config)

    // Also register normalized version for strings
    if (typeof command === 'string') {
      const norm = normalize(command)
      if (norm !== command) {
        registry.spawnMocks.set(norm, config)
      }
    }

    if (process.env.DEBUG_TESTKIT) {
      console.log('[registerSpawn]', {
        key: command,
        size: registry.spawnMocks.size,
        keys: Array.from(registry.spawnMocks.keys()),
      })
    }
  }

  registerExec(command: string | RegExp, config: ProcessMockConfig): void {
    const registry = getRegistry()
    registry.execMocks.set(command, config)

    // Also register normalized version for strings
    if (typeof command === 'string') {
      const norm = normalize(command)
      if (norm !== command) {
        registry.execMocks.set(norm, config)
      }
    }

    if (process.env.DEBUG_TESTKIT) {
      console.log('[registerExec]', {
        key: command,
        size: registry.execMocks.size,
        keys: Array.from(registry.execMocks.keys()),
      })
    }
  }

  registerExecSync(command: string | RegExp, config: ProcessMockConfig): void {
    const registry = getRegistry()
    registry.execSyncMocks.set(command, config)

    // Also register normalized version for strings
    if (typeof command === 'string') {
      const norm = normalize(command)
      if (norm !== command) {
        registry.execSyncMocks.set(norm, config)
      }
    }

    if (process.env.DEBUG_TESTKIT) {
      console.log('[registerExecSync]', {
        key: command,
        size: registry.execSyncMocks.size,
        keys: Array.from(registry.execSyncMocks.keys()),
      })
    }
  }

  registerFork(modulePath: string | RegExp, config: ProcessMockConfig): void {
    const registry = getRegistry()
    registry.forkMocks.set(modulePath, config)

    // Also register normalized version for strings
    if (typeof modulePath === 'string') {
      const norm = normalize(modulePath)
      if (norm !== modulePath) {
        registry.forkMocks.set(norm, config)
      }
    }

    if (process.env.DEBUG_TESTKIT) {
      console.log('[registerFork]', {
        key: modulePath,
        size: registry.forkMocks.size,
        keys: Array.from(registry.forkMocks.keys()),
      })
    }
  }

  registerExecFile(file: string | RegExp, config: ProcessMockConfig): void {
    const registry = getRegistry()
    registry.execFileMocks.set(file, config)

    // Also register normalized version for strings
    if (typeof file === 'string') {
      const norm = normalize(file)
      if (norm !== file) {
        registry.execFileMocks.set(norm, config)
      }
    }

    if (process.env.DEBUG_TESTKIT) {
      console.log('[registerExecFile]', {
        key: file,
        size: registry.execFileMocks.size,
        keys: Array.from(registry.execFileMocks.keys()),
      })
    }
  }

  registerExecFileSync(file: string | RegExp, config: ProcessMockConfig): void {
    const registry = getRegistry()
    registry.execFileSyncMocks.set(file, config)

    // Also register normalized version for strings
    if (typeof file === 'string') {
      const norm = normalize(file)
      if (norm !== file) {
        registry.execFileSyncMocks.set(norm, config)
      }
    }

    if (process.env.DEBUG_TESTKIT) {
      console.log('[registerExecFileSync]', {
        key: file,
        size: registry.execFileSyncMocks.size,
        keys: Array.from(registry.execFileSyncMocks.keys()),
      })
    }
  }

  clear(): void {
    resetAll()
  }

  restore(): void {
    // No-op in factory pattern - mocks are created at declaration time
    // Kept for backward compatibility
    this.clear()
  }

  getSpawnedProcesses(): MockChildProcess[] {
    const registry = getRegistry()
    return [...registry.spawnedProcesses]
  }

  getExecCalls(): Array<{ command: string; options?: cp.ExecOptions }> {
    const registry = getRegistry()
    return [...registry.execCalls]
  }

  getExecSyncCalls(): Array<{ command: string; options?: cp.ExecSyncOptions }> {
    const registry = getRegistry()
    return [...registry.execSyncCalls]
  }

  getForkCalls(): Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }> {
    const registry = getRegistry()
    return [...registry.forkCalls]
  }

  getExecFileCalls(): Array<{ file: string; args?: string[]; options?: cp.ExecFileOptions }> {
    const registry = getRegistry()
    return [...registry.execFileCalls]
  }

  getExecFileSyncCalls(): Array<{
    file: string
    args?: string[]
    options?: cp.ExecFileSyncOptions
  }> {
    const registry = getRegistry()
    return [...registry.execFileSyncCalls]
  }

  public findMockConfig(
    mocks: Map<string | RegExp, ProcessMockConfig>,
    input: string,
  ): ProcessMockConfig | undefined {
    return findConfig(mocks, input)
  }
}

/**
 * Global process mocker instance
 */
declare global {
  // Expose a singleton for the process mocker across module graphs
  var __GLOBAL_PROCESS_MOCKER__: ProcessMockerImpl | undefined
}

/**
 * Create a new process mocker
 */
export function createProcessMocker(): ProcessMocker {
  return new ProcessMockerImpl()
}

/**
 * Get or create the global process mocker
 */
export function getGlobalProcessMocker(): ProcessMocker {
  if (!globalThis.__GLOBAL_PROCESS_MOCKER__) {
    globalThis.__GLOBAL_PROCESS_MOCKER__ = new ProcessMockerImpl()
  }
  return globalThis.__GLOBAL_PROCESS_MOCKER__
}

/**
 * Setup process mocking with automatic cleanup
 * Use this in test setup files for automatic lifecycle management
 */
export function setupProcessMocking(): ProcessMocker {
  const mocker = getGlobalProcessMocker()

  // Clear mocks after each test
  if (typeof afterEach !== 'undefined') {
    afterEach(() => {
      clearCalls() // Only clear calls, keep registered mocks
    })
  }

  // Restore mocks after all tests
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      mocker.restore()
    })
  }

  return mocker
}

/**
 * Direct setup for child_process mocks (deprecated - use factory pattern instead)
 * @deprecated Use the factory pattern with vi.mock declarations
 */
export function setupChildProcessMocks(_childProcess: typeof cp): void {
  console.warn(
    'setupChildProcessMocks is deprecated. Use the factory pattern with vi.mock declarations instead.',
  )
  // No-op - factory handles everything
}

/**
 * Quick setup for common command mocking patterns
 */
export const processHelpers = {
  /**
   * Mock a command to return success with output
   */
  mockSuccess: (command: string | RegExp, stdout: string, exitCode = 0) => {
    const mocker = getGlobalProcessMocker()
    mocker.register(command, { stdout, exitCode })
    return mocker
  },

  /**
   * Mock a command to return failure with error output
   */
  mockFailure: (command: string | RegExp, stderr: string, exitCode = 1) => {
    const mocker = getGlobalProcessMocker()
    mocker.register(command, { stderr, exitCode })
    return mocker
  },

  /**
   * Mock a command to throw an error
   */
  mockError: (command: string | RegExp, error: Error) => {
    const mocker = getGlobalProcessMocker()
    mocker.register(command, { error })
    return mocker
  },

  /**
   * Mock a long-running command with delay
   */
  mockDelayed: (command: string | RegExp, delay: number, stdout = '', exitCode = 0) => {
    const mocker = getGlobalProcessMocker()
    mocker.register(command, { stdout, exitCode, delay })
    return mocker
  },

  /**
   * Get the global mocker for advanced configuration
   */
  getMocker: () => getGlobalProcessMocker(),

  /**
   * Clear all call history but keep registered mocks
   */
  clearCalls: () => clearCalls(),

  /**
   * Clear everything: all registered mocks AND call history
   * @remarks
   * This is more destructive than clearCalls() as it removes all mock registrations.
   * Use clearCalls() if you only want to reset call tracking between tests.
   */
  clear: () => getGlobalProcessMocker().clear(),

  /**
   * Alias for clear() - removes all mocks and calls
   * @deprecated Use clear() or clearCalls() for clarity
   */
  clearAllMocksAndCalls: () => getGlobalProcessMocker().clear(),

  /**
   * Restore original functions
   */
  restore: () => getGlobalProcessMocker().restore(),
}
