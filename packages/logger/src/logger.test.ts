import { describe, expect, it, vi } from 'vitest'

import type { LogFields, LogLevel } from './types.js'

import {
  BaseLogger,
  DEFAULT_REDACT_KEYS,
  getLogLevelFromEnv,
  getPrettyFromEnv,
  getRedactKeysFromEnv,
  getMaxFieldSizeFromEnv,
} from './logger.js'

// Test implementation of BaseLogger
class TestLogger extends BaseLogger {
  public logs: Array<{ level: LogLevel; msg: string; fields?: LogFields }> = []

  child(bindings: LogFields): TestLogger {
    return new TestLogger(
      {
        name: this.name,
        level: this.level,
        pretty: this.pretty,
        redactKeys: Array.from(this.redactKeys),
        maxFieldSize: this.maxFieldSize,
        defaultFields: this.defaultFields,
      },
      { ...this.bindings, ...bindings },
    )
  }

  protected log(level: LogLevel, msg: string, fields?: LogFields): void {
    if (!this.shouldLog(level)) {
      return
    }
    const mergedFields = this.mergeFields(fields)
    const redactedFields = this.redactFields(mergedFields)
    this.logs.push({ level, msg, fields: redactedFields })
  }

  // Expose protected methods for testing
  public testShouldLog(level: LogLevel): boolean {
    return this.shouldLog(level)
  }

  public testRedactFields(fields: LogFields): LogFields {
    return this.redactFields(fields)
  }

  public testShouldRedact(key: string): boolean {
    return this.shouldRedact(key)
  }
}

describe('BaseLogger', () => {
  describe('log levels', () => {
    it('should respect log level filtering', () => {
      const logger = new TestLogger({ level: 'warn' })

      expect(logger.testShouldLog('trace')).toBe(false)
      expect(logger.testShouldLog('debug')).toBe(false)
      expect(logger.testShouldLog('info')).toBe(false)
      expect(logger.testShouldLog('warn')).toBe(true)
      expect(logger.testShouldLog('error')).toBe(true)
    })

    it('should log messages at appropriate levels', () => {
      const logger = new TestLogger({ level: 'debug' })

      logger.trace('trace msg')
      logger.debug('debug msg')
      logger.info('info msg')
      logger.warn('warn msg')
      logger.error('error msg')

      // Trace should be filtered out
      expect(logger.logs).toHaveLength(4)
      expect(logger.logs[0]).toEqual({
        level: 'debug',
        msg: 'debug msg',
        fields: {},
      })
      expect(logger.logs[1]).toEqual({
        level: 'info',
        msg: 'info msg',
        fields: {},
      })
      expect(logger.logs[2]).toEqual({
        level: 'warn',
        msg: 'warn msg',
        fields: {},
      })
      expect(logger.logs[3]).toEqual({
        level: 'error',
        msg: 'error msg',
        fields: {},
      })
    })
  })

  describe('field redaction', () => {
    it('should redact default sensitive keys', () => {
      const logger = new TestLogger()

      const fields = {
        username: 'john',
        password: 'secret123',
        apiKey: 'abc-123-def',
        token: 'bearer-token',
        data: 'normal-data',
      }

      const redacted = logger.testRedactFields(fields)

      expect(redacted.username).toBe('john')
      expect(redacted.password).toBe('[REDACTED]')
      expect(redacted.apiKey).toBe('[REDACTED]')
      expect(redacted.token).toBe('[REDACTED]')
      expect(redacted.data).toBe('normal-data')
    })

    it('should redact custom keys', () => {
      const logger = new TestLogger({
        redactKeys: ['customSecret', 'privateData'],
      })

      const fields = {
        customSecret: 'should-be-hidden',
        privateData: 'also-hidden',
        publicData: 'visible',
      }

      const redacted = logger.testRedactFields(fields)

      expect(redacted.customSecret).toBe('[REDACTED]')
      expect(redacted.privateData).toBe('[REDACTED]')
      expect(redacted.publicData).toBe('visible')
    })

    it('should redact nested objects', () => {
      const logger = new TestLogger()

      const fields = {
        user: {
          name: 'John',
          password: 'secret',
          profile: {
            apiKey: 'hidden',
            bio: 'visible',
          },
        },
      }

      const redacted = logger.testRedactFields(fields)
      const user = redacted.user as Record<string, unknown>
      const profile = user.profile as Record<string, unknown>

      expect(user.name).toBe('John')
      expect(user.password).toBe('[REDACTED]')
      expect(profile.apiKey).toBe('[REDACTED]')
      expect(profile.bio).toBe('visible')
    })

    it('should handle case-insensitive redaction', () => {
      const logger = new TestLogger()

      expect(logger.testShouldRedact('password')).toBe(true)
      expect(logger.testShouldRedact('PASSWORD')).toBe(true)
      expect(logger.testShouldRedact('Password')).toBe(true)
      expect(logger.testShouldRedact('user_password')).toBe(true)
      expect(logger.testShouldRedact('passwordHash')).toBe(true)
    })

    it('should redact headers.authorization', () => {
      const logger = new TestLogger()

      const fields = {
        headers: {
          authorization: 'Bearer token123',
          'content-type': 'application/json',
        },
      }

      const redacted = logger.testRedactFields(fields)
      const headers = redacted.headers as Record<string, unknown>

      expect(headers.authorization).toBe('[REDACTED]')
      expect(headers['content-type']).toBe('application/json')
    })
  })

  describe('field truncation', () => {
    it('should truncate large strings', () => {
      const logger = new TestLogger({ maxFieldSize: 50 })

      const fields = {
        shortText: 'This is fine',
        longText: 'a'.repeat(100),
      }

      const redacted = logger.testRedactFields(fields)

      expect(redacted.shortText).toBe('This is fine')
      expect(redacted.longText).toBe('a'.repeat(50) + '... [TRUNCATED]')
    })

    it('should respect maxFieldSize option', () => {
      const logger = new TestLogger({ maxFieldSize: 20 })

      const fields = {
        text: 'This is a very long text that should be truncated',
      }

      const redacted = logger.testRedactFields(fields)

      expect(redacted.text).toBe('This is a very long ... [TRUNCATED]')
    })
  })

  describe('child loggers', () => {
    it('should inherit parent configuration', () => {
      const parent = new TestLogger({
        name: 'parent',
        level: 'warn',
        redactKeys: ['customKey'],
      })

      const child = parent.child({ module: 'child' })

      // Test inheritance
      expect(child.level).toBe('warn')
      expect(child.name).toBe('parent')
      expect(child.testShouldRedact('customKey')).toBe(true)
    })

    it('should merge bindings', () => {
      const parent = new TestLogger({}, { parentField: 'parent' })
      const child = parent.child({ childField: 'child' })

      child.info('test', { extraField: 'extra' })

      expect(child.logs[0].fields).toEqual({
        parentField: 'parent',
        childField: 'child',
        extraField: 'extra',
      })
    })
  })

  describe('default fields', () => {
    it('should include default fields in all logs', () => {
      const logger = new TestLogger({
        defaultFields: {
          service: 'test-service',
          version: '1.0.0',
        },
      })

      logger.info('test message', { custom: 'field' })

      expect(logger.logs[0].fields).toEqual({
        service: 'test-service',
        version: '1.0.0',
        custom: 'field',
      })
    })

    it('should allow fields to override defaults', () => {
      const logger = new TestLogger({
        defaultFields: {
          environment: 'production',
        },
      })

      logger.info('test', { environment: 'staging' })

      expect(logger.logs[0].fields).toEqual({
        environment: 'staging',
      })
    })
  })
})

