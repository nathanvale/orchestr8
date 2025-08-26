import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import type { HttpHandler } from 'msw'

// Mock handlers for common API patterns
const defaultHandlers: HttpHandler[] = [
  // Example API handlers
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),
  
  http.get('/api/user/:id', ({ params }) => {
    const { id } = params
    return HttpResponse.json({
      id,
      name: `Test User ${id}`,
      email: `test${id}@example.com`
    })
  }),
  
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: '1', name: 'Test User' }
    })
  })
]

// Setup MSW server
export const server = setupServer(...defaultHandlers)

// Global setup and teardown
beforeAll(() => {
  // Start MSW server
  server.listen({
    onUnhandledRequest: 'warn' // Log unhandled requests in development
  })
  
  // Mock common browser APIs
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  
  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
  
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })
  
  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock
  })
  
  // Mock fetch (fallback if MSW doesn't handle it)
  global.fetch = vi.fn()
  
  // Setup console mocking for cleaner test output
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
  vi.clearAllTimers()
})

afterEach(() => {
  // Reset any request handlers that may have been added during tests
  server.resetHandlers()
})

afterAll(() => {
  // Clean up MSW server
  server.close()
  
  // Restore all mocks
  vi.restoreAllMocks()
})

// Utility functions for test setup
export const mockApiResponse = (url: string, response: any, status = 200) => {
  server.use(
    http.get(url, () => {
      return HttpResponse.json(response, { status })
    })
  )
}

export const mockApiError = (url: string, status = 500, message = 'Server Error') => {
  server.use(
    http.get(url, () => {
      return HttpResponse.json({ error: message }, { status })
    })
  )
}

// React Testing Library configuration
import '@testing-library/jest-dom/vitest' // Add jest-dom matchers

// Custom render function for React components  
import { render as rtlRender, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import React from 'react'

// Wrapper component for providers (customize as needed)
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  // Add your providers here (Router, Theme, Context, etc.)
  return <>{children}</>
}

export const render = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => rtlRender(ui, { wrapper: AllTheProviders, ...options })

// Export all testing utilities
export * from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'