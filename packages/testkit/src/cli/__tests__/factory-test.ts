/**
 * Test to verify the mock factory pattern works correctly
 * Tests both 'child_process' and 'node:child_process' module specifiers
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as cp from 'child_process'
import * as nodeCP from 'node:child_process'
import { getGlobalProcessMocker } from '../process-mock.js'

describe('Mock Factory Pattern', () => {
  let mocker: ReturnType<typeof getGlobalProcessMocker>

  beforeEach(() => {
    mocker = getGlobalProcessMocker()
    mocker.clear()
  })

  describe('child_process module', () => {
    it('should mock spawn correctly', () => {
      mocker.registerSpawn('test-command', { stdout: 'test output', exitCode: 0 })

      const process = cp.spawn('test-command')
      expect(process).toBeDefined()
      expect(process.pid).toBeGreaterThan(0)

      const spawned = mocker.getSpawnedProcesses()
      expect(spawned).toHaveLength(1)
    })

    it('should mock exec correctly', async () => {
      mocker.registerExec('echo hello', { stdout: 'hello\n', exitCode: 0 })

      const promise = new Promise<{ stdout: string; stderr: string }>((resolve) => {
        cp.exec('echo hello', (error, stdout, stderr) => {
          expect(error).toBeNull()
          resolve({ stdout, stderr })
        })
      })

      const result = await promise
      expect(result.stdout).toBe('hello\n')
      expect(result.stderr).toBe('')

      const calls = mocker.getExecCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].command).toBe('echo hello')
    })

    it('should mock execSync correctly', () => {
      mocker.registerExecSync('pwd', { stdout: '/home/user', exitCode: 0 })

      const result = cp.execSync('pwd')
      expect(result.toString()).toBe('/home/user')

      const calls = mocker.getExecSyncCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].command).toBe('pwd')
    })

    it('should mock fork correctly', () => {
      mocker.registerFork('./worker.js', { stdout: 'worker output', exitCode: 0 })

      const process = cp.fork('./worker.js')
      expect(process).toBeDefined()
      expect(process.pid).toBeGreaterThan(0)

      const calls = mocker.getForkCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].modulePath).toBe('./worker.js')
    })
  })

  describe('node:child_process module', () => {
    it('should mock spawn correctly', () => {
      mocker.registerSpawn('node-test', { stdout: 'node test output', exitCode: 0 })

      const process = nodeCP.spawn('node-test')
      expect(process).toBeDefined()
      expect(process.pid).toBeGreaterThan(0)

      const spawned = mocker.getSpawnedProcesses()
      expect(spawned).toHaveLength(1)
    })

    it('should mock exec correctly', async () => {
      mocker.registerExec('node --version', { stdout: 'v18.0.0\n', exitCode: 0 })

      const promise = new Promise<{ stdout: string; stderr: string }>((resolve) => {
        nodeCP.exec('node --version', (error, stdout, stderr) => {
          expect(error).toBeNull()
          resolve({ stdout, stderr })
        })
      })

      const result = await promise
      expect(result.stdout).toBe('v18.0.0\n')
      expect(result.stderr).toBe('')

      const calls = mocker.getExecCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].command).toBe('node --version')
    })

    it('should mock execSync correctly', () => {
      mocker.registerExecSync('ls', { stdout: 'file1.txt\nfile2.txt', exitCode: 0 })

      const result = nodeCP.execSync('ls')
      expect(result.toString()).toBe('file1.txt\nfile2.txt')

      const calls = mocker.getExecSyncCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].command).toBe('ls')
    })

    it('should mock fork correctly', () => {
      mocker.registerFork('./node-worker.js', { stdout: 'node worker output', exitCode: 0 })

      const process = nodeCP.fork('./node-worker.js')
      expect(process).toBeDefined()
      expect(process.pid).toBeGreaterThan(0)

      const calls = mocker.getForkCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].modulePath).toBe('./node-worker.js')
    })
  })

  describe('Registry sharing', () => {
    it('should share registry between both module specifiers', () => {
      mocker.registerSpawn('shared-command', { stdout: 'shared output', exitCode: 0 })

      // Use child_process
      const process1 = cp.spawn('shared-command')
      expect(process1).toBeDefined()

      // Use node:child_process
      const process2 = nodeCP.spawn('shared-command')
      expect(process2).toBeDefined()

      // Both should be tracked
      const spawned = mocker.getSpawnedProcesses()
      expect(spawned).toHaveLength(2)
    })

    it('should handle regex patterns correctly', () => {
      mocker.registerExecSync(/^git/, { stdout: 'git output', exitCode: 0 })

      const result1 = cp.execSync('git status')
      expect(result1.toString()).toBe('git output')

      const result2 = nodeCP.execSync('git log')
      expect(result2.toString()).toBe('git output')

      const calls = mocker.getExecSyncCalls()
      expect(calls).toHaveLength(2)
    })
  })

  describe('Error handling', () => {
    it('should handle exec errors correctly', async () => {
      const error = new Error('Command failed')
      mocker.registerExec('failing-command', { error, exitCode: 1 })

      const promise = new Promise<Error | null>((resolve) => {
        cp.exec('failing-command', (err) => {
          resolve(err)
        })
      })

      const result = await promise
      expect(result).toBeInstanceOf(Error)
      expect(result?.message).toBe('Command failed')
    })

    it('should handle execSync errors correctly', () => {
      const error = new Error('Sync command failed')
      mocker.registerExecSync('sync-fail', { error })

      expect(() => {
        cp.execSync('sync-fail')
      }).toThrow('Sync command failed')
    })
  })
})
