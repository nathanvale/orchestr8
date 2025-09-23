import { setupConvexTest } from '@template/testkit/convex'
import { convexTest } from 'convex-test'
import { describe, expect, it, test, vi } from 'vitest'

// Minimal smoke tests to lock in Convex harness patterns.
// These do not require a schema or modules and avoid network/Docker.

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const describeConvex = RUN_CONVEX ? describe : describe.skip

describeConvex('convex harness smoke', () => {
  it('storage roundtrip via harness helpers', async () => {
    // modules defaults to {} to prevent _generated directory scan
    const ctx = setupConvexTest()

    const id = await ctx.storage.uploadFile('hello.txt', 'hello world')
    const buf = await ctx.storage.getFile(id)

    expect(buf).not.toBeNull()
    const text = new TextDecoder('utf-8').decode(new Uint8Array(buf as ArrayBuffer))
    expect(text).toBe('hello world')

    await ctx.lifecycle.cleanup()
  })

  it('identity helpers (fluent) return authed context', async () => {
    // modules defaults to {} to prevent _generated directory scan
    const ctx = setupConvexTest()
    const user = { subject: 'user_123', name: 'Test User' }

    // Fluent API returns an authenticated TestConvex instance for operations
    const authed = ctx.auth.withUser(user)
    expect(typeof authed.run).toBe('function')

    // Run a no-op through the authed context to validate the shape
    await authed.run(async () => undefined)

    await ctx.lifecycle.cleanup()
  })

  it('scheduler API surface is usable with fake timers', async () => {
    vi.useFakeTimers()
    // modules defaults to {} to prevent _generated directory scan
    const ctx = setupConvexTest()

    // No scheduled functions here; this asserts the API shape and cleanup pattern
    await ctx.scheduler.finishInProgress()
    await ctx.lifecycle.cleanup()
    vi.useRealTimers()
  })
})

// IMPORTANT: Convex tests require either:
// 1. A _generated directory from running 'npx convex codegen'
// 2. An explicit modules parameter (even if empty) to skip auto-discovery
//
// We use approach #2 here to avoid requiring codegen for these examples.
// For real projects with actual Convex functions, use:
// const modules = import.meta.glob('./**/*.{js,ts}', { eager: true })

// Minimal convex.test.ts example to lock patterns used across the monorepo.
// This file exercises identity, scheduler, db/storage via t.run, and fetch stubbing.

// If you have a Convex schema and generated API, import them and replace placeholders.
// import schema from './schema'
// import { api } from './_generated/api'

// Keep this runnable without project-specific schema/api.

const testConvex = RUN_CONVEX ? test : test.skip

testConvex('identity isolation with withIdentity', async () => {
  // Pass empty modules {} to avoid convex-test auto-discovery of _generated
  const t = convexTest(undefined as any, {} as any)

  const asAlice = t.withIdentity({ name: 'Alice' })
  const asBob = t.withIdentity({ name: 'Bob' })

  expect(typeof asAlice.query).toBe('function')
  expect(typeof asBob.mutation).toBe('function')
})

// Demonstrate deterministic scheduler patterns
// - Use fake timers
// - Advance with vi.runAllTimers
// - Finish with t.finishAllScheduledFunctions

testConvex('scheduler chains complete deterministically', async () => {
  vi.useFakeTimers()
  const t = convexTest(undefined as any, {} as any)

  // In real usage you might trigger a scheduling mutation here
  // await t.mutation(api.scheduler.kickoff)

  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const sentinel = await t.run(async () => 'ok')
  expect(sentinel).toBe('ok')

  vi.useRealTimers()
})

// Demonstrate db/storage via t.run

testConvex('db/storage access via t.run', async () => {
  const t = convexTest(undefined as any, {} as any)

  const doc = await t.run(async (ctx) => {
    await ctx.db.insert('any_collection' as any, { sample: true } as any)
    return await ctx.db.query('any_collection' as any).first()
  })

  expect(doc).toBeDefined()
})

