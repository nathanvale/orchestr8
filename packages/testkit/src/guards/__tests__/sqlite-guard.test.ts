/**
 * Tests for SQLite Leak Guard
 *
 * NOTE: These tests verify the guard's functionality but run in isolation
 * from the actual better-sqlite3 mocking to avoid circular dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('SQLite Guard Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('should be disabled by default', async () => {
    delete process.env.TESTKIT_SQLITE_GUARD
    const { getSqliteGuardConfig } = await import('../config.js')
    const config = getSqliteGuardConfig()
    expect(config.enabled).toBe(false)
  })

  it('should enable when TESTKIT_SQLITE_GUARD=on', async () => {
    process.env.TESTKIT_SQLITE_GUARD = 'on'
    const { getSqliteGuardConfig } = await import('../config.js')
    const config = getSqliteGuardConfig()
    expect(config.enabled).toBe(true)
  })

  it('should support strict mode', async () => {
    process.env.TESTKIT_SQLITE_GUARD_STRICT = 'on'
    const { getSqliteGuardConfig } = await import('../config.js')
    const config = getSqliteGuardConfig()
    expect(config.strict).toBe(true)
  })

  it('should support verbose mode', async () => {
    process.env.TESTKIT_SQLITE_GUARD_VERBOSE = 'on'
    const { getSqliteGuardConfig } = await import('../config.js')
    const config = getSqliteGuardConfig()
    expect(config.verbose).toBe(true)
  })

  it('should support multiple boolean formats', async () => {
    const testCases = [
      { value: 'on', expected: true },
      { value: 'true', expected: true },
      { value: '1', expected: true },
      { value: 'yes', expected: true },
      { value: 'off', expected: false },
      { value: 'false', expected: false },
      { value: '0', expected: false },
      { value: 'no', expected: false },
    ]

    for (const { value, expected } of testCases) {
      process.env.TESTKIT_SQLITE_GUARD = value
      vi.resetModules()
      const { getSqliteGuardConfig } = await import('../config.js')
      const config = getSqliteGuardConfig()
      expect(config.enabled).toBe(expected)
    }
  })
})

describe('Timers Guard Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('should be disabled by default', async () => {
    delete process.env.TESTKIT_TIMERS_GUARD
    const { getTimersGuardConfig } = await import('../config.js')
    const config = getTimersGuardConfig()
    expect(config.enabled).toBe(false)
  })

  it('should enable when TESTKIT_TIMERS_GUARD=on', async () => {
    process.env.TESTKIT_TIMERS_GUARD = 'on'
    const { getTimersGuardConfig } = await import('../config.js')
    const config = getTimersGuardConfig()
    expect(config.enabled).toBe(true)
  })

  it('should support verbose mode', async () => {
    process.env.TESTKIT_TIMERS_GUARD_VERBOSE = 'on'
    const { getTimersGuardConfig } = await import('../config.js')
    const config = getTimersGuardConfig()
    expect(config.verbose).toBe(true)
  })
})

describe('Report Hangs Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('should enable in CI by default', async () => {
    process.env.CI = 'true'
    delete process.env.TESTKIT_REPORT_HANGS
    const { getReportHangsConfig } = await import('../config.js')
    const enabled = getReportHangsConfig()
    expect(enabled).toBe(true)
  })

  it('should disable locally by default', async () => {
    delete process.env.CI
    delete process.env.TESTKIT_REPORT_HANGS
    const { getReportHangsConfig } = await import('../config.js')
    const enabled = getReportHangsConfig()
    expect(enabled).toBe(false)
  })

  it('should respect explicit on setting', async () => {
    delete process.env.CI
    process.env.TESTKIT_REPORT_HANGS = 'on'
    const { getReportHangsConfig } = await import('../config.js')
    const enabled = getReportHangsConfig()
    expect(enabled).toBe(true)
  })

  it('should respect explicit off setting in CI', async () => {
    process.env.CI = 'true'
    process.env.TESTKIT_REPORT_HANGS = 'off'
    const { getReportHangsConfig } = await import('../config.js')
    const enabled = getReportHangsConfig()
    expect(enabled).toBe(false)
  })
})

describe('Guards Integration', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('should detect when any guards are enabled', async () => {
    process.env.TESTKIT_SQLITE_GUARD = 'on'
    const { hasAnyGuardsEnabled } = await import('../config.js')
    expect(hasAnyGuardsEnabled()).toBe(true)
  })

  it('should detect when no guards are enabled', async () => {
    delete process.env.TESTKIT_SQLITE_GUARD
    delete process.env.TESTKIT_TIMERS_GUARD
    const { hasAnyGuardsEnabled } = await import('../config.js')
    expect(hasAnyGuardsEnabled()).toBe(false)
  })

  it('should get complete guards config', async () => {
    process.env.TESTKIT_SQLITE_GUARD = 'on'
    process.env.TESTKIT_SQLITE_GUARD_STRICT = 'on'
    process.env.TESTKIT_TIMERS_GUARD = 'on'
    process.env.CI = 'true'

    const { getGuardsConfig } = await import('../config.js')
    const config = getGuardsConfig()

    expect(config).toMatchObject({
      sqliteGuard: {
        enabled: true,
        strict: true,
        verbose: false,
      },
      timersGuard: {
        enabled: true,
        verbose: false,
      },
      reportHangs: true,
    })
  })
})
