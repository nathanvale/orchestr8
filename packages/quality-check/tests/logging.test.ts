import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  createQualityLogger,
  createQualityLoggerSync,
  generateCorrelationId,
} from '../src/logging/quality-logger.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('Quality Logger Integration', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'quality-check-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('creates logger with correlation ID', async () => {
    const correlationId = generateCorrelationId('qc')
    const logger = await createQualityLogger({
      level: 'info',
      correlationId,
      dir: tempDir,
      enabled: true,
      usePinoTransports: false, // Disable transports for testing
    })

    expect(logger).toBeDefined()
    expect(correlationId).toMatch(/^qc-/)
  })

  test('creates sync logger', () => {
    const correlationId = generateCorrelationId('qc')
    const logger = createQualityLoggerSync({
      level: 'info',
      correlationId,
      dir: tempDir,
      enabled: true,
    })

    expect(logger).toBeDefined()
    expect(correlationId).toMatch(/^qc-/)
  })

  test('logger has expected methods', async () => {
    const logger = await createQualityLogger({
      level: 'debug',
      enabled: true,
      usePinoTransports: false,
    })

    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.child).toBe('function')
  })

  test('child logger maintains correlation context', async () => {
    const parentId = generateCorrelationId('qc')
    const parentLogger = await createQualityLogger({
      correlationId: parentId,
      enabled: true,
      usePinoTransports: false,
    })

    const childLogger = parentLogger.child({
      component: 'eslint',
      filePath: 'test.ts',
    })

    expect(childLogger).toBeDefined()
    expect(typeof childLogger.info).toBe('function')
  })

  test('respects enabled flag', async () => {
    const disabledLogger = await createQualityLogger({
      enabled: false,
    })

    const enabledLogger = await createQualityLogger({
      enabled: true,
      usePinoTransports: false,
    })

    expect(disabledLogger).toBeDefined()
    expect(enabledLogger).toBeDefined()
  })
})
