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

// ============================================================================
// SQLITE GUARD MOCKING (better-sqlite3)
// ============================================================================

// Module-level guard instance for SQLite leak detection
let __sqliteGuardModule: {
  guard: import('./guards/sqlite-guard.js').SqliteLeakGuard
  config: import('./guards/config.js').SqliteGuardConfig
} | null = null

async function getSqliteGuard() {
  if (!__sqliteGuardModule) {
    try {
      const { getSqliteGuardConfig } = await import('./guards/config.js')
      const config = getSqliteGuardConfig()

      if (config.enabled) {
        const { SqliteLeakGuard } = await import('./guards/sqlite-guard.js')
        __sqliteGuardModule = {
          guard: new SqliteLeakGuard(config),
          config,
        }

        if (config.verbose) {
          console.log('[Bootstrap] SQLite Guard enabled:', config)
        }
      }
    } catch (error) {
      // Silently fail if guards module not available
      if (process.env.DEBUG_TESTKIT) {
        console.warn('[Bootstrap] Failed to load SQLite guard:', error)
      }
    }
  }
  return __sqliteGuardModule
}

// Mock better-sqlite3 to track database connections
vi.mock('better-sqlite3', async () => {
  const guardModule = await getSqliteGuard()

  // If guard not enabled or not available, return actual module
  if (!guardModule) {
    return vi.importActual('better-sqlite3')
  }

  // Better-sqlite3 Database interface (minimal subset needed for tracking)
  interface Database {
    readonly name: string
    readonly open: boolean
    readonly readonly: boolean
    readonly memory: boolean
    close(): void
  }

  const actual = (await vi.importActual('better-sqlite3')) as {
    default: new (...args: unknown[]) => Database
    [key: string]: unknown
  }

  // Wrap the constructor with a Proxy to track instances
  const ProxiedDatabase = new Proxy(actual.default, {
    construct(target, args: unknown[]) {
      const db = new target(...(args as ConstructorParameters<typeof target>))
      guardModule.guard.trackDatabase(db)
      return db
    },
  })

  return {
    ...actual,
    default: ProxiedDatabase,
  }
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
