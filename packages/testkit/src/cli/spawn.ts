/**
 * Spawn utilities for testing CLI commands with subprocess spawning
 * Provides higher-level utilities built on top of process-mock for common spawning patterns
 *
 * @remarks
 * These utilities use the quad-register pattern by default, meaning mocks are
 * automatically registered for spawn, exec, execSync, and fork methods.
 * This ensures consistent behavior regardless of which child_process method
 * your code uses internally.
 *
 * @example
 * ```typescript
 * // Mock will work for spawn, exec, execSync, and fork
 * spawnUtils.mockCommandSuccess('npm install', 'installed successfully')
 *
 * // Your code can use any method and the mock will work
 * const result1 = spawn('npm', ['install'])
 * const result2 = exec('npm install')
 * const result3 = execSync('npm install')
 * const result4 = fork('npm', ['install'])
 * ```
 */

import { getRegistry, resetAll, clearCalls } from './registry.js'
import { normalize } from './normalize.js'
import type { ProcessMockConfig } from './process-mock.js'
import {
  sanitizeCommand,
  validateCommand,
  escapeShellArg,
  validateShellExecution,
} from '../security/index.js'

/**
 * Options for spawn testing
 */
export interface SpawnTestOptions {
  /** Working directory for the command */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Input to send to stdin */
  input?: string
  /** Expected exit code (default: 0) */
  expectedExitCode?: number
  /** Timeout for command execution (ms) */
  timeout?: number
}

/**
 * Result of spawn test execution
 */
export interface SpawnTestResult {
  /** Exit code returned by the process */
  exitCode: number
  /** Signal that terminated the process */
  signal: NodeJS.Signals | null
  /** Standard output */
  stdout: string
  /** Standard error */
  stderr: string
  /** Whether the process was killed */
  killed: boolean
  /** Process ID */
  pid: number
}

/**
 * Spawn utilities for testing CLI commands
 *
 * All methods in this object register mocks for multiple child_process methods
 * (spawn, exec, execSync, fork) unless otherwise specified. This is known as
 * the "quad-register pattern" and ensures your mocks work regardless of which
 * method your code uses.
 */
