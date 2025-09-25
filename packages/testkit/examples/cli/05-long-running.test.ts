import { processHelpers } from '@orchestr8/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: long-running commands', () => {
  it('simulates delay deterministically', async () => {
    processHelpers.mockDelayed('sleep 1', 50, 'done')

    const started = Date.now()
    await new Promise<void>((resolve) => {
      exec('sleep 1', (_err, stdout) => {
        expect(String(stdout)).toContain('done')
        resolve()
      })
    })
    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThanOrEqual(45)
  })
})
