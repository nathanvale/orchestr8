import { Writable } from 'node:stream'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ConsoleLogger, createConsoleLogger } from './console.js'

// Helper to capture stream output
class TestStream extends Writable {
  public output: string[] = []

  _write(chunk: any, _encoding: string, callback: () => void): void {
    this.output.push(chunk.toString())
    callback()
  }

  clear(): void {
    this.output = []
  }

  getLastLine(): string {
    return this.output[this.output.length - 1]
  }

  getJSON(): any {
    const line = this.getLastLine()
    return JSON.parse(line)
  }
}

describe('ConsoleLogger', () => {
  let stream: TestStream

  beforeEach(() => {
    stream = new TestStream()
  })

  describe('JSON output', () => {
    it('should output JSON formatted logs', () => {
      const logger = new ConsoleLogger({ stream, pretty: false })

      logger.info('test message', { field: 'value' })

      const output = stream.getJSON()
      expect(output.level).toBe('info')
      expect(output.msg).toBe('test message')
      expect(output.field).toBe('value')
      expect(output.timestamp).toBeDefined()
    })

    it('should include logger name in output', () => {
      const logger = new ConsoleLogger({
        name: 'test-logger',
        stream,
        pretty: false,
      })

      logger.info('test')

      const output = stream.getJSON()
      expect(output.name).toBe('test-logger')
    })

    it('should respect log level filtering', () => {
      const logger = new ConsoleLogger({ level: 'warn', stream, pretty: false })

      logger.trace('trace')
      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')

      expect(stream.output).toHaveLength(2)

      const warn = JSON.parse(stream.output[0])
      const error = JSON.parse(stream.output[1])

      expect(warn.level).toBe('warn')
      expect(error.level).toBe('error')
    })

    it('should redact sensitive fields', () => {
      const logger = new ConsoleLogger({ stream, pretty: false })

      logger.info('test', {
        username: 'john',
        password: 'secret123',
        apiKey: 'abc-123',
      })

      const output = stream.getJSON()
      expect(output.username).toBe('john')
      expect(output.password).toBe('[REDACTED]')
      expect(output.apiKey).toBe('[REDACTED]')
    })

    it('should truncate large fields', () => {
      const logger = new ConsoleLogger({
        stream,
        pretty: false,
        maxFieldSize: 20,
      })

      logger.info('test', {
        largeText: 'a'.repeat(50),
      })

      const output = stream.getJSON()
      expect(output.largeText).toBe('a'.repeat(20) + '... [TRUNCATED]')
    })

    it('should merge default fields', () => {
      const logger = new ConsoleLogger({
        stream,
        pretty: false,
        defaultFields: { service: 'test-service', version: '1.0.0' },
      })

      logger.info('test', { custom: 'field' })

      const output = stream.getJSON()
      expect(output.service).toBe('test-service')
      expect(output.version).toBe('1.0.0')
      expect(output.custom).toBe('field')
    })
  })

  describe('Pretty output', () => {
    it('should output pretty formatted logs', () => {
      const logger = new ConsoleLogger({ stream, pretty: true })

      logger.info('test message')

      const output = stream.getLastLine()
      expect(output).toContain('INFO')
      expect(output).toContain('test message')
      expect(output).toContain('\x1b[') // Contains ANSI color codes
    })

    it('should include logger name in pretty output', () => {
      const logger = new ConsoleLogger({ name: 'app', stream, pretty: true })

      logger.info('test')

      const output = stream.getLastLine()
      expect(output).toContain('[app]')
    })

    it('should format fields in pretty output', () => {
      const logger = new ConsoleLogger({ stream, pretty: true })

      logger.info('test', {
        string: 'value',
        number: 123,
        boolean: true,
      })

      const output = stream.getLastLine()
      expect(output).toContain('string=value')
      expect(output).toContain('number=123')
      expect(output).toContain('boolean=true')
    })

    it('should quote strings with spaces in pretty output', () => {
      const logger = new ConsoleLogger({ stream, pretty: true })

      logger.info('test', {
        message: 'hello world',
      })

      const output = stream.getLastLine()
      expect(output).toContain('message="hello world"')
    })

    it('should use appropriate colors for log levels', () => {
      const logger = new ConsoleLogger({ stream, pretty: true, level: 'trace' })

      logger.trace('trace')
      expect(stream.output[0]).toContain('\x1b[90m') // Gray

      logger.debug('debug')
      expect(stream.output[1]).toContain('\x1b[36m') // Cyan

      logger.info('info')
      expect(stream.output[2]).toContain('\x1b[32m') // Green

      logger.warn('warn')
      expect(stream.output[3]).toContain('\x1b[33m') // Yellow

      logger.error('error')
      expect(stream.output[4]).toContain('\x1b[31m') // Red
    })
  })

  describe('Child loggers', () => {
    it('should create child loggers with merged bindings', () => {
      const logger = new ConsoleLogger({ stream, pretty: false })
      const child = logger.child({ module: 'child' })

      child.info('test', { field: 'value' })

      const output = stream.getJSON()
      expect(output.module).toBe('child')
      expect(output.field).toBe('value')
    })

    it('should inherit parent configuration', () => {
      const logger = new ConsoleLogger({
        name: 'parent',
        level: 'warn',
        stream,
        pretty: false,
        redactKeys: ['customSecret'],
      })

      const child = logger.child({ module: 'child' })

      // Should respect parent level
      child.info('info') // Should not output
      child.warn('warn') // Should output

      expect(stream.output).toHaveLength(1)

      // Should respect parent redaction
      child.warn('test', { customSecret: 'hidden' })
      const output = JSON.parse(stream.output[1])
      expect(output.customSecret).toBe('[REDACTED]')
    })

    it('should merge nested bindings', () => {
      const logger = new ConsoleLogger(
        { stream, pretty: false },
        { app: 'test' },
      )
      const child1 = logger.child({ module: 'auth' })
      const child2 = child1.child({ action: 'login' })

      child2.info('test')

      const output = stream.getJSON()
      expect(output.app).toBe('test')
      expect(output.module).toBe('auth')
      expect(output.action).toBe('login')
    })
  })

  describe('Error handling', () => {
    it('should handle null and undefined fields', () => {
      const logger = new ConsoleLogger({ stream, pretty: false })

      logger.info('test', {
        nullField: null,
        undefinedField: undefined,
      })

      const output = stream.getJSON()
      expect(output.nullField).toBe(null)
      expect(output.undefinedField).toBe(undefined)
    })

    it('should handle circular references in objects', () => {
      const logger = new ConsoleLogger({
        stream,
        pretty: false,
        maxFieldSize: 100,
      })

      const circular: any = { name: 'test' }
      circular.self = circular

      // Should not throw
      expect(() => logger.info('test', { data: circular })).not.toThrow()
    })
  })
})

describe('createConsoleLogger', () => {
  it('should create a console logger with default options', () => {
    const logger = createConsoleLogger()
    expect(logger).toBeDefined()
    expect(logger).toBeInstanceOf(ConsoleLogger)
  })

  it('should respect environment variables', () => {
    vi.stubEnv('LOG_LEVEL', 'debug')
    vi.stubEnv('LOG_PRETTY', 'true')

    const stream = new TestStream()
    const logger = createConsoleLogger({ stream })

    logger.debug('test')

    const output = stream.getLastLine()
    expect(output).toContain('DEBUG') // Pretty format
    expect(output).toContain('\x1b[') // ANSI codes
  })

  it('should allow options to override environment', () => {
    vi.stubEnv('LOG_LEVEL', 'debug')
    vi.stubEnv('LOG_PRETTY', 'true')

    const stream = new TestStream()
    const logger = createConsoleLogger({
      stream,
      level: 'error',
      pretty: false,
    })

    logger.debug('debug') // Should not output
    logger.error('error') // Should output

    expect(stream.output).toHaveLength(1)

    const output = stream.getJSON()
    expect(output.level).toBe('error')
  })
})
