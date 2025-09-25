/**
 * Example demonstrating quickMocks hexa-register pattern
 * Shows how one quickMocks registration works with all 6 child_process methods
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { spawn, exec, execSync, fork, execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { quickMocks, processHelpers } from '@orchestr8/testkit/cli'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

describe('CLI command mocking - all methods example', () => {
  beforeEach(() => {
    processHelpers.clearCalls()
    processHelpers.clear()
  })

  describe('Single registration, multiple methods', () => {
    it('one quickMocks.success() call works with all 6 methods', async () => {
      // Register once for the command
      quickMocks.success('npm --version', '10.2.0\n')

      // Works with spawn
      const spawnChild = spawn('npm', ['--version'])
      let spawnOutput = ''
      spawnChild.stdout?.on('data', (chunk) => {
        spawnOutput += chunk.toString()
      })
      await new Promise((resolve) => spawnChild.on('exit', resolve))
      expect(spawnOutput).toBe('10.2.0\n')

      // Works with exec (async)
      const { stdout: execOutput } = await execAsync('npm --version')
      expect(execOutput).toBe('10.2.0\n')

      // Works with execSync
      const execSyncOutput = execSync('npm --version', { encoding: 'utf8' })
      expect(execSyncOutput).toBe('10.2.0\n')

      // Works with fork
      const forkChild = fork('npm', ['--version'])
      await new Promise((resolve) => forkChild.on('exit', resolve))

      // Works with execFile (async)
      const { stdout: execFileOutput } = await execFileAsync('npm', ['--version'])
      expect(execFileOutput).toBe('10.2.0\n')

      // Works with execFileSync
      const execFileSyncOutput = execFileSync('npm', ['--version'], {
        encoding: 'utf8',
      })
      expect(execFileSyncOutput).toBe('10.2.0\n')
    })
  })

  describe('Pattern matching across methods', () => {
    it('RegExp patterns work with all methods', async () => {
      // Register with a pattern
      quickMocks.success(/git\s+(status|log|diff)/, 'git output\n')

      // All these variations match
      expect(execSync('git status', { encoding: 'utf8' })).toBe('git output\n')
      expect(execSync('git log', { encoding: 'utf8' })).toBe('git output\n')
      expect(execSync('git   diff', { encoding: 'utf8' })).toBe('git output\n')

      const { stdout } = await execAsync('git status')
      expect(stdout).toBe('git output\n')

      const fileResult = execFileSync('git', ['status'], { encoding: 'utf8' })
      expect(fileResult).toBe('git output\n')
    })
  })

  describe('Error handling across methods', () => {
    it('quickMocks.failure() propagates errors correctly', async () => {
      quickMocks.failure('bad-command', 'command not found\n', 127)

      // execSync throws
      expect(() => execSync('bad-command')).toThrow()

      // exec rejects with error
      await expect(execAsync('bad-command')).rejects.toMatchObject({
        code: 127,
        stderr: 'command not found\n',
      })

      // execFileSync throws
      expect(() => execFileSync('bad-command')).toThrow()

      // spawn emits exit event with code
      const child = spawn('bad-command')
      const exitCode = await new Promise((resolve) => {
        child.on('exit', resolve)
      })
      expect(exitCode).toBe(127)
    })
  })

  describe('Batch registration', () => {
    it('batch registers multiple commands for all methods', async () => {
      quickMocks.batch([
        { command: 'node --version', output: 'v20.11.0\n' },
        { command: 'npm --version', output: '10.2.0\n' },
        { command: 'yarn --version', output: '1.22.19\n' },
      ])

      // All commands work with all methods
      expect(execSync('node --version', { encoding: 'utf8' })).toBe('v20.11.0\n')
      expect(execSync('npm --version', { encoding: 'utf8' })).toBe('10.2.0\n')
      expect(execSync('yarn --version', { encoding: 'utf8' })).toBe('1.22.19\n')

      const { stdout: nodeVer } = await execAsync('node --version')
      expect(nodeVer).toBe('v20.11.0\n')

      const npmVer = execFileSync('npm', ['--version'], { encoding: 'utf8' })
      expect(npmVer).toBe('10.2.0\n')
    })
  })

  describe('Timing control', () => {
    it('quickMocks.slow() adds delay to all methods', async () => {
      quickMocks.slow('slow-operation', 100, 'done\n')

      // Measure execSync timing
      const syncStart = Date.now()
      const syncResult = execSync('slow-operation', { encoding: 'utf8' })
      const syncElapsed = Date.now() - syncStart

      expect(syncResult).toBe('done\n')
      expect(syncElapsed).toBeGreaterThanOrEqual(90) // Allow small variance

      // Measure async exec timing
      const asyncStart = Date.now()
      const { stdout } = await execAsync('slow-operation')
      const asyncElapsed = Date.now() - asyncStart

      expect(stdout).toBe('done\n')
      expect(asyncElapsed).toBeGreaterThanOrEqual(90)
    })
  })
})
