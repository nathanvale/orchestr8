/**
 * Spawn utilities for testing CLI commands with subprocess spawning
 * Provides higher-level utilities built on top of process-mock for common spawning patterns
 */

import { getGlobalProcessMocker, type ProcessMockConfig } from './process-mock.js'

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
 */
export const spawnUtils = {
  /**
   * Mock a command to succeed with specific output
   */
  mockCommandSuccess: (command: string | RegExp, stdout = '', stderr = '', exitCode = 0): void => {
    const mocker = getGlobalProcessMocker()
    mocker.registerSpawn(command, {
      stdout,
      stderr,
      exitCode,
    })
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
    const mocker = getGlobalProcessMocker()
    mocker.registerSpawn(command, {
      stdout,
      stderr,
      exitCode,
    })
  },

  /**
   * Mock a command to throw an error during execution
   */
  mockCommandError: (command: string | RegExp, error: Error): void => {
    const mocker = getGlobalProcessMocker()
    mocker.registerSpawn(command, {
      error,
    })
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
    const mocker = getGlobalProcessMocker()
    mocker.registerSpawn(command, {
      stdout,
      exitCode,
      delay,
    })
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
    const mocker = getGlobalProcessMocker()
    // For interactive commands, we simulate the full conversation
    const fullOutput = Object.entries(responses)
      .map(([prompt, response]) => `${prompt}\n${response}\n`)
      .join('')

    mocker.registerSpawn(command, {
      stdout: fullOutput + finalOutput,
      exitCode,
    })
  },

  /**
   * Get all spawned processes for testing verification
   */
  getSpawnedProcesses: () => {
    const mocker = getGlobalProcessMocker()
    return mocker.getSpawnedProcesses()
  },

  /**
   * Clear all spawn mocks
   */
  clearMocks: (): void => {
    const mocker = getGlobalProcessMocker()
    mocker.clear()
  },

  /**
   * Restore original spawn functionality
   */
  restore: (): void => {
    const mocker = getGlobalProcessMocker()
    mocker.restore()
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
 */
export class SpawnMockBuilder {
  private command: string | RegExp
  private config: ProcessMockConfig = {}

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
   * Apply the mock configuration
   */
  mock(): void {
    const mocker = getGlobalProcessMocker()
    mocker.registerSpawn(this.command, this.config)
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
