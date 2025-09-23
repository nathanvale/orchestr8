/**
 * Mock factory for child_process module
 * Creates vitest mock functions for all child_process methods
 */

// IMPORTANT: type-only import to avoid circular runtime import while mocking
import type * as cp from 'node:child_process'
import { promisify } from 'node:util'
import { URL } from 'url'
import { vi } from 'vitest'

import { findConfig, normalizeParts } from './normalize.js'
import { MockChildProcess, type ProcessMockConfig } from './process-mock.js'
import { getRegistry, trackCall, trackProcess } from './registry.js'

/**
 * Create a complete mock of the child_process module
 * Uses singleton registry for all operations to ensure consistency
 */
export function createChildProcessMock(): typeof cp {
  // Don't capture registry in closure - call getRegistry() each time

  function warnMissing(kind: string, key: string) {
    if (process.env.DEBUG_TESTKIT) {
      console.warn(`No mock registered for ${kind}: ${key}`)
      const hint = kind.startsWith('spawn')
        ? 'mocker.registerSpawn(command, config)'
        : kind.startsWith('execFileSync')
          ? 'mocker.registerExecFileSync(file, config)'
          : kind.startsWith('execFile')
            ? 'mocker.registerExecFile(file, config)'
            : kind.startsWith('execSync')
              ? 'mocker.registerExecSync(command, config)'
              : kind.startsWith('fork')
                ? 'mocker.registerFork(modulePath, config)'
                : 'mocker.registerExec(command, config)'
      console.warn(`Register with: ${hint}`)
    }
  }

  // Fallback lookup: try primary, then others to honor hexa-register semantics
  function findWithFallback(
    primary: Map<string | RegExp, ProcessMockConfig>,
    input: string,
    kind?: string,
  ): ProcessMockConfig | undefined {
    const reg = getRegistry()

    // First try primary map
    const primaryConfig = findConfig(primary, input)
    if (primaryConfig) {
      return primaryConfig
    }

    // Check for strict mode
    const strictMode = process.env.STRICT_PROCESS_MOCKS === '1'

    // Try fallback maps
    const fallbackConfig =
      findConfig(reg.execFileMocks, input) ||
      findConfig(reg.execSyncMocks, input) ||
      findConfig(reg.spawnMocks, input) ||
      findConfig(reg.forkMocks, input) ||
      findConfig(reg.execFileSyncMocks, input)

    if (fallbackConfig && strictMode && kind) {
      // In strict mode, warn when using fallback
      if (process.env.DEBUG_TESTKIT) {
        console.warn(
          `[STRICT MODE] Mock for ${kind} "${input}" found via fallback, not in primary registry. ` +
            `Consider registering specifically for ${kind}.`,
        )
      }
      // Optionally throw in ultra-strict mode
      if (process.env.STRICT_PROCESS_MOCKS === 'throw') {
        throw new Error(
          `Strict mode: Mock for ${kind} "${input}" not found in primary registry. ` +
            `Found in fallback but STRICT_PROCESS_MOCKS=throw prevents fallback usage.`,
        )
      }
    }

    return fallbackConfig
  }

  // Create spawn mock
  const spawn = vi.fn((command: string, args?: readonly string[], _options?: cp.SpawnOptions) => {
    const fullCommand = normalizeParts(command, args ? [...args] : undefined)
    const registry = getRegistry()

    // Debug logging
    if (process.env.DEBUG_TESTKIT) {
      console.log('[spawn mock] Called with:', { command, args, fullCommand })
      console.log('[spawn mock] Registry size:', registry.spawnMocks.size)
      console.log('[spawn mock] Registry keys:', Array.from(registry.spawnMocks.keys()))
    }

    const config = findWithFallback(registry.spawnMocks, fullCommand, 'spawn')

    if (!config) {
      warnMissing('spawn command', fullCommand)
    }

    const mockProcess = new MockChildProcess(config ?? {})
    // Track spawned processes for verification in tests
    trackProcess(mockProcess)
    return mockProcess as unknown as cp.ChildProcess
  })

  // Create exec mock
  const exec = vi.fn((...args: Parameters<typeof cp.exec>) => {
    const [command, optionsOrCallback, callback] = args
    const actualOptions = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
    const actualCallback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    trackCall('exec', { command, options: actualOptions || undefined })

    const config = findWithFallback(getRegistry().execMocks, command, 'exec')

    if (!config) {
      warnMissing('exec command', command)
    }

    // Simulate async execution
    setTimeout(() => {
      if (actualCallback) {
        // If explicit error configured, surface it
        if (config?.error) {
          const execError = config.error as cp.ExecException
          execError.code = config.exitCode ?? 1
          actualCallback(execError, '', config.stderr ?? '')
          return
        }

        // Match Node semantics: non-zero exit should produce an ExecException
        if (config?.exitCode !== undefined && config.exitCode !== 0) {
          const err = new Error(`Command failed: ${command}`) as cp.ExecException & {
            status?: number
            output?: Array<null | string>
            pid?: number
          }
          err.code = config.exitCode
          err.killed = false
          err.signal = config.signal ?? undefined
          err.cmd = command
          // Extended props
          err.status = config.exitCode
          err.output = [null, config.stdout ?? '', config.stderr ?? '']
          err.pid = 0
          // Assign non-standard props via index access for compatibility
          ;(err as unknown as Record<string, unknown>)['stdout'] = config.stdout ?? ''
          ;(err as unknown as Record<string, unknown>)['stderr'] = config.stderr ?? ''
          actualCallback(err, '', config.stderr ?? '')
          return
        }

        actualCallback(null, config?.stdout ?? '', config?.stderr ?? '')
      }
    }, config?.delay ?? 0)

    // Return a mock child process (do not track in spawnedProcesses)
    const mockProcess = new MockChildProcess(config ?? {})
    return mockProcess as unknown as cp.ChildProcess
  })

  // Add __promisify__ to match Node.js exec signature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(exec as any).__promisify__ = vi.fn((command: string, options?: cp.ExecOptions) => {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      exec(command, options, (error, stdout, _stderr) => {
        if (error) {
          reject(error)
        } else {
          resolve({ stdout: stdout.toString(), stderr: _stderr?.toString?.() ?? '' })
        }
      })
    })
  })

  // Also provide util.promisify.custom so util.promisify(exec) returns { stdout, stderr }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(exec as any)[(promisify as unknown as { custom: symbol }).custom] = vi.fn(
    (command: string, options?: cp.ExecOptions) => {
      return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        exec(command, options, (error, stdout, _stderr) => {
          if (error) {
            reject(error)
          } else {
            resolve({ stdout: stdout.toString(), stderr: _stderr?.toString?.() ?? '' })
          }
        })
      })
    },
  )

  // Create execSync mock
  const execSync = vi.fn((command: string, options?: cp.ExecSyncOptions) => {
    trackCall('execSync', { command, options })

    const config = findWithFallback(getRegistry().execSyncMocks, command, 'execSync')

    if (!config) {
      warnMissing('execSync command', command)
    }

    if (config?.error) {
      throw config.error
    }

    if (config?.exitCode && config.exitCode !== 0) {
      const error = new Error(`Command failed: ${command}`) as cp.ExecException & {
        status?: number
        output?: Array<null | string>
        pid?: number
      }
      error.code = config.exitCode
      error.killed = false
      error.signal = config.signal ?? undefined
      error.cmd = command
      // Extended properties that some versions of Node provide
      error.status = config.exitCode
      error.output = [null, config.stdout ?? '', config.stderr ?? '']
      error.pid = 0
      error.stdout = config.stdout ?? ''
      error.stderr = config.stderr ?? ''
      throw error
    }

    // If delay is specified, use a sync delay (capped for safety)
    if (config?.delay) {
      // Cap delay at 250ms to prevent blocking event loop too long
      const MAX_SYNC_DELAY = 250
      const actualDelay = Math.min(config.delay, MAX_SYNC_DELAY)

      // Only apply delay if explicitly allowed
      if (process.env.ALLOW_SYNC_DELAY === 'true') {
        const start = Date.now()
        while (Date.now() - start < actualDelay) {
          // Busy wait - intentionally blocking for test simulation
        }
      } else if (process.env.DEBUG_TESTKIT) {
        console.warn(`Sync delay of ${config.delay}ms requested but ALLOW_SYNC_DELAY not set`)
      }
    }

    const output = config?.stdout ?? ''
    const encoding = options?.encoding

    if (encoding && encoding !== 'buffer') {
      return output
    }

    return Buffer.from(output)
  })

  // Create fork mock
  const fork = vi.fn(
    (modulePath: string | URL, args?: readonly string[], options?: cp.ForkOptions) => {
      const modulePathStr = modulePath.toString()
      trackCall('fork', {
        modulePath: modulePathStr,
        args: args ? [...args] : undefined,
        options,
      })

      // For fork, try both module path alone and full command format
      const fullCommand = normalizeParts(modulePathStr, args ? [...args] : undefined)
      const config =
        findWithFallback(getRegistry().forkMocks, modulePathStr, 'fork') ||
        findWithFallback(getRegistry().forkMocks, fullCommand, 'fork')

      if (!config) {
        warnMissing('fork module', modulePathStr)
      }

      const mockProcess = new MockChildProcess(config ?? {})
      // Note: We intentionally do NOT track fork-created processes in spawnedProcesses
      return mockProcess as unknown as cp.ChildProcess
    },
  )

  // Create execFile mock
  const execFile = vi.fn(
    (
      file: string,
      argsOrOptions?:
        | readonly string[]
        | cp.ExecFileOptions
        | ((
            error: cp.ExecFileException | null,
            stdout: string | Buffer,
            stderr: string | Buffer,
          ) => void),
      optionsOrCallback?:
        | cp.ExecFileOptions
        | ((
            error: cp.ExecFileException | null,
            stdout: string | Buffer,
            stderr: string | Buffer,
          ) => void),
      callback?: (
        error: cp.ExecFileException | null,
        stdout: string | Buffer,
        stderr: string | Buffer,
      ) => void,
    ) => {
      let actualArgs: string[] | undefined
      let actualOptions: cp.ExecFileOptions | undefined
      let actualCallback:
        | ((
            error: cp.ExecFileException | null,
            stdout: string | Buffer,
            stderr: string | Buffer,
          ) => void)
        | undefined

      // Handle overloaded signatures robustly regardless of undefined placeholders
      if (Array.isArray(argsOrOptions)) {
        actualArgs = argsOrOptions as string[]
      } else if (typeof argsOrOptions === 'function') {
        actualCallback = argsOrOptions as typeof actualCallback
      } else if (argsOrOptions) {
        actualOptions = argsOrOptions as cp.ExecFileOptions
      }

      if (typeof optionsOrCallback === 'function') {
        actualCallback = optionsOrCallback as typeof actualCallback
      } else if (optionsOrCallback) {
        actualOptions = optionsOrCallback as cp.ExecFileOptions
      }

      if (callback) {
        actualCallback = callback as typeof actualCallback
      }

      const fullCommand = normalizeParts(file, actualArgs)
      trackCall('execFile', {
        file,
        args: actualArgs,
        options: actualOptions,
      })

      const config = findWithFallback(getRegistry().execFileMocks, fullCommand, 'execFile')

      if (!config) {
        warnMissing('execFile', fullCommand)
      }

      // Simulate async execution
      setTimeout(() => {
        if (actualCallback) {
          // Configured hard error takes precedence
          if (config?.error) {
            const execError = config.error as cp.ExecFileException
            execError.code = config.exitCode ?? 1
            actualCallback(execError, Buffer.from(''), Buffer.from(config.stderr ?? ''))
            return
          }

          // Non-zero exit codes should surface an error similar to Node
          if (config?.exitCode !== undefined && config.exitCode !== 0) {
            type ExecFileError = cp.ExecFileException & {
              status?: number
              output?: Array<null | string>
              pid?: number
              stdout?: string | Buffer
              stderr?: string | Buffer
            }
            const error = new Error(`Command failed: ${fullCommand}`) as ExecFileError
            error.code = config.exitCode
            error.killed = false
            error.signal = config.signal ?? undefined
            error.cmd = fullCommand
            error.status = config.exitCode
            error.output = [null, config.stdout ?? '', config.stderr ?? '']
            error.pid = 0
            error.stdout = config.stdout ?? ''
            error.stderr = config.stderr ?? ''
            actualCallback(error, Buffer.from(''), Buffer.from(config.stderr ?? ''))
            return
          }

          actualCallback(null, Buffer.from(config?.stdout ?? ''), Buffer.from(config?.stderr ?? ''))
        }
      }, config?.delay ?? 0)

      // Return a mock child process
      const mockProcess = new MockChildProcess(config ?? {})
      // Note: We intentionally do NOT track execFile-created processes in spawnedProcesses
      return mockProcess as unknown as cp.ChildProcess
    },
  )

  // Add __promisify__ to match Node.js execFile signature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(execFile as any).__promisify__ = vi.fn(
    (file: string, args?: readonly string[], options?: cp.ExecFileOptions) => {
      return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(file, args, options, (error, stdout, _stderr) => {
          if (error) {
            reject(error)
          } else {
            resolve({ stdout: stdout.toString(), stderr: _stderr?.toString?.() ?? '' })
          }
        })
      })
    },
  )

  // And util.promisify.custom for execFile as well
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(execFile as any)[(promisify as unknown as { custom: symbol }).custom] = vi.fn(
    (file: string, args?: readonly string[], options?: cp.ExecFileOptions) => {
      return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFile(file, args, options, (error, stdout, _stderr) => {
          if (error) {
            reject(error)
          } else {
            resolve({ stdout: stdout.toString(), stderr: _stderr?.toString?.() ?? '' })
          }
        })
      })
    },
  )

  // Create execFileSync mock
  const execFileSync = vi.fn(
    (file: string, args?: readonly string[], options?: cp.ExecFileSyncOptions) => {
      const fullCommand = normalizeParts(file, args ? [...args] : undefined)
      trackCall('execFileSync', {
        file,
        args: args ? [...args] : undefined,
        options,
      })

      const config = findWithFallback(getRegistry().execFileSyncMocks, fullCommand, 'execFileSync')

      if (!config) {
        warnMissing('execFileSync', fullCommand)
      }

      // Throw error if delay is specified - execFileSync doesn't support delays
      if (config?.delay) {
        throw new Error(
          `execFileSync does not support delays. Remove delay from mock config for: ${fullCommand}`,
        )
      }

      if (config?.error) {
        throw config.error
      }

      if (config?.exitCode && config.exitCode !== 0) {
        type ExecFileError = cp.ExecFileException & {
          status?: number
          output?: Array<null | string>
          pid?: number
          stdout?: string | Buffer
          stderr?: string | Buffer
        }
        const error = new Error(`Command failed: ${fullCommand}`) as ExecFileError
        error.code = config.exitCode
        error.killed = false
        error.signal = config.signal ?? undefined
        error.cmd = fullCommand
        // Extended properties
        error.status = config.exitCode
        error.output = [null, config.stdout ?? '', config.stderr ?? '']
        error.pid = 0
        error.stdout = config.stdout ?? ''
        error.stderr = config.stderr ?? ''
        throw error
      }

      // Respect encoding similar to execSync
      const output = config?.stdout ?? ''
      const encoding = options?.encoding as BufferEncoding | 'buffer' | undefined
      if (encoding && encoding !== 'buffer') {
        return output
      }
      return Buffer.from(output)
    },
  )

  // Create the mocked module object with exposed API for external registration
  const moduleMockCore = {
    spawn,
    exec,
    execSync,
    fork,
    execFile,
    execFileSync,
    // Expose registry and API for external access
    __processMockRegistry: getRegistry(),
    __processMockApi: {
      register(
        type: 'spawn' | 'exec' | 'execSync' | 'fork' | 'execFile' | 'execFileSync',
        key: string | RegExp,
        cfg: ProcessMockConfig,
      ) {
        const registry = getRegistry()
        const map =
          type === 'spawn'
            ? registry.spawnMocks
            : type === 'exec'
              ? registry.execMocks
              : type === 'execSync'
                ? registry.execSyncMocks
                : type === 'fork'
                  ? registry.forkMocks
                  : type === 'execFile'
                    ? registry.execFileMocks
                    : registry.execFileSyncMocks
        map.set(key, cfg)
      },
      clear() {
        const registry = getRegistry()
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
      },
      getRegistry() {
        return getRegistry()
      },
    },
    // Add other child_process exports as needed
    spawnSync: vi.fn(),
    ChildProcess: class {} as unknown,
    StdioNull: 'inherit' as unknown,
    StdioPipe: 'pipe' as unknown,
  } as unknown as typeof cp

  // Ensure ESM/CJS interop: provide a default export for consumers that import default
  // Vitest may expect a `default` when mocking built-ins in some paths (e.g., during teardown).
  const moduleMock = Object.assign({}, moduleMockCore, {
    default: moduleMockCore,
  }) as unknown as typeof cp

  return moduleMock
}
