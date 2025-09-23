import { exec, execFile, execFileSync, execSync, fork, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { beforeEach, describe, expect, it } from 'vitest'
import { processHelpers } from '../process-mock'
import { quickMocks } from '../spawn'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

describe('quickMocks hexa-register pattern', () => {
  beforeEach(() => {
    processHelpers.clearCalls()
    processHelpers.clear()
  })

  describe('quickMocks.success() registers for all 6 methods', () => {
    const command = 'echo test'
    const output = 'test output'

    beforeEach(() => {
      quickMocks.success(command, output)
    })

    it('works with spawn', async () => {
      const child = spawn('echo', ['test'])
      let stdout = ''

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(0)
          expect(stdout).toBe(output)
          resolve()
        })
      })
    })

    it('works with exec', async () => {
      const { stdout } = await execAsync(command)
      expect(stdout).toBe(output)
    })

    it('works with execSync', () => {
      const result = execSync(command, { encoding: 'utf8' })
      expect(result).toBe(output)
    })

    it('works with fork', async () => {
      const child = fork('echo', ['test'])

      child.on('message', (_msg) => {
        // Message received from forked process
      })

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(0)
          resolve()
        })
      })
    })

    it('works with execFile', async () => {
      const { stdout } = await execFileAsync('echo', ['test'])
      expect(stdout).toBe(output)
    })

    it('works with execFileSync', () => {
      const result = execFileSync('echo', ['test'], { encoding: 'utf8' })
      expect(result).toBe(output)
    })
  })

  describe('quickMocks.failure() registers for all 6 methods', () => {
    const command = 'failing-command'
    const errorMessage = 'Command failed with error'
    const exitCode = 1

    beforeEach(() => {
      quickMocks.failure(command, errorMessage, exitCode)
    })

    it('works with spawn', async () => {
      const child = spawn(command)
      let stderr = ''

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(exitCode)
          expect(stderr).toBe(errorMessage)
          resolve()
        })
      })
    })

    it('works with exec', async () => {
      try {
        await execAsync(command)
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(exitCode)
        expect(error.stderr).toBe(errorMessage)
      }
    })

    it('works with execSync', () => {
      expect(() => execSync(command)).toThrow()
      try {
        execSync(command)
      } catch (error: any) {
        expect(error.status).toBe(exitCode)
        expect(error.stderr?.toString()).toContain(errorMessage)
      }
    })

    it('works with fork', async () => {
      const child = fork(command)

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(exitCode)
          resolve()
        })
      })
    })

    it('works with execFile', async () => {
      try {
        await execFileAsync(command)
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.code).toBe(exitCode)
        expect(error.stderr).toBe(errorMessage)
      }
    })

    it('works with execFileSync', () => {
      expect(() => execFileSync(command)).toThrow()
      try {
        execFileSync(command)
      } catch (error: any) {
        expect(error.status).toBe(exitCode)
        expect(error.stderr?.toString()).toContain(errorMessage)
      }
    })
  })

  describe('quickMocks.throws() registers for all 6 methods', () => {
    const command = 'throw-error'
    const error = new Error('ENOENT: command not found')

    beforeEach(() => {
      quickMocks.throws(command, error)
    })

    it('works with spawn', () => {
      const child = spawn(command)

      child.on('error', (err) => {
        expect(err.message).toBe(error.message)
      })
    })

    it('works with exec', async () => {
      await new Promise<void>((resolve) => {
        exec(command, (err) => {
          expect(err?.message).toBe(error.message)
          resolve()
        })
      })
    })

    it('works with execSync', () => {
      expect(() => execSync(command)).toThrow(error.message)
    })

    it('works with fork', () => {
      const child = fork(command)

      child.on('error', (err) => {
        expect(err.message).toBe(error.message)
      })
    })

    it('works with execFile', async () => {
      await new Promise<void>((resolve) => {
        execFile(command, (err) => {
          expect(err?.message).toBe(error.message)
          resolve()
        })
      })
    })

    it('works with execFileSync', () => {
      expect(() => execFileSync(command)).toThrow(error.message)
    })
  })

  describe('quickMocks.slow() registers for all 6 methods', () => {
    const command = 'slow-command'
    const output = 'delayed output'
    const delay = 50

    beforeEach(() => {
      quickMocks.slow(command, delay, output)
    })

    it('works with spawn', async () => {
      const start = Date.now()
      const child = spawn(command)
      let stdout = ''

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          const elapsed = Date.now() - start
          expect(elapsed).toBeGreaterThanOrEqual(delay - 10) // Allow small variance
          expect(code).toBe(0)
          expect(stdout).toBe(output)
          resolve()
        })
      })
    })

    it('works with exec', async () => {
      const start = Date.now()
      const { stdout } = await execAsync(command)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(delay - 10)
      expect(stdout).toBe(output)
    })

    it('works with execSync', () => {
      // Enable sync delay for this test
      const originalAllowSync = process.env.ALLOW_SYNC_DELAY
      process.env.ALLOW_SYNC_DELAY = 'true'

      try {
        const start = Date.now()
        const result = execSync(command, { encoding: 'utf8' })
        const elapsed = Date.now() - start

        expect(elapsed).toBeGreaterThanOrEqual(delay - 10)
        expect(result).toBe(output)
      } finally {
        // Restore original value
        if (originalAllowSync !== undefined) {
          process.env.ALLOW_SYNC_DELAY = originalAllowSync
        } else {
          delete process.env.ALLOW_SYNC_DELAY
        }
      }
    })

    it('works with fork', async () => {
      const start = Date.now()
      const child = fork(command)

      await new Promise<void>((resolve) => {
        child.on('exit', (code) => {
          const elapsed = Date.now() - start
          expect(elapsed).toBeGreaterThanOrEqual(delay - 10)
          expect(code).toBe(0)
          resolve()
        })
      })
    })

    it('works with execFile', async () => {
      const start = Date.now()
      const { stdout } = await execFileAsync(command)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(delay - 10)
      expect(stdout).toBe(output)
    })

    it('works with execFileSync', () => {
      // execFileSync throws if delay is configured
      expect(() => execFileSync(command, [], { encoding: 'utf8' })).toThrow(
        'execFileSync does not support delays',
      )
    })
  })

  describe('quickMocks.batch() registers all commands for all 6 methods', () => {
    const commands = [
      { command: 'ls', output: 'file1.txt\nfile2.txt', exitCode: 0 },
      { command: 'pwd', output: '/home/user', exitCode: 0 },
      { command: 'whoami', output: 'testuser', exitCode: 0 },
    ]

    beforeEach(() => {
      quickMocks.batch(commands)
    })

    it('all commands work with exec', async () => {
      for (const cmd of commands) {
        const { stdout } = await execAsync(cmd.command)
        expect(stdout).toBe(cmd.output)
      }
    })

    it('all commands work with execSync', () => {
      for (const cmd of commands) {
        const result = execSync(cmd.command, { encoding: 'utf8' })
        expect(result).toBe(cmd.output)
      }
    })

    it('all commands work with execFile', async () => {
      for (const cmd of commands) {
        const { stdout } = await execFileAsync(cmd.command)
        expect(stdout).toBe(cmd.output)
      }
    })

    it('all commands work with execFileSync', () => {
      for (const cmd of commands) {
        const result = execFileSync(cmd.command, [], { encoding: 'utf8' })
        expect(result).toBe(cmd.output)
      }
    })
  })

  describe('RegExp patterns work with all methods', () => {
    const pattern = /git\s+(status|diff)/
    const output = 'git command output'

    beforeEach(() => {
      quickMocks.success(pattern, output)
    })

    it('matches "git status" with exec', async () => {
      const { stdout } = await execAsync('git status')
      expect(stdout).toBe(output)
    })

    it('matches "git diff" with execSync', () => {
      const result = execSync('git diff', { encoding: 'utf8' })
      expect(result).toBe(output)
    })

    it('matches with extra spaces', async () => {
      const { stdout } = await execAsync('git   status')
      expect(stdout).toBe(output)
    })

    it('works with execFile', async () => {
      const { stdout } = await execFileAsync('git', ['status'])
      expect(stdout).toBe(output)
    })

    it('works with execFileSync', () => {
      const result = execFileSync('git', ['diff'], { encoding: 'utf8' })
      expect(result).toBe(output)
    })
  })
})
