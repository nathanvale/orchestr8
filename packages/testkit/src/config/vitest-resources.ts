/**
 * Vitest resource management integration
 *
 * Provides lifecycle hooks that integrate the resource manager with vitest
 * test execution. Ensures all registered resources are cleaned up automatically
 * during test lifecycle events.
 */

import { beforeEach, afterEach, afterAll } from 'vitest'
import {
  cleanupAllResources,
  getResourceStats,
  detectResourceLeaks,
  type CleanupOptions,
  type ResourceLeak,
  ResourceCategory,
} from '../resources/index.js'

/**
 * Options for vitest resource management setup
 */
export interface VitestResourceOptions {
  /** Clean up resources after each test (default: true) */
  cleanupAfterEach?: boolean
  /** Clean up resources after all tests (default: true) */
  cleanupAfterAll?: boolean
  /** Enable resource leak detection (default: true) */
  enableLeakDetection?: boolean
  /** Custom cleanup options */
  cleanupOptions?: CleanupOptions
  /** Log resource statistics (default: false) */
  logStats?: boolean
  /** Categories to exclude from automatic cleanup */
  excludeCategories?: ResourceCategory[]
}

/**
 * Default vitest resource options
 */
const DEFAULT_VITEST_RESOURCE_OPTIONS: Required<VitestResourceOptions> = {
  cleanupAfterEach: true,
  cleanupAfterAll: true,
  enableLeakDetection: true,
  cleanupOptions: {},
  logStats: false,
  excludeCategories: [],
}

/**
 * Set up resource management hooks for vitest
 *
 * This function registers vitest lifecycle hooks to automatically clean up
 * resources and detect leaks during test execution.
 *
 * @param options - Configuration options for resource management
 *
 * @example
 * ```typescript
 * // In your vitest setup file or test file
 * import { setupResourceCleanup } from '@orchestr8/testkit/config'
 *
 * setupResourceCleanup({
 *   cleanupAfterEach: true,
 *   enableLeakDetection: true,
 *   logStats: true
 * })
 * ```
 *
 * @example Custom cleanup with exclusions
 * ```typescript
 * import { setupResourceCleanup, ResourceCategory } from '@orchestr8/testkit/config'
 *
 * setupResourceCleanup({
 *   cleanupAfterEach: true,
 *   excludeCategories: [ResourceCategory.PROCESS], // Keep processes running
 *   cleanupOptions: {
 *     timeout: 10000, // Custom timeout
 *     parallel: true
 *   }
 * })
 * ```
 */
export function setupResourceCleanup(options: VitestResourceOptions = {}): void {
  const config = { ...DEFAULT_VITEST_RESOURCE_OPTIONS, ...options }

  // Store initial resource count to detect leaks from previous tests
  let initialResourceCount = 0

  beforeEach(() => {
    const stats = getResourceStats()
    initialResourceCount = stats.total

    if (config.logStats && initialResourceCount > 0) {
      console.log(
        `[Resource Manager] Test starting with ${initialResourceCount} pre-existing resources`,
      )
    }
  })

  if (config.cleanupAfterEach) {
    afterEach(async () => {
      // Perform cleanup excluding specified categories
      const cleanupOptions = {
        ...config.cleanupOptions,
        exclude: config.excludeCategories.map((cat) => cat.toString()),
      }

      const cleanupResult = await cleanupAllResources(cleanupOptions)

      if (config.logStats) {
        console.log(`[Resource Manager] After test cleanup:`, {
          resourcesCleaned: cleanupResult.resourcesCleaned,
          errors: cleanupResult.errors.length,
          categories: Object.keys(cleanupResult.summary),
        })
      }

      // Log cleanup errors as warnings
      if (cleanupResult.errors.length > 0) {
        console.warn(`[Resource Manager] Cleanup errors in afterEach:`)
        cleanupResult.errors.forEach((error, index) => {
          console.warn(`  ${index + 1}. ${error.resourceId}: ${error.error.message}`)
        })
      }

      // Detect resource leaks if enabled
      if (config.enableLeakDetection) {
        const leaks = detectResourceLeaks()
        const newLeaks = leaks.filter((leak) => !config.excludeCategories.includes(leak.category))

        if (newLeaks.length > 0) {
          console.warn(`[Resource Manager] Potential resource leaks detected after test:`)
          newLeaks.forEach((leak, index) => {
            console.warn(
              `  ${index + 1}. ${leak.resourceId} (${leak.category}) - age: ${leak.age}ms`,
            )
            if (leak.description) {
              console.warn(`     Description: ${leak.description}`)
            }
          })
        }
      }
    })
  }

  if (config.cleanupAfterAll) {
    afterAll(async () => {
      // Final cleanup of all resources
      const cleanupOptions = {
        ...config.cleanupOptions,
        excludeCategories: [], // Clean everything in afterAll
      }

      const cleanupResult = await cleanupAllResources(cleanupOptions)

      if (config.logStats) {
        console.log(`[Resource Manager] Final cleanup completed:`, {
          resourcesCleaned: cleanupResult.resourcesCleaned,
          errors: cleanupResult.errors.length,
          categories: Object.keys(cleanupResult.summary),
        })
      }

      // Log any final cleanup errors
      if (cleanupResult.errors.length > 0) {
        console.warn(`[Resource Manager] Final cleanup errors:`)
        cleanupResult.errors.forEach((error, index) => {
          console.warn(`  ${index + 1}. ${error.resourceId}: ${error.error.message}`)
        })
      }

      // Final leak detection
      if (config.enableLeakDetection) {
        const finalLeaks = detectResourceLeaks()
        if (finalLeaks.length > 0) {
          console.error(`[Resource Manager] Resource leaks remaining after all tests:`)
          finalLeaks.forEach((leak, index) => {
            console.error(
              `  ${index + 1}. ${leak.resourceId} (${leak.category}) - age: ${leak.age}ms`,
            )
            if (leak.description) {
              console.error(`     Description: ${leak.description}`)
            }
          })
        }
      }
    })
  }
}

