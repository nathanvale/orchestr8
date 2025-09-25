import { createConvexTestHarness } from '@orchestr8/testkit/convex'
import { describe, expect, it, vi } from 'vitest'

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const d = RUN_CONVEX ? describe : describe.skip

d('convex: reset and deterministic seeding', () => {
  it('resets between tests and supports seeded runs', async () => {
    const harness = createConvexTestHarness({ debug: false })

    await harness.db.seed(async (ctx) => {
      await ctx.db.insert('items' as any, { name: 'A' } as any)
    })

    const first = await harness.db.run((ctx) => ctx.db.query('items' as any).collect())
    expect(first.length).toBe(1)

    await harness.lifecycle.reset()

    const afterReset = await harness.db.run((ctx) => ctx.db.query('items' as any).collect())
    expect(afterReset.length).toBe(0)

    await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
  })
})
