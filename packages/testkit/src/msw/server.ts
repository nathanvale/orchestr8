/**
 * MSW server singleton for test environments
 */

import { setupServer } from 'msw/node'
import type { SetupServer } from 'msw/node'
import type { RequestHandler } from 'msw'
import { createMSWConfig, validateMSWConfig, type MSWConfig } from './config'

/**
 * Global MSW server instance
 */
let serverInstance: SetupServer | null = null
let currentConfig: MSWConfig | null = null

/**
 * Create or get the singleton MSW server instance
 */
export function createMSWServer(
  handlers: RequestHandler[] = [],
  config: Partial<MSWConfig> = {},
): SetupServer {
  // If server exists and config hasn't changed, return existing instance
  if (serverInstance && currentConfig && configMatches(currentConfig, config)) {
    return serverInstance
  }

  // Close existing server if it exists
  if (serverInstance) {
    serverInstance.close()
  }

  // Create new configuration
  currentConfig = createMSWConfig(config)
  validateMSWConfig(currentConfig)

  // Create new server instance
  serverInstance = setupServer(...handlers)

  return serverInstance
}

/**
 * Get the current MSW server instance
 */
export function getMSWServer(): SetupServer | null {
  return serverInstance
}

/**
 * Start the MSW server with proper configuration
 */
export function startMSWServer(config?: Partial<MSWConfig>): void {
  if (!serverInstance) {
    throw new Error('MSW server not created. Call createMSWServer() first.')
  }

  const finalConfig = config ? createMSWConfig(config) : currentConfig
  if (!finalConfig) {
    throw new Error('No MSW configuration available')
  }

  serverInstance.listen({
    onUnhandledRequest: finalConfig.onUnhandledRequest,
  })

  if (!finalConfig.quiet) {
    console.log(
      `🎭 MSW server started with ${finalConfig.onUnhandledRequest} mode for unhandled requests`,
    )
  }
}

/**
 * Stop the MSW server
 */
export function stopMSWServer(): void {
  if (serverInstance) {
    serverInstance.close()
    if (currentConfig && !currentConfig.quiet) {
      console.log('🎭 MSW server stopped')
    }
  }
}

/**
 * Reset MSW handlers to their initial state
 */
export function resetMSWHandlers(): void {
  if (serverInstance) {
    serverInstance.resetHandlers()
  }
}

/**
 * Add new handlers to the MSW server
 */
export function addMSWHandlers(...handlers: RequestHandler[]): void {
  if (serverInstance) {
    serverInstance.use(...handlers)
  }
}

/**
 * Restore original handlers (remove runtime handlers)
 */
export function restoreMSWHandlers(): void {
  if (serverInstance) {
    serverInstance.restoreHandlers()
  }
}

/**
 * Clean up and dispose of the MSW server
 */
export function disposeMSWServer(): void {
  if (serverInstance) {
    serverInstance.close()
    serverInstance = null
    currentConfig = null
  }
}

/**
 * Check if two configurations are equivalent
 */
function configMatches(config1: MSWConfig, config2: Partial<MSWConfig>): boolean {
  const keys = Object.keys(config2) as Array<keyof MSWConfig>
  return keys.every((key) => config1[key] === config2[key])
}

/**
 * Get current MSW configuration
 */
export function getMSWConfig(): MSWConfig | null {
  return currentConfig
}

/**
 * Update MSW configuration (requires server restart)
 */
export function updateMSWConfig(config: Partial<MSWConfig>): void {
  if (currentConfig) {
    currentConfig = createMSWConfig({ ...currentConfig, ...config })
    validateMSWConfig(currentConfig)
  }
}
