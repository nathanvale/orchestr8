import { processHelpers } from '@orchestr8/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: non-zero exit', () => {
  it('mocks failure with stderr and exit code', async () => {
    processHelpers.mockFailure('git status', 'fatal: not a git repository', 128)

    await new Promise<void>((resolve) => {
      exec('git status', (err, _stdout, stderr) => {
        expect(err?.code).toBe(128)
        expect(String(stderr)).toContain('not a git repository')
        resolve()
      })
    })
  })
})
