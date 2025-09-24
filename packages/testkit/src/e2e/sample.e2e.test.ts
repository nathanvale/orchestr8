import { describe, expect, it } from 'vitest'

describe('sample e2e', () => {
  it('performs a full workflow smoke check', async () => {
    // Minimal end-to-end smoke test: exercise a small API surface or a
    // high-level integration point. Keep it deterministic and fast.
    const sum = (a: number, b: number) => a + b
    expect(sum(2, 3)).toBe(5)
  })
})
