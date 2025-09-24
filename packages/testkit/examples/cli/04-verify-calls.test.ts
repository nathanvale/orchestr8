import { processHelpers } from '@template/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: verifying calls', () => {
  it('inspects exec calls and spawned processes', async () => {
    processHelpers.mockSuccess('echo hello', 'hello\n')

    await new Promise<void>((resolve) => {
      exec('echo hello', () => resolve())
    })

    const mocker = processHelpers.getMocker()
    const execCalls = mocker.getExecCalls()
    expect(execCalls.some((c) => c.command.includes('echo hello'))).toBe(true)
  })
})
