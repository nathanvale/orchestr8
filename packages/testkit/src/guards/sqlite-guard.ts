/**
 * SQLite Leak Guard
 *
 * Automatically detects and closes leaked better-sqlite3 database connections
 * that prevent Vitest processes from exiting cleanly.
 *
 * Features:
 * - Wraps better-sqlite3 constructor with Proxy for transparent tracking
 * - Auto-closes leaked DBs in afterEach and afterAll hooks
 * - Respects read-only databases (doesn't close them)
 * - Strict mode: fails tests if forced closures detected
 * - Verbose mode: logs forced closures for debugging
 */

import { afterEach, afterAll, vi } from 'vitest'
import type { getSqliteGuardConfig } from './config.js'

type SqliteGuardConfig = ReturnType<typeof getSqliteGuardConfig>

/**
 * Better-sqlite3 Database interface (minimal subset)
 */
interface Database {
  readonly name: string
  readonly open: boolean
  readonly readonly: boolean
  readonly memory: boolean
  close(): void
}

/**
 * Metadata about a tracked database instance
 */
interface DatabaseMetadata {
  db: Database
  openedAt: number
  testName: string | undefined
  stack: string
}

/**
 * Forced closure record for strict mode
 */
interface ForcedClosure {
  testName: string | undefined
  dbName: string
  stack: string
}

/**
 * SQLite leak guard manager
 */
class SqliteLeakGuard {
  private trackedDbs = new Set<DatabaseMetadata>()
  private forcedClosures: ForcedClosure[] = []
  private config: SqliteGuardConfig
  private currentTestName: string | undefined

  constructor(config: SqliteGuardConfig) {
    this.config = config
  }

  /**
   * Track a new database instance
   */
  trackDatabase(db: Database): void {
    const metadata: DatabaseMetadata = {
      db,
      openedAt: Date.now(),
      testName: this.currentTestName,
      stack: this.captureStack(),
    }
    this.trackedDbs.add(metadata)
  }

  /**
   * Cleanup leaked databases
   */
  cleanup(scope: 'test' | 'suite'): void {
    for (const metadata of this.trackedDbs) {
      const { db } = metadata

      // Check if DB needs closing
      if (this.shouldCloseDatabase(db)) {
        try {
          db.close()

          if (this.config.verbose) {
            this.logClosure(metadata)
          }

          if (this.config.strict) {
            this.forcedClosures.push({
              testName: metadata.testName,
              dbName: db.name,
              stack: metadata.stack,
            })
          }
        } catch (error) {
          // Log error but continue with other closures
          console.error(
            `[SQLite Guard] Failed to close database ${db.name}:`,
            error instanceof Error ? error.message : String(error),
          )
        }
      }
    }

    // Clear tracked databases after cleanup
    this.trackedDbs.clear()

    // In strict mode at suite end, fail if forced closures occurred
    if (scope === 'suite' && this.config.strict && this.forcedClosures.length > 0) {
      this.throwStrictModeError()
    }
  }

  /**
   * Determine if a database should be closed
   */
  private shouldCloseDatabase(db: Database): boolean {
    // Don't close if already closed
    if (!db.open) return false

    // Don't close read-only databases (might be shared)
    if (db.readonly) return false

    return true
  }

  /**
   * Log a forced closure
   */
  private logClosure(metadata: DatabaseMetadata): void {
    const { db, testName } = metadata
    const location = testName ? `in test "${testName}"` : 'outside test context'
    console.log(`[SQLite Guard] Auto-closed leaked database "${db.name}" opened ${location}`)
  }

  /**
   * Throw error in strict mode
   */
  private throwStrictModeError(): void {
    const count = this.forcedClosures.length
    const tests = new Set(this.forcedClosures.map((fc) => fc.testName ?? 'unknown'))

    let message = `SQLite Leak Guard detected ${count} forced closure${count === 1 ? '' : 's'}:\n\n`

    message += `Tests with leaks: ${Array.from(tests).join(', ')}\n\n`
    message += 'Leaked databases:\n'

    for (const closure of this.forcedClosures) {
      message += `  - ${closure.dbName} (${closure.testName ?? 'unknown test'})\n`
    }

    message += '\nPlease close all database connections in your tests using db.close()'

    throw new Error(message)
  }

  /**
   * Capture stack trace for debugging
   */
  private captureStack(): string {
    const stack = new Error().stack || ''
    // Remove first 3 lines (Error, this function, caller)
    return stack.split('\n').slice(3).join('\n')
  }

  /**
   * Update current test name for better error messages
   */
  setCurrentTestName(name: string | undefined): void {
    this.currentTestName = name
  }
}

/**
 * Check if better-sqlite3 is available
 */
function isBetterSqlite3Available(): boolean {
  try {
    // Try to resolve the module if import.meta.resolve is available
    if (typeof import.meta.resolve !== 'undefined') {
      void import.meta.resolve('better-sqlite3')
      return true
    }
    // Fallback: assume it's available if not in a test environment
    return true
  } catch {
    return false
  }
}

/**
 * Setup SQLite leak guard with Vitest mocking
 */
export function setupSqliteGuard(config: SqliteGuardConfig): void {
  // Skip if better-sqlite3 is not installed
  if (!isBetterSqlite3Available()) {
    if (config.verbose) {
      console.log('[SQLite Guard] better-sqlite3 not found, skipping guard setup')
    }
    return
  }

  const guard = new SqliteLeakGuard(config)

  // Mock better-sqlite3 with Proxy-wrapped constructor
  vi.mock('better-sqlite3', async () => {
    const actual = (await vi.importActual('better-sqlite3')) as {
      default: new (...args: unknown[]) => Database
      [key: string]: unknown
    }

    // Wrap the constructor with a Proxy to track instances
    const ProxiedDatabase = new Proxy(actual.default, {
      construct(target, args: unknown[]) {
        // Create the real database instance
        const db = new target(...(args as ConstructorParameters<typeof target>)) as Database

        // Track the instance
        guard.trackDatabase(db)

        return db
      },
    })

    // Return the module with wrapped constructor
    return {
      ...actual,
      default: ProxiedDatabase,
    }
  })

  // Install cleanup hooks
  afterEach(() => {
    // Try to get current test name from Vitest
    try {
      const state = (expect as { getState?: () => { currentTestName?: string } }).getState?.()
      guard.setCurrentTestName(state?.currentTestName)
    } catch {
      // Ignore if we can't get test name
    }

    guard.cleanup('test')
  })

  afterAll(() => {
    guard.cleanup('suite')
  })

  if (config.verbose) {
    console.log('[SQLite Guard] Enabled with config:', config)
  }
}
