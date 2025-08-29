import { nodeRuntime } from './node-adapter'
import type { Runtime } from './types'

/**
 * Creates a runtime adapter based on the current environment
 *
 * - Returns Node.js adapter by default (pnpm migration)
 * - Can still use Bun adapter if explicitly requested
 */
export function createRuntime(): Runtime {
  // Always use Node.js adapter after pnpm migration
  return nodeRuntime()
}

// Re-export types and adapters for testing
export { bunRuntime } from './bun-adapter'
export { nodeRuntime } from './node-adapter'
export type { Runtime, RuntimeServer, ServeOptions } from './types'