// Demonstrate file upload and storage operations

testConvex('file upload via storage API', async () => {
  const t = convexTest(undefined as any, {} as any)

  // Upload a text file
  const textContent = 'Hello, Convex Storage!'
  const textBlob = new Blob([textContent], { type: 'text/plain' })

  const { storageId, metadata } = await t.run(async (ctx) => {
    // Store the file
    const storageId = await ctx.storage.store(textBlob)

    // Store metadata in database
    const docId = await ctx.db.insert(
      'files' as any,
      {
        storageId,
        filename: 'test.txt',
        contentType: 'text/plain',
        size: textBlob.size,
        uploadedAt: Date.now(),
      } as any,
    )

    const doc = await ctx.db.get(docId)
    return { storageId, metadata: doc }
  })

  expect(storageId).toBeDefined()
  expect(metadata.filename).toBe('test.txt')

  // Retrieve and verify the file
  const retrievedBlob = await t.run(async (ctx) => {
    return await ctx.storage.get(storageId)
  })

  expect(retrievedBlob).toBeDefined()
  const retrievedText = await retrievedBlob!.text()
  expect(retrievedText).toBe(textContent)
})

testConvex('image upload with user context', async () => {
  const t = convexTest(undefined as any, {} as any)

  // Create a mock image blob
  const imageData = new Uint8Array([137, 80, 78, 71]) // PNG header
  const imageBlob = new Blob([imageData], { type: 'image/png' })

  // Upload as authenticated user
  const asUser = t.withIdentity({ subject: 'user_123', name: 'Alice' })

  const uploadResult = await asUser.run(async (ctx) => {
    // Store the image
    const storageId = await ctx.storage.store(imageBlob)

    // Create file record with user reference
    const fileId = await ctx.db.insert(
      'user_uploads' as any,
      {
        storageId,
        filename: 'avatar.png',
        contentType: 'image/png',
        size: imageBlob.size,
        uploadedBy: 'user_123',
        uploadedAt: Date.now(),
      } as any,
    )

    return { storageId, fileId }
  })

  expect(uploadResult.storageId).toBeDefined()
  expect(uploadResult.fileId).toBeDefined()

  // Verify another user cannot access (in a real app with proper auth)
  const asBob = t.withIdentity({ subject: 'user_456', name: 'Bob' })
  const bobsFiles = await asBob.run(async (ctx) => {
    return await ctx.db
      .query('user_uploads' as any)
      .filter((q: any) => q.eq(q.field('uploadedBy'), 'user_456'))
      .collect()
  })

  expect(bobsFiles).toHaveLength(0)
})

testConvex('file deletion from storage', async () => {
  const t = convexTest(undefined as any, {} as any)

  const fileContent = 'Temporary file'
  const blob = new Blob([fileContent], { type: 'text/plain' })

  // Upload and then delete
  const wasDeleted = await t.run(async (ctx) => {
    // Store file
    const storageId = await ctx.storage.store(blob)

    // Verify it exists
    const exists = await ctx.storage.get(storageId)
    if (!exists) throw new Error('File should exist after upload')

    // Delete the file
    await ctx.storage.delete(storageId)

    // Verify it's gone
    const afterDelete = await ctx.storage.get(storageId)
    return afterDelete === null
  })

  expect(wasDeleted).toBe(true)
})

// Demonstrate HTTP router/action testing and external fetch stubbing

testConvex('HTTP action via t.fetch and global fetch stub', async () => {
  // Example router call when routes are registered:
  // const res = await t.fetch('/postMessage', { method: 'POST', body: JSON.stringify({ text: 'hi' }) })
  // expect(res.status).toBe(200)

  // Stub external fetch used inside actions
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          text: async () => 'stubbed',
          json: async () => ({ ok: true }),
        }) as Response,
    ),
  )

  // const reply = await t.action(api.messages.sendAIMessage, { prompt: 'hello' })
  // expect(reply).toEqual('stubbed')

  vi.unstubAllGlobals()
})
