import { processHelpers } from '@orchestr8/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: basic success', () => {
  it('mocks git status with stdout and zero exit', async () => {
    processHelpers.mockSuccess('git status', 'nothing to commit')

    await new Promise<void>((resolve) => {
      exec('git status', (_err, stdout) => {
        expect(String(stdout)).toContain('nothing to commit')
        resolve()
      })
    })
  })
})
