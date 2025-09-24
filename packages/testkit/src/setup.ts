/**
 * Test setup file for testkit
 *
 * This file now delegates to bootstrap.ts which handles all vi.mock declarations
 * and initialization in the correct order.
 */

// Import bootstrap first - this handles all vi.mock declarations
import './bootstrap.js'

// Re-export utilities for convenience
export { getGlobalProcessMocker, setupProcessMocking } from './cli/process-mock.js'
export { getTestEnvironment } from './env/core.js'