describe('Environment helpers', () => {
  describe('getLogLevelFromEnv', () => {
    it('should return log level from LOG_LEVEL env var', () => {
      vi.stubEnv('LOG_LEVEL', 'debug')
      expect(getLogLevelFromEnv()).toBe('debug')
    })

    it('should return info as default when LOG_LEVEL is not set', () => {
      vi.stubEnv('LOG_LEVEL', '')
      expect(getLogLevelFromEnv()).toBe('info')
    })

    it('should handle case-insensitive LOG_LEVEL', () => {
      vi.stubEnv('LOG_LEVEL', 'ERROR')
      expect(getLogLevelFromEnv()).toBe('error')
    })

    it('should return info for invalid LOG_LEVEL', () => {
      vi.stubEnv('LOG_LEVEL', 'invalid')
      expect(getLogLevelFromEnv()).toBe('info')
    })
  })

  describe('getPrettyFromEnv', () => {
    it('should return true when LOG_PRETTY is "true"', () => {
      vi.stubEnv('LOG_PRETTY', 'true')
      expect(getPrettyFromEnv()).toBe(true)
    })

    it('should return false for any other value', () => {
      vi.stubEnv('LOG_PRETTY', 'false')
      expect(getPrettyFromEnv()).toBe(false)

      vi.stubEnv('LOG_PRETTY', '1')
      expect(getPrettyFromEnv()).toBe(false)

      vi.stubEnv('LOG_PRETTY', '')
      expect(getPrettyFromEnv()).toBe(false)
    })
  })

  describe('getRedactKeysFromEnv', () => {
    it('should parse comma-separated keys from LOG_REDACT', () => {
      vi.stubEnv('LOG_REDACT', 'key1,key2,key3')
      expect(getRedactKeysFromEnv()).toEqual(['key1', 'key2', 'key3'])
    })

    it('should trim whitespace from keys', () => {
      vi.stubEnv('LOG_REDACT', ' key1 , key2 , key3 ')
      expect(getRedactKeysFromEnv()).toEqual(['key1', 'key2', 'key3'])
    })

    it('should return empty array when LOG_REDACT is not set', () => {
      vi.stubEnv('LOG_REDACT', '')
      expect(getRedactKeysFromEnv()).toEqual([])
    })
  })

  describe('getMaxFieldSizeFromEnv', () => {
    it('should parse integer from LOG_MAX_FIELD_SIZE', () => {
      vi.stubEnv('LOG_MAX_FIELD_SIZE', '5000')
      expect(getMaxFieldSizeFromEnv()).toBe(5000)
    })

    it('should return default 10000 for invalid values', () => {
      vi.stubEnv('LOG_MAX_FIELD_SIZE', 'invalid')
      expect(getMaxFieldSizeFromEnv()).toBe(10000)

      vi.stubEnv('LOG_MAX_FIELD_SIZE', '-100')
      expect(getMaxFieldSizeFromEnv()).toBe(10000)

      vi.stubEnv('LOG_MAX_FIELD_SIZE', '0')
      expect(getMaxFieldSizeFromEnv()).toBe(10000)
    })

    it('should return default 10000 when not set', () => {
      vi.stubEnv('LOG_MAX_FIELD_SIZE', '')
      expect(getMaxFieldSizeFromEnv()).toBe(10000)
    })
  })
})

describe('DEFAULT_REDACT_KEYS', () => {
  it('should include common sensitive keys', () => {
    expect(DEFAULT_REDACT_KEYS).toContain('password')
    expect(DEFAULT_REDACT_KEYS).toContain('token')
    expect(DEFAULT_REDACT_KEYS).toContain('apiKey')
    expect(DEFAULT_REDACT_KEYS).toContain('secret')
    expect(DEFAULT_REDACT_KEYS).toContain('authorization')
    expect(DEFAULT_REDACT_KEYS).toContain('headers.authorization')
  })
})
