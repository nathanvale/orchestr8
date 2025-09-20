/**
 * Tests for process mocking utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MockStream,
  MockChildProcess,
  createProcessMocker,
  getGlobalProcessMocker,
  setupProcessMocking,
  processHelpers,
  type ProcessMockConfig,
} from '../process-mock.js'

// Mock the child_process module at the module level for ESM compatibility
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
  execSync: vi.fn(),
  fork: vi.fn(),
}))

// Import child_process after mocking
import * as cp from 'child_process'

describe('MockStream', () => {
  let stream: MockStream

  beforeEach(() => {
    stream = new MockStream()
  })

  it('should write and buffer data correctly', () => {
    const testData = 'Hello, World!'
    const result = stream.write(testData)

    expect(result).toBe(true)
    expect(stream.getBuffer()).toBe(testData)
  })

  it('should emit data events when writing', () => {
    const mockCallback = vi.fn()
    stream.on('data', mockCallback)

    const testData = 'Test data'
    stream.write(testData)

    expect(mockCallback).toHaveBeenCalledWith(testData)
  })

  it('should handle multiple writes correctly', () => {
    stream.write('First ')
    stream.write('Second ')
    stream.write('Third')

    expect(stream.getBuffer()).toBe('First Second Third')
  })

  it('should emit end event when ended', () => {
    const mockCallback = vi.fn()
    stream.on('end', mockCallback)

    stream.end('Final data')

    expect(mockCallback).toHaveBeenCalled()
    expect(stream.getBuffer()).toBe('Final data')
  })

  it('should emit close event when closed', () => {
    const mockCallback = vi.fn()
    stream.on('close', mockCallback)

    stream.close()

    expect(mockCallback).toHaveBeenCalled()
    expect(stream.isClosed()).toBe(true)
  })

  it('should not write when closed', () => {
    stream.close()
    const result = stream.write('Should not write')

    expect(result).toBe(false)
    expect(stream.getBuffer()).toBe('')
  })

  it('should clear buffer correctly', () => {
    stream.write('Some data')
    expect(stream.getBuffer()).toBe('Some data')

    stream.clear()
    expect(stream.getBuffer()).toBe('')
  })
})

describe('MockChildProcess', () => {
  it('should create with default configuration', () => {
    const process = new MockChildProcess()

    expect(process.pid).toBeGreaterThan(1000)
    expect(process.exitCode).toBe(null)
    expect(process.signalCode).toBe(null)
    expect(process.killed).toBe(false)
  })

  it('should create with custom configuration', () => {
    const config: ProcessMockConfig = {
      pid: 12345,
      exitCode: 1,
      stdout: 'Test output',
      stderr: 'Test error',
    }

    const process = new MockChildProcess(config)
    expect(process.pid).toBe(12345)
  })

  it('should simulate successful execution', async () => {
    const config: ProcessMockConfig = {
      stdout: 'Success output',
      stderr: 'Warning message',
      exitCode: 0,
    }

    const process = new MockChildProcess(config)
    const exitPromise = new Promise<void>((resolve) => {
      process.on('exit', (code, signal) => {
        expect(code).toBe(0)
        expect(signal).toBe(null)
        resolve()
      })
    })

    await exitPromise
    expect(process.stdout.getBuffer()).toBe('Success output')
    expect(process.stderr.getBuffer()).toBe('Warning message')
  })

  it('should simulate execution with delay', async () => {
    const startTime = Date.now()
    const config: ProcessMockConfig = {
      delay: 100,
      stdout: 'Delayed output',
      exitCode: 0,
    }

    const process = new MockChildProcess(config)
    const exitPromise = new Promise<void>((resolve) => {
      process.on('exit', () => {
        const endTime = Date.now()
        expect(endTime - startTime).toBeGreaterThanOrEqual(90) // Allow some tolerance
        resolve()
      })
    })

    await exitPromise
    expect(process.stdout.getBuffer()).toBe('Delayed output')
  })

  it('should handle process kill correctly', async () => {
    const config: ProcessMockConfig = {
      delay: 1000, // Long delay to ensure we can kill it
      stdout: 'Should not complete',
    }

    const process = new MockChildProcess(config)
    const closePromise = new Promise<void>((resolve) => {
      process.on('close', (code, signal) => {
        expect(code).toBe(null)
        expect(signal).toBe('SIGTERM')
        expect(process.killed).toBe(true)
        resolve()
      })
    })

    // Kill the process after a short delay
    setTimeout(() => {
      const result = process.kill()
      expect(result).toBe(true)
    }, 50)

    await closePromise
  })

  it('should emit error events when configured', async () => {
    const testError = new Error('Test error')
    const config: ProcessMockConfig = {
      error: testError,
    }

    const process = new MockChildProcess(config)
    const errorPromise = new Promise<void>((resolve) => {
      process.on('error', (error) => {
        expect(error).toBe(testError)
        resolve()
      })
    })

    await errorPromise
  })

  it('should not allow killing already killed process', () => {
    const process = new MockChildProcess()

    const firstKill = process.kill()
    expect(firstKill).toBe(true)

    const secondKill = process.kill()
    expect(secondKill).toBe(false)
  })
})

describe('ProcessMocker', () => {
  let mocker: ReturnType<typeof createProcessMocker>

  beforeEach(() => {
    mocker = createProcessMocker()
  })

  afterEach(() => {
    mocker.restore()
  })

  it('should mock spawn correctly', () => {
    const config: ProcessMockConfig = {
      stdout: 'Test output',
      exitCode: 0,
    }

    mocker.registerSpawn('test-command', config)

    const process = cp.spawn('test-command', ['arg1', 'arg2'])
    expect(process).toBeInstanceOf(MockChildProcess)

    const spawnedProcesses = mocker.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(1)
  })

  it('should mock exec correctly', async () => {
    const config: ProcessMockConfig = {
      stdout: 'Exec output',
      stderr: 'Exec error',
      exitCode: 0,
    }

    mocker.registerExec('exec-command', config)

    const result = await new Promise<{ error: Error | null; stdout: string; stderr: string }>(
      (resolve) => {
        cp.exec('exec-command', (error, stdout, stderr) => {
          resolve({ error, stdout, stderr })
        })
      },
    )

    expect(result.error).toBe(null)
    expect(result.stdout).toBe('Exec output')
    expect(result.stderr).toBe('Exec error')

    const execCalls = mocker.getExecCalls()
    expect(execCalls).toHaveLength(1)
    expect(execCalls[0].command).toBe('exec-command')
  })

  it('should mock execSync correctly', () => {
    const config: ProcessMockConfig = {
      stdout: 'Sync output',
      exitCode: 0,
    }

    mocker.registerExecSync('sync-command', config)

    const result = cp.execSync('sync-command')
    expect(result.toString()).toBe('Sync output')

    const execSyncCalls = mocker.getExecSyncCalls()
    expect(execSyncCalls).toHaveLength(1)
    expect(execSyncCalls[0].command).toBe('sync-command')
  })

  it('should mock fork correctly', () => {
    const config: ProcessMockConfig = {
      stdout: 'Fork output',
      exitCode: 0,
    }

    mocker.registerFork('test-module.js', config)

    const process = cp.fork('test-module.js', ['arg1'])
    expect(process).toBeInstanceOf(MockChildProcess)

    const forkCalls = mocker.getForkCalls()
    expect(forkCalls).toHaveLength(1)
    expect(forkCalls[0].modulePath).toBe('test-module.js')
    expect(forkCalls[0].args).toEqual(['arg1'])
  })

  it('should handle URL module paths in fork', () => {
    const config: ProcessMockConfig = {
      stdout: 'URL Fork output',
      exitCode: 0,
    }

    mocker.registerFork('file:///path/to/module.js', config)

    const moduleUrl = new URL('file:///path/to/module.js')
    const process = cp.fork(moduleUrl, ['arg1'])
    expect(process).toBeInstanceOf(MockChildProcess)

    const forkCalls = mocker.getForkCalls()
    expect(forkCalls).toHaveLength(1)
    expect(forkCalls[0].modulePath).toBe('file:///path/to/module.js')
  })

  it('should mock execSync errors correctly', () => {
    const testError = new Error('Sync command failed')
    const config: ProcessMockConfig = {
      error: testError,
    }

    mocker.registerExecSync('failing-sync-command', config)

    expect(() => {
      cp.execSync('failing-sync-command')
    }).toThrow('Sync command failed')
  })

  it('should mock exec errors correctly', async () => {
    const testError = new Error('Exec command failed') as cp.ExecException
    testError.code = 1
    const config: ProcessMockConfig = {
      error: testError,
      exitCode: 1,
      stderr: 'Command failed output',
    }

    mocker.registerExec('failing-exec-command', config)

    const result = await new Promise<{
      error: cp.ExecException | null
      stdout: string
      stderr: string
    }>((resolve) => {
      cp.exec('failing-exec-command', (error, stdout, stderr) => {
        resolve({ error: error as cp.ExecException | null, stdout, stderr })
      })
    })

    expect(result.error).toBe(testError)
    expect(result.error?.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('Command failed output')
  })

  it('should support regex patterns for command matching', () => {
    const config: ProcessMockConfig = {
      stdout: 'Pattern matched',
      exitCode: 0,
    }

    mocker.registerSpawn(/^git /, config)

    const process1 = cp.spawn('git', ['status'])
    const process2 = cp.spawn('git', ['log'])

    expect(process1).toBeInstanceOf(MockChildProcess)
    expect(process2).toBeInstanceOf(MockChildProcess)

    const spawnedProcesses = mocker.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(2)
  })

  it('should clear all mocks', () => {
    mocker.registerSpawn('test1', { stdout: 'output1' })
    mocker.registerExec('test2', { stdout: 'output2' })

    expect(mocker.getSpawnedProcesses()).toHaveLength(0)
    expect(mocker.getExecCalls()).toHaveLength(0)

    // Trigger some calls
    cp.spawn('test1')
    cp.exec('test2', () => {})

    expect(mocker.getSpawnedProcesses()).toHaveLength(1)
    expect(mocker.getExecCalls()).toHaveLength(1)

    mocker.clear()

    expect(mocker.getSpawnedProcesses()).toHaveLength(0)
    expect(mocker.getExecCalls()).toHaveLength(0)
  })

  it('should register commands for all process types with register method', () => {
    const config: ProcessMockConfig = {
      stdout: 'Universal output',
      exitCode: 0,
    }

    mocker.register('universal-command', config)

    // Test spawn
    const spawnProcess = cp.spawn('universal-command')
    expect(spawnProcess).toBeInstanceOf(MockChildProcess)

    // Test exec
    cp.exec('universal-command', (error, stdout) => {
      expect(error).toBe(null)
      expect(stdout).toBe('Universal output')
    })

    // Test execSync
    const syncResult = cp.execSync('universal-command')
    expect(syncResult.toString()).toBe('Universal output')

    expect(mocker.getSpawnedProcesses()).toHaveLength(1)
    expect(mocker.getExecCalls()).toHaveLength(1)
    expect(mocker.getExecSyncCalls()).toHaveLength(1)
  })
})

describe('Global Process Mocker', () => {
  afterEach(() => {
    const globalMocker = getGlobalProcessMocker()
    globalMocker.clear()
    globalMocker.restore()
  })

  it('should return the same instance', () => {
    const mocker1 = getGlobalProcessMocker()
    const mocker2 = getGlobalProcessMocker()

    expect(mocker1).toBe(mocker2)
  })

  it('should work with setupProcessMocking', () => {
    const mocker = setupProcessMocking()
    expect(mocker).toBe(getGlobalProcessMocker())
  })
})

describe('Process Helpers', () => {
  afterEach(() => {
    processHelpers.restore()
  })

  it('should mock success correctly', () => {
    processHelpers.mockSuccess('success-command', 'Success output', 0)

    const result = cp.execSync('success-command')
    expect(result.toString()).toBe('Success output')
  })

  it('should mock failure correctly', async () => {
    processHelpers.mockFailure('failure-command', 'Failure output', 1)

    const result = await new Promise<{ error: Error | null; stdout: string; stderr: string }>(
      (resolve) => {
        cp.exec('failure-command', (error, stdout, stderr) => {
          resolve({ error, stdout, stderr })
        })
      },
    )

    expect(result.error).toBeTruthy()
    expect(result.stderr).toBe('Failure output')
  })

  it('should mock error correctly', () => {
    const testError = new Error('Test error')
    processHelpers.mockError('error-command', testError)

    expect(() => {
      cp.execSync('error-command')
    }).toThrow('Test error')
  })

  it('should mock delayed commands correctly', async () => {
    const startTime = Date.now()
    processHelpers.mockDelayed('delayed-command', 100, 'Delayed output', 0)

    const process = cp.spawn('delayed-command')
    const exitPromise = new Promise<void>((resolve) => {
      process.on('exit', () => {
        const endTime = Date.now()
        expect(endTime - startTime).toBeGreaterThanOrEqual(90)
        resolve()
      })
    })

    await exitPromise
  })

  it('should clear mocks correctly', () => {
    processHelpers.mockSuccess('test-command', 'output')

    // Verify mock is working
    const result1 = cp.execSync('test-command')
    expect(result1.toString()).toBe('output')

    processHelpers.clear()

    // After clearing, the mock should be gone and we should get the default behavior
    const mocker = processHelpers.getMocker()
    expect(mocker.getExecSyncCalls()).toHaveLength(0)
  })
})

describe('Integration Tests', () => {
  let mocker: ReturnType<typeof createProcessMocker>

  beforeEach(() => {
    mocker = createProcessMocker()
  })

  afterEach(() => {
    mocker.restore()
  })

  it('should handle complex command scenarios', async () => {
    // Mock a git status command
    mocker.registerSpawn('git status', {
      stdout: 'On branch main\nnothing to commit, working tree clean\n',
      exitCode: 0,
    })

    // Mock a npm install command that takes time
    mocker.registerSpawn('npm install', {
      stdout: 'npm WARN deprecated package\nadded 42 packages in 2.5s\n',
      delay: 50,
      exitCode: 0,
    })

    // Mock a failing test command
    mocker.registerSpawn('npm test', {
      stderr: '1 test failed\n',
      exitCode: 1,
    })

    // Test git status
    const gitProcess = cp.spawn('git', ['status'])
    const gitExitPromise = new Promise<number>((resolve) => {
      gitProcess.on('exit', (code) => resolve(code!))
    })

    const gitExitCode = await gitExitPromise
    expect(gitExitCode).toBe(0)

    // Test npm install with delay
    const startTime = Date.now()
    const npmProcess = cp.spawn('npm', ['install'])
    const npmExitPromise = new Promise<number>((resolve) => {
      npmProcess.on('exit', (code) => {
        const endTime = Date.now()
        expect(endTime - startTime).toBeGreaterThanOrEqual(40)
        resolve(code!)
      })
    })

    const npmExitCode = await npmExitPromise
    expect(npmExitCode).toBe(0)

    // Test failing npm test
    const testProcess = cp.spawn('npm', ['test'])
    const testExitPromise = new Promise<number>((resolve) => {
      testProcess.on('exit', (code) => resolve(code!))
    })

    const testExitCode = await testExitPromise
    expect(testExitCode).toBe(1)

    // Verify all processes were tracked
    const spawnedProcesses = mocker.getSpawnedProcesses()
    expect(spawnedProcesses).toHaveLength(3)
  })

  it('should handle exec with options callback signature', async () => {
    mocker.registerExec('test-command', {
      stdout: 'Command output',
      exitCode: 0,
    })

    // Test the callback-only signature
    const result = await new Promise<{ error: Error | null; stdout: string; stderr: string }>(
      (resolve) => {
        cp.exec('test-command', (error, stdout, stderr) => {
          resolve({ error, stdout, stderr })
        })
      },
    )

    expect(result.error).toBe(null)
    expect(result.stdout).toBe('Command output')
    expect(result.stderr).toBe('')
  })

  it('should handle exec with options and callback signature', async () => {
    mocker.registerExec('test-command-with-options', {
      stdout: 'Command with options output',
      exitCode: 0,
    })

    // Test the options + callback signature
    const result = await new Promise<{ error: Error | null; stdout: string; stderr: string }>(
      (resolve) => {
        cp.exec('test-command-with-options', { timeout: 5000 }, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr })
        })
      },
    )

    expect(result.error).toBe(null)
    expect(result.stdout).toBe('Command with options output')
    expect(result.stderr).toBe('')

    const execCalls = mocker.getExecCalls()
    expect(execCalls).toHaveLength(1)
    expect(execCalls[0].options?.timeout).toBe(5000)
  })
})
