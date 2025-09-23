import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'
const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const testConvex = RUN_CONVEX ? test : test.skip

// Minimal example showing Convex best practices:
// - Identity via t.withIdentity
// - Scheduler using fake timers + finishAllScheduledFunctions
// - Storage/db access via t.run
// - HTTP router testing via t.fetch

// If you have a schema and generated API, import them:
// import schema from './schema'
// import { api } from './_generated/api'

// For this template, we use convexTest() without schema to keep it runnable.

testConvex('identity isolation with withIdentity', async () => {
  const t = convexTest()

  const asSarah = t.withIdentity({ name: 'Sarah' })
  // Example public mutation call if you have an API:
  // await asSarah.mutation(api.tasks.create, { text: 'Add tests' })
  // const sarahsTasks = await asSarah.query(api.tasks.list)
  // expect(sarahsTasks).toMatchObject([{ text: 'Add tests' }])

  const asLee = t.withIdentity({ name: 'Lee' })
  // const leesTasks = await asLee.query(api.tasks.list)
  // expect(leesTasks).toEqual([])

  // This sample is illustrative; replace with your generated API calls
  expect(typeof asSarah.query).toBe('function')
  expect(typeof asLee.mutation).toBe('function')
})

testConvex('scheduler chains complete deterministically', async () => {
  vi.useFakeTimers()
  const t = convexTest()

  // Example if you had a function that schedules work:
  // await t.mutation(api.scheduler.kickoff)

  // For chains, use finishAllScheduledFunctions with a timer advancer
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  // Inspect with t.run when you need direct db access
  const result = await t.run(async (_ctx) => {
    // Example: return await ctx.db.query('tasks').first()
    return 'ok'
  })
  expect(result).toBe('ok')

  vi.useRealTimers()
})

testConvex('storage & db via t.run', async () => {
  const t = convexTest()

  const value = await t.run(async (ctx) => {
    // Example storage write/read when your schema enables it:
    // const id = await ctx.storage.generateUploadUrl()
    // return id
    await ctx.db.insert('any_collection' as any, { sample: true } as any)
    return await ctx.db.query('any_collection' as any).first()
  })

  // In a real project, assert real shapes
  expect(value).toBeDefined()
})

testConvex('HTTP router via t.fetch or stubbed fetch for external APIs', async () => {
  // Router testing example (when you have registered routes):
  // const t = convexTest()
  // const res = await t.fetch('/api/some-route', { method: 'POST' })
  // expect(res.status).toBe(200)

  // External API calls from actions can be stubbed
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
