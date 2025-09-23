import { vi } from 'vitest'

// ============================================================================
// TESTKIT BOOTSTRAP
// ============================================================================
// This module is automatically loaded before all tests via setupFiles in vitest config.
// It provides unified mocking infrastructure for common Node.js modules.
//
// IMPORTANT: All mocks must be created here to ensure they are hoisted properly
// by vitest and applied before any test imports.
// ============================================================================

// Track bootstrap loading
interface TestkitGlobals {
  __testkitBootstrapCount?: number
}

const bootstrapState = {
  loaded: true,
  loadCount: (globalThis as TestkitGlobals).__testkitBootstrapCount || 0,
}
;(globalThis as TestkitGlobals).__testkitBootstrapCount = bootstrapState.loadCount + 1

// ============================================================================

// Child process mocking - single cached instance for both specifiers
let __cpMockModule: unknown | null = null
async function getChildProcessMock() {
  if (!__cpMockModule) {
    const { createChildProcessMock } = await import('./cli/mock-factory.js')
    __cpMockModule = createChildProcessMock()
  }
  return __cpMockModule
}

vi.mock('node:child_process', async () => {
  const mod = await getChildProcessMock()
  if (process.env.DEBUG_TESTKIT) {
    const keys = Object.keys(mod as Record<string, unknown>)
    if (!('execSync' in (mod as Record<string, unknown>))) {
      console.warn('[testkit/bootstrap] child_process mock missing execSync; keys:', keys)
    }
  }
  return mod
})

// Also mock the non-prefixed specifier to catch all imports
vi.mock('child_process', async () => {
  return getChildProcessMock()
})

// Future mock declarations will go here:
// vi.mock('fs', () => createFsMock())
// vi.mock('node:fs', () => createFsMock())

// ============================================================================
// BOOTSTRAP STATE TRACKING
// ============================================================================

// Export bootstrap state for verification in tests
export const getBootstrapState = () => ({
  ...bootstrapState,
  environment: {
    runner: 'vitest',
    environment: process.env.VITEST_ENV || 'node',
    hasSetupFiles: true,
  },
})

// Log bootstrap state in debug mode
if (process.env.DEBUG_TESTKIT || process.env.VERBOSE_TEST) {
  console.log('🚀 Testkit Bootstrap Loaded:', getBootstrapState())
}
