import { createTempDirectory } from '@template/testkit/fs'
import { describe, expect, it } from 'vitest'

// Basic temp directory usage demonstrating creation, file IO, and cleanup
// This example focuses on the core createTempDirectory API.

describe('fs temp directory basics', () => {
  it('creates, writes, reads and cleans up', async () => {
    const temp = await createTempDirectory({ prefix: 'example-' })

    await temp.writeFile('nested/hello.txt', 'hello world')
    expect(await temp.exists('nested/hello.txt')).toBe(true)

    const contents = await temp.readFile('nested/hello.txt')
    expect(contents).toBe('hello world')

    // Create a structure in one shot
    await temp.createStructure({
      'src': {
        'index.ts': "export const msg = 'hi'",
        'lib': {
          'util.ts': 'export function double(n:number){return n*2}',
        },
      },
      'package.json': '{"name":"temp-example"}',
    })

    const entries = await temp.readdir('src')
    expect(entries.sort()).toEqual(['index.ts', 'lib'])

    await temp.cleanup()
    expect(await temp.exists('nested/hello.txt')).toBe(false)
  })
})
