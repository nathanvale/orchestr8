/**
 * Core process mocking utilities for testing CLI commands
 * Provides comprehensive mocking of child_process methods (spawn, exec, execSync, fork)
 */

import { vi } from 'vitest'
import * as cp from 'child_process'
import { EventEmitter } from 'events'

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

    // Simulate process execution
    this.simulateExecution()
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
      this.emit('error', this.config.error)
      return
    }

    // Set exit code and signal
    this.exitCode = this.config.exitCode ?? 0
    this.signalCode = this.config.signal ?? null

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
 * Process mocker interface
 */
export interface ProcessMocker {
  /** Register a mock for a specific command */
  register(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for spawn calls */
  registerSpawn(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for exec calls */
  registerExec(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for execSync calls */
  registerExecSync(command: string | RegExp, config: ProcessMockConfig): void
  /** Register a mock for fork calls */
  registerFork(modulePath: string | RegExp, config: ProcessMockConfig): void
  /** Clear all registered mocks */
  clear(): void
  /** Restore original child_process methods */
  restore(): void
  /** Get all spawned processes */
  getSpawnedProcesses(): MockChildProcess[]
  /** Get all exec calls */
  getExecCalls(): Array<{ command: string; options?: cp.ExecOptions }>
  /** Get all execSync calls */
  getExecSyncCalls(): Array<{ command: string; options?: cp.ExecSyncOptions }>
  /** Get all fork calls */
  getForkCalls(): Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }>
}

/**
 * Process mocker implementation
 */
export class ProcessMockerImpl implements ProcessMocker {
  private spawnMocks = new Map<string | RegExp, ProcessMockConfig>()
  private execMocks = new Map<string | RegExp, ProcessMockConfig>()
  private execSyncMocks = new Map<string | RegExp, ProcessMockConfig>()
  private forkMocks = new Map<string | RegExp, ProcessMockConfig>()

  private spawnedProcesses: MockChildProcess[] = []
  private execCalls: Array<{ command: string; options?: cp.ExecOptions }> = []
  private execSyncCalls: Array<{ command: string; options?: cp.ExecSyncOptions }> = []
  private forkCalls: Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }> = []

  constructor() {
    this.setupMocks()
  }

  register(command: string | RegExp, config: ProcessMockConfig): void {
    this.registerSpawn(command, config)
    this.registerExec(command, config)
    this.registerExecSync(command, config)
  }

  registerSpawn(command: string | RegExp, config: ProcessMockConfig): void {
    this.spawnMocks.set(command, config)
  }

  registerExec(command: string | RegExp, config: ProcessMockConfig): void {
    this.execMocks.set(command, config)
  }

  registerExecSync(command: string | RegExp, config: ProcessMockConfig): void {
    this.execSyncMocks.set(command, config)
  }

  registerFork(modulePath: string | RegExp, config: ProcessMockConfig): void {
    this.forkMocks.set(modulePath, config)
  }

  clear(): void {
    this.spawnMocks.clear()
    this.execMocks.clear()
    this.execSyncMocks.clear()
    this.forkMocks.clear()
    this.spawnedProcesses = []
    this.execCalls = []
    this.execSyncCalls = []
    this.forkCalls = []
  }

  restore(): void {
    vi.restoreAllMocks()
  }

  getSpawnedProcesses(): MockChildProcess[] {
    return [...this.spawnedProcesses]
  }

  getExecCalls(): Array<{ command: string; options?: cp.ExecOptions }> {
    return [...this.execCalls]
  }

  getExecSyncCalls(): Array<{ command: string; options?: cp.ExecSyncOptions }> {
    return [...this.execSyncCalls]
  }

  getForkCalls(): Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }> {
    return [...this.forkCalls]
  }

  private setupMocks(): void {
    // Mock cp.spawn
    vi.spyOn(cp, 'spawn').mockImplementation(
      (command: string, args?: readonly string[], _options?: cp.SpawnOptions) => {
        const fullCommand = args ? `${command} ${args.join(' ')}` : command
        const config = this.findMockConfig(this.spawnMocks, fullCommand) ?? {}

        const mockProcess = new MockChildProcess(config)
        this.spawnedProcesses.push(mockProcess)

        return mockProcess as unknown as cp.ChildProcess
      },
    )

    // Mock cp.exec
    vi.spyOn(cp, 'exec').mockImplementation((...args: Parameters<typeof cp.exec>) => {
      const [command, optionsOrCallback, callback] = args
      // Handle overloaded function signature
      const actualOptions = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
      const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

      this.execCalls.push({ command, options: actualOptions || undefined })

      const config = this.findMockConfig(this.execMocks, command) ?? {}

      // Simulate async execution
      setTimeout(() => {
        if (actualCallback) {
          if (config.error) {
            const execError = config.error as cp.ExecException
            execError.code = config.exitCode ?? 1
            actualCallback(execError, '', config.stderr ?? '')
          } else {
            actualCallback(null, config.stdout ?? '', config.stderr ?? '')
          }
        }
      }, config.delay ?? 0)

      // Return a mock ChildProcess
      const mockProcess = new MockChildProcess(config)
      return mockProcess as unknown as cp.ChildProcess
    })

    // Mock cp.execSync
    vi.spyOn(cp, 'execSync').mockImplementation((command: string, options?: cp.ExecSyncOptions) => {
      this.execSyncCalls.push({ command, options })

      const config = this.findMockConfig(this.execSyncMocks, command) ?? {}

      if (config.error) {
        throw config.error
      }

      const output = config.stdout ?? ''
      return Buffer.from(output)
    })

    // Mock cp.fork
    vi.spyOn(cp, 'fork').mockImplementation(
      (modulePath: string | URL, args?: readonly string[], options?: cp.ForkOptions) => {
        const modulePathStr = modulePath.toString()
        this.forkCalls.push({
          modulePath: modulePathStr,
          args: args ? [...args] : undefined,
          options,
        })

        const config = this.findMockConfig(this.forkMocks, modulePathStr) ?? {}
        const mockProcess = new MockChildProcess(config)

        return mockProcess as unknown as cp.ChildProcess
      },
    )
  }

  private findMockConfig(
    mocks: Map<string | RegExp, ProcessMockConfig>,
    input: string,
  ): ProcessMockConfig | undefined {
    for (const [pattern, config] of mocks) {
      if (typeof pattern === 'string') {
        if (input === pattern || input.includes(pattern)) {
          return config
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(input)) {
          return config
        }
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
 * Create a new process mocker or get the global instance
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
