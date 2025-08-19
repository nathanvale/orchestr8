/**
 * Tests for MemoryLogger adapter
 */

import { describe, it, expect, beforeEach } from 'vitest'

import type { LogLevel } from '../types.js'

import { MemoryLogger, createMemoryLogger } from './memory.js'

describe('MemoryLogger', () => {
  let logger: MemoryLogger

  beforeEach(() => {
    logger = new MemoryLogger()
  })

  describe('logging methods', () => {
    it('should log trace messages', () => {
      logger.trace('trace message', { key: 'value' })
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'trace',
        message: 'trace message',
        fields: { key: 'value' },
      })
      expect(entries[0].timestamp).toBeDefined()
    })

    it('should log debug messages', () => {
      logger.debug('debug message', { debug: true })
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'debug',
        message: 'debug message',
        fields: { debug: true },
      })
    })

    it('should log info messages', () => {
      logger.info('info message', { info: 'data' })
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'info',
        message: 'info message',
        fields: { info: 'data' },
      })
    })

    it('should log warn messages', () => {
      logger.warn('warning message', { warning: 'condition' })
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'warn',
        message: 'warning message',
        fields: { warning: 'condition' },
      })
    })

    it('should log error messages', () => {
      logger.error('error message', { error: 'details' })
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'error',
        message: 'error message',
        fields: { error: 'details' },
      })
    })

    it('should log messages without fields', () => {
      logger.info('simple message')
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'info',
        message: 'simple message',
      })
      expect(entries[0].fields).toBeUndefined()
    })
  })

  describe('child logger', () => {
    it('should create child logger with additional context', () => {
      const child = logger.child({ requestId: '123' })

      child.info('child message', { childKey: 'childValue' })
      const entries = logger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        level: 'info',
        message: 'child message',
        fields: {
          requestId: '123',
          childKey: 'childValue',
        },
      })
    })

    it('should inherit parent context in child logger', () => {
      const parentLogger = new MemoryLogger({ parentKey: 'parentValue' })
      const child = parentLogger.child({ childKey: 'childValue' })

      child.info('test message')
      const entries = parentLogger.getEntries()

      expect(entries).toHaveLength(1)
      expect(entries[0].fields).toEqual({
        parentKey: 'parentValue',
        childKey: 'childValue',
      })
    })

    it('should share entries between parent and child', () => {
      logger.info('parent message')

      const child = logger.child({ childId: 'c1' })
      child.info('child message')

      const parentEntries = logger.getEntries()
      const childEntries = child.getEntries()

      expect(parentEntries).toHaveLength(2)
      expect(childEntries).toHaveLength(2)
      expect(parentEntries).toEqual(childEntries)
    })

    it('should override parent context keys in child', () => {
      const parentLogger = new MemoryLogger({ key: 'parent' })
      const child = parentLogger.child({ key: 'child' })

      child.info('test')
      const entries = parentLogger.getEntries()

      expect(entries[0].fields).toEqual({ key: 'child' })
    })
  })

  describe('getEntries', () => {
    it('should return all log entries', () => {
      logger.trace('trace')
      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      const entries = logger.getEntries()

      expect(entries).toHaveLength(5)
      expect(entries.map((e) => e.level)).toEqual([
        'trace',
        'debug',
        'info',
        'warn',
        'error',
      ])
    })

    it('should return a copy of entries array', () => {
      logger.info('test')

      const entries1 = logger.getEntries()
      const entries2 = logger.getEntries()

      expect(entries1).not.toBe(entries2)
      expect(entries1).toEqual(entries2)
    })
  })

  describe('getEntriesByLevel', () => {
    beforeEach(() => {
      logger.trace('trace 1')
      logger.debug('debug 1')
      logger.info('info 1')
      logger.info('info 2')
      logger.warn('warn 1')
      logger.error('error 1')
      logger.error('error 2')
    })

    it('should filter entries by level', () => {
      const infoEntries = logger.getEntriesByLevel('info')
      expect(infoEntries).toHaveLength(2)
      expect(infoEntries.every((e) => e.level === 'info')).toBe(true)

      const errorEntries = logger.getEntriesByLevel('error')
      expect(errorEntries).toHaveLength(2)
      expect(errorEntries.every((e) => e.level === 'error')).toBe(true)
    })

    it('should return empty array for level with no entries', () => {
      const newLogger = new MemoryLogger()
      const entries = newLogger.getEntriesByLevel('warn')
      expect(entries).toEqual([])
    })

    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error']

    it.each(levels)('should filter %s level correctly', (level) => {
      const entries = logger.getEntriesByLevel(level)
      expect(entries.every((e) => e.level === level)).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear all log entries', () => {
      logger.info('message 1')
      logger.info('message 2')

      expect(logger.count()).toBe(2)

      logger.clear()

      expect(logger.count()).toBe(0)
      expect(logger.getEntries()).toEqual([])
    })

    it('should allow logging after clear', () => {
      logger.info('before clear')
      logger.clear()
      logger.info('after clear')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].message).toBe('after clear')
    })
  })

  describe('count', () => {
    it('should return 0 for new logger', () => {
      expect(logger.count()).toBe(0)
    })

    it('should return correct count of entries', () => {
      logger.info('1')
      expect(logger.count()).toBe(1)

      logger.info('2')
      expect(logger.count()).toBe(2)

      logger.info('3')
      expect(logger.count()).toBe(3)
    })

    it('should include child logger entries in count', () => {
      logger.info('parent')

      const child = logger.child({ child: true })
      child.info('child')

      expect(logger.count()).toBe(2)
      expect(child.count()).toBe(2)
    })
  })

  describe('createMemoryLogger', () => {
    it('should create logger without context', () => {
      const logger = createMemoryLogger()
      logger.info('test')

      const entries = logger.getEntries()
      expect(entries[0].fields).toBeUndefined()
    })

    it('should create logger with initial context', () => {
      const logger = createMemoryLogger({ app: 'test-app' })
      logger.info('test')

      const entries = logger.getEntries()
      expect(entries[0].fields).toEqual({ app: 'test-app' })
    })
  })

  describe('timestamp', () => {
    it('should add ISO timestamp to each entry', () => {
      const before = new Date().toISOString()
      logger.info('test')
      const after = new Date().toISOString()

      const entry = logger.getEntries()[0]
      expect(entry.timestamp).toBeDefined()
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
      expect(entry.timestamp >= before).toBe(true)
      expect(entry.timestamp <= after).toBe(true)
    })
  })
})
