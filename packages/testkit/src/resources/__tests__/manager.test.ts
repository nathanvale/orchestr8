/* eslint-disable max-lines-per-function */
/**
 * Comprehensive tests for ResourceManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ResourceManager,
  globalResourceManager,
  registerResource,
  cleanupAllResources,
  getResourceStats,
} from '../manager.js'
import {
  ResourceCategory,
  ResourcePriority,
  ResourceEvent,
  type ResourceOptions,
} from '../types.js'

describe('ResourceManager', () => {
  let manager: ResourceManager
  let mockCleanupFn: ReturnType<typeof vi.fn>
  let mockAsyncCleanupFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    manager = new ResourceManager({
      autoRegisterProcessHandlers: false,
      enableLogging: false,
    })
    mockCleanupFn = vi.fn()
    mockAsyncCleanupFn = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(async () => {
    // Clean up all resources after each test
    await manager.cleanup({ continueOnError: true })
    manager.clear()
    manager.removeAllListeners()
  })

  describe('Resource Registration', () => {
    it('should register a sync cleanup function', () => {
      manager.register('test-resource', mockCleanupFn)

      expect(manager.hasResource('test-resource')).toBe(true)
      expect(manager.getResourceCount()).toBe(1)
    })

    it('should register an async cleanup function', () => {
      manager.register('async-resource', mockAsyncCleanupFn)

      expect(manager.hasResource('async-resource')).toBe(true)
      expect(manager.getResourceCount()).toBe(1)
    })

    it('should register with category and priority', () => {
      const options: ResourceOptions = {
        category: ResourceCategory.DATABASE,
        priority: ResourcePriority.CRITICAL,
        description: 'Test database connection',
        tags: ['db', 'mysql'],
      }

      manager.register('db-connection', mockCleanupFn, options)

      const resource = manager.getResource('db-connection')
      expect(resource).toBeDefined()
      expect(resource!.category).toBe(ResourceCategory.DATABASE)
      expect(resource!.priority).toBe(ResourcePriority.CRITICAL)
      expect(resource!.description).toBe('Test database connection')
      expect(resource!.tags).toEqual(['db', 'mysql'])
    })

    it('should register with custom metadata', () => {
      const metadata = { connectionId: 123, host: 'localhost' }
      manager.register('resource-with-metadata', mockCleanupFn, { metadata })

      const resource = manager.getResource('resource-with-metadata')
      expect(resource!.metadata).toEqual(metadata)
    })

    it('should prevent duplicate registration', () => {
      manager.register('duplicate', mockCleanupFn)

      expect(() => {
        manager.register('duplicate', mockCleanupFn)
      }).toThrow("Resource with ID 'duplicate' is already registered")
    })

    it('should validate dependencies exist', () => {
      expect(() => {
        manager.register('dependent', mockCleanupFn, {
          dependencies: ['non-existent'],
        })
      }).toThrow("Dependency 'non-existent' not found for resource 'dependent'")
    })

    it('should register with dependencies when they exist', () => {
      manager.register('dependency', mockCleanupFn)
      manager.register('dependent', mockCleanupFn, {
        dependencies: ['dependency'],
      })

      const resource = manager.getResource('dependent')
      expect(resource!.dependencies).toEqual(['dependency'])
    })

    it('should respect maximum resource limit', () => {
      const limitedManager = new ResourceManager({ maxResources: 2 })

      limitedManager.register('resource1', mockCleanupFn)
      limitedManager.register('resource2', mockCleanupFn)

      expect(() => {
        limitedManager.register('resource3', mockCleanupFn)
      }).toThrow('Maximum number of resources (2) exceeded')
    })

    it('should emit registration event', () => {
      const eventListener = vi.fn()
      manager.on(ResourceEvent.RESOURCE_REGISTERED, eventListener)

      manager.register('test', mockCleanupFn, {
        category: ResourceCategory.FILE,
        description: 'Test file',
      })

      expect(eventListener).toHaveBeenCalledWith({
        resourceId: 'test',
        category: ResourceCategory.FILE,
        timestamp: expect.any(Number),
        data: { description: 'Test file', tags: undefined },
      })
    })
  })

  describe('File Descriptor Registration', () => {
    it('should register file descriptor for cleanup', () => {
      const fd = 123
      const path = '/tmp/test.txt'

      manager.registerFileDescriptor('test-fd', fd, path)

      expect(manager.hasResource('test-fd')).toBe(true)
      const resource = manager.getResource('test-fd')
      expect(resource).toBeDefined()
      expect(resource!.category).toBe(ResourceCategory.FILE)
      expect(resource!.priority).toBe(ResourcePriority.HIGH)
      expect(resource!.description).toBe(`File descriptor ${fd} for ${path}`)
      expect(resource!.tags).toEqual(['file-descriptor'])
      expect(resource!.metadata).toEqual({ fd, path })
    })

    it('should register file descriptor without path', () => {
      const fd = 456

      manager.registerFileDescriptor('test-fd-no-path', fd)

      const resource = manager.getResource('test-fd-no-path')
      expect(resource).toBeDefined()
      expect(resource!.description).toBe(`File descriptor ${fd}`)
      expect(resource!.metadata).toEqual({ fd, path: undefined })
    })
  })

  describe('Resource Unregistration', () => {
    it('should unregister existing resource', () => {
      manager.register('test', mockCleanupFn)
      const result = manager.unregister('test')

      expect(result).toBe(true)
      expect(manager.hasResource('test')).toBe(false)
      expect(manager.getResourceCount()).toBe(0)
    })

    it('should return false for non-existent resource', () => {
      const result = manager.unregister('non-existent')
      expect(result).toBe(false)
    })

    it('should prevent unregistering resource with dependents', () => {
      manager.register('dependency', mockCleanupFn)
      manager.register('dependent', mockCleanupFn, {
        dependencies: ['dependency'],
      })

      expect(() => {
        manager.unregister('dependency')
      }).toThrow("Cannot unregister resource 'dependency' - it has dependents: dependent")
    })

    it('should emit unregistration event', () => {
      const eventListener = vi.fn()
      manager.on(ResourceEvent.RESOURCE_UNREGISTERED, eventListener)

      manager.register('test', mockCleanupFn, { category: ResourceCategory.FILE })
      manager.unregister('test')

      expect(eventListener).toHaveBeenCalledWith({
        resourceId: 'test',
        category: ResourceCategory.FILE,
        timestamp: expect.any(Number),
      })
    })
  })

  describe('Resource Cleanup', () => {
    it('should execute single resource cleanup', async () => {
      manager.register('test', mockCleanupFn)

      const result = await manager.cleanup({ ids: ['test'] })

      expect(mockCleanupFn).toHaveBeenCalledOnce()
      expect(result.success).toBe(true)
      expect(result.resourcesProcessed).toBe(1)
      expect(result.resourcesCleaned).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should execute async cleanup function', async () => {
      manager.register('async-test', mockAsyncCleanupFn)

      const result = await manager.cleanup({ ids: ['async-test'] })

      expect(mockAsyncCleanupFn).toHaveBeenCalledOnce()
      expect(result.success).toBe(true)
      expect(result.resourcesCleaned).toBe(1)
    })

    it('should execute all resources cleanup', async () => {
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn()

      manager.register('resource1', cleanup1)
      manager.register('resource2', cleanup2)

      const result = await manager.cleanup()

      expect(cleanup1).toHaveBeenCalledOnce()
      expect(cleanup2).toHaveBeenCalledOnce()
      expect(result.resourcesProcessed).toBe(2)
      expect(result.resourcesCleaned).toBe(2)
    })

    it('should execute cleanup by category', async () => {
      const dbCleanup = vi.fn()
      const fileCleanup = vi.fn()

      manager.register('db', dbCleanup, { category: ResourceCategory.DATABASE })
      manager.register('file', fileCleanup, { category: ResourceCategory.FILE })

      const result = await manager.cleanupByCategory(ResourceCategory.DATABASE)

      expect(dbCleanup).toHaveBeenCalledOnce()
      expect(fileCleanup).not.toHaveBeenCalled()
      expect(result.resourcesCleaned).toBe(1)
    })

    it('should execute cleanup by priority order', async () => {
      const callOrder: string[] = []

      const lowPriority = vi.fn(() => callOrder.push('low'))
      const highPriority = vi.fn(() => callOrder.push('high'))
      const criticalPriority = vi.fn(() => callOrder.push('critical'))

      manager.register('low', lowPriority, { priority: ResourcePriority.LOW })
      manager.register('high', highPriority, { priority: ResourcePriority.HIGH })
      manager.register('critical', criticalPriority, { priority: ResourcePriority.CRITICAL })

      await manager.cleanup()

      expect(callOrder).toEqual(['critical', 'high', 'low'])
    })

    it('should handle cleanup errors gracefully', async () => {
      const errorCleanup = vi.fn(() => {
        throw new Error('Cleanup failed')
      })
      const successCleanup = vi.fn()

      manager.register('error', errorCleanup)
      manager.register('success', successCleanup)

      const result = await manager.cleanup({ continueOnError: true })

      expect(result.success).toBe(true) // Success because continueOnError is true
      expect(result.resourcesCleaned).toBe(1) // Only success resource was cleaned
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].resourceId).toBe('error')
      expect(result.errors[0].error.message).toBe('Cleanup failed')
      expect(successCleanup).toHaveBeenCalledOnce()
    })

    it('should stop on first error when continueOnError is false', async () => {
      const errorCleanup = vi.fn(() => {
        throw new Error('Cleanup failed')
      })
      const neverCalledCleanup = vi.fn()

      manager.register('error', errorCleanup, { priority: ResourcePriority.CRITICAL })
      manager.register('never-called', neverCalledCleanup, { priority: ResourcePriority.LOW })

      const result = await manager.cleanup({ continueOnError: false })

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(neverCalledCleanup).not.toHaveBeenCalled()
    })

    it('should handle cleanup timeouts', async () => {
      const slowCleanup = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 1000)))

      manager.register('slow', slowCleanup, { timeout: 100 })

      const result = await manager.cleanup({ continueOnError: true })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].timeout).toBe(true)
      expect(result.errors[0].error.message).toContain('timeout')
    })

    it('should respect dependencies in cleanup order', async () => {
      const callOrder: string[] = []

      const dependencyCleanup = vi.fn(() => callOrder.push('dependency'))
      const dependentCleanup = vi.fn(() => callOrder.push('dependent'))

      manager.register('dependency', dependencyCleanup)
      manager.register('dependent', dependentCleanup, {
        dependencies: ['dependency'],
      })

      const result = await manager.cleanup()

      expect(callOrder).toEqual(['dependency', 'dependent'])
      expect(result.skipped).toHaveLength(0)
    })

    it('should skip resources with uncleaned dependencies', async () => {
      const dependencyCleanup = vi.fn(() => {
        throw new Error('Dependency cleanup failed')
      })
      const dependentCleanup = vi.fn()

      manager.register('dependency', dependencyCleanup)
      manager.register('dependent', dependentCleanup, {
        dependencies: ['dependency'],
      })

      const result = await manager.cleanup({ continueOnError: true })

      expect(dependentCleanup).not.toHaveBeenCalled()
      expect(result.skipped).toContain('dependent')
    })

    it('should force cleanup ignoring dependencies when force is true', async () => {
      const dependencyCleanup = vi.fn(() => {
        throw new Error('Dependency cleanup failed')
      })
      const dependentCleanup = vi.fn()

      manager.register('dependency', dependencyCleanup)
      manager.register('dependent', dependentCleanup, {
        dependencies: ['dependency'],
      })

      const result = await manager.cleanup({ force: true, continueOnError: true })

      expect(dependentCleanup).toHaveBeenCalledOnce()
      expect(result.skipped).toHaveLength(0)
    })

    it('should not clean already cleaned resources', async () => {
      manager.register('test', mockCleanupFn)

      // First cleanup
      await manager.cleanup({ ids: ['test'] })
      expect(mockCleanupFn).toHaveBeenCalledOnce()

      // Second cleanup should not call again
      await manager.cleanup({ ids: ['test'] })
      expect(mockCleanupFn).toHaveBeenCalledOnce()
    })

    it('should prevent concurrent cleanup operations', async () => {
      const slowCleanup = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)))
      manager.register('slow', slowCleanup)

      const cleanup1 = manager.cleanup()
      const cleanup2 = manager.cleanup()

      const [result1, result2] = await Promise.all([cleanup1, cleanup2])

      expect(result1).toBe(result2) // Should return the same promise
      expect(slowCleanup).toHaveBeenCalledOnce()
    })

    it('should emit cleanup events', async () => {
      const startListener = vi.fn()
      const completedListener = vi.fn()
      const cleanedListener = vi.fn()

      manager.on(ResourceEvent.CLEANUP_STARTED, startListener)
      manager.on(ResourceEvent.CLEANUP_COMPLETED, completedListener)
      manager.on(ResourceEvent.RESOURCE_CLEANED, cleanedListener)

      manager.register('test', mockCleanupFn)
      await manager.cleanup()

      expect(startListener).toHaveBeenCalledOnce()
      expect(completedListener).toHaveBeenCalledOnce()
      expect(cleanedListener).toHaveBeenCalledWith({
        resourceId: 'test',
        category: ResourceCategory.EVENT, // Default category
        timestamp: expect.any(Number),
      })
    })
  })

  describe('Resource Filtering', () => {
    beforeEach(() => {
      manager.register('db1', vi.fn(), {
        category: ResourceCategory.DATABASE,
        tags: ['mysql', 'primary'],
      })
      manager.register('db2', vi.fn(), {
        category: ResourceCategory.DATABASE,
        tags: ['postgres', 'secondary'],
      })
      manager.register('file1', vi.fn(), {
        category: ResourceCategory.FILE,
        tags: ['temp', 'logs'],
      })
    })

    it('should filter by categories', async () => {
      const result = await manager.cleanup({
        categories: [ResourceCategory.DATABASE],
      })

      expect(result.resourcesProcessed).toBe(2)
      expect(result.summary[ResourceCategory.DATABASE].success).toBe(2)
      expect(result.summary[ResourceCategory.FILE].success).toBe(0)
    })

    it('should filter by tags', async () => {
      const result = await manager.cleanup({
        tags: ['mysql'],
      })

      expect(result.resourcesProcessed).toBe(1)
    })

    it('should filter by specific IDs', async () => {
      const result = await manager.cleanup({
        ids: ['db1', 'file1'],
      })

      expect(result.resourcesProcessed).toBe(2)
    })

    it('should exclude specific IDs', async () => {
      const result = await manager.cleanup({
        exclude: ['db1'],
      })

      expect(result.resourcesProcessed).toBe(2) // db2 and file1
    })
  })

  describe('Batch Operations', () => {
    it('should register batch of resources', () => {
      const resources = [
        { id: 'batch1', cleanup: vi.fn(), options: { category: ResourceCategory.DATABASE } },
        { id: 'batch2', cleanup: vi.fn(), options: { category: ResourceCategory.FILE } },
        { id: 'batch3', cleanup: vi.fn() },
      ]

      manager.registerBatch(resources)

      expect(manager.getResourceCount()).toBe(3)
      expect(manager.getResource('batch1')!.category).toBe(ResourceCategory.DATABASE)
    })

    it('should cleanup batch of resources by IDs', async () => {
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn()
      const cleanup3 = vi.fn()

      manager.register('batch1', cleanup1)
      manager.register('batch2', cleanup2)
      manager.register('batch3', cleanup3)

      const result = await manager.cleanupBatch(['batch1', 'batch3'])

      expect(cleanup1).toHaveBeenCalledOnce()
      expect(cleanup2).not.toHaveBeenCalled()
      expect(cleanup3).toHaveBeenCalledOnce()
      expect(result.resourcesProcessed).toBe(2)
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      manager.register('db', vi.fn(), {
        category: ResourceCategory.DATABASE,
        priority: ResourcePriority.CRITICAL,
      })
      manager.register('file', vi.fn(), {
        category: ResourceCategory.FILE,
        priority: ResourcePriority.HIGH,
      })
      manager.register('timer', vi.fn(), {
        category: ResourceCategory.TIMER,
        priority: ResourcePriority.MEDIUM,
      })
    })

    it('should get resource statistics', () => {
      const stats = manager.getStats()

      expect(stats.total).toBe(3)
      expect(stats.byCategory[ResourceCategory.DATABASE]).toBe(1)
      expect(stats.byCategory[ResourceCategory.FILE]).toBe(1)
      expect(stats.byCategory[ResourceCategory.TIMER]).toBe(1)
      expect(stats.byPriority[ResourcePriority.CRITICAL]).toBe(1)
      expect(stats.byPriority[ResourcePriority.HIGH]).toBe(1)
      expect(stats.byPriority[ResourcePriority.MEDIUM]).toBe(1)
      expect(stats.cleaned).toBe(0)
    })

    it('should get resources by category', () => {
      const byCategory = manager.getResourcesByCategory()

      expect(byCategory[ResourceCategory.DATABASE]).toBe(1)
      expect(byCategory[ResourceCategory.FILE]).toBe(1)
      expect(byCategory[ResourceCategory.TIMER]).toBe(1)
      expect(byCategory[ResourceCategory.NETWORK]).toBe(0)
    })

    it('should update cleaned count after cleanup', async () => {
      await manager.cleanup({ ids: ['db'] })

      const stats = manager.getStats()
      expect(stats.cleaned).toBe(1) // One resource was cleaned up
    })
  })

  describe('Leak Detection', () => {
    it('should detect potential leaks based on age', async () => {
      const leakManager = new ResourceManager({
        leakDetectionAge: 100, // 100ms for fast testing
        autoRegisterProcessHandlers: false,
      })

      leakManager.register('old-resource', vi.fn(), {
        description: 'This is an old resource',
        tags: ['test'],
      })

      // Wait for resource to age
      await new Promise((resolve) => setTimeout(resolve, 150))

      const leaks = leakManager.detectLeaks()

      expect(leaks).toHaveLength(1)
      expect(leaks[0].resourceId).toBe('old-resource')
      expect(leaks[0].age).toBeGreaterThan(100)
      expect(leaks[0].description).toBe('This is an old resource')
      expect(leaks[0].tags).toEqual(['test'])
    })

    it('should not detect cleaned resources as leaks', async () => {
      const leakManager = new ResourceManager({
        leakDetectionAge: 50,
        autoRegisterProcessHandlers: false,
      })

      leakManager.register('cleaned-resource', vi.fn())

      await new Promise((resolve) => setTimeout(resolve, 100))
      await leakManager.cleanup({ ids: ['cleaned-resource'] })

      const leaks = leakManager.detectLeaks()
      expect(leaks).toHaveLength(0)
    })

    it('should emit leak detection events', async () => {
      const leakManager = new ResourceManager({
        leakDetectionAge: 50,
        autoRegisterProcessHandlers: false,
      })

      const leakListener = vi.fn()
      leakManager.on(ResourceEvent.LEAK_DETECTED, leakListener)

      leakManager.register('leak', vi.fn())
      await new Promise((resolve) => setTimeout(resolve, 100))

      leakManager.detectLeaks()

      expect(leakListener).toHaveBeenCalledWith({
        resourceId: 'leak',
        category: ResourceCategory.EVENT,
        timestamp: expect.any(Number),
        data: { age: expect.any(Number), description: undefined },
      })
    })
  })

  describe('Event System', () => {
    it('should add and remove event listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      manager.on(ResourceEvent.RESOURCE_REGISTERED, listener1)
      manager.on(ResourceEvent.RESOURCE_REGISTERED, listener2)

      manager.register('test', vi.fn())

      expect(listener1).toHaveBeenCalledOnce()
      expect(listener2).toHaveBeenCalledOnce()

      manager.off(ResourceEvent.RESOURCE_REGISTERED, listener1)
      manager.register('test2', vi.fn())

      expect(listener1).toHaveBeenCalledOnce() // Still only once
      expect(listener2).toHaveBeenCalledTimes(2)
    })

    it('should remove all listeners for an event', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      manager.on(ResourceEvent.RESOURCE_REGISTERED, listener1)
      manager.on(ResourceEvent.RESOURCE_REGISTERED, listener2)

      manager.removeAllListeners(ResourceEvent.RESOURCE_REGISTERED)
      manager.register('test', vi.fn())

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })

    it('should handle errors in event listeners gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const workingListener = vi.fn()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      manager.on(ResourceEvent.RESOURCE_REGISTERED, errorListener)
      manager.on(ResourceEvent.RESOURCE_REGISTERED, workingListener)

      manager.register('test', vi.fn())

      expect(workingListener).toHaveBeenCalledOnce()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in resource event listener'),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Process Integration', () => {
    it('should register process handlers', () => {
      const processManager = new ResourceManager({
        autoRegisterProcessHandlers: true,
      })

      expect(processManager['processHandlersRegistered']).toBe(true)
    })

    it('should not auto-register when disabled', () => {
      const processManager = new ResourceManager({
        autoRegisterProcessHandlers: false,
      })

      expect(processManager['processHandlersRegistered']).toBe(false)
    })
  })

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customManager = new ResourceManager({
        defaultTimeout: 5000,
        leakDetectionAge: 30000,
        maxResources: 500,
        enableLogging: true,
        enableMetrics: true,
      })

      expect(customManager['config'].defaultTimeout).toBe(5000)
      expect(customManager['config'].leakDetectionAge).toBe(30000)
      expect(customManager['config'].maxResources).toBe(500)
      expect(customManager['config'].enableLogging).toBe(true)
      expect(customManager['config'].enableMetrics).toBe(true)
    })

    it('should use default configuration when not provided', () => {
      const defaultManager = new ResourceManager()

      expect(defaultManager['config'].defaultTimeout).toBe(10000)
      expect(defaultManager['config'].leakDetectionAge).toBe(60000)
      expect(defaultManager['config'].maxResources).toBe(10000)
      expect(defaultManager['config'].autoRegisterProcessHandlers).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle cleanup of empty resource list', async () => {
      const result = await manager.cleanup()

      expect(result.success).toBe(true)
      expect(result.resourcesProcessed).toBe(0)
      expect(result.resourcesCleaned).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle multiple cleanup calls during cleanup', async () => {
      manager.register('slow', () => new Promise((resolve) => setTimeout(resolve, 100)))

      const promises = [manager.cleanup(), manager.cleanup(), manager.cleanup()]

      const results = await Promise.all(promises)

      // All should return the same result
      expect(results[0]).toBe(results[1])
      expect(results[1]).toBe(results[2])
    })

    it('should handle registration during cleanup', async () => {
      let cleanupStarted = false

      manager.register('initial', async () => {
        cleanupStarted = true
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const cleanupPromise = manager.cleanup()

      // Wait for cleanup to start
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Try to register during cleanup
      expect(() => {
        manager.register('during-cleanup', vi.fn())
      }).not.toThrow()

      await cleanupPromise

      expect(cleanupStarted).toBe(true)
      expect(manager.hasResource('during-cleanup')).toBe(true)
    })

    it('should clear all resources', () => {
      manager.register('test1', vi.fn())
      manager.register('test2', vi.fn())

      expect(manager.getResourceCount()).toBe(2)

      manager.clear()

      expect(manager.getResourceCount()).toBe(0)
    })
  })
})

describe('Global Resource Manager', () => {
  afterEach(async () => {
    await cleanupAllResources({ continueOnError: true })
    globalResourceManager.clear()
  })

  it('should use global resource manager for convenience functions', () => {
    const cleanup = vi.fn()

    registerResource('global-test', cleanup, {
      category: ResourceCategory.FILE,
      description: 'Global test resource',
    })

    expect(globalResourceManager.hasResource('global-test')).toBe(true)

    const stats = getResourceStats()
    expect(stats.total).toBe(1)
    expect(stats.byCategory[ResourceCategory.FILE]).toBe(1)
  })

  it('should cleanup all resources globally', async () => {
    const cleanup1 = vi.fn()
    const cleanup2 = vi.fn()

    registerResource('global1', cleanup1)
    registerResource('global2', cleanup2)

    const result = await cleanupAllResources()

    expect(cleanup1).toHaveBeenCalledOnce()
    expect(cleanup2).toHaveBeenCalledOnce()
    expect(result.resourcesCleaned).toBe(2)
  })

  it('should detect leaks globally', async () => {
    // Create a manager with short leak detection time for testing
    const testManager = new ResourceManager({
      leakDetectionAge: 50,
      autoRegisterProcessHandlers: false,
    })

    testManager.register('potential-leak', vi.fn())

    await new Promise((resolve) => setTimeout(resolve, 100))

    const leaks = testManager.detectLeaks()
    expect(leaks.length).toBeGreaterThan(0)
  })
})

describe('Resource Manager Performance', () => {
  it('should handle large number of resources efficiently', async () => {
    const manager = new ResourceManager({
      autoRegisterProcessHandlers: false,
      maxResources: 2000,
    })

    const startTime = Date.now()

    // Register 1000 resources
    for (let i = 0; i < 1000; i++) {
      manager.register(`resource-${i}`, vi.fn(), {
        category: i % 2 === 0 ? ResourceCategory.FILE : ResourceCategory.TIMER,
      })
    }

    const registrationTime = Date.now() - startTime
    expect(registrationTime).toBeLessThan(100) // Should be fast

    const cleanupStartTime = Date.now()
    const result = await manager.cleanup()
    const cleanupTime = Date.now() - cleanupStartTime

    expect(result.resourcesCleaned).toBe(1000)
    expect(cleanupTime).toBeLessThan(500) // Should cleanup quickly
  })

  it('should have minimal memory overhead', () => {
    const manager = new ResourceManager({
      autoRegisterProcessHandlers: false,
    })

    // Register resources and measure memory impact
    for (let i = 0; i < 100; i++) {
      manager.register(`resource-${i}`, vi.fn(), {
        category: ResourceCategory.TIMER,
        description: `Resource ${i}`,
        tags: [`tag-${i % 10}`],
        metadata: { index: i, timestamp: Date.now() },
      })
    }

    const stats = manager.getStats()
    expect(stats.total).toBe(100)

    // Memory usage should be reasonable
    const memoryUsage = process.memoryUsage()
    expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
  })
})
