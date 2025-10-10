/**
 * Configuration for TestKit leak guards
 *
 * Provides environment variable parsing and configuration management
 * for SQLite, timers, and other resource leak detection features.
 */

export interface SqliteGuardConfig {
  /** Enable SQLite leak detection and auto-cleanup */
  enabled: boolean
  /** Fail tests if forced closures are detected */
  strict: boolean
  /** Log forced closures for debugging */
  verbose: boolean
}

export interface TimersGuardConfig {
  /** Enable timer/interval leak detection and cleanup */
  enabled: boolean
  /** Log cleared timers for debugging */
  verbose: boolean
}

export interface GuardsConfig {
  /** SQLite leak guard configuration */
  sqliteGuard: SqliteGuardConfig
  /** Timers/intervals guard configuration */
  timersGuard: TimersGuardConfig
  /** Auto-append hanging-process reporter to Vitest */
  reportHangs: boolean
}

/**
 * Parse boolean from environment variable
 * Supports: 'on'/'off', 'true'/'false', '1'/'0', 'yes'/'no'
 */
function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue
  const normalized = value.toLowerCase().trim()
  if (['on', 'true', '1', 'yes'].includes(normalized)) return true
  if (['off', 'false', '0', 'no'].includes(normalized)) return false
  return defaultValue
}

/**
 * Get SQLite guard configuration from environment variables
 */
export function getSqliteGuardConfig(): SqliteGuardConfig {
  // Default to disabled initially (Phase 1: opt-in)
  // Phase 2: Enable by default in CI
  // Phase 3: Enable by default everywhere
  const defaultEnabled = false // Will change in future versions

  return {
    enabled: parseEnvBoolean(process.env.TESTKIT_SQLITE_GUARD, defaultEnabled),
    strict: parseEnvBoolean(process.env.TESTKIT_SQLITE_GUARD_STRICT, false),
    verbose: parseEnvBoolean(process.env.TESTKIT_SQLITE_GUARD_VERBOSE, false),
  }
}

/**
 * Get timers guard configuration from environment variables
 */
export function getTimersGuardConfig(): TimersGuardConfig {
  return {
    enabled: parseEnvBoolean(process.env.TESTKIT_TIMERS_GUARD, false),
    verbose: parseEnvBoolean(process.env.TESTKIT_TIMERS_GUARD_VERBOSE, false),
  }
}

/**
 * Get hanging-process reporter configuration
 */
export function getReportHangsConfig(): boolean {
  // Auto-enable in CI by default to help debug hanging processes
  const isCI = process.env.CI === 'true' || process.env.CI === '1'
  return parseEnvBoolean(process.env.TESTKIT_REPORT_HANGS, isCI)
}

/**
 * Get complete guards configuration
 */
export function getGuardsConfig(): GuardsConfig {
  return {
    sqliteGuard: getSqliteGuardConfig(),
    timersGuard: getTimersGuardConfig(),
    reportHangs: getReportHangsConfig(),
  }
}

/**
 * Check if any guards are enabled
 */
export function hasAnyGuardsEnabled(): boolean {
  const config = getGuardsConfig()
  return config.sqliteGuard.enabled || config.timersGuard.enabled
}
