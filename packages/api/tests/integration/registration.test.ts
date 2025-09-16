import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/index.js'
import { UserModel } from '../../src/models/User.js'

describe('POST /api/users/register', () => {
  beforeEach(() => {
    UserModel.clear()
  })

  it('should register a new user successfully', async () => {
    const response = await request(app).post('/api/users/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User',
    })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
    expect(response.body).toHaveProperty('token')
    expect(response.body.email).toBe('test@example.com')
    expect(response.body.name).toBe('Test User')
    expect(response.body).not.toHaveProperty('passwordHash')
  })

  it('should validate email format', async () => {
    const response = await request(app).post('/api/users/register').send({
      email: 'invalid-email',
      password: 'Password123!',
      name: 'Test User',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })

  it('should validate password strength', async () => {
    const response = await request(app).post('/api/users/register').send({
      email: 'test@example.com',
      password: 'weak',
      name: 'Test User',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })

  it('should prevent duplicate email registration', async () => {
    await request(app).post('/api/users/register').send({
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User',
    })

    const response = await request(app).post('/api/users/register').send({
      email: 'test@example.com',
      password: 'AnotherPass123!',
      name: 'Another User',
    })

    expect(response.status).toBe(409)
    expect(response.body.error.message).toBe('Email already registered')
  })

  it('should validate required fields', async () => {
    const response = await request(app).post('/api/users/register').send({
      email: 'test@example.com',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.message).toBe('Validation failed')
  })

  it('should enforce rate limiting', async () => {
    const requests = []
    for (let i = 0; i < 6; i++) {
      requests.push(
        request(app)
          .post('/api/users/register')
          .send({
            email: `test${i}@example.com`,
            password: 'Password123!',
            name: `Test User ${i}`,
          }),
      )
    }

    const responses = await Promise.all(requests)
    const lastResponse = responses[5]

    expect(lastResponse.status).toBe(429)
    expect(lastResponse.text).toContain('Too many requests')
  })
})
