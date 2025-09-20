/**
 * Factory for creating mocked child_process module
 * This ensures mocks are created at declaration time, not runtime
 */

import { vi } from 'vitest'
import type * as cp from 'child_process'
import { MockChildProcess, type ProcessMockConfig } from './process-mock.js'

/**
 * Global registry for mock configurations
 */
export interface ProcessMockRegistry {
  spawnMocks: Map<string | RegExp, ProcessMockConfig>
  execMocks: Map<string | RegExp, ProcessMockConfig>
  execSyncMocks: Map<string | RegExp, ProcessMockConfig>
  forkMocks: Map<string | RegExp, ProcessMockConfig>
  execFileMocks: Map<string | RegExp, ProcessMockConfig>
  execFileSyncMocks: Map<string | RegExp, ProcessMockConfig>
  spawnedProcesses: MockChildProcess[]
  execCalls: Array<{ command: string; options?: cp.ExecOptions }>
  execSyncCalls: Array<{ command: string; options?: cp.ExecSyncOptions }>
  forkCalls: Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }>
  execFileCalls: Array<{ file: string; args?: string[]; options?: cp.ExecFileOptions }>
  execFileSyncCalls: Array<{ file: string; args?: string[]; options?: cp.ExecFileSyncOptions }>
}

/**
 * Global registry instance
 */
const registry: ProcessMockRegistry = {
  spawnMocks: new Map(),
  execMocks: new Map(),
  execSyncMocks: new Map(),
  forkMocks: new Map(),
  execFileMocks: new Map(),
  execFileSyncMocks: new Map(),
  spawnedProcesses: [],
  execCalls: [],
  execSyncCalls: [],
  forkCalls: [],
  execFileCalls: [],
  execFileSyncCalls: [],
}

/**
 * Find matching mock configuration
 */
function findMockConfig(
  mocks: Map<string | RegExp, ProcessMockConfig>,
  input: string,
): ProcessMockConfig | undefined {
  // First pass: exact matches
  for (const [pattern, config] of mocks) {
    if (typeof pattern === 'string' && input === pattern) {
      return config
    }
  }

  // Second pass: regex matches
  for (const [pattern, config] of mocks) {
    if (pattern instanceof RegExp && pattern.test(input)) {
      return config
    }
  }

  // Third pass: includes matches (least specific)
  for (const [pattern, config] of mocks) {
    if (typeof pattern === 'string' && input.includes(pattern)) {
      return config
    }
  }

  return undefined
}

/**
 * Get the global process mock registry
 */
export function getProcessMockRegistry(): ProcessMockRegistry {
  return registry
}

/**
 * Clear all registered mocks
 */
export function clearMockRegistry(): void {
  registry.spawnMocks.clear()
  registry.execMocks.clear()
  registry.execSyncMocks.clear()
  registry.forkMocks.clear()
  registry.execFileMocks.clear()
  registry.execFileSyncMocks.clear()
  registry.spawnedProcesses = []
  registry.execCalls = []
  registry.execSyncCalls = []
  registry.forkCalls = []
  registry.execFileCalls = []
  registry.execFileSyncCalls = []
}

/**
 * Create a mocked child_process module
 * This factory is called at mock time by vi.mock
 */
