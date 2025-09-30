/**
 * Resource cleanup manager for @orchestr8/testkit
 * Prevents memory leaks and resource exhaustion by tracking and cleaning up resources
 */

import {
  type ResourceCategory,
  type ResourcePriority,
  type CleanupFunction,
  type ResourceOptions,
  type ResourceDefinition,
  type CleanupOptions,
  type CleanupResult,
  type CleanupError,
  type CleanupCategorySummary,
  type ResourceLeak,
  type ResourceStats,
  type ResourceManagerConfig,
  type ResourceEventData,
  ResourceCategory as RC,
  ResourcePriority as RP,
  ResourceEvent,
  DEFAULT_CATEGORY_PRIORITIES,
  DEFAULT_CATEGORY_TIMEOUTS,
  isAsyncCleanupFunction,
} from './types.js'
import { createExitHandler } from '../utils/process-listeners.js'
import { closeSync } from 'node:fs'

/**
 * Main resource management class
 */
export class ResourceManager {
  private resources = new Map<string, ResourceDefinition>()
  private config: Required<ResourceManagerConfig>
  private processHandlersRegistered = false
  private cleanupInProgress = false
  private cleanupPromise: Promise<CleanupResult> | null = null
  private eventListeners = new Map<ResourceEvent, Set<(data: ResourceEventData) => void>>()
  private removeProcessListeners?: () => void
  private cleanedCount = 0

  constructor(config: ResourceManagerConfig = {}) {
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 10000,
      autoRegisterProcessHandlers: config.autoRegisterProcessHandlers ?? true,
      leakDetectionAge: config.leakDetectionAge ?? 60000, // 1 minute
      enableLogging: config.enableLogging ?? false,
      maxResources: config.maxResources ?? 10000,
      enableMetrics: config.enableMetrics ?? false,
    }

