/**
 * MSW server singleton for test environments
 */

import type { RequestHandler } from 'msw'
import type { SetupServer } from 'msw/node'
import { setupServer } from 'msw/node'
import { createMSWConfig, validateMSWConfig, type MSWConfig } from './config'

/**
 * Global MSW server instance
 */
let serverInstance: SetupServer | null = null
let currentConfig: MSWConfig | null = null
// Keep original bootstrap handlers so reset/restore semantics stay intact when rebuilding
let baseHandlersSnapshot: RequestHandler[] = []

/**
 * Create or get the singleton MSW server instance
 */
export function createMSWServer(
  handlers: RequestHandler[] = [],
  config: Partial<MSWConfig> = {},
): SetupServer {
  const nextConfig = createMSWConfig(config)
  validateMSWConfig(nextConfig)

  const shouldRebuild = (() => {
    if (!serverInstance) return true
    if (!currentConfig) return true
    // Rebuild if config keys provided differ OR handlers list changed
    const configChanged = !configMatches(currentConfig, config)
    const handlersChanged = handlers.length > 0 && !sameHandlerSet(baseHandlersSnapshot, handlers)
    return configChanged || handlersChanged
  })()

  if (shouldRebuild) {
    if (serverInstance) {
      serverInstance.close()
    }
    currentConfig = nextConfig
    baseHandlersSnapshot = [...handlers]
    serverInstance = setupServer(...handlers)
  } else if (handlers.length > 0 && sameHandlerSet(baseHandlersSnapshot, handlers)) {
    // Handlers explicitly passed but identical; surface a subtle hint once
    warnOnce(
      'MSW:createMSWServer: Provided handlers identical to existing base set; reusing current server.',
    )
  }

  return serverInstance as SetupServer
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
  if (config) {
    // Merge + persist overrides so getMSWConfig reflects runtime state
    currentConfig = createMSWConfig({ ...(currentConfig || {}), ...config })
    validateMSWConfig(currentConfig)
  }
  if (!currentConfig) throw new Error('No MSW configuration available')

  serverInstance.listen({
    onUnhandledRequest: currentConfig.onUnhandledRequest,
  })

  if (!currentConfig.quiet) {
    console.log(
      `🎭 MSW server started with ${currentConfig.onUnhandledRequest} mode for unhandled requests`,
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
    baseHandlersSnapshot = []
  }
}

/**
 * Check if two configurations are equivalent
 */
function configMatches(config1: MSWConfig, config2: Partial<MSWConfig>): boolean {
  const keys = Object.keys(config2) as Array<keyof MSWConfig>
  if (keys.length === 0) return true // no overrides supplied
  return keys.every((key) => config1[key] === config2[key])
}

function sameHandlerSet(a: RequestHandler[], b: RequestHandler[]): boolean {
  if (a.length !== b.length) return false
  // Compare by toString hash (handler.toString contains method+endpoint)
  const sig = (h: RequestHandler) => String(h)
  const aSigs = a.map(sig).sort()
  const bSigs = b.map(sig).sort()
  return aSigs.every((v, i) => v === bSigs[i])
}

const warnedMessages = new Set<string>()
function warnOnce(message: string): void {
  if (!warnedMessages.has(message)) {
    warnedMessages.add(message)
    console.warn(message)
  }
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
  if (!currentConfig) return
  const previous = currentConfig
  currentConfig = createMSWConfig({ ...currentConfig, ...config })
  validateMSWConfig(currentConfig)

  // Auto-restart if onUnhandledRequest mode changed so new behavior applies immediately
  if (serverInstance && previous.onUnhandledRequest !== currentConfig.onUnhandledRequest) {
    serverInstance.close()
    serverInstance.listen({ onUnhandledRequest: currentConfig.onUnhandledRequest })
    if (!currentConfig.quiet) {
      console.log(
        `🎭 MSW server restarted with ${currentConfig.onUnhandledRequest} mode (config update)`,
      )
    }
  }
}
