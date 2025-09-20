/**
 * Test setup file for testkit
 * Configures vi.mock for child_process using the factory pattern
 */

import { vi } from 'vitest'
import { createChildProcessMock } from './cli/mock-factory.js'

// Mock both module specifiers for child_process
// This ensures mocks are created at declaration time, not runtime
vi.mock('child_process', () => createChildProcessMock())
vi.mock('node:child_process', () => createChildProcessMock())

// Export for convenience
export { getGlobalProcessMocker, setupProcessMocking } from './cli/process-mock.js'
export { getProcessMockRegistry, clearMockRegistry } from './cli/mock-factory.js'
