/**
 * Resource management type definitions for @orchestr8/testkit
 */

/**
 * Categories for organizing different types of resources
 */
export enum ResourceCategory {
  /** Database connections, transactions, prepared statements */
  DATABASE = 'database',
  /** File descriptors, temporary files, file watchers */
  FILE = 'file',
  /** Child processes, worker threads, process monitors */
  PROCESS = 'process',
  /** setTimeout, setInterval, immediate timers */
  TIMER = 'timer',
  /** TCP/UDP sockets, HTTP connections, WebSockets */
  NETWORK = 'network',
  /** Event listeners, subscriptions, custom emitters */
  EVENT = 'event',
  /** Critical system resources that must be cleaned first */
  CRITICAL = 'critical',
}

/**
 * Priority levels determining cleanup order (lower number = higher priority)
 */
export enum ResourcePriority {
  /** Critical resources that must be cleaned first (DB connections, file locks) */
  CRITICAL = 0,
  /** High priority resources (open files, network connections) */
  HIGH = 1,
  /** Medium priority resources (timers, event listeners) */
  MEDIUM = 2,
  /** Low priority resources (temporary files, caches) */
  LOW = 3,
}

/**
 * Synchronous cleanup function
 */
export type SyncCleanupFunction = () => void

/**
 * Asynchronous cleanup function
 */
export type AsyncCleanupFunction = () => Promise<void>

/**
 * Union type for cleanup functions
 */
export type CleanupFunction = SyncCleanupFunction | AsyncCleanupFunction

/**
 * Options for resource registration
 */
export interface ResourceOptions {
  /** Resource category for organization and batch operations */
  category?: ResourceCategory
  /** Cleanup priority (defaults to category-based priority) */
  priority?: ResourcePriority
  /** Human-readable description of the resource */
  description?: string
  /** Tags for additional categorization and filtering */
  tags?: string[]
  /** Timeout in milliseconds for cleanup operation */
  timeout?: number
  /** IDs of resources that must be cleaned before this one */
  dependencies?: string[]
  /** Additional metadata for the resource */
  metadata?: Record<string, unknown>
}

/**
 * Complete resource definition with all properties
 */
export interface ResourceDefinition {
  /** Unique identifier for the resource */
  id: string
  /** Function to clean up the resource */
  cleanup: CleanupFunction
  /** Resource category */
  category: ResourceCategory
  /** Cleanup priority */
  priority: ResourcePriority
  /** Optional description */
  description?: string
  /** Optional tags */
  tags?: string[]
  /** Cleanup timeout in milliseconds */
  timeout?: number
  /** Dependencies that must be cleaned first */
  dependencies?: string[]
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Timestamp when resource was registered */
  registeredAt: number
  /** Whether resource has been cleaned */
  cleaned: boolean
}

export interface CleanupOptions {
  /** Only cleanup resources with these categories */
  categories?: ResourceCategory[]
  /** Only cleanup resources with these tags */
  tags?: string[]
  /** Only cleanup resources with these IDs */
  ids?: string[]
  /** Skip resources with these IDs */
  exclude?: string[]
  /** Skip resources with these categories */
  excludeCategories?: ResourceCategory[]
  /** Force cleanup even if dependencies exist */
  force?: boolean
  /** Global timeout for entire cleanup operation */
  timeout?: number
  /** Continue cleanup even if some resources fail */
  continueOnError?: boolean
  /** Enable parallel cleanup (default: false) */
  parallel?: boolean
}
/**
 * Error that occurred during resource cleanup
 */
export interface CleanupError {
  /** ID of the resource that failed to cleanup */
  resourceId: string
  /** Category of the failed resource */
  category: ResourceCategory
  /** The error that occurred */
  error: Error
  /** Whether the failure was due to timeout */
  timeout: boolean
  /** Timestamp when the error occurred */
  timestamp: number
}

/**
 * Summary of cleanup results for a category
 */
export interface CleanupCategorySummary {
  /** Number of resources successfully cleaned */
  success: number
  /** Number of resources that failed to clean */
  failed: number
  /** Total duration for category cleanup */
  duration: number
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Whether the overall cleanup was successful */
  success: boolean
  /** Total number of resources processed */
  resourcesProcessed: number
  /** Number of resources successfully cleaned */
  resourcesCleaned: number
  /** Errors that occurred during cleanup */
  errors: CleanupError[]
  /** Number of errors that occurred during cleanup */
  errorCount: number
  /** Total duration of cleanup operation in milliseconds */
  duration: number
  /** Summary by category */
  summary: Record<ResourceCategory, CleanupCategorySummary>
  /** Resources that were skipped due to dependencies */
  skipped: string[]
}