export const spawnUtils = {
  /**
   * Mock a command to succeed with specific output
   *
   * @param command - Command pattern to match
   * @param stdout - Standard output to return
   * @param stderr - Standard error to return
   * @param exitCode - Exit code to return (default: 0)
   *
   * @remarks
   * Registers the mock for spawn, exec, execSync, and fork methods
   */
  mockCommandSuccess: (command: string | RegExp, stdout = '', stderr = '', exitCode = 0): void => {
    const registry = getRegistry()

    // Security validation for string commands
    if (typeof command === 'string') {
      validateCommand(command)
    }

    const key = typeof command === 'string' ? normalize(sanitizeCommand(command)) : command
    const config: ProcessMockConfig = { stdout, stderr, exitCode }

    // Register for all methods by default (quad-register pattern)
    registry.spawnMocks.set(key, config)
    registry.execMocks.set(key, config)
    registry.execSyncMocks.set(key, config)
    registry.forkMocks.set(key, config)
    registry.execFileMocks.set(key, config)
    registry.execFileSyncMocks.set(key, config)
  },

  /**
   * Mock a command to fail with specific error output
   */
  mockCommandFailure: (
    command: string | RegExp,
    stderr = 'Command failed',
    exitCode = 1,
    stdout = '',
  ): void => {
    const registry = getRegistry()

    // Security validation for string commands
    if (typeof command === 'string') {
      validateCommand(command)
    }

    const key = typeof command === 'string' ? normalize(sanitizeCommand(command)) : command
    const config: ProcessMockConfig = { stdout, stderr, exitCode }

    // Register for all methods by default (quad-register pattern)
    registry.spawnMocks.set(key, config)
    registry.execMocks.set(key, config)
    registry.execSyncMocks.set(key, config)
    registry.forkMocks.set(key, config)
    registry.execFileMocks.set(key, config)
    registry.execFileSyncMocks.set(key, config)
  },

  /**
   * Mock a command to throw an error during execution
   */
  mockCommandError: (command: string | RegExp, error: Error): void => {
    const registry = getRegistry()

    // Security validation for string commands
    if (typeof command === 'string') {
      validateCommand(command)
    }

    const key = typeof command === 'string' ? normalize(sanitizeCommand(command)) : command
    const config: ProcessMockConfig = { error }

    // Register for all methods by default (quad-register pattern)
    registry.spawnMocks.set(key, config)
    registry.execMocks.set(key, config)
    registry.execSyncMocks.set(key, config)
    registry.forkMocks.set(key, config)
    registry.execFileMocks.set(key, config)
    registry.execFileSyncMocks.set(key, config)
  },

  /**
   * Mock a long-running command with delay
   */
  mockLongRunningCommand: (
    command: string | RegExp,
    delay: number,
    stdout = '',
    exitCode = 0,
  ): void => {
    const registry = getRegistry()

    // Security validation for string commands
    if (typeof command === 'string') {
      validateCommand(command)
    }

    const key = typeof command === 'string' ? normalize(sanitizeCommand(command)) : command
    const config: ProcessMockConfig = { stdout, exitCode, delay }

    // Register for all methods by default (quad-register pattern)
    registry.spawnMocks.set(key, config)
    registry.execMocks.set(key, config)
    registry.execSyncMocks.set(key, config)
    registry.forkMocks.set(key, config)
    registry.execFileMocks.set(key, config)
    registry.execFileSyncMocks.set(key, config)
  },

  /**
   * Mock an interactive command that responds to input
   */
  mockInteractiveCommand: (
    command: string | RegExp,
    responses: Record<string, string>,
    finalOutput = '',
    exitCode = 0,
  ): void => {
    const registry = getRegistry()

    // Security validation for string commands
    if (typeof command === 'string') {
      validateCommand(command)
    }

    const key = typeof command === 'string' ? normalize(sanitizeCommand(command)) : command

    // For interactive commands, we simulate the full conversation
    // Escape shell arguments in responses for security
    const fullOutput = Object.entries(responses)
      .map(([prompt, response]) => `${prompt}\n${escapeShellArg(response)}\n`)
      .join('')

    const config: ProcessMockConfig = { stdout: fullOutput + finalOutput, exitCode }

    // Register for all methods by default (quad-register pattern)
    registry.spawnMocks.set(key, config)
    registry.execMocks.set(key, config)
    registry.execSyncMocks.set(key, config)
    registry.forkMocks.set(key, config)
    registry.execFileMocks.set(key, config)
    registry.execFileSyncMocks.set(key, config)
  },

  /**
   * Get all spawned processes for testing verification
   */
  getSpawnedProcesses: () => {
    const registry = getRegistry()
    return registry.spawnedProcesses
  },

  /**
   * Clear all spawn mocks
   */
  clearMocks: (): void => {
    clearCalls()
  },

  /**
   * Restore original spawn functionality
   */
  restore: (): void => {
    resetAll()
  },

  /**
   * Validate shell execution with comprehensive security checks
   *
   * @param command - The base command to validate
   * @param args - Array of arguments to escape
   * @returns Object with validated command and escaped arguments
   *
   * @example
   * ```typescript
   * const { command, args } = spawnUtils.validateExecution('echo', ['hello', 'world; rm -rf /'])
   * // Returns: { command: 'echo', args: ['\'hello\'', '\'world; rm -rf /\''] }
   * ```
   */
  validateExecution: (
    command: string,
    args: string[] = [],
  ): { command: string; args: string[] } => {
    return validateShellExecution(command, args)
  },
}

/**
 * Common command mocking patterns
 */
