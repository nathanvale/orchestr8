/**
 * CLI command mocking utilities for testing
 */

// Re-export process mocking utilities
export {
  MockStream,
  MockChildProcess,
  createProcessMocker,
  getGlobalProcessMocker,
  setupProcessMocking,
  processHelpers,
  type ProcessMockConfig,
  type ProcessMocker,
} from './process-mock.js'

// Re-export spawn utilities
export {
  spawnUtils,
  commonCommands,
  mockSpawn,
  quickMocks,
  SpawnMockBuilder,
  type SpawnTestOptions,
  type SpawnTestResult,
} from './spawn.js'
