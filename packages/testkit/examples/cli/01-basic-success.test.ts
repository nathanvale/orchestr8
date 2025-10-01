import { spawnUtils } from '@orchestr8/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it, afterEach } from 'vitest'

describe('cli: basic success', () => {
  afterEach(() => {
    // Clean up mocks after each test
    spawnUtils.restore()
  })

  it('mocks git status with stdout and zero exit', async () => {
    spawnUtils.mockCommandSuccess('git status', 'nothing to commit, working tree clean')

    await new Promise<void>((resolve) => {
      exec('git status', (_err, stdout) => {
        expect(String(stdout)).toContain('nothing to commit')
        resolve()
      })
    })
  })

  it('mocks command with specific exit code', async () => {
    spawnUtils.mockCommandSuccess('echo hello', 'hello world', '', 0)

    await new Promise<void>((resolve) => {
      exec('echo hello', (err, stdout, stderr) => {
        expect(err).toBeNull()
        expect(stdout.trim()).toBe('hello world')
        expect(stderr).toBe('')
        resolve()
      })
    })
  })
})