export const commonCommands = {
  /**
   * Mock git commands
   */
  git: {
    /** Mock git status to show clean working directory */
    statusClean: () =>
      spawnUtils.mockCommandSuccess('git status', 'nothing to commit, working tree clean'),

    /** Mock git status to show changes */
    statusDirty: () =>
      spawnUtils.mockCommandSuccess('git status', 'Changes not staged for commit:'),

    /** Mock git branch to return current branch */
    currentBranch: (branch = 'main') =>
      spawnUtils.mockCommandSuccess('git branch --show-current', branch),

    /** Mock git clone success */
    cloneSuccess: (repo: string) =>
      spawnUtils.mockCommandSuccess(`git clone ${repo}`, `Cloning into '${repo}'...`),

    /** Mock git clone failure */
    cloneFailure: (repo: string, error = 'Repository not found') =>
      spawnUtils.mockCommandFailure(`git clone ${repo}`, error, 128),
  },

  /**
   * Mock npm commands
   */
  npm: {
    /** Mock npm install success */
    installSuccess: () => spawnUtils.mockCommandSuccess('npm install', 'added 42 packages'),

    /** Mock npm install failure */
    installFailure: (error = 'ERESOLVE unable to resolve dependency tree') =>
      spawnUtils.mockCommandFailure('npm install', error, 1),

    /** Mock npm test success */
    testSuccess: () => spawnUtils.mockCommandSuccess('npm test', 'All tests passed'),

    /** Mock npm test failure */
    testFailure: (error = '1 test failed') => spawnUtils.mockCommandFailure('npm test', error, 1),

    /** Mock npm version */
    version: (version = '10.0.0') => spawnUtils.mockCommandSuccess('npm --version', version),
  },

  /**
   * Mock pnpm commands
   */
  pnpm: {
    /** Mock pnpm install success */
    installSuccess: () => spawnUtils.mockCommandSuccess('pnpm install', 'Dependencies installed'),

    /** Mock pnpm build success */
    buildSuccess: () => spawnUtils.mockCommandSuccess('pnpm build', 'Build completed successfully'),

    /** Mock pnpm test success */
    testSuccess: () => spawnUtils.mockCommandSuccess('pnpm test', 'Tests passed'),
  },

  /**
   * Mock docker commands
   */
  docker: {
    /** Mock docker version */
    version: (version = '24.0.0') =>
      spawnUtils.mockCommandSuccess('docker --version', `Docker version ${version}`),

    /** Mock docker build success */
    buildSuccess: (tag: string) =>
      spawnUtils.mockCommandSuccess(`docker build -t ${tag}`, `Successfully built ${tag}`),

    /** Mock docker run */
    run: (image: string, output = '') =>
      spawnUtils.mockCommandSuccess(`docker run ${image}`, output),
  },

  /**
   * Mock common shell commands
   */
  shell: {
    /** Mock ls command */
    ls: (files: string[] = []) => spawnUtils.mockCommandSuccess('ls', files.join('\n')),

    /** Mock pwd command */
    pwd: (path = '/current/directory') => spawnUtils.mockCommandSuccess('pwd', path),

    /** Mock echo command */
    echo: (message: string) => spawnUtils.mockCommandSuccess(`echo ${message}`, message),

    /** Mock which command success */
    whichFound: (command: string, path = `/usr/bin/${command}`) =>
      spawnUtils.mockCommandSuccess(`which ${command}`, path),

    /** Mock which command not found */
    whichNotFound: (command: string) =>
      spawnUtils.mockCommandFailure(`which ${command}`, `${command} not found`, 1),
  },
}

/**
 * Builder pattern for complex spawn mocking scenarios
 *
 * @example
 * ```typescript
 * // Simple success mock
 * mockSpawn('npm install')
 *   .stdout('installed')
 *   .exitCode(0)
 *   .mock()
 *
 * // Method-specific mock
 * mockSpawn('git status')
 *   .stdout('clean')
 *   .forMethods(['spawn', 'exec']) // Only for spawn and exec
 *   .mock()
 * ```
 */
export class SpawnMockBuilder {
  private command: string | RegExp
  private config: ProcessMockConfig = {}
  private methods?: Array<'spawn' | 'exec' | 'execSync' | 'fork' | 'execFile' | 'execFileSync'>

  constructor(command: string | RegExp) {
    this.command = command
  }

  /**
   * Set the stdout output
   */
  stdout(output: string): this {
    this.config.stdout = output
    return this
  }

  /**
   * Set the stderr output
   */
  stderr(output: string): this {
    this.config.stderr = output
    return this
  }

  /**
   * Set the exit code
   */
  exitCode(code: number): this {
    this.config.exitCode = code
    return this
  }

  /**
   * Set an error to throw
   */
  error(error: Error): this {
    this.config.error = error
    return this
  }

  /**
   * Set a delay before completion
   */
  delay(ms: number): this {
    this.config.delay = ms
    return this
  }

  /**
   * Set the process PID
   */
  pid(processId: number): this {
    this.config.pid = processId
    return this
  }

  /**
   * Set the signal
   */
  signal(signal: NodeJS.Signals): this {
    this.config.signal = signal
    return this
  }

