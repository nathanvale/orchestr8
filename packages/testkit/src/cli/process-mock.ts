/**
 * Core process mocking utilities for testing CLI commands
 * Provides comprehensive mocking of child_process methods (spawn, exec, execSync, fork)
 */

import { EventEmitter } from 'events'
import type * as cp from 'child_process'
import { getProcessMockRegistry, clearMockRegistry } from './mock-factory.js'

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
    this.pid = config.pid ?? Math.floor(Math.random() * 10000) + 1000

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

    // Set exit code and signal
    // When terminated by signal, exitCode should be null
    if (this.config.signal) {
      this.exitCode = null
      this.signalCode = this.config.signal
    } else if (this.config.exitCode !== undefined) {
      this.exitCode = this.config.exitCode
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
 * Process mocker interface - now uses the factory pattern
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
 * Process mocker implementation using factory pattern
 *
 * This implementation uses a centralized factory pattern where mocks are
 * registered at module initialization time via vi.mock declarations.
 * The registry is shared globally and persists across test runs.
 *
 * @remarks
 * Unlike traditional runtime mocking, this approach ensures mocks are
 * available immediately when tests start, avoiding timing issues with
 * module hoisting and import order.
 */
export class ProcessMockerImpl implements ProcessMocker {
  constructor() {
    // No runtime patching needed - factory handles everything
  }

  register(
    command: string | RegExp,
    config: ProcessMockConfig,
    options?: { methods?: Array<'spawn' | 'exec' | 'execSync' | 'fork'> },
  ): void {
    const methods = options?.methods || ['spawn', 'exec', 'execSync', 'fork']

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
  }

  registerSpawn(command: string | RegExp, config: ProcessMockConfig): void {
    const registry = getProcessMockRegistry()
    registry.spawnMocks.set(command, config)
  }

  registerExec(command: string | RegExp, config: ProcessMockConfig): void {
    const registry = getProcessMockRegistry()
    registry.execMocks.set(command, config)
  }

  registerExecSync(command: string | RegExp, config: ProcessMockConfig): void {
    const registry = getProcessMockRegistry()
    registry.execSyncMocks.set(command, config)
  }

  registerFork(modulePath: string | RegExp, config: ProcessMockConfig): void {
    const registry = getProcessMockRegistry()
    registry.forkMocks.set(modulePath, config)
  }

  registerExecFile(file: string | RegExp, config: ProcessMockConfig): void {
    const registry = getProcessMockRegistry()
    registry.execFileMocks.set(file, config)
  }

  registerExecFileSync(file: string | RegExp, config: ProcessMockConfig): void {
    const registry = getProcessMockRegistry()
    registry.execFileSyncMocks.set(file, config)
  }

  clear(): void {
    clearMockRegistry()
  }

  restore(): void {
    // No-op in factory pattern - mocks are created at declaration time
    // Kept for backward compatibility
    this.clear()
  }

  getSpawnedProcesses(): MockChildProcess[] {
    const registry = getProcessMockRegistry()
    return [...registry.spawnedProcesses]
  }

  getExecCalls(): Array<{ command: string; options?: cp.ExecOptions }> {
    const registry = getProcessMockRegistry()
    return [...registry.execCalls]
  }

  getExecSyncCalls(): Array<{ command: string; options?: cp.ExecSyncOptions }> {
    const registry = getProcessMockRegistry()
    return [...registry.execSyncCalls]
  }

  getForkCalls(): Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }> {
    const registry = getProcessMockRegistry()
    return [...registry.forkCalls]
  }

  getExecFileCalls(): Array<{ file: string; args?: string[]; options?: cp.ExecFileOptions }> {
    const registry = getProcessMockRegistry()
    return [...registry.execFileCalls]
  }

  getExecFileSyncCalls(): Array<{
    file: string
    args?: string[]
    options?: cp.ExecFileSyncOptions
  }> {
    const registry = getProcessMockRegistry()
    return [...registry.execFileSyncCalls]
  }

  public findMockConfig(
    mocks: Map<string | RegExp, ProcessMockConfig>,
    input: string,
  ): ProcessMockConfig | undefined {
    // First pass: look for exact matches
    for (const [pattern, config] of mocks) {
      if (typeof pattern === 'string' && input === pattern) {
        return config
      }
    }

    // Second pass: look for regex matches
    for (const [pattern, config] of mocks) {
      if (pattern instanceof RegExp && pattern.test(input)) {
        return config
      }
    }

    // Third pass: look for includes matches (least specific)
    for (const [pattern, config] of mocks) {
      if (typeof pattern === 'string' && input.includes(pattern)) {
        return config
      }
    }

    return undefined
  }
}

/**
 * Global process mocker instance
 */
let globalMocker: ProcessMockerImpl | null = null

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
  if (!globalMocker) {
    globalMocker = new ProcessMockerImpl()
  }
  return globalMocker
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
      mocker.clear()
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
   * Clear all mocks
   */
  clear: () => getGlobalProcessMocker().clear(),

  /**
   * Restore original functions
   */
  restore: () => getGlobalProcessMocker().restore(),
}
