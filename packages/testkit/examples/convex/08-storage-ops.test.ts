import { describe, it, expect } from 'vitest'
import { createConvexTestHarness } from '@orchestr8/testkit/convex'

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const d = RUN_CONVEX ? describe : describe.skip

d('convex: storage operations', () => {
  it('uploads, fetches, and deletes file', async () => {
    const harness = createConvexTestHarness()

    const storageId = await harness.storage.uploadFile('hello.txt', 'hello world')
    expect(storageId).toBeDefined()

    const buf = await harness.storage.getFile(storageId!)
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(new Uint8Array(buf!))).toContain('hello')

    await harness.storage.deleteFile(storageId!)
  })
})