export function createChildProcessMock(): typeof cp {
  // Create spawn mock
  const spawn = vi.fn((command: string, args?: readonly string[], _options?: cp.SpawnOptions) => {
    const fullCommand = args ? `${command} ${args.join(' ')}` : command
    const config = findMockConfig(registry.spawnMocks, fullCommand)

    if (!config) {
      console.warn(`No mock registered for spawn command: ${fullCommand}`)
      console.warn('Register with: mocker.registerSpawn(command, config)')
    }

    const mockProcess = new MockChildProcess(config ?? {})
    registry.spawnedProcesses.push(mockProcess)
    return mockProcess as unknown as cp.ChildProcess
  })

  // Create exec mock
  const exec = vi.fn((...args: Parameters<typeof cp.exec>) => {
    const [command, optionsOrCallback, callback] = args
    const actualOptions = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
    const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    registry.execCalls.push({ command, options: actualOptions || undefined })

    const config = findMockConfig(registry.execMocks, command)

    if (!config) {
      console.warn(`No mock registered for exec command: ${command}`)
      console.warn('Register with: mocker.registerExec(command, config)')
    }

    // Simulate async execution
    setTimeout(() => {
      if (actualCallback) {
        if (config?.error) {
          const execError = config.error as cp.ExecException
          execError.code = config.exitCode ?? 1
          actualCallback(execError, '', config.stderr ?? '')
        } else {
          actualCallback(null, config?.stdout ?? '', config?.stderr ?? '')
        }
      }
    }, config?.delay ?? 0)

    const mockProcess = new MockChildProcess(config ?? {})
    return mockProcess as unknown as cp.ChildProcess
  }) as unknown as typeof cp.exec

  // Create execSync mock
  const execSync = vi.fn((command: string, options?: cp.ExecSyncOptions) => {
    registry.execSyncCalls.push({ command, options })

    const config = findMockConfig(registry.execSyncMocks, command)

    if (!config) {
      console.warn(`No mock registered for execSync command: ${command}`)
      console.warn('Register with: mocker.registerExecSync(command, config)')
    }

    if (config?.error) {
      throw config.error
    }

    const output = config?.stdout ?? ''
    return Buffer.from(output)
  })

  // Create fork mock
  const fork = vi.fn(
    (modulePath: string | URL, args?: readonly string[], options?: cp.ForkOptions) => {
      const modulePathStr = modulePath.toString()
      registry.forkCalls.push({
        modulePath: modulePathStr,
        args: args ? [...args] : undefined,
        options,
      })

      const config = findMockConfig(registry.forkMocks, modulePathStr)

      if (!config) {
        console.warn(`No mock registered for fork module: ${modulePathStr}`)
        console.warn('Register with: mocker.registerFork(modulePath, config)')
      }

      const mockProcess = new MockChildProcess(config ?? {})
      return mockProcess as unknown as cp.ChildProcess
    },
  )

  // Create execFile mock
  const execFile = vi.fn((...args: unknown[]) => {
    const [file, argsOrOptions, optionsOrCallback, callback] = args as [
      string,
      unknown?,
      unknown?,
      unknown?,
    ]

    let actualArgs: string[] | undefined
    let actualOptions: cp.ExecFileOptions | undefined
    let actualCallback:
      | ((
          error: cp.ExecFileException | null,
          stdout: string | Buffer,
          stderr: string | Buffer,
        ) => void)
      | undefined

    // Handle overloaded signatures
    if (Array.isArray(argsOrOptions)) {
      actualArgs = argsOrOptions as string[]
      if (typeof optionsOrCallback === 'function') {
        actualCallback = optionsOrCallback as typeof actualCallback
      } else {
        actualOptions = optionsOrCallback as cp.ExecFileOptions | undefined
        actualCallback = callback as typeof actualCallback
      }
    } else if (typeof argsOrOptions === 'function') {
      actualCallback = argsOrOptions as typeof actualCallback
    } else {
      actualOptions = argsOrOptions as cp.ExecFileOptions | undefined
      actualCallback = optionsOrCallback as typeof actualCallback
    }

    const fullCommand = actualArgs ? `${file} ${actualArgs.join(' ')}` : file
    registry.execFileCalls.push({
      file,
      args: actualArgs,
      options: actualOptions,
    })

    const config = findMockConfig(registry.execFileMocks, fullCommand)

    if (!config) {
      console.warn(`No mock registered for execFile: ${fullCommand}`)
      console.warn('Register with: mocker.registerExecFile(file, config)')
    }

    // Simulate async execution
    setTimeout(() => {
      if (actualCallback) {
        if (config?.error) {
          const execError = config.error as cp.ExecFileException
          execError.code = config.exitCode ?? 1
          actualCallback(execError, '', config.stderr ?? '')
        } else {
          actualCallback(null, config?.stdout ?? '', config?.stderr ?? '')
        }
      }
    }, config?.delay ?? 0)

    const mockProcess = new MockChildProcess(config ?? {})
    return mockProcess as unknown as cp.ChildProcess
  }) as unknown as typeof cp.execFile

  // Create execFileSync mock
  const execFileSync = vi.fn(
    (file: string, args?: readonly string[], options?: cp.ExecFileSyncOptions) => {
      const fullCommand = args ? `${file} ${args.join(' ')}` : file
      registry.execFileSyncCalls.push({
        file,
        args: args ? [...args] : undefined,
        options,
      })

      const config = findMockConfig(registry.execFileSyncMocks, fullCommand)

      if (!config) {
        console.warn(`No mock registered for execFileSync: ${fullCommand}`)
        console.warn('Register with: mocker.registerExecFileSync(file, config)')
      }

      if (config?.error) {
        throw config.error
      }

      const output = config?.stdout ?? ''
      return Buffer.from(output)
    },
  )

  // Return the mocked module
  return {
    spawn,
    exec,
    execSync,
    fork,
    execFile,
    execFileSync,
    // Add other child_process exports as needed
    spawnSync: vi.fn(),
    ChildProcess: class {} as unknown,
    StdioNull: 'inherit' as unknown,
    StdioPipe: 'pipe' as unknown,
  } as unknown as typeof cp
}
