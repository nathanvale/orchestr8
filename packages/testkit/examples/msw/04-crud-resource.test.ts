import { createCRUDHandlers, HTTP_STATUS, setupMSW } from '@template/testkit/msw'
import { describe, expect, it } from 'vitest'

type Note = { id: string; text: string }

setupMSW([...createCRUDHandlers<Note>('notes', [{ id: '1', text: 'hello' }])])

describe('msw: crud resource', () => {
  it('lists notes', async () => {
    const res = await fetch('http://localhost:3000/notes')
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it('creates a note', async () => {
    const res = await fetch('http://localhost:3000/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'second' }),
    })
    expect(res.status).toBe(HTTP_STATUS.CREATED)
    const body = await res.json()
    expect(body.text).toBe('second')
  })
})
