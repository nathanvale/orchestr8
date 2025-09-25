import { createPaginatedHandler, setupMSW } from '@orchestr8/testkit/msw'
import { describe, expect, it } from 'vitest'

const data = Array.from({ length: 13 }, (_, i) => ({ id: `${i + 1}`, value: i }))

setupMSW([createPaginatedHandler('*/api/items', data, 5)])

describe('msw: pagination', () => {
  it('returns expected slice and metadata', async () => {
    const res = await fetch('http://localhost:9999/api/items?page=3&pageSize=5')
    const body = await res.json()
    expect(body.items).toHaveLength(3)
    expect(body.pagination.total).toBe(13)
    expect(body.pagination.page).toBe(3)
    expect(body.pagination.hasNext).toBe(false)
    expect(body.pagination.hasPrev).toBe(true)
  })
})
