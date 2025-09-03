/**
 * MSW server setup for testing
 * Configures mock service worker for API testing
 */

import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { handlers } from './handlers'

// Setup MSW server with our handlers
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
})

// Stop server after all tests
afterAll(() => {
  server.close()
})
