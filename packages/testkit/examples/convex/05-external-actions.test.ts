import { createConvexTestHarness } from '@orchestr8/testkit/convex'
import { describe, expect, it, vi } from 'vitest'

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const d = RUN_CONVEX ? describe : describe.skip

d('convex: external action mocking', () => {
  it('stubs global fetch for actions', async () => {
    const harness = createConvexTestHarness()

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

    // In a real project: await harness.convex.action(api.actions.someCall)
    expect(typeof harness.convex.action).toBe('function')

    vi.unstubAllGlobals()
  })
})
