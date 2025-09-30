import * as cp from 'node:child_process'
import { promisify } from 'node:util'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockSpawn, spawnUtils } from '../spawn.js'

describe('execFile promisify support', () => {
  beforeEach(() => {
    spawnUtils.clearMocks()
  })

  it('should support util.promisify with execFile for success', async () => {
    // Register mock for execFile
    mockSpawn('myfile')
      .stdout('promisified output')
      .stderr('some warnings')
      .exitCode(0)
      .forExecFileOnly()
      .mock()

    // Use promisify
    const execFileAsync = promisify(cp.execFile)

    // Should return { stdout, stderr } as strings
    const result = await execFileAsync('myfile', [])
    expect(result.stdout).toBe('promisified output')
    expect(result.stderr).toBe('some warnings')
  })

  it('should support util.promisify with execFile for failure', async () => {
    // Register failing mock
    mockSpawn('failfile')
      .stdout('partial output')
      .stderr('error output')
      .exitCode(1)
      .forExecFileOnly()
      .mock()

    // Use promisify
    const execFileAsync = promisify(cp.execFile)

    // Should reject with error
    await expect(execFileAsync('failfile', [])).rejects.toMatchObject({
      code: 1,
      stderr: 'error output',
    })
  })

  it('should handle execFile with args via promisify', async () => {
    // Register mock that would match with args
    mockSpawn('echo --flag value').stdout('with args').exitCode(0).forExecFileOnly().mock()

    const execFileAsync = promisify(cp.execFile)
    const result = await execFileAsync('echo', ['--flag', 'value'])
    expect(result.stdout).toBe('with args')
  })

  it('should handle empty output via promisify', async () => {
    // Register mock with no output
    mockSpawn('silent').stdout('').stderr('').exitCode(0).forExecFileOnly().mock()

    const execFileAsync = promisify(cp.execFile)
    const result = await execFileAsync('silent', [])
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })

  it('should work with both exec and execFile promisified', async () => {
    // Register for both methods
    mockSpawn('dual-command').stdout('dual output').forMethods(['exec', 'execFile']).mock()

    const execAsync = promisify(cp.exec)
    const execFileAsync = promisify(cp.execFile)

    // Both should work
    const execResult = await execAsync('dual-command')
    expect(execResult.stdout).toBe('dual output')

    const execFileResult = await execFileAsync('dual-command', [])
    expect(execFileResult.stdout).toBe('dual output')
  })

  it('should handle error thrown during execution', async () => {
    const testError = new Error('Execution failed')

    mockSpawn('error-cmd').error(testError).forExecFileOnly().mock()

    const execFileAsync = promisify(cp.execFile)
    await expect(execFileAsync('error-cmd', [])).rejects.toThrow('Execution failed')
  })

  it('should support options parameter with promisify', async () => {
    mockSpawn('with-options').stdout('options output').forExecFileOnly().mock()

    const execFileAsync = promisify(cp.execFile)
    const result = await execFileAsync('with-options', [], {
      encoding: 'utf8',
      timeout: 5000,
    })

    expect(result.stdout).toBe('options output')
  })
})
