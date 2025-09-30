/**
 * Simple integration test to verify vitest resource management works
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  registerResource,
  cleanupAllResources,
  getResourceStats,
  ResourceCategory,
} from '../../resources/index.js'

describe('simple vitest-resources integration', () => {
  afterEach(async () => {
    // Clean up after each test
    await cleanupAllResources()
  })

  it('should register and cleanup resources', async () => {
    // Initially no resources
    const initialStats = getResourceStats()
    expect(initialStats.total).toBe(0)

    // Register a resource
    let cleanupCalled = false
    registerResource(
      'test-resource',
      () => {
        cleanupCalled = true
      },
      {
        category: ResourceCategory.CRITICAL,
        description: 'Test resource',
      },
    )

    // Should have one resource registered
    const afterRegister = getResourceStats()
    expect(afterRegister.total).toBe(1)
    expect(afterRegister.byCategory[ResourceCategory.CRITICAL]).toBe(1)

    // Cleanup should call our cleanup function
    const result = await cleanupAllResources()
    expect(cleanupCalled).toBe(true)
    expect(result.successCount).toBe(1)
    expect(result.errorCount).toBe(0)

    // Should have no resources after cleanup
    const finalStats = getResourceStats()
    expect(finalStats.total).toBe(0)
  })

  it('should handle fs integration', async () => {
    const { useTempDirectoryWithResourceManager } = await import('../../fs/cleanup.js')

    // Create temp directory with resource manager
    const tempDir = await useTempDirectoryWithResourceManager({ prefix: 'integration-test-' })

    // Should be registered
    const stats = getResourceStats()
    expect(stats.total).toBe(1)
    expect(stats.byCategory[ResourceCategory.FILE]).toBe(1)

    // Cleanup should work
    await cleanupAllResources()

    const finalStats = getResourceStats()
    expect(finalStats.total).toBe(0)
  })

  it('should handle sqlite integration', async () => {
    const { createDatabaseWithResourceManager } = await import('../../sqlite/cleanup.js')

    let cleanupCalled = false
    const mockDb = {
      cleanup: async () => {
        cleanupCalled = true
      },
    }

    // Create database with resource manager
    await createDatabaseWithResourceManager(() => mockDb, 'Test database')

    // Should be registered
    const stats = getResourceStats()
    expect(stats.total).toBe(1)
    expect(stats.byCategory[ResourceCategory.DATABASE]).toBe(1)

    // Cleanup should work
    await cleanupAllResources()
    expect(cleanupCalled).toBe(true)

    const finalStats = getResourceStats()
    expect(finalStats.total).toBe(0)
  })
})
