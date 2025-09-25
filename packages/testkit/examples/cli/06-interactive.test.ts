import { spawnUtils } from '@orchestr8/testkit/cli'
import { exec } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('cli: interactive transcript', () => {
  it('simulates Q&A transcript deterministically', async () => {
    spawnUtils.mockInteractiveCommand(
      'onboarding-cli',
      {
        'What is your name?': 'Ada',
        'Choose language (ts/js)': 'ts',
      },
      'Project created!',
      0,
    )

    const output = await new Promise<string>((resolve) => {
      exec('onboarding-cli', (_err, stdout) => resolve(String(stdout)))
    })

    expect(output).toContain('What is your name?')
    expect(output).toContain('Ada')
    expect(output).toContain('Choose language (ts/js)')
    expect(output).toContain('ts')
    expect(output).toContain('Project created!')
  })
})