  /**
   * Specify which methods to register the mock for
   *
   * @param methods - Array of methods to register for
   * @default ['spawn', 'exec', 'execSync', 'fork', 'execFile', 'execFileSync']
   *
   * @example
   * ```typescript
   * mockSpawn('npm install')
   *   .stdout('installed')
   *   .forMethods(['spawn', 'exec']) // Only spawn and exec
   *   .mock()
   * ```
   */
  forMethods(
    methods: Array<'spawn' | 'exec' | 'execSync' | 'fork' | 'execFile' | 'execFileSync'>,
  ): this {
    this.methods = methods
    return this
  }

  /**
   * Convenience method to register only for spawn
   */
  forSpawnOnly(): this {
    return this.forMethods(['spawn'])
  }

  /**
   * Convenience method to register only for exec
   */
  forExecOnly(): this {
    return this.forMethods(['exec'])
  }

  /**
   * Convenience method to register only for sync methods
   */
  forSyncOnly(): this {
    return this.forMethods(['execSync', 'execFileSync'])
  }

  /**
   * Convenience method to register only for execFile
   */
  forExecFileOnly(): this {
    return this.forMethods(['execFile'])
  }

  /**
   * Convenience method to register only for execFileSync
   */
  forExecFileSyncOnly(): this {
    return this.forMethods(['execFileSync'])
  }

  /**
   * Convenience method to register for all methods
   */
  forAll(): this {
    return this.forMethods(['spawn', 'exec', 'execSync', 'fork', 'execFile', 'execFileSync'])
  }

  /**
   * Convenience method to register only for async methods
   */
  forAsyncOnly(): this {
    return this.forMethods(['spawn', 'exec', 'fork', 'execFile'])
  }

  /**
   * Apply the mock configuration
   *
   * @remarks
   * By default registers for all methods (spawn, exec, execSync, fork, execFile, execFileSync)
   * unless limited by forMethods() or convenience methods
   */
  mock(): void {
    const registry = getRegistry()

    // Security validation for string commands
    if (typeof this.command === 'string') {
      validateCommand(this.command)
    }

    const key =
      typeof this.command === 'string' ? normalize(sanitizeCommand(this.command)) : this.command
    const methods = this.methods || [
      'spawn',
      'exec',
      'execSync',
      'fork',
      'execFile',
      'execFileSync',
    ]

    // Register for specified methods
    if (methods.includes('spawn')) {
      registry.spawnMocks.set(key, this.config)
    }
    if (methods.includes('exec')) {
      registry.execMocks.set(key, this.config)
    }
    if (methods.includes('execSync')) {
      registry.execSyncMocks.set(key, this.config)
    }
    if (methods.includes('fork')) {
      registry.forkMocks.set(key, this.config)
    }
    if (methods.includes('execFile')) {
      registry.execFileMocks.set(key, this.config)
    }
    if (methods.includes('execFileSync')) {
      registry.execFileSyncMocks.set(key, this.config)
    }
  }
}

/**
 * Create a new spawn mock builder
 */
export function mockSpawn(command: string | RegExp): SpawnMockBuilder {
  return new SpawnMockBuilder(command)
}

/**
 * Quick utilities for common testing scenarios
 */
export const quickMocks = {
  /**
   * Mock a successful command with output
   */
  success: (command: string | RegExp, output = '') =>
    mockSpawn(command).stdout(output).exitCode(0).mock(),

  /**
   * Mock a failed command with error
   */
  failure: (command: string | RegExp, error = 'Command failed', exitCode = 1) =>
    mockSpawn(command).stderr(error).exitCode(exitCode).mock(),

  /**
   * Mock a command that throws an error
   */
  throws: (command: string | RegExp, error: Error) => mockSpawn(command).error(error).mock(),

  /**
   * Mock a slow command
   */
  slow: (command: string | RegExp, delay: number, output = '') =>
    mockSpawn(command).stdout(output).delay(delay).exitCode(0).mock(),

  /**
   * Mock multiple commands at once
   */
  batch: (commands: Array<{ command: string | RegExp; output?: string; exitCode?: number }>) => {
    commands.forEach(({ command, output = '', exitCode = 0 }) => {
      mockSpawn(command).stdout(output).exitCode(exitCode).mock()
    })
  },
}
