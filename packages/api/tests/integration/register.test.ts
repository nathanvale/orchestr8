import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/index.js'

describe('POST /api/users/register', () => {
  const validUserData = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    name: 'Test User',
  }

  beforeEach(() => {
    // Reset any test state if needed
  })

  it('should register a new user successfully', async () => {
    const response = await request(app).post('/api/users/register').send(validUserData).expect(201)

    expect(response.body).toHaveProperty('id')
    expect(response.body).toHaveProperty('email', validUserData.email)
    expect(response.body).toHaveProperty('name', validUserData.name)
    expect(response.body).toHaveProperty('token')
    expect(response.body).not.toHaveProperty('password')
  })

  it('should return 400 for invalid email format', async () => {
    const invalidData = { ...validUserData, email: 'invalid-email' }

    const response = await request(app).post('/api/users/register').send(invalidData).expect(400)

    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR')
    expect(response.body.error.message).toContain('Validation failed')
  })

  it('should return 400 for weak password', async () => {
    const invalidData = { ...validUserData, password: '123' }

    const response = await request(app).post('/api/users/register').send(invalidData).expect(400)

    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR')
  })

  it('should return 409 for duplicate email', async () => {
    // First registration
    await request(app).post('/api/users/register').send(validUserData).expect(201)

    // Attempt duplicate registration
    const response = await request(app).post('/api/users/register').send(validUserData).expect(409)

    expect(response.body.error).toHaveProperty('code', 'CONFLICT')
    expect(response.body.error.message).toContain('Email already registered')
  })

  it('should return 400 for missing required fields', async () => {
    const incompleteData = { email: 'test@example.com' }

    const response = await request(app).post('/api/users/register').send(incompleteData).expect(400)

    expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR')
  })

  it('should sanitize input and prevent XSS', async () => {
    const xssData = {
      ...validUserData,
      name: '<script>alert("xss")</script>Test User',
    }

    const response = await request(app).post('/api/users/register').send(xssData).expect(201)

    expect(response.body.name).not.toContain('<script>')
  })
})
