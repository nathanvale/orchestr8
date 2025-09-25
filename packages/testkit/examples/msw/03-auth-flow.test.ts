import { createAuthHandlers, HTTP_STATUS, setupMSW } from '@orchestr8/testkit/msw'
import { describe, expect, it } from 'vitest'

setupMSW([...createAuthHandlers('http://localhost:3000')])

describe('msw: auth flow', () => {
  it('logs in and fetches profile', async () => {
    const login = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    })
    const loginJson = await login.json()
    expect(loginJson.token).toBeTruthy()

    const me = await fetch('http://localhost:3000/auth/me', {
      headers: { Authorization: `Bearer ${loginJson.token}` },
    })
    const meJson = await me.json()
    expect(meJson.email).toBe('test@example.com')
  })

  it('rejects invalid credentials', async () => {
    const bad = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong', password: 'nope' }),
    })
    expect(bad.status).toBe(HTTP_STATUS.UNAUTHORIZED)
    const body = await bad.json()
    expect(body.error.message).toMatch(/invalid/i)
  })
})
