/**
 * Unified process mock registry singleton
 *
 * This module provides a single registry instance to solve the parallel registry issue.
 * All mock operations go through this singleton to ensure consistent registration/lookup.
 */

import type * as cp from 'node:child_process'
import type { MockChildProcess, ProcessMockConfig } from './process-mock.js'

export interface ProcessMockRegistry {
  spawnMocks: Map<string | RegExp, ProcessMockConfig>
  execMocks: Map<string | RegExp, ProcessMockConfig>
  execSyncMocks: Map<string | RegExp, ProcessMockConfig>
  forkMocks: Map<string | RegExp, ProcessMockConfig>
  execFileMocks: Map<string | RegExp, ProcessMockConfig>
  execFileSyncMocks: Map<string | RegExp, ProcessMockConfig>
  spawnedProcesses: MockChildProcess[]
  execCalls: Array<{ command: string; options?: cp.ExecOptions }>
  execSyncCalls: Array<{ command: string; options?: cp.ExecSyncOptions }>
  forkCalls: Array<{ modulePath: string; args?: string[]; options?: cp.ForkOptions }>
  execFileCalls: Array<{ file: string; args?: string[]; options?: cp.ExecFileOptions }>
  execFileSyncCalls: Array<{ file: string; args?: string[]; options?: cp.ExecFileSyncOptions }>
}

// Use global to ensure single instance across module boundaries
// This is necessary because vitest can create multiple module instances
const REGISTRY_KEY = '__testkit_process_mock_registry__' as const
const LEGACY_REGISTRY_KEY = '__PROCESS_MOCK_REGISTRY__' as const

declare global {
  var __testkit_process_mock_registry__: ProcessMockRegistry | undefined
  // Legacy name used in some tests/assets
  var __PROCESS_MOCK_REGISTRY__: ProcessMockRegistry | undefined
}

function createEmptyRegistry(): ProcessMockRegistry {
  return {
    spawnMocks: new Map(),
    execMocks: new Map(),
    execSyncMocks: new Map(),
    forkMocks: new Map(),
    execFileMocks: new Map(),
    execFileSyncMocks: new Map(),
    spawnedProcesses: [],
    execCalls: [],
    execSyncCalls: [],
    forkCalls: [],
    execFileCalls: [],
    execFileSyncCalls: [],
  }
}

/**
 * Get the singleton registry instance
 * Uses globalThis to ensure single instance across all module boundaries
 */
export function getRegistry(): ProcessMockRegistry {
  let reg = globalThis[REGISTRY_KEY]
  if (!reg) {
    reg = createEmptyRegistry()
    globalThis[REGISTRY_KEY] = reg
    // Keep legacy alias in sync for readers referencing the old name
    globalThis[LEGACY_REGISTRY_KEY] = reg
  }
  // Ensure alias stays in sync if only legacy key exists
  if (!globalThis[LEGACY_REGISTRY_KEY]) {
    globalThis[LEGACY_REGISTRY_KEY] = reg
  }
  return reg
}

/**
 * Clear all call tracking arrays but keep registered mocks
 */
export function clearCalls(): void {
  const registry = getRegistry()
  registry.spawnedProcesses = []
  registry.execCalls = []
  registry.execSyncCalls = []
  registry.forkCalls = []
  registry.execFileCalls = []
  registry.execFileSyncCalls = []
}

/**
 * Reset the entire registry (clear mocks and calls)
 */
export function resetAll(): void {
  const registry = getRegistry()
  registry.spawnMocks.clear()
  registry.execMocks.clear()
  registry.execSyncMocks.clear()
  registry.forkMocks.clear()
  registry.execFileMocks.clear()
  registry.execFileSyncMocks.clear()
  clearCalls()
}

/**
 * Track a call to a mocked function
 */
type ExecCall = { command: string; options?: cp.ExecOptions }
type ExecSyncCall = { command: string; options?: cp.ExecSyncOptions }
type ForkCall = { modulePath: string; args?: string[]; options?: cp.ForkOptions }
type ExecFileCall = { file: string; args?: string[]; options?: cp.ExecFileOptions }
type ExecFileSyncCall = { file: string; args?: string[]; options?: cp.ExecFileSyncOptions }
type TrackCallData = ExecCall | ExecSyncCall | ForkCall | ExecFileCall | ExecFileSyncCall

export function trackCall(
  type: 'exec' | 'execSync' | 'fork' | 'execFile' | 'execFileSync',
  data: TrackCallData,
): void {
  const registry = getRegistry()
  switch (type) {
    case 'exec':
      registry.execCalls.push(data as ExecCall)
      break
    case 'execSync':
      registry.execSyncCalls.push(data as ExecSyncCall)
      break
    case 'fork':
      registry.forkCalls.push(data as ForkCall)
      break
    case 'execFile':
      registry.execFileCalls.push(data as ExecFileCall)
      break
    case 'execFileSync':
      registry.execFileSyncCalls.push(data as ExecFileSyncCall)
      break
  }
}

/**
 * Track a spawned process
 */
export function trackProcess(proc: MockChildProcess): void {
  const registry = getRegistry()
  registry.spawnedProcesses.push(proc)
}

// Legacy compatibility functions
export function getSpawnedProcesses(): MockChildProcess[] {
  return getRegistry().spawnedProcesses
}

export function getExecCalls(): Array<{ command: string; options?: cp.ExecOptions }> {
  return getRegistry().execCalls
}

export function getExecSyncCalls(): Array<{ command: string; options?: cp.ExecSyncOptions }> {
  return getRegistry().execSyncCalls
}

export function getForkCalls(): Array<{
  modulePath: string
  args?: string[]
  options?: cp.ForkOptions
}> {
  return getRegistry().forkCalls
}

export function getExecFileCalls(): Array<{
  file: string
  args?: string[]
  options?: cp.ExecFileOptions
}> {
  return getRegistry().execFileCalls
}

export function getExecFileSyncCalls(): Array<{
  file: string
  args?: string[]
  options?: cp.ExecFileSyncOptions
}> {
  return getRegistry().execFileSyncCalls
}
