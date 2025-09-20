/**
 * Common MSW handlers and utilities for API mocking
 */

import { http, HttpResponse, delay } from 'msw'
import type { RequestHandler } from 'msw'

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

/**
 * Common response headers
 */
export const COMMON_HEADERS = {
  JSON: { 'Content-Type': 'application/json' },
  TEXT: { 'Content-Type': 'text/plain' },
  HTML: { 'Content-Type': 'text/html' },
  CORS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
} as const

/**
 * Create a successful JSON response
 */
export function createSuccessResponse(
  data: Record<string, unknown> | unknown[],
  status: number = HTTP_STATUS.OK,
) {
  return HttpResponse.json(data, {
    status,
    headers: COMMON_HEADERS.JSON,
  })
}

/**
 * Create an error response
 */
export function createErrorResponse(
  message: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  code?: string,
) {
  return HttpResponse.json(
    {
      error: {
        message,
        code,
        status,
      },
    },
    {
      status,
      headers: COMMON_HEADERS.JSON,
    },
  )
}

/**
 * Create a delayed response (useful for testing loading states)
 */
export function createDelayedResponse(
  data: Record<string, unknown> | unknown[],
  delayMs = 1000,
  status: number = HTTP_STATUS.OK,
) {
  return delay(delayMs).then(() => createSuccessResponse(data, status))
}

/**
 * Create a handler that randomly fails (useful for testing error handling)
 */
export function createUnreliableHandler(
  endpoint: string,
  successData: Record<string, unknown> | unknown[],
  failureRate = 0.3,
  method: 'get' | 'post' | 'put' | 'delete' | 'patch' = 'get',
): RequestHandler {
  return http[method](endpoint, async () => {
    if (Math.random() < failureRate) {
      return createErrorResponse('Random failure for testing', HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
    return createSuccessResponse(successData)
  })
}

/**
 * Create a paginated response handler
 */
export function createPaginatedHandler<T>(
  endpoint: string,
  allData: T[],
  defaultPageSize = 10,
): RequestHandler {
  return http.get(endpoint, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') || defaultPageSize.toString(), 10)

    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const items = allData.slice(startIndex, endIndex)

    return createSuccessResponse({
      items,
      pagination: {
        page,
        pageSize,
        total: allData.length,
        totalPages: Math.ceil(allData.length / pageSize),
        hasNext: endIndex < allData.length,
        hasPrev: page > 1,
      },
    })
  })
}

/**
 * Create authentication handlers
 */
export function createAuthHandlers(baseUrl = ''): RequestHandler[] {
  return [
    // Login handler
    http.post(`${baseUrl}/auth/login`, async ({ request }) => {
      const body = (await request.json()) as { email: string; password: string }

      if (body.email === 'test@example.com' && body.password === 'password') {
        return createSuccessResponse({
          token: 'mock-jwt-token',
          user: {
            id: '1',
            email: body.email,
            name: 'Test User',
          },
        })
      }

      return createErrorResponse('Invalid credentials', HTTP_STATUS.UNAUTHORIZED)
    }),

    // Protected route handler
    http.get(`${baseUrl}/auth/me`, ({ request }) => {
      const authHeader = request.headers.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse(
          'Missing or invalid authorization header',
          HTTP_STATUS.UNAUTHORIZED,
        )
      }

      const token = authHeader.replace('Bearer ', '')
      if (token !== 'mock-jwt-token') {
        return createErrorResponse('Invalid token', HTTP_STATUS.UNAUTHORIZED)
      }

      return createSuccessResponse({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      })
    }),

    // Logout handler
    http.post(`${baseUrl}/auth/logout`, () => {
      return HttpResponse.json(null, { status: HTTP_STATUS.NO_CONTENT })
    }),
  ]
}

/**
 * Create CRUD handlers for a resource
 */
export function createCRUDHandlers<T extends { id: string }>(
  resourceName: string,
  initialData: T[] = [],
  baseUrl = '',
): RequestHandler[] {
  const data = [...initialData]

  return [
    // List/Get all
    http.get(`${baseUrl}/${resourceName}`, () => {
      return createSuccessResponse(data)
    }),

    // Get by ID
    http.get(`${baseUrl}/${resourceName}/:id`, ({ params }) => {
      const item = data.find((d) => d.id === params.id)
      if (!item) {
        return createErrorResponse(`${resourceName} not found`, HTTP_STATUS.NOT_FOUND)
      }
      return createSuccessResponse(item)
    }),

    // Create
    http.post(`${baseUrl}/${resourceName}`, async ({ request }) => {
      const newItem = (await request.json()) as Omit<T, 'id'> & { id?: string }
      const item = {
        ...newItem,
        id: newItem.id || `${Date.now()}`,
      } as T
      data.push(item)
      return createSuccessResponse(item, HTTP_STATUS.CREATED)
    }),

    // Update
    http.put(`${baseUrl}/${resourceName}/:id`, async ({ params, request }) => {
      const index = data.findIndex((d) => d.id === params.id)
      if (index === -1) {
        return createErrorResponse(`${resourceName} not found`, HTTP_STATUS.NOT_FOUND)
      }
      const updates = (await request.json()) as Partial<T>
      data[index] = { ...data[index], ...updates }
      return createSuccessResponse(data[index])
    }),

    // Delete
    http.delete(`${baseUrl}/${resourceName}/:id`, ({ params }) => {
      const index = data.findIndex((d) => d.id === params.id)
      if (index === -1) {
        return createErrorResponse(`${resourceName} not found`, HTTP_STATUS.NOT_FOUND)
      }
      data.splice(index, 1)
      return HttpResponse.json(null, { status: HTTP_STATUS.NO_CONTENT })
    }),
  ]
}

/**
 * Create a handler that simulates network issues
 */
export function createNetworkIssueHandler(
  endpoint: string,
  method: 'get' | 'post' | 'put' | 'delete' | 'patch' = 'get',
): RequestHandler {
  return http[method](endpoint, async () => {
    // Simulate various network issues
    const issues = [
      () => delay(5000).then(() => createErrorResponse('Request timeout', 408)),
      () => createErrorResponse('Service unavailable', HTTP_STATUS.SERVICE_UNAVAILABLE),
      () => createErrorResponse('Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR),
    ]

    const randomIssue = issues[Math.floor(Math.random() * issues.length)]
    return randomIssue?.()
  })
}

/**
 * Default handlers for common scenarios
 */
export const defaultHandlers: RequestHandler[] = [
  // Health check endpoint
  http.get('*/health', () => {
    return createSuccessResponse({ status: 'ok', timestamp: new Date().toISOString() })
  }),

  // Default 404 for unmatched routes
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return createErrorResponse(
      `Route not found: ${request.method} ${request.url}`,
      HTTP_STATUS.NOT_FOUND,
    )
  }),
]
