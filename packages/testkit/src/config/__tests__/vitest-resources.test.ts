/**
 * Integration tests for vitest resource management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  setupResourceCleanup,
  enableResourceCleanup,
  enableResourceCleanupWithDebugging,
  useResourceManager,
  bridgeLegacyCleanup,
} from '../vitest-resources.js'
import {
  registerResource,
  cleanupAllResources,
  getResourceStats,
  ResourceCategory,
  clearAllResources,
} from '../../resources/index.js'

describe('vitest-resources integration', () => {
  // Clean up any resources from previous tests
  beforeEach(async () => {
    clearAllResources() // Clear all state including counters
    await cleanupAllResources()
    // Verify cleanup worked
    const stats = getResourceStats()
    if (stats.total > 0) {
      console.warn(`Warning: ${stats.total} resources still registered after cleanup`)
      // Force cleanup of any remaining resources
      await cleanupAllResources({ force: true })
    }
  })

  afterEach(async () => {
    // Ensure cleanup after each test
    await cleanupAllResources()
    clearAllResources() // Reset state for next test
    vi.clearAllMocks()
  })

  describe('setupResourceCleanup', () => {
    it('should register vitest hooks for resource cleanup', () => {
      // Mock console to capture log output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Setup with logging enabled
      setupResourceCleanup({
        logStats: true,
        enableLeakDetection: true,
      })

      // Register a test resource
      registerResource(
        'test-resource',
        () => {
          // Cleanup function
        },
        {
          category: ResourceCategory.CRITICAL,
          description: 'Test resource for vitest integration',
        },
      )

      const stats = getResourceStats()
      expect(stats.total).toBe(1)
      expect(stats.byCategory[ResourceCategory.CRITICAL]).toBe(1)

      consoleSpy.mockRestore()
    })

    it('should respect cleanup exclusions', async () => {
      // Setup with process exclusions
      setupResourceCleanup({
        cleanupAfterEach: true,
        excludeCategories: [ResourceCategory.PROCESS],
      })

      // Register resources of different categories
      registerResource('memory-resource', () => {}, {
        category: ResourceCategory.CRITICAL,
        description: 'Memory resource',
      })

      registerResource('process-resource', () => {}, {
        category: ResourceCategory.PROCESS,
        description: 'Process resource',
      })

      const initialStats = getResourceStats()
      expect(initialStats.total).toBe(2)

      // Cleanup excluding processes
      await cleanupAllResources({
        excludeCategories: [ResourceCategory.PROCESS],
      })

      const finalStats = getResourceStats()
      expect(finalStats.total).toBe(1)
      expect(finalStats.byCategory[ResourceCategory.PROCESS]).toBe(1)
      expect(finalStats.byCategory[ResourceCategory.CRITICAL]).toBe(0)
    })

    it('should handle cleanup errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      setupResourceCleanup({
        cleanupAfterEach: true,
        logStats: true,
      })

      // Register a resource that will fail cleanup
      registerResource(
        'failing-resource',
        () => {
          throw new Error('Cleanup failed')
        },
        {
          category: ResourceCategory.CRITICAL,
          description: 'Failing resource',
        },
      )

      // Trigger cleanup manually (simulating afterEach)
      const result = await cleanupAllResources()

      expect(result.errorCount).toBe(1)
      expect(result.errors[0].resourceId).toBe('failing-resource')
      expect(result.errors[0].error.message).toBe('Cleanup failed')

      consoleSpy.mockRestore()
    })
  })

  describe('enableResourceCleanup', () => {
    it('should setup resource cleanup with default options', () => {
      // This should not throw
      enableResourceCleanup()

      // Register a test resource to verify it works
      registerResource('default-test', () => {}, {
        category: ResourceCategory.CRITICAL,
        description: 'Default test resource',
      })

      const stats = getResourceStats()
      expect(stats.total).toBe(1)
    })
  })

  describe('enableResourceCleanupWithDebugging', () => {
    it('should setup resource cleanup with debugging enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      enableResourceCleanupWithDebugging()

      // Register a test resource
      registerResource('debug-test', () => {}, {
        category: ResourceCategory.CRITICAL,
        description: 'Debug test resource',
      })

      const stats = getResourceStats()
      expect(stats.total).toBe(1)

      consoleSpy.mockRestore()
    })
  })

  describe('useResourceManager', () => {
    it('should provide manual resource management functions', async () => {
      const { cleanup, detectLeaks, getStats, cleanupByCategory } = useResourceManager()

      // Register resources of different categories
      registerResource('memory-1', () => {}, {
        category: ResourceCategory.CRITICAL,
        description: 'Memory resource 1',
      })

      registerResource('file-1', () => {}, {
        category: ResourceCategory.FILE,
        description: 'File resource 1',
      })

      // Test getStats
      const stats = getStats()
      expect(stats.total).toBe(2)
      expect(stats.byCategory[ResourceCategory.CRITICAL]).toBe(1)
      expect(stats.byCategory[ResourceCategory.FILE]).toBe(1)

      // Test cleanupByCategory
      await cleanupByCategory(ResourceCategory.CRITICAL)

      const afterCategoryCleanup = getStats()
      expect(afterCategoryCleanup.total).toBe(1)
      expect(afterCategoryCleanup.byCategory[ResourceCategory.FILE]).toBe(1)

      // Test detectLeaks (there shouldn't be any yet)
      const leaks = detectLeaks()
      expect(leaks).toHaveLength(0)

      // Test cleanup
      await cleanup()

      const finalStats = getStats()
      expect(finalStats.total).toBe(0)
    })
  })

  describe('bridgeLegacyCleanup', () => {
    it('should register legacy cleanup with resource manager', async () => {
      let legacyCleanupCalled = false
      const legacyCleanup = () => {
        legacyCleanupCalled = true
      }

      bridgeLegacyCleanup(legacyCleanup, ResourceCategory.DATABASE, 'Legacy database cleanup')

      // Wait for the dynamic import to complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      const stats = getResourceStats()
      expect(stats.total).toBe(1)
      expect(stats.byCategory[ResourceCategory.DATABASE]).toBe(1)

      // Cleanup should call the legacy cleanup
      await cleanupAllResources()
      expect(legacyCleanupCalled).toBe(true)
    })
  })

  describe('resource leak detection', () => {
    it('should detect resource leaks', async () => {
      // Create a test-specific resource manager with short leak detection age
      const { ResourceManager } = await import('../../resources/manager.js')
      const testManager = new ResourceManager({
        leakDetectionAge: 30, // 30ms for testing
        enableLogging: false,
      })

      // Register a resource that wont be cleaned up immediately
      testManager.register('potential-leak', () => {}, {
        category: ResourceCategory.CRITICAL,
        description: 'Resource that might leak',
      })

      // Wait for the resource to age
      await new Promise((resolve) => setTimeout(resolve, 50))

      const leaks = testManager.detectLeaks()
      expect(leaks).toHaveLength(1)
      expect(leaks[0].resourceId).toBe('potential-leak')
      expect(leaks[0].category).toBe(ResourceCategory.CRITICAL)
      expect(leaks[0].age).toBeGreaterThan(30)
    })
  })

  describe('integration with fs cleanup', () => {
    it('should work with temp directory cleanup', async () => {
      // Import fs cleanup functions
      const { useTempDirectoryWithResourceManager } = await import('../../fs/cleanup.js')

      setupResourceCleanup({
        logStats: true,
      })

      // Create a temp directory using resource manager integration
      const tempDir = await useTempDirectoryWithResourceManager({ prefix: 'test-' })

      expect(tempDir.path).toMatch(/test-/)

      // Verify it's registered with resource manager
      const stats = getResourceStats()
      expect(stats.total).toBe(1)
      expect(stats.byCategory[ResourceCategory.FILE]).toBe(1)

      // Cleanup should handle the temp directory
      await cleanupAllResources()

      const finalStats = getResourceStats()
      expect(finalStats.total).toBe(0)
    })
  })

  describe('integration with sqlite cleanup', () => {
    it('should work with SQLite database cleanup', async () => {
      // Import sqlite cleanup functions
      const { createDatabaseWithResourceManager } = await import('../../sqlite/cleanup.js')

      setupResourceCleanup({
        logStats: true,
      })

      // Create a mock database object
      let cleanupCalled = false
      const mockDb = {
        cleanup: async () => {
          cleanupCalled = true
        },
      }

      // Register database using resource manager integration
      const db = await createDatabaseWithResourceManager(() => mockDb, 'Test SQLite database')

      expect(db).toBe(mockDb)

      // Verify it's registered with resource manager
      const stats = getResourceStats()
      expect(stats.total).toBe(1)
      expect(stats.byCategory[ResourceCategory.DATABASE]).toBe(1)

      // Cleanup should handle the database
      await cleanupAllResources()

      expect(cleanupCalled).toBe(true)

      const finalStats = getResourceStats()
      expect(finalStats.total).toBe(0)
    })
  })

  describe('custom cleanup options', () => {
    it('should respect custom timeout options', async () => {
      const { cleanup } = useResourceManager()

      // Register a resource with a slow cleanup
      let cleanupStarted = false
      let cleanupCompleted = false

      registerResource(
        'slow-cleanup',
        async () => {
          cleanupStarted = true
          await new Promise((resolve) => setTimeout(resolve, 100))
          cleanupCompleted = true
        },
        {
          category: ResourceCategory.CRITICAL,
          description: 'Slow cleanup resource',
        },
      )

      // Cleanup with custom timeout
      const startTime = Date.now()
      await cleanup({
        timeout: 200, // Give enough time for slow cleanup
      })
      const endTime = Date.now()

      expect(cleanupStarted).toBe(true)
      expect(cleanupCompleted).toBe(true)
      expect(endTime - startTime).toBeGreaterThan(90) // Should take at least 100ms
    })

    it('should handle cleanup timeouts', async () => {
      const { cleanup } = useResourceManager()

      // Register a resource with a very slow cleanup
      registerResource(
        'very-slow-cleanup',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second
        },
        {
          category: ResourceCategory.CRITICAL,
          description: 'Very slow cleanup resource',
        },
      )

      // Cleanup with short timeout
      const result = await cleanup({
        timeout: 50, // Very short timeout
      })

      // Should have timeout error
      expect(result.errorCount).toBe(1)
      expect(result.errors[0].error.message).toMatch(/timeout/i)
    })
  })

  describe('parallel cleanup', () => {
    it('should support parallel cleanup', async () => {
      const { cleanup } = useResourceManager()

      const cleanupTimes: number[] = []

      // Register multiple resources
      for (let i = 0; i < 3; i++) {
        registerResource(
          `parallel-${i}`,
          async () => {
            const start = Date.now()
            await new Promise((resolve) => setTimeout(resolve, 50))
            cleanupTimes.push(Date.now() - start)
          },
          {
            category: ResourceCategory.CRITICAL,
            description: `Parallel cleanup resource ${i}`,
          },
        )
      }

      const startTime = Date.now()
      await cleanup({ parallel: true })
      const totalTime = Date.now() - startTime

      // With parallel cleanup, total time should be close to individual time
      expect(totalTime).toBeLessThan(150) // Should be much less than 3 * 50ms
      expect(cleanupTimes).toHaveLength(3)
    })
  })
})
