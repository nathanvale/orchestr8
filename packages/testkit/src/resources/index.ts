/**
 * Resource management exports for @orchestr8/testkit
 *
 * Comprehensive resource cleanup system to prevent memory leaks and resource exhaustion.
 * Tracks and manages cleanup of database connections, file descriptors, processes,
 * timers, network connections, and event listeners.
 */

// Export main ResourceManager class and global instance
export {
  ResourceManager,
  globalResourceManager,
  registerResource,
  registerFileDescriptor,
  cleanupAllResources,
  getResourceStats,
  detectResourceLeaks,
} from './manager.js'

// Export all types and enums
export {
  ResourceCategory,
  ResourcePriority,
  ResourceEvent,
  type SyncCleanupFunction,
  type AsyncCleanupFunction,
  type CleanupFunction,
  type ResourceOptions,
  type ResourceDefinition,
  type CleanupOptions,
  type CleanupError,
  type CleanupCategorySummary,
  type CleanupResult,
  type ResourceLeak,
  type ResourceStats,
  type ResourceManagerConfig,
  type ResourceEventData,
  isAsyncCleanupFunction,
  DEFAULT_CATEGORY_PRIORITIES,
  DEFAULT_CATEGORY_TIMEOUTS,
} from './types.js'

/**
 * @example Basic usage
 * ```typescript
 * import { registerResource, registerFileDescriptor, cleanupAllResources, ResourceCategory } from '@orchestr8/testkit/resources'
 *
 * // Register a database connection for cleanup
 * registerResource('db-connection', () => db.close(), {
 *   category: ResourceCategory.DATABASE,
 *   description: 'Main database connection',
 *   priority: ResourcePriority.CRITICAL
 * })
 *
 * // Register a file descriptor for automatic cleanup
 * const fd = fs.openSync('/tmp/data.txt', 'r')
 * registerFileDescriptor('data-file', fd, '/tmp/data.txt')
 *
 * // Register a temporary file for cleanup
 * registerResource('temp-file', () => fs.unlink('/tmp/test.txt'), {
 *   category: ResourceCategory.FILE,
 *   description: 'Temporary test file'
 * })
 *
 * // Cleanup all resources at the end of tests
 * await cleanupAllResources()
 * ```
 *
 * @example Advanced usage with custom manager
 * ```typescript
 * import { ResourceManager, ResourceCategory } from '@orchestr8/testkit/resources'
 *
 * const manager = new ResourceManager({
 *   defaultTimeout: 5000,
 *   enableLogging: true,
 *   leakDetectionAge: 30000
 * })
 *
 * // Register resources with dependencies
 * manager.register('connection-pool', () => pool.close())
 * manager.register('transaction', () => tx.rollback(), {
 *   dependencies: ['connection-pool'], // Will be cleaned before connection-pool
 *   category: ResourceCategory.DATABASE
 * })
 *
 * // Cleanup by category
 * await manager.cleanupByCategory(ResourceCategory.DATABASE)
 *
 * // Check for resource leaks
 * const leaks = manager.detectLeaks()
 * if (leaks.length > 0) {
 *   console.warn('Potential resource leaks detected:', leaks)
 * }
 * ```
 *
 * @example Event-driven cleanup monitoring
 * ```typescript
 * import { globalResourceManager, ResourceEvent } from '@orchestr8/testkit/resources'
 *
 * globalResourceManager.on(ResourceEvent.RESOURCE_CLEANED, (data) => {
 *   console.log(`Cleaned resource: ${data.resourceId} (${data.category})`)
 * })
 *
 * globalResourceManager.on(ResourceEvent.LEAK_DETECTED, (data) => {
 *   console.warn(`Potential leak detected: ${data.resourceId}`)
 * })
 * ```
 */
