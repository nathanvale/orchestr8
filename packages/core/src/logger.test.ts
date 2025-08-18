/**
 * Tests for logger implementations
 */

import { describe, expect, test } from 'vitest'

import { NoOpLogger, MemoryLogger } from './logger.js'

describe('NoOpLogger', () => {
  test('discards all log entries', () => {
    const logger = new NoOpLogger()

    // These should not throw or cause any side effects
    logger.trace('trace message', { data: 'value' })
    logger.debug('debug message', { data: 'value' })
    logger.info('info message', { data: 'value' })
    logger.warn('warn message', { data: 'value' })
    logger.error('error message', { data: 'value' })
    logger.log('info', 'generic message', { data: 'value' })

    // Should be safe to call
    expect(() => logger.child({ context: 'test' })).not.toThrow()
  })

  test('child logger is also a no-op', () => {
    const logger = new NoOpLogger()
    const child = logger.child({ context: 'test' })

    // Child should also be a no-op
    expect(() => {
      child.info('child message')
      child.error('child error')
    }).not.toThrow()
  })
})

describe('MemoryLogger', () => {
  test('stores log entries with timestamps', () => {
    const logger = new MemoryLogger()
    const beforeTime = new Date().toISOString()

    logger.info('test message', { key: 'value' })

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)

    const entry = entries[0]!
    expect(entry.level).toBe('info')
    expect(entry.message).toBe('test message')
    expect(entry.data).toEqual({ key: 'value' })
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(new Date(entry.timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeTime).getTime(),
    )
  })

  test('supports all log levels', () => {
    const logger = new MemoryLogger()

    logger.trace('trace msg')
    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')
    logger.error('error msg')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(5)
    expect(entries.map((e) => e.level)).toEqual([
      'trace',
      'debug',
      'info',
      'warn',
      'error',
    ])
    expect(entries.map((e) => e.message)).toEqual([
      'trace msg',
      'debug msg',
      'info msg',
      'warn msg',
      'error msg',
    ])
  })

  test('generic log method works correctly', () => {
    const logger = new MemoryLogger()

    logger.log('warn', 'generic warning', { detail: 'test' })

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      level: 'warn',
      message: 'generic warning',
      data: { detail: 'test' },
    })
  })

  test('child logger includes parent context', () => {
    const parentLogger = new MemoryLogger({ service: 'orchestr8' })
    const childLogger = parentLogger.child({ component: 'engine' })

    childLogger.info('test message', { extra: 'data' })

    const entries = parentLogger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.data).toEqual({
      service: 'orchestr8',
      component: 'engine',
      extra: 'data',
    })
  })

  test('child context overrides parent context', () => {
    const parentLogger = new MemoryLogger({ key: 'parent', shared: 'parent' })
    const childLogger = parentLogger.child({ key: 'child', new: 'child' })

    childLogger.info('test message')

    const entries = parentLogger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.data).toEqual({
      key: 'child', // Child overrides parent
      shared: 'parent', // Parent value preserved
      new: 'child', // New child value added
    })
  })

  test('nested child loggers work correctly', () => {
    const rootLogger = new MemoryLogger({ level: 'root' })
    const childLogger = rootLogger.child({ level: 'child' })
    const grandchildLogger = childLogger.child({ level: 'grandchild' })

    grandchildLogger.info('nested message', { data: 'test' })

    // All loggers share the same entries array
    const grandchildEntries = grandchildLogger.getEntries()
    expect(grandchildEntries).toHaveLength(1)
    expect(grandchildEntries[0]!.data).toEqual({
      level: 'grandchild', // Grandchild overrides all
      data: 'test',
    })

    // All parent loggers share the same entries
    expect(rootLogger.getEntries()).toHaveLength(1)
    expect(childLogger.getEntries()).toHaveLength(1)
    expect(rootLogger.getEntries()[0]).toEqual(grandchildEntries[0])
  })

  test('getEntriesByLevel filters correctly', () => {
    const logger = new MemoryLogger()

    logger.info('info 1')
    logger.warn('warn 1')
    logger.info('info 2')
    logger.error('error 1')
    logger.warn('warn 2')

    const infoEntries = logger.getEntriesByLevel('info')
    expect(infoEntries).toHaveLength(2)
    expect(infoEntries.map((e) => e.message)).toEqual(['info 1', 'info 2'])

    const warnEntries = logger.getEntriesByLevel('warn')
    expect(warnEntries).toHaveLength(2)
    expect(warnEntries.map((e) => e.message)).toEqual(['warn 1', 'warn 2'])

    const errorEntries = logger.getEntriesByLevel('error')
    expect(errorEntries).toHaveLength(1)
    expect(errorEntries[0]!.message).toBe('error 1')

    const debugEntries = logger.getEntriesByLevel('debug')
    expect(debugEntries).toHaveLength(0)
  })

  test('clear removes all entries', () => {
    const logger = new MemoryLogger()

    logger.info('message 1')
    logger.warn('message 2')
    expect(logger.count()).toBe(2)

    logger.clear()
    expect(logger.count()).toBe(0)
    expect(logger.getEntries()).toHaveLength(0)
  })

  test('count returns correct entry count', () => {
    const logger = new MemoryLogger()

    expect(logger.count()).toBe(0)

    logger.info('message 1')
    expect(logger.count()).toBe(1)

    logger.error('message 2')
    expect(logger.count()).toBe(2)

    logger.clear()
    expect(logger.count()).toBe(0)
  })

  test('handles undefined and null data gracefully', () => {
    const logger = new MemoryLogger()

    logger.info('message with undefined', undefined)
    logger.info('message with null', null)
    logger.info('message without data')

    const entries = logger.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0]!.data).toEqual({})
    expect(entries[1]!.data).toEqual({})
    expect(entries[2]!.data).toEqual({})
  })

  test('preserves context when data is undefined', () => {
    const logger = new MemoryLogger({ context: 'test' })

    logger.info('message', undefined)

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.data).toEqual({ context: 'test' })
  })
})
