import { createConvexTestHarness } from '@orchestr8/testkit/convex'
import { describe, expect, it, vi } from 'vitest'

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const d = RUN_CONVEX ? describe : describe.skip

d('convex: scheduler helpers', () => {
  it('finishes all scheduled functions with timers', async () => {
    vi.useFakeTimers()
    const harness = createConvexTestHarness()

    // Without generated API, we only exercise finish helpers deterministically
    await harness.scheduler.finishAll(vi.runAllTimers)

    // nothing to assert without api; validate the call completes without error
    expect(true).toBe(true)

    await harness.lifecycle.cleanup({ advanceTimers: vi.runAllTimers })
    vi.useRealTimers()
  })
})
