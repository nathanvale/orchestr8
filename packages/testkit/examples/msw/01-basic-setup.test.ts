import { createSuccessResponse, http, setupMSW } from '@orchestr8/testkit/msw'
import { describe, expect, it } from 'vitest'

// Basic server with a simple endpoint
setupMSW([http.get('*/health', () => createSuccessResponse({ ok: true }))])

describe('msw: basic setup', () => {
  it('responds to health endpoint', async () => {
    const res = await fetch('http://localhost:9999/health')
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
