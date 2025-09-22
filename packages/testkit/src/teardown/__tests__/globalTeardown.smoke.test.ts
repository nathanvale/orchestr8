import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDirectory, createManagedTempDirectory } from '../../fs/cleanup'
import teardown from '../globalTeardown'

describe('globalTeardown smoke', () => {
  let prevLogFileEnv: string | undefined
  let tempDirPath: string
  let logFilePath: string

  beforeEach(async () => {
    // Use testkit temp utilities to isolate FS and ensure cleanup
    const temp = await createManagedTempDirectory({ prefix: 'testkit-teardown-' })
    tempDirPath = temp.path
    logFilePath = path.join(tempDirPath, 'smoke.log')

    prevLogFileEnv = process.env['LOG_FILE']
    process.env['LOG_FILE'] = logFilePath
  })

  afterEach(async () => {
    if (prevLogFileEnv === undefined) delete process.env['LOG_FILE']
    else process.env['LOG_FILE'] = prevLogFileEnv

    // Ensure temp dir cleanup via registry
    await cleanupTempDirectory({ path: tempDirPath, cleanup: async () => {} } as any)
  })

  it('writes a cleanup header and summary to the log file', async () => {
    await teardown()
    // Read via Node fs to assert actual file content written by teardown
    const content = (await import('node:fs/promises')).readFile(logFilePath, 'utf8')
    const text = await content
    expect(text).toContain('Cleanup run')
    expect(text).toMatch(/Found \d+ matching processes/)
    // Summary line will always be present even if nothing to kill
    expect(text).toMatch(/Summary: killed=\d+ failed=\d+/)
  })
})
