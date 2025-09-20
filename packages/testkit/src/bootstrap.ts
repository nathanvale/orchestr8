/**
 * Testkit Bootstrap Module
 *
 * This module MUST be imported before any test code to ensure proper mock initialization.
 * It consolidates all vi.mock declarations and registry initialization in one place,
 * guaranteeing correct import order and preventing timing-sensitive failures.
 *
 * Usage:
 * - Automatically loaded via setupFiles in vitest.config.ts
 * - Or manually import at the top of test files: import '@template/testkit/bootstrap'
 */

import { vi } from 'vitest'
import { createChildProcessMock } from './cli/mock-factory.js'
import { clearMockRegistry } from './cli/mock-factory.js'

// ============================================================================
// STEP 1: Vi.mock Declarations
// All vi.mock calls must happen here, before any other imports
// ============================================================================

// Child process mocking (from Task 013)
vi.mock('child_process', () => createChildProcessMock())
vi.mock('node:child_process', () => createChildProcessMock())

// Future mock declarations will go here:
// vi.mock('fs', () => createFsMock())
// vi.mock('node:fs', () => createFsMock())
// vi.mock('path', () => createPathMock())
// vi.mock('node:path', () => createPathMock())

// ============================================================================
// STEP 2: Registry Initialization
// Initialize all mock registries in the correct order
// ============================================================================

// Clear any previous mock configurations
clearMockRegistry()

// Initialize other registries as they are created
// initializeFsRegistry()
// initializePathRegistry()

// ============================================================================
// STEP 3: Bootstrap Validation
// Ensure bootstrap only loads once and in the correct order
// ============================================================================

declare global {
  var __TESTKIT_BOOTSTRAP_LOADED: boolean | undefined
  var __TESTKIT_BOOTSTRAP_LOAD_COUNT: number | undefined
  interface Window {
    happyDOM?: unknown
    HTMLDocument?: unknown
  }
}

// Track bootstrap loading
if (globalThis.__TESTKIT_BOOTSTRAP_LOADED) {
  globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT = (globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT || 1) + 1
  console.warn(
    `⚠️ Testkit bootstrap loaded ${globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT} times!\n` +
      'This may indicate:\n' +
      '  - Multiple imports of bootstrap\n' +
      '  - Incorrect setupFiles configuration\n' +
      '  - Tests importing bootstrap directly when using setupFiles\n',
  )
} else {
  globalThis.__TESTKIT_BOOTSTRAP_LOADED = true
  globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT = 1
}

// ============================================================================
// STEP 4: Validation Utilities
// Helper functions to ensure proper initialization
// ============================================================================

/**
 * Check if bootstrap has been loaded
 */
export function isBootstrapLoaded(): boolean {
  return globalThis.__TESTKIT_BOOTSTRAP_LOADED === true
}

/**
 * Require bootstrap to be loaded, throw if not
 */
export function requireBootstrap(): void {
  if (!isBootstrapLoaded()) {
    throw new Error(
      '❌ Testkit bootstrap not loaded!\n\n' +
        'The testkit bootstrap module must be loaded before any test code.\n\n' +
        'Solutions:\n' +
        '  1. Ensure vitest.config.ts includes:\n' +
        '     setupFiles: ["./src/setup.ts"] or ["./src/bootstrap.ts"]\n\n' +
        '  2. Or import at the top of your test file:\n' +
        '     import "@template/testkit/bootstrap"\n\n' +
        '  3. Or import from the main testkit module:\n' +
        '     import { ... } from "@template/testkit"\n\n' +
        'Current globalThis.__TESTKIT_BOOTSTRAP_LOADED: ' +
        globalThis.__TESTKIT_BOOTSTRAP_LOADED,
    )
  }
}

/**
 * Validate import order by checking the call stack
 */
export function validateImportOrder(): void {
  const stack = new Error().stack

  // Check if vitest has already initialized
  if (stack?.includes('node_modules/vitest') && stack.includes('runTest')) {
    console.warn(
      '⚠️ Bootstrap may have loaded after test initialization\n' +
        'Consider using setupFiles in vitest.config.ts instead of manual imports',
    )
  }

  // Check if we're being imported from a test file directly
  if (stack?.includes('.test.ts') || stack?.includes('.spec.ts')) {
    // This is OK if setupFiles is not configured
    if (
      globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT &&
      globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT > 1
    ) {
      console.warn(
        '⚠️ Bootstrap imported from test file but already loaded via setupFiles\n' +
          'Remove the manual import from your test file',
      )
    }
  }
}

// Run validation on load
validateImportOrder()

// ============================================================================
// STEP 5: Environment Detection
// Detect which test runner and environment we're in
// ============================================================================

export interface TestEnvironment {
  runner: 'vitest' | 'wallaby' | 'unknown'
  environment: 'node' | 'happy-dom' | 'jsdom' | 'unknown'
  hasSetupFiles: boolean
}

/**
 * Detect the current test environment
 */
export function detectEnvironment(): TestEnvironment {
  return {
    runner: process.env.WALLABY_WORKER ? 'wallaby' : process.env.VITEST ? 'vitest' : 'unknown',
    environment: detectEnvironmentType(),
    hasSetupFiles: globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT === 1,
  }
}

function detectEnvironmentType(): TestEnvironment['environment'] {
  // Check for happy-dom
  const win = globalThis as typeof globalThis & Window
  if (win.happyDOM || win.HTMLDocument) {
    return 'happy-dom'
  }

  // Check for jsdom
  if (globalThis.navigator?.userAgent?.includes('jsdom')) {
    return 'jsdom'
  }

  // Check for node
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node'
  }

  return 'unknown'
}

// ============================================================================
// STEP 6: Cleanup Hooks
// Register cleanup hooks for test lifecycle
// ============================================================================

if (typeof afterEach !== 'undefined') {
  afterEach(() => {
    // Clear mock registries after each test
    clearMockRegistry()
  })
}

// ============================================================================
// STEP 7: Export Status
// Export bootstrap status for debugging
// ============================================================================

export const bootstrapStatus = {
  loaded: isBootstrapLoaded,
  loadCount: () => globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT || 0,
  environment: detectEnvironment,
  validate: requireBootstrap,
}

// Log bootstrap status in debug mode
if (process.env.DEBUG_TESTKIT) {
  console.log('🚀 Testkit Bootstrap Loaded:', {
    loaded: isBootstrapLoaded(),
    loadCount: globalThis.__TESTKIT_BOOTSTRAP_LOAD_COUNT,
    environment: detectEnvironment(),
  })
}