/**
 * Resource leak detection result
 */
export interface ResourceLeak {
  /** ID of the leaked resource */
  resourceId: string
  /** Category of the leaked resource */
  category: ResourceCategory
  /** How long the resource has been registered (ms) */
  age: number
  /** Description of the resource */
  description?: string
  /** Tags associated with the resource */
  tags?: string[]
  /** Whether the resource appears to be actively used */
  potentialLeak: boolean
}

/**
 * Resource usage statistics
 */
export interface ResourceStats {
  /** Total number of registered resources */
  /** Total number of resources ever registered (including cleaned ones) */
  totalRegistered: number
  total: number
  /** Resources by category */
  byCategory: Record<ResourceCategory, number>
  /** Resources by priority */
  byPriority: Record<ResourcePriority, number>
  /** Number of cleaned resources */
  cleaned: number
  /** Average age of resources in milliseconds */
  averageAge: number
  /** Oldest resource age in milliseconds */
  oldestAge: number
  /** Potential leaks detected */
  potentialLeaks: number
}

/**
 * Configuration for the ResourceManager
 */
export interface ResourceManagerConfig {
  /** Default timeout for cleanup operations (ms) */
  defaultTimeout?: number
  /** Whether to automatically register process exit handlers */
  autoRegisterProcessHandlers?: boolean
  /** Maximum age before resource is considered a potential leak (ms) */
  leakDetectionAge?: number
  /** Whether to log cleanup operations */
  enableLogging?: boolean
  /** Maximum number of resources to track */
  maxResources?: number
  /** Whether to collect performance metrics */
  enableMetrics?: boolean
}

/**
 * Event types emitted by ResourceManager
 */
export enum ResourceEvent {
  /** Fired when a resource is registered */
  RESOURCE_REGISTERED = 'resource:registered',
  /** Fired when a resource is unregistered */
  RESOURCE_UNREGISTERED = 'resource:unregistered',
  /** Fired when a resource is cleaned */
  RESOURCE_CLEANED = 'resource:cleaned',
  /** Fired when resource cleanup fails */
  RESOURCE_CLEANUP_FAILED = 'resource:cleanup:failed',
  /** Fired when cleanup operation starts */
  CLEANUP_STARTED = 'cleanup:started',
  /** Fired when cleanup operation completes */
  CLEANUP_COMPLETED = 'cleanup:completed',
  /** Fired when potential leak is detected */
  LEAK_DETECTED = 'leak:detected',
}

/**
 * Event data for resource operations
 */
export interface ResourceEventData {
  /** ID of the resource */
  resourceId: string
  /** Category of the resource */
  category: ResourceCategory
  /** Timestamp of the event */
  timestamp: number
  /** Additional event-specific data */
  data?: Record<string, unknown>
}

/**
 * Type guard to check if a function is async
 */
export function isAsyncCleanupFunction(fn: CleanupFunction): fn is AsyncCleanupFunction {
  return fn.constructor.name === 'AsyncFunction' || fn.toString().startsWith('async ')
}

/**
 * Default resource priorities by category
 */
export const DEFAULT_CATEGORY_PRIORITIES: Record<ResourceCategory, ResourcePriority> = {
  [ResourceCategory.CRITICAL]: ResourcePriority.CRITICAL,
  [ResourceCategory.DATABASE]: ResourcePriority.CRITICAL,
  [ResourceCategory.FILE]: ResourcePriority.HIGH,
  [ResourceCategory.NETWORK]: ResourcePriority.HIGH,
  [ResourceCategory.PROCESS]: ResourcePriority.HIGH,
  [ResourceCategory.EVENT]: ResourcePriority.MEDIUM,
  [ResourceCategory.TIMER]: ResourcePriority.MEDIUM,
}

/**
 * Default timeouts by category (in milliseconds)
 */
export const DEFAULT_CATEGORY_TIMEOUTS: Record<ResourceCategory, number> = {
  [ResourceCategory.CRITICAL]: 30000, // 30 seconds
  [ResourceCategory.DATABASE]: 15000,  // 15 seconds
  [ResourceCategory.FILE]: 10000,      // 10 seconds
  [ResourceCategory.NETWORK]: 10000,   // 10 seconds
  [ResourceCategory.PROCESS]: 20000,   // 20 seconds
  [ResourceCategory.EVENT]: 5000,      // 5 seconds
  [ResourceCategory.TIMER]: 5000,      // 5 seconds
}