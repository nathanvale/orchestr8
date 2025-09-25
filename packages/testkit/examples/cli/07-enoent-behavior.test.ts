import { processHelpers } from '@orchestr8/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: ENOENT-like behavior', () => {
  it('demonstrates behavior when no mock is registered', async () => {
    // Intentionally do NOT register a mock for this command
    const output = await new Promise<{ err: unknown; stdout: string; stderr: string }>(
      (resolve) => {
        exec('unknown-command --foo', (err, stdout, stderr) => {
          resolve({ err, stdout: String(stdout), stderr: String(stderr) })
        })
      },
    )

    // Our mock factory logs a warning and proceeds with default success (exitCode 0) unless configured otherwise
    // For deterministic tests, prefer registering an explicit failure:
    // processHelpers.mockFailure('unknown-command --foo', 'command not found', 127)
    // and then assert on err.code === 127

    expect(typeof output.err === 'object' || output.err === null).toBe(true)
    expect(output.stdout).toBeTypeOf('string')
    expect(output.stderr).toBeTypeOf('string')
  })

  it('preferred: explicitly model ENOENT (127)', async () => {
    processHelpers.mockFailure('unknown-command --bar', 'command not found', 127)
    const { err, stdout, stderr } = await new Promise<{ err: any; stdout: string; stderr: string }>(
      (resolve) => {
        exec('unknown-command --bar', (err, stdout, stderr) => {
          resolve({ err, stdout: String(stdout), stderr: String(stderr) })
        })
      },
    )
    expect(err?.code).toBe(127)
    expect(stderr).toContain('command not found')
    expect(stdout).toBe('')
  })
})