/**
 * Quick setup for resource cleanup with sensible defaults
 *
 * Equivalent to calling setupResourceCleanup() with default options.
 * Use this for simple test setups that just want automatic cleanup.
 *
 * @example
 * ```typescript
 * import { enableResourceCleanup } from '@orchestr8/testkit/config'
 *
 * // In your test setup
 * enableResourceCleanup()
 * ```
 */
export function enableResourceCleanup(): void {
  setupResourceCleanup()
}

/**
 * Setup resource cleanup with leak detection and logging enabled
 *
 * Useful for debugging resource leaks in tests.
 *
 * @example
 * ```typescript
 * import { enableResourceCleanupWithDebugging } from '@orchestr8/testkit/config'
 *
 * // In your test setup when debugging resource issues
 * enableResourceCleanupWithDebugging()
 * ```
 */
export function enableResourceCleanupWithDebugging(): void {
  setupResourceCleanup({
    enableLeakDetection: true,
    logStats: true,
    cleanupOptions: {
      // Note: enableLogging would need to be added to CleanupOptions type if needed
      continueOnError: true,
    },
  })
}

/**
 * Custom hook for manual resource management in specific tests
 *
 * Returns functions to manually trigger cleanup and leak detection.
 * Use this when you need fine-grained control over resource cleanup timing.
 *
 * @example
 * ```typescript
 * import { useResourceManager } from '@orchestr8/testkit/config'
 *
 * const { cleanup, detectLeaks, getStats } = useResourceManager()
 *
 * it('should manage resources manually', async () => {
 *   // Register some resources...
 *
 *   // Manual cleanup at specific point
 *   await cleanup()
 *
 *   // Check for leaks
 *   const leaks = detectLeaks()
 *   expect(leaks).toHaveLength(0)
 *
 *   // Get current stats
 *   const stats = getStats()
 *   console.log('Resource stats:', stats)
 * })
 * ```
 */
export function useResourceManager() {
  return {
    /**
     * Manually trigger resource cleanup
     */
    cleanup: (options?: CleanupOptions) => cleanupAllResources(options),

    /**
     * Detect resource leaks
     */
    detectLeaks: (): ResourceLeak[] => detectResourceLeaks(),

    /**
     * Get current resource statistics
     */
    getStats: () => getResourceStats(),

    /**
     * Clean up specific categories
     */
    cleanupByCategory: (category: ResourceCategory, options?: CleanupOptions) =>
      cleanupAllResources({ ...options, categories: [category] }),
  }
}

/**
 * Integration helper for existing cleanup patterns
 *
 * Bridges existing cleanup registries (like SQLite cleanup) with the resource manager.
 * Use this to migrate existing cleanup code to the resource manager gradually.
 *
 * @param legacyCleanup - Function that performs legacy cleanup
 * @param category - Resource category for the legacy cleanup
 * @param description - Description of the legacy cleanup
 *
 * @example
 * ```typescript
 * import { bridgeLegacyCleanup } from '@orchestr8/testkit/config'
 * import { cleanupAllSqlite } from '@orchestr8/testkit/sqlite'
 *
 * // Bridge SQLite cleanup with resource manager
 * bridgeLegacyCleanup(
 *   () => cleanupAllSqlite(),
 *   ResourceCategory.DATABASE,
 *   'Legacy SQLite cleanup'
 * )
 * ```
 */
export function bridgeLegacyCleanup(
  legacyCleanup: () => void | Promise<void>,
  category: ResourceCategory,
  description: string,
): void {
  // This will be implemented when we integrate with existing cleanup patterns
  // For now, we'll register it as a generic resource
  import('../resources/index.js').then(({ registerResource }) => {
    registerResource(`legacy-cleanup-${Date.now()}`, legacyCleanup, {
      category,
      description,
    })
  })
}
