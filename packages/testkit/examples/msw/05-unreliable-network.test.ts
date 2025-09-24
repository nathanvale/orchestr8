import { createNetworkIssueHandler, createUnreliableHandler, setupMSW } from '@template/testkit/msw'
import { describe, expect, it } from 'vitest'

setupMSW([
  createUnreliableHandler('*/unstable', { value: 'sometimes' }, 0.99),
  createNetworkIssueHandler('*/trouble'),
])

describe('msw: unreliable & network issues', () => {
  it('handles intermittent failures', async () => {
    const res = await fetch('http://localhost:3000/unstable')
    // We cannot assert success deterministically; we just ensure a JSON shape
    const body = await res.json().catch(() => null)
    expect(body === null || body.value === 'sometimes').toBe(true)
  })

  it('simulates network problem variants', async () => {
    const res = await fetch('http://localhost:3000/trouble')
    const body = await res.json()
    expect(body.error.message).toBeTruthy()
  })
})
