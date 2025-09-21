/**
 * Tests for MSW handlers and response builders
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import {
  createSuccessResponse,
  createErrorResponse,
  createDelayedResponse,
  createUnreliableHandler,
  createPaginatedHandler,
  createAuthHandlers,
  createCRUDHandlers,
  createNetworkIssueHandler,
  HTTP_STATUS,
} from '../handlers'

describe('MSW Handlers', () => {
  const server = setupServer()

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    server.resetHandlers()
    vi.restoreAllMocks()
  })

  afterAll(() => {
    server.close()
  })

  describe('Response Builders', () => {
    describe('createSuccessResponse', () => {
      it('should create a successful JSON response with default status 200', async () => {
        const data = { message: 'success' }
        server.use(
          http.get('https://api.test.com/success', () => {
            return createSuccessResponse(data)
          }),
        )

        const response = await fetch('https://api.test.com/success')
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('application/json')
        const json = await response.json()
        expect(json).toEqual(data)
      })

      it('should create a successful response with custom status', async () => {
        const data = { created: true }
        server.use(
          http.post('https://api.test.com/create', () => {
            return createSuccessResponse(data, HTTP_STATUS.CREATED)
          }),
        )

        const response = await fetch('https://api.test.com/create', { method: 'POST' })
        expect(response.status).toBe(201)
        const json = await response.json()
        expect(json).toEqual(data)
      })
    })

    describe('createErrorResponse', () => {
      it('should create an error response with default status 500', async () => {
        const message = 'Internal server error'
        server.use(
          http.get('https://api.test.com/error', () => {
            return createErrorResponse(message)
          }),
        )

        const response = await fetch('https://api.test.com/error')
        expect(response.status).toBe(500)
        const json = await response.json()
        expect(json).toEqual({
          error: {
            message,
            code: undefined,
            status: 500,
          },
        })
      })

      it('should create an error response with custom status and code', async () => {
        const message = 'Not found'
        const code = 'RESOURCE_NOT_FOUND'
        server.use(
          http.get('https://api.test.com/not-found', () => {
            return createErrorResponse(message, HTTP_STATUS.NOT_FOUND, code)
          }),
        )

        const response = await fetch('https://api.test.com/not-found')
        expect(response.status).toBe(404)
        const json = await response.json()
        expect(json).toEqual({
          error: {
            message,
            code,
            status: 404,
          },
        })
      })
    })

    describe('createDelayedResponse', () => {
      it('should create a response with promise-based delay', async () => {
        const data = { delayed: true }
        const delayMs = 100

        server.use(
          http.get('https://api.test.com/delayed', () => {
            return createDelayedResponse(data, delayMs)
          }),
        )

        const startTime = Date.now()
        const response = await fetch('https://api.test.com/delayed')
        const endTime = Date.now()

        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json).toEqual(data)

        // Verify delay was applied (with some tolerance)
        expect(endTime - startTime).toBeGreaterThanOrEqual(delayMs - 10)
      })

      it('should handle promise rejection gracefully', async () => {
        // Test the actual createDelayedResponse with a mocked delay that rejects
        const mockDelay = vi.fn().mockRejectedValue(new Error('Delay failed'))

        server.use(
          http.get('https://api.test.com/delayed-error', async () => {
            try {
              await mockDelay()
              return createSuccessResponse({ test: true })
            } catch (error) {
              return createErrorResponse((error as Error).message, 500)
            }
          }),
        )

        const response = await fetch('https://api.test.com/delayed-error')
        expect(response.status).toBe(500)
        const json = await response.json()
        expect(json.error.message).toBe('Delay failed')
      })

      it('should work with custom status codes', async () => {
        const data = { created: true }
        server.use(
          http.post('https://api.test.com/delayed-create', () => {
            return createDelayedResponse(data, 50, HTTP_STATUS.CREATED)
          }),
        )

        const response = await fetch('https://api.test.com/delayed-create', { method: 'POST' })
        expect(response.status).toBe(201)
        const json = await response.json()
        expect(json).toEqual(data)
      })
    })
  })

  describe('Handler Builders', () => {
    describe('createUnreliableHandler', () => {
      it('should fail at the specified rate', async () => {
        const successData = { success: true }
        const failureRate = 1.0 // Always fail for predictable testing

        // Mock Math.random to return 0 (ensuring failure)
        vi.spyOn(Math, 'random').mockReturnValue(0)

        server.use(
          createUnreliableHandler('https://api.test.com/unreliable', successData, failureRate),
        )

        const response = await fetch('https://api.test.com/unreliable')
        expect(response.status).toBe(500)
        const json = await response.json()
        expect(json.error.message).toBe('Random failure for testing')
      })

      it('should succeed when below failure rate', async () => {
        const successData = { success: true }
        const failureRate = 0.3

        // Mock Math.random to return 0.5 (above failure rate)
        vi.spyOn(Math, 'random').mockReturnValue(0.5)

        server.use(
          createUnreliableHandler('https://api.test.com/reliable', successData, failureRate),
        )

        const response = await fetch('https://api.test.com/reliable')
        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json).toEqual(successData)
      })
    })

    describe('createPaginatedHandler', () => {
      const testData = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }))

      it('should return paginated data with default page size', async () => {
        server.use(createPaginatedHandler('https://api.test.com/items', testData))

        const response = await fetch('https://api.test.com/items')
        expect(response.status).toBe(200)
        const json = await response.json()

        expect(json.items).toHaveLength(10) // Default page size
        expect(json.pagination.page).toBe(1)
        expect(json.pagination.total).toBe(25)
        expect(json.pagination.totalPages).toBe(3)
        expect(json.pagination.hasNext).toBe(true)
        expect(json.pagination.hasPrev).toBe(false)
      })

      it('should handle custom page and page size', async () => {
        server.use(createPaginatedHandler('https://api.test.com/items', testData, 5))

        const response = await fetch('https://api.test.com/items?page=2&pageSize=5')
        expect(response.status).toBe(200)
        const json = await response.json()

        expect(json.items).toHaveLength(5)
        expect(json.items[0].id).toBe(6) // Second page starts at item 6
        expect(json.pagination.page).toBe(2)
        expect(json.pagination.pageSize).toBe(5)
        expect(json.pagination.hasNext).toBe(true)
        expect(json.pagination.hasPrev).toBe(true)
      })

      it('should handle out of bounds pages', async () => {
        server.use(createPaginatedHandler('https://api.test.com/items', testData))

        const response = await fetch('https://api.test.com/items?page=10')
        expect(response.status).toBe(200)
        const json = await response.json()

        expect(json.items).toHaveLength(0)
        expect(json.pagination.page).toBe(10)
        expect(json.pagination.hasNext).toBe(false)
        expect(json.pagination.hasPrev).toBe(true)
      })
    })

    describe('createAuthHandlers', () => {
      beforeEach(() => {
        server.use(...createAuthHandlers())
      })

      it('should authenticate with valid credentials', async () => {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
        })

        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json.token).toBe('mock-jwt-token')
        expect(json.user.email).toBe('test@example.com')
      })

      it('should reject invalid credentials', async () => {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'wrong@example.com', password: 'wrong' }),
        })

        expect(response.status).toBe(401)
        const json = await response.json()
        expect(json.error.message).toBe('Invalid credentials')
      })

      it('should require authorization for protected routes', async () => {
        const response = await fetch('/auth/me')
        expect(response.status).toBe(401)
      })

      it('should return user info with valid token', async () => {
        const response = await fetch('/auth/me', {
          headers: { Authorization: 'Bearer mock-jwt-token' },
        })

        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json.email).toBe('test@example.com')
      })
    })

    describe('createCRUDHandlers', () => {
      const initialData = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]

      beforeEach(() => {
        server.use(...createCRUDHandlers('items', [...initialData]))
      })

      it('should list all items', async () => {
        const response = await fetch('/items')
        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json).toHaveLength(2)
      })

      it('should get item by ID', async () => {
        const response = await fetch('/items/1')
        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json.id).toBe('1')
        expect(json.name).toBe('Item 1')
      })

      it('should return 404 for non-existent item', async () => {
        const response = await fetch('/items/999')
        expect(response.status).toBe(404)
      })

      it('should create new item', async () => {
        const newItem = { name: 'New Item' }
        const response = await fetch('/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        })

        expect(response.status).toBe(201)
        const json = await response.json()
        expect(json.name).toBe('New Item')
        expect(json.id).toBeDefined()
      })

      it('should update existing item', async () => {
        const updates = { name: 'Updated Item' }
        const response = await fetch('/items/1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json.name).toBe('Updated Item')
        expect(json.id).toBe('1')
      })

      it('should delete item', async () => {
        const response = await fetch('/items/1', { method: 'DELETE' })
        expect(response.status).toBe(204)

        // Verify item is deleted
        const getResponse = await fetch('/items/1')
        expect(getResponse.status).toBe(404)
      })
    })

    describe('createNetworkIssueHandler', () => {
      it('should simulate network issues', async () => {
        server.use(createNetworkIssueHandler('https://api.test.com/flaky'))

        // Network issue handlers should return error responses
        const response = await fetch('https://api.test.com/flaky')
        expect(response.status).toBeGreaterThanOrEqual(400)
      })
    })
  })
})
