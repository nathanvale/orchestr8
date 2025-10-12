/**
 * Tests for pre-configured test setup module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestSetup } from '../index.js'
import * as configModule from '../../config/index.js'

// Mock the config and utils modules
vi.mock('../../config/index.js', () => ({
  setupResourceCleanup: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/index.js', () => ({
  cleanupAllResources: vi.fn().mockResolvedValue({
    resourcesCleaned: 0,
    errors: [],
    summary: {},
  }),
}))

// Shared console spy for all tests
let consoleLogSpy: ReturnType<typeof vi.spyOn>

describe('createTestSetup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Create shared console spy
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('should call setupResourceCleanup with default options', async () => {
    await createTestSetup()

    expect(configModule.setupResourceCleanup).toHaveBeenCalledWith({
      cleanupAfterEach: true,
      cleanupAfterAll: true,
      enableLeakDetection: true,
      logStats: false,
    })
  })

  it('should call setupResourceCleanup with custom options', async () => {
    await createTestSetup({
      cleanupAfterEach: false,
      enableLeakDetection: false,
      logStats: true,
    })

    expect(configModule.setupResourceCleanup).toHaveBeenCalledWith({
      cleanupAfterEach: false,
      cleanupAfterAll: true,
      enableLeakDetection: false,
      logStats: true,
    })
  })

  it('should respect LOG_CLEANUP_STATS environment variable', async () => {
    const originalEnv = process.env['LOG_CLEANUP_STATS']
    process.env['LOG_CLEANUP_STATS'] = '1'

    await createTestSetup()

    expect(configModule.setupResourceCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        logStats: true,
      }),
    )

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env['LOG_CLEANUP_STATS']
    } else {
      process.env['LOG_CLEANUP_STATS'] = originalEnv
    }
  })

  it('should log package name when provided in non-production', async () => {
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'test'

    await createTestSetup({ packageName: 'my-test-package' })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '✅ TestKit resource cleanup configured (my-test-package)',
    )

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV']
    } else {
      process.env['NODE_ENV'] = originalEnv
    }
  })

  it('should not log in production environment', async () => {
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'production'

    await createTestSetup({ packageName: 'my-test-package' })

    expect(consoleLogSpy).not.toHaveBeenCalled()

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV']
    } else {
      process.env['NODE_ENV'] = originalEnv
    }
  })

  it('should log without package name when logStats is true', async () => {
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'test'

    await createTestSetup({ logStats: true })

    expect(consoleLogSpy).toHaveBeenCalledWith('✅ TestKit resource cleanup configured')

    // Restore environment
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV']
    } else {
      process.env['NODE_ENV'] = originalEnv
    }
  })

  it('should forward additional resource options', async () => {
    await createTestSetup({
      cleanupOptions: {
        timeout: 5000,
        continueOnError: true,
      },
      excludeCategories: [],
    })

    expect(configModule.setupResourceCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanupOptions: {
          timeout: 5000,
          continueOnError: true,
        },
        excludeCategories: [],
      }),
    )
  })
})
