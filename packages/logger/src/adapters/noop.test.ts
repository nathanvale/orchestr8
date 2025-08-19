import { describe, expect, it } from 'vitest'

import { NoopLogger, createNoopLogger } from './noop.js'

describe('NoopLogger', () => {
  it('should create a noop logger instance', () => {
    const logger = new NoopLogger()
    expect(logger).toBeDefined()
    expect(logger).toBeInstanceOf(NoopLogger)
  })

  it('should not throw when logging at any level', () => {
    const logger = new NoopLogger()

    expect(() => logger.trace('trace message')).not.toThrow()
    expect(() => logger.debug('debug message')).not.toThrow()
    expect(() => logger.info('info message')).not.toThrow()
    expect(() => logger.warn('warn message')).not.toThrow()
    expect(() => logger.error('error message')).not.toThrow()
  })

  it('should accept fields without throwing', () => {
    const logger = new NoopLogger()

    expect(() =>
      logger.info('message', { field1: 'value1', field2: 123 }),
    ).not.toThrow()
  })

  it('should create child loggers', () => {
    const logger = new NoopLogger()
    const child = logger.child({ module: 'test' })

    expect(child).toBeDefined()
    expect(child).toBeInstanceOf(NoopLogger)
  })

  it('should preserve bindings in child loggers', () => {
    const logger = new NoopLogger()
    const child1 = logger.child({ module: 'parent' })
    const child2 = child1.child({ submodule: 'child' })

    // Should not throw and should maintain the chain
    expect(() => child2.info('test')).not.toThrow()
  })

  it('should handle options parameter', () => {
    const logger = new NoopLogger({ name: 'test', level: 'debug' })
    expect(logger).toBeDefined()
  })
})

describe('createNoopLogger', () => {
  it('should create a noop logger instance', () => {
    const logger = createNoopLogger()
    expect(logger).toBeDefined()
    expect(logger).toBeInstanceOf(NoopLogger)
  })

  it('should return a functional logger', () => {
    const logger = createNoopLogger()

    expect(() => {
      logger.trace('trace')
      logger.debug('debug')
      logger.info('info')
      logger.warn('warn')
      logger.error('error')
    }).not.toThrow()
  })
})
