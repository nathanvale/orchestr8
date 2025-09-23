import { describe, it, expect } from 'vitest'
import { createConvexTestHarness } from '@template/testkit/convex'

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const d = RUN_CONVEX ? describe : describe.skip

// These examples prefer generated Convex files; gate behind env like other examples

d('convex: seed and query', () => {
  it('seeds and queries collection via db.run', async () => {
    const harness = createConvexTestHarness()

    await harness.db.seed(async (ctx) => {
      await ctx.db.insert('users' as any, { name: 'Test', email: 't@example.com' } as any)
      await ctx.db.insert('users' as any, { name: 'Dev', email: 'd@example.com' } as any)
    })

    const users = await harness.db.run(async (ctx) => {
      return await ctx.db.query('users' as any).collect()
    })

    expect(users.length).toBe(2)
  })
})