    if (this.config.autoRegisterProcessHandlers) {
      this.registerProcessHandlers()
    }
  }

  /**
   * Register a file descriptor for automatic cleanup
   * Prevents file descriptor leaks by ensuring files are closed on process exit
   */
  registerFileDescriptor(id: string, fd: number, path?: string): void {
    const cleanup = () => {
      try {
        closeSync(fd)
      } catch (error) {
        // File descriptor might already be closed
        if (this.config.enableLogging) {
          console.warn(`Failed to close file descriptor ${fd}: ${error}`)
        }
      }
    }

    this.register(id, cleanup, {
      category: RC.FILE,
      priority: RP.HIGH,
      description: path ? `File descriptor ${fd} for ${path}` : `File descriptor ${fd}`,
      tags: ['file-descriptor'],
      metadata: { fd, path },
    })
  }

  /**
   * Register a resource for cleanup
   */
  register(id: string, cleanup: CleanupFunction, options: ResourceOptions = {}): void {
    if (this.resources.has(id)) {
      throw new Error(`Resource with ID '${id}' is already registered`)
    }

    if (this.resources.size >= this.config.maxResources) {
      throw new Error(`Maximum number of resources (${this.config.maxResources}) exceeded`)
    }

    const category = options.category ?? RC.EVENT
    const priority = options.priority ?? DEFAULT_CATEGORY_PRIORITIES[category]
    const timeout = options.timeout ?? DEFAULT_CATEGORY_TIMEOUTS[category]

    const resource: ResourceDefinition = {
      id,
      cleanup,
      category,
      priority,
      description: options.description,
      tags: options.tags ? [...options.tags] : undefined,
      timeout,
      dependencies: options.dependencies ? [...options.dependencies] : undefined,
      metadata: options.metadata ? { ...options.metadata } : undefined,
      registeredAt: Date.now(),
      cleaned: false,
    }

    // Validate dependencies exist
    if (resource.dependencies) {
      for (const depId of resource.dependencies) {
        if (!this.resources.has(depId)) {
          throw new Error(`Dependency '${depId}' not found for resource '${id}'`)
        }
      }
    }

    this.resources.set(id, resource)
    this.emit(ResourceEvent.RESOURCE_REGISTERED, {
      resourceId: id,
      category,
      timestamp: Date.now(),
      data: { description: options.description, tags: options.tags },
    })

    this.log(`Registered resource: ${id} (${category})`)
  }

  /**
   * Unregister a resource
   */
  unregister(id: string): boolean {
    const resource = this.resources.get(id)
    if (!resource) {
      return false
    }

    // Check if other resources depend on this one
    const dependents = this.findDependents(id)
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister resource '${id}' - it has dependents: ${dependents.join(', ')}`,
      )
    }

    this.resources.delete(id)
    this.emit(ResourceEvent.RESOURCE_UNREGISTERED, {
      resourceId: id,
      category: resource.category,
      timestamp: Date.now(),
    })

    this.log(`Unregistered resource: ${id}`)
    return true
  }

  /**
   * Cleanup all resources or specific subset
   */
  async cleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    // Prevent concurrent cleanup operations
    if (this.cleanupInProgress) {
      if (this.cleanupPromise) {
        return this.cleanupPromise
      }
      throw new Error('Cleanup already in progress')
    }

    this.cleanupInProgress = true
    const startTime = Date.now()

    this.emit(ResourceEvent.CLEANUP_STARTED, {
      resourceId: 'all',
      category: RC.CRITICAL,
      timestamp: startTime,
      data: { options },
    })

    try {
      this.cleanupPromise = this.performCleanup(options, startTime)
      const result = await this.cleanupPromise

      this.emit(ResourceEvent.CLEANUP_COMPLETED, {
        resourceId: 'all',
        category: RC.CRITICAL,
        timestamp: Date.now(),
        data: { result },
      })

      return result
    } finally {
      this.cleanupInProgress = false
      this.cleanupPromise = null
    }
  }

  /**
   * Cleanup resources by category
   */
  async cleanupByCategory(category: ResourceCategory): Promise<CleanupResult> {
    return this.cleanup({ categories: [category] })
  }

  /**
   * Get current resource statistics
   */
  getStats(): ResourceStats {
    const now = Date.now()
    const resources = Array.from(this.resources.values())

    const byCategory = Object.values(RC).reduce(
      (acc, cat) => {
        acc[cat] = 0
        return acc
      },
      {} as Record<ResourceCategory, number>,
    )

    const byPriority = Object.values(RP).reduce(
      (acc, pri) => {
        acc[pri as ResourcePriority] = 0
        return acc
      },
      {} as Record<ResourcePriority, number>,
    )

    // Use persistent counter instead of counting current resources
    let totalAge = 0
    let oldestAge = 0

    for (const resource of resources) {
      byCategory[resource.category]++
      byPriority[resource.priority]++

      const age = now - resource.registeredAt
      totalAge += age
      oldestAge = Math.max(oldestAge, age)
    }

    const potentialLeaks = this.detectLeaks().length

    return {
      total: resources.length,
      byCategory,
      byPriority,
      cleaned: this.cleanedCount,
      averageAge: resources.length > 0 ? totalAge / resources.length : 0,
      oldestAge,
      potentialLeaks,
    }
  }

  /**
   * Detect potential resource leaks
   */
  detectLeaks(): ResourceLeak[] {
    const now = Date.now()
    const leaks: ResourceLeak[] = []

    for (const resource of this.resources.values()) {
      if (resource.cleaned) continue

      const age = now - resource.registeredAt
      if (age > this.config.leakDetectionAge) {
        leaks.push({
          resourceId: resource.id,
          category: resource.category,
          age,
          description: resource.description,
          tags: resource.tags,
          potentialLeak: age > this.config.leakDetectionAge * 2, // Very old resources
        })

        this.emit(ResourceEvent.LEAK_DETECTED, {
          resourceId: resource.id,
          category: resource.category,
          timestamp: now,
          data: { age, description: resource.description },
        })
      }
    }

    return leaks
  }

  /**
   * Register batch of resources
   */
  registerBatch(
    resources: Array<{
      id: string
      cleanup: CleanupFunction
      options?: ResourceOptions
    }>,
  ): void {
    for (const { id, cleanup, options } of resources) {
      this.register(id, cleanup, options)
    }
  }

  /**
   * Cleanup specific batch of resources by ID
   */
  async cleanupBatch(ids: string[]): Promise<CleanupResult> {
    return this.cleanup({ ids })
  }

  /**
   * Register process exit handlers
   */
  registerProcessHandlers(): void {
    if (this.processHandlersRegistered) {
      return
    }

    const handleExit = async () => {
      this.log('Process exit signal received - cleaning up resources')
      try {
        await this.cleanup({ timeout: 5000 }) // Quick cleanup on exit
      } catch (error) {
        console.error('Error during emergency cleanup:', error)
      }
    }

    // Use ProcessListenerManager to prevent memory leaks
    this.removeProcessListeners = createExitHandler(handleExit, {
      events: [
        'exit',
        'SIGINT',
        'SIGTERM',
        'beforeExit',
        'uncaughtException',
        'unhandledRejection',
      ],
      description: 'ResourceManager cleanup',
      timeout: 5000,
    })

    this.processHandlersRegistered = true
    this.log('Process exit handlers registered')
  }

  /**
   * Unregister process handlers (for testing)
   */
  unregisterProcessHandlers(): void {
    if (this.removeProcessListeners) {
      this.removeProcessListeners()
      this.removeProcessListeners = undefined
    }
    this.processHandlersRegistered = false
    this.log('Process exit handlers unregistered')
  }

  /**
   * Add event listener
   */
  on(event: ResourceEvent, listener: (data: ResourceEventData) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * Remove event listener
   */
  off(event: ResourceEvent, listener: (data: ResourceEventData) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(event?: ResourceEvent): void {
    if (event) {
      this.eventListeners.delete(event)
    } else {
      this.eventListeners.clear()
    }
  }

  /**
   * Get the number of registered resources
   */
  getResourceCount(): number {
    return this.resources.size
  }

  /**
   * Get resources grouped by category
   */
  getResourcesByCategory(): Record<ResourceCategory, number> {
    const counts = Object.values(RC).reduce(
      (acc, cat) => {
        acc[cat] = 0
        return acc
      },
      {} as Record<ResourceCategory, number>,
    )

    for (const resource of this.resources.values()) {
      counts[resource.category]++
    }

    return counts
  }

  /**
   * Check if a resource exists
   */
  hasResource(id: string): boolean {
    return this.resources.has(id)
  }

  /**
   * Get resource by ID
   */
  getResource(id: string): ResourceDefinition | undefined {
    return this.resources.get(id)
  }

  /**
   * Clear all resources (for testing)
   */
  clear(): void {
    this.resources.clear()
    this.log('All resources cleared')
  }

  // Private methods

  private async performCleanup(options: CleanupOptions, startTime: number): Promise<CleanupResult> {
    const resources = this.getResourcesToClean(options)
    const sortedResources = this.sortResourcesForCleanup(resources)

    const errors: CleanupError[] = []
    const summary = {} as Record<ResourceCategory, CleanupCategorySummary>
    const skipped: string[] = []
    let resourcesCleaned = 0

    // Initialize summary
    for (const category of Object.values(RC)) {
      summary[category] = { success: 0, failed: 0, duration: 0 }
    }

    // Process resources in priority order
    for (const resource of sortedResources) {
      if (resource.cleaned) {
        continue // Skip already cleaned resources
      }

      // Check dependencies
      if (!options.force && resource.dependencies) {
        const uncleanedDeps = resource.dependencies.filter((depId) => {
          const dep = this.resources.get(depId)
          return dep && !dep.cleaned
        })

        if (uncleanedDeps.length > 0) {
          skipped.push(resource.id)
          continue
        }
      }

      const categoryStart = Date.now()
      try {
        await this.cleanupResource(resource, options)
        resource.cleaned = true
        this.cleanedCount++
        resourcesCleaned++
        summary[resource.category].success++

        // Remove cleaned resource from registry to prevent memory leaks
        this.resources.delete(resource.id)

        this.emit(ResourceEvent.RESOURCE_CLEANED, {
          resourceId: resource.id,
          category: resource.category,
          timestamp: Date.now(),
        })
      } catch (error) {
        const cleanupError: CleanupError = {
          resourceId: resource.id,
          category: resource.category,
          error: error as Error,
          timeout: (error as Error).message.includes('timeout'),
          timestamp: Date.now(),
        }
        errors.push(cleanupError)
        summary[resource.category].failed++

        this.emit(ResourceEvent.RESOURCE_CLEANUP_FAILED, {
          resourceId: resource.id,
          category: resource.category,
          timestamp: Date.now(),
          data: { error },
        })

        if (!options.continueOnError) {
          break
        }
      }
      summary[resource.category].duration += Date.now() - categoryStart
    }

    const duration = Date.now() - startTime
    const success = errors.length === 0 || (options.continueOnError ?? false)

    return {
      success,
      resourcesProcessed: sortedResources.length,
      resourcesCleaned,
      errors,
      duration,
      summary,
      skipped,
    }
  }

  private getResourcesToClean(options: CleanupOptions): ResourceDefinition[] {
    let resources = Array.from(this.resources.values())

    // Filter by categories
    if (options.categories) {
      resources = resources.filter((r) => options.categories!.includes(r.category))
    }

    // Filter by tags
    if (options.tags) {
      resources = resources.filter(
        (r) => r.tags && options.tags!.some((tag) => r.tags!.includes(tag)),
      )
    }

    // Filter by specific IDs
    if (options.ids) {
      resources = resources.filter((r) => options.ids!.includes(r.id))
    }

    // Exclude specific IDs
    if (options.exclude) {
      resources = resources.filter((r) => !options.exclude!.includes(r.id))
    }

    return resources
  }

  private sortResourcesForCleanup(resources: ResourceDefinition[]): ResourceDefinition[] {
    // Sort by priority (lower number = higher priority), then by registration time
    return resources.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.registeredAt - b.registeredAt
    })
  }

  private async cleanupResource(
    resource: ResourceDefinition,
    options: CleanupOptions,
  ): Promise<void> {
    const timeout = options.timeout ?? resource.timeout ?? this.config.defaultTimeout

    const cleanupPromise = isAsyncCleanupFunction(resource.cleanup)
      ? resource.cleanup()
      : Promise.resolve(resource.cleanup())

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Cleanup timeout after ${timeout}ms for resource: ${resource.id}`))
      }, timeout)
    })

    // Race between cleanup and timeout
    await Promise.race([cleanupPromise, timeoutPromise])
  }

  private findDependents(resourceId: string): string[] {
    const dependents: string[] = []

    for (const resource of this.resources.values()) {
      if (resource.dependencies && resource.dependencies.includes(resourceId)) {
        dependents.push(resource.id)
      }
    }

    return dependents
  }

  private emit(event: ResourceEvent, data: ResourceEventData): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data)
        } catch (error) {
          if (this.config.enableLogging) {
            console.error(`Error in event listener for ${event}:`, error)
          }
        }
      }
    }
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ResourceManager] ${message}`)
    }
  }
}

/**
 * Global resource manager instance
 */
export const globalResourceManager = new ResourceManager()

/**
 * Convenience function to register a resource globally
 */
export function registerResource(
  id: string,
  cleanup: CleanupFunction,
  options?: ResourceOptions,
): void {
  globalResourceManager.register(id, cleanup, options)
}

/**
 * Convenience function to register a file descriptor globally
 * Automatically closes file descriptors on process exit to prevent leaks
 */
export function registerFileDescriptor(id: string, fd: number, path?: string): void {
  globalResourceManager.registerFileDescriptor(id, fd, path)
}

/**
 * Convenience function to cleanup all resources globally
 */
export function cleanupAllResources(options?: CleanupOptions): Promise<CleanupResult> {
  return globalResourceManager.cleanup(options)
}

/**
 * Convenience function to get global resource stats
 */
export function getResourceStats(): ResourceStats {
  return globalResourceManager.getStats()
}

/**
 * Convenience function to detect leaks globally
 */
export function detectResourceLeaks(): ResourceLeak[] {
  return globalResourceManager.detectLeaks()
}
