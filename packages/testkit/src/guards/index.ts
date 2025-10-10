/**
 * TestKit Leak Guards
 *
 * Automatic detection and cleanup of resource leaks (SQLite databases, timers, etc.)
 * that prevent Vitest processes from exiting cleanly.
 *
 * @module @orchestr8/testkit/guards
 */

export {
  getGuardsConfig,
  getSqliteGuardConfig,
  getTimersGuardConfig,
  getReportHangsConfig,
  hasAnyGuardsEnabled,
  type GuardsConfig,
  type SqliteGuardConfig,
  type TimersGuardConfig,
} from './config.js'

export { setupSqliteGuard } from './sqlite-guard.js'
export { setupTimersGuard } from './timers-guard.js'

/**
 * Setup all enabled guards based on configuration
 *
 * This is a convenience function that checks configuration
 * and enables guards as needed.
 */
export async function setupGuards(): Promise<void> {
  const { getGuardsConfig } = await import('./config.js')
  const config = getGuardsConfig()

  if (config.sqliteGuard.enabled) {
    const { setupSqliteGuard } = await import('./sqlite-guard.js')
    setupSqliteGuard(config.sqliteGuard)
  }

  if (config.timersGuard.enabled) {
    const { setupTimersGuard } = await import('./timers-guard.js')
    setupTimersGuard(config.timersGuard)
  }
}
