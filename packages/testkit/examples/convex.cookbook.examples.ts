// Non-executing examples matching the cookbook docs.
// Copy snippets into your Convex project and adjust imports/paths.

/* Auth: scoped identity with withIdentity
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

test('authenticated functions: per-user isolation', async () => {
  const t = convexTest(schema)

  const asSarah = t.withIdentity({ name: 'Sarah' })
  await asSarah.mutation(api.tasks.create, { text: 'Add tests' })

  const sarahs = await asSarah.query(api.tasks.list)
  expect(sarahs).toMatchObject([{ text: 'Add tests' }])

  const asLee = t.withIdentity({ name: 'Lee' })
  const lees = await asLee.query(api.tasks.list)
  expect(lees).toEqual([])
})
*/

/* Seeding: use t.run for fidelity
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'

test('seed initial data', async () => {
  const t = convexTest(schema)

  await t.run(async (ctx) => {
    await ctx.db.insert('users', { name: 'Test', email: 't@example.com' })
    await ctx.db.insert('users', { name: 'Dev', email: 'd@example.com' })
  })

  const users = await t.run((ctx) => ctx.db.query('users').collect())
  expect(users).toHaveLength(2)
})
*/

/* Scheduler + fake timers
import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

test('mutation schedules action and completes', async () => {
  vi.useFakeTimers()
  const t = convexTest(schema)

  const scheduledId = await t.mutation(
    api.scheduler.mutationSchedulingAction,
    { delayMs: 10_000 },
  )

  vi.advanceTimersByTime(10_001)

  await t.finishInProgressScheduledFunctions()

  const status = await t.run((ctx) => ctx.db.get(scheduledId))
  expect(status).toMatchObject({ state: { kind: 'success' } })

  vi.useRealTimers()
})
*/

/* HTTP actions via t.fetch
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'

test('HTTP action handles POST JSON', async () => {
  const t = convexTest(schema)

  const res = await t.fetch('/postMessage', {
    method: 'POST',
    body: JSON.stringify({ author: 'Sam', body: 'Hey' }),
    headers: { 'Content-Type': 'application/json' },
  })

  expect(res.status).toBe(200)
})
*/

// Custom convex folder location (modules)
// /// <reference types="vite/client" />
// export const modules = import.meta.glob('./path/to/files/*.ts')
//
// import { convexTest } from 'convex-test'
// import { test } from 'vitest'
// import schema from './schema'
// import { modules } from './test.setup'
//
// test('some behavior', async () => {
//   const t = convexTest(schema, modules)
//   // ...
// })
