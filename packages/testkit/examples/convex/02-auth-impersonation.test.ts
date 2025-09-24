import { createConvexTestHarness } from '@template/testkit/convex'
import { describe, expect, it } from 'vitest'

const RUN_CONVEX = process.env.CONVEX_GENERATED === 'true'
const d = RUN_CONVEX ? describe : describe.skip

d('convex: auth impersonation (fluent)', () => {
  it('creates separate contexts per user', async () => {
    const harness = createConvexTestHarness()

    const asAlice = harness.auth.withUser({ subject: 'alice', issuer: 'test' })
    const asBob = harness.auth.withUser({ subject: 'bob', issuer: 'test' })

    // In real code, you would call your generated API (queries/mutations).
    // For this runnable example, just assert convex-test instance methods exist.
    expect(typeof asAlice.query).toBe('function')
    expect(typeof asBob.mutation).toBe('function')
  })
})
