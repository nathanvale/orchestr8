import { createNetworkIssueHandler, createUnreliableHandler, setupMSW } from '@template/testkit/msw'
import { describe, expect, it } from 'vitest'

setupMSW([
  createUnreliableHandler('*/unstable', { value: 'sometimes' }, 0),
  createNetworkIssueHandler('*/trouble'),
])

describe('msw: unreliable & network issues', () => {
  it('handles intermittent failures', async () => {
    const res = await fetch('http://localhost:3000/unstable')
    // With 0% failure rate, this will always succeed
    const body = await res.json()
    expect(body.value).toBe('sometimes')
  })

  it('simulates network problem variants', async () => {
    const res = await fetch('http://localhost:3000/trouble')
    const body = await res.json()
    expect(body.error.message).toBeTruthy()
  })
})
