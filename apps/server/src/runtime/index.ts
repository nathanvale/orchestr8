import { bunRuntime } from './bun-adapter'
import { nodeRuntime } from './node-adapter'
import type { Runtime } from './types'

/**
 * Creates a runtime adapter based on the current environment
 *
 * - Returns Bun adapter when Bun.serve is available (production)
 * - Returns Node.js adapter otherwise (testing with Vitest)
 */
export function createRuntime(): Runtime {
  // Check if we're running in Bun environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  if (typeof (globalThis as any).Bun?.serve === 'function') {
    return bunRuntime()
  }

  // Fallback to Node.js adapter for testing
  return nodeRuntime()
}

// Re-export types and adapters for testing
export { bunRuntime } from './bun-adapter'
export { nodeRuntime } from './node-adapter'
export type { Runtime, RuntimeServer, ServeOptions } from './types'
