import { spawnUtils } from '@template/testkit/cli'
import { execFile } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: regex args matching', () => {
  it('matches execFile with normalized args', async () => {
    // Use regex to allow flexible arg ordering/spacing
    spawnUtils.mockCommandSuccess(/npm\s+run\s+build/, 'building...')

    await new Promise<void>((resolve) => {
      execFile('npm', ['run', 'build'], (_err, stdout) => {
        expect(String(stdout)).toContain('building...')
        resolve()
      })
    })
  })
})
