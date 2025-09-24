/**
 * Vitest global setup for MSW
 * Configures Mock Service Worker for all test suites
 */

import { setupServer } from 'msw/node'
import { defaultHandlers } from './src/msw/handlers'

// Global MSW server instance
let globalServer: ReturnType<typeof setupServer> | null = null

/**
 * Global MSW setup function
 * Called once before all test suites run
 */
export async function setup() {
  // Create and start MSW server with default handlers
  globalServer = setupServer(...defaultHandlers)
  globalServer.listen({
    onUnhandledRequest: 'error',
  })

  console.log('🎭 MSW global setup complete')
}

/**
 * Global MSW teardown function
 * Called once after all test suites complete
 */
export async function teardown() {
  if (globalServer) {
    // Stop the MSW server
    globalServer.close()
    globalServer = null
  }

  console.log('🎭 MSW global teardown complete')
}
