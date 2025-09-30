/**
 * Performance benchmarks for resource management utilities
 */

import { bench, describe, afterEach } from 'vitest'
import {
  ResourceManager,
  globalResourceManager,
  registerResource,
  cleanupAllResources,
  getResourceStats,
  detectResourceLeaks,
  ResourceCategory,
  ResourcePriority,
  type CleanupFunction,
} from '../src/resources'

// Track managers for cleanup
const managers: ResourceManager[] = []

afterEach(async () => {
  // Clean up all test managers
  await Promise.all(managers.map((manager) => manager.cleanup()))
  managers.length = 0

  // Reset global manager
  await globalResourceManager.cleanup()
})

describe('ResourceManager creation and basic operations', () => {
  bench(
    'ResourceManager creation',
    () => {
      const manager = new ResourceManager()
      managers.push(manager)
      return manager
    },
    { iterations: 1000 },
  )

  bench(
    'ResourceManager with config',
    () => {
      const manager = new ResourceManager({
        defaultTimeout: 5000,
        enableLogging: false,
        leakDetectionAge: 30000,
      })
      managers.push(manager)
      return manager
    },
    { iterations: 1000 },
  )

  bench(
    'resource registration',
    () => {
      const manager = new ResourceManager()
      managers.push(manager)

      const cleanup: CleanupFunction = () => {}
      manager.register('test-resource', cleanup, {
        category: ResourceCategory.GENERAL,
        description: 'Test resource',
      })
    },
    { iterations: 1000 },
  )

  bench(
    'multiple resource registrations',
    () => {
      const manager = new ResourceManager()
      managers.push(manager)

      for (let i = 0; i < 10; i++) {
        const cleanup: CleanupFunction = () => {}
        manager.register(`test-resource-${i}`, cleanup, {
          category: ResourceCategory.GENERAL,
          description: `Test resource ${i}`,
        })
      }
    },
    { iterations: 500 },
  )
})

describe('global resource manager performance', () => {
  bench(
    'registerResource global',
    () => {
      const cleanup: CleanupFunction = () => {}
      registerResource('global-test', cleanup, {
        category: ResourceCategory.GENERAL,
        description: 'Global test resource',
      })
    },
    { iterations: 1000 },
  )

  bench(
    'getResourceStats',
    () => {
      return getResourceStats()
    },
    { iterations: 10000 },
  )

  bench(
    'detectResourceLeaks',
    () => {
      return detectResourceLeaks()
    },
    { iterations: 1000 },
  )
})

describe('cleanup performance', () => {
  bench(
    'single resource cleanup',
    async () => {
      const manager = new ResourceManager()

      let cleanupCalled = false
      const cleanup: CleanupFunction = () => {
        cleanupCalled = true
      }

      manager.register('test-resource', cleanup)
      await manager.cleanup()

      return cleanupCalled
    },
    { iterations: 500 },
  )

  bench(
    'multiple resources cleanup',
    async () => {
      const manager = new ResourceManager()

      const cleanupCalls: boolean[] = []

      for (let i = 0; i < 20; i++) {
        const cleanup: CleanupFunction = () => {
          cleanupCalls[i] = true
        }
        manager.register(`resource-${i}`, cleanup, {
          category: ResourceCategory.GENERAL,
        })
      }

      await manager.cleanup()
      return cleanupCalls.filter(Boolean).length
    },
    { iterations: 100 },
  )

  bench(
    'cleanup by category',
    async () => {
      const manager = new ResourceManager()
      managers.push(manager)

      // Register resources in different categories
      for (let i = 0; i < 5; i++) {
        manager.register(`db-${i}`, () => {}, {
          category: ResourceCategory.DATABASE,
        })
        manager.register(`file-${i}`, () => {}, {
          category: ResourceCategory.FILE,
        })
        manager.register(`network-${i}`, () => {}, {
          category: ResourceCategory.NETWORK,
        })
      }

      await manager.cleanupByCategory(ResourceCategory.DATABASE)
    },
    { iterations: 200 },
  )

  bench(
    'priority-based cleanup',
    async () => {
      const manager = new ResourceManager()

      // Register resources with different priorities
      manager.register('critical', () => {}, {
        priority: ResourcePriority.CRITICAL,
      })
      manager.register('high', () => {}, {
        priority: ResourcePriority.HIGH,
      })
      manager.register('normal', () => {}, {
        priority: ResourcePriority.NORMAL,
      })
      manager.register('low', () => {}, {
        priority: ResourcePriority.LOW,
      })

      await manager.cleanup()
    },
    { iterations: 200 },
  )
})

describe('async cleanup performance', () => {
  bench(
    'async resource cleanup',
    async () => {
      const manager = new ResourceManager()

      let cleanupCalled = false
      const cleanup = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        cleanupCalled = true
      }

      manager.register('async-resource', cleanup)
      await manager.cleanup()

      return cleanupCalled
    },
    { iterations: 100 },
  )

  bench(
    'mixed sync/async cleanup',
    async () => {
      const manager = new ResourceManager()

      const results: boolean[] = []

      // Mix of sync and async resources
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // Sync cleanup
          manager.register(`sync-${i}`, () => {
            results[i] = true
          })
        } else {
          // Async cleanup
          manager.register(`async-${i}`, async () => {
            await new Promise((resolve) => setTimeout(resolve, 1))
            results[i] = true
          })
        }
      }

      await manager.cleanup()
      return results.filter(Boolean).length
    },
    { iterations: 50 },
  )
})

describe('dependency handling performance', () => {
  bench(
    'resource with dependencies',
    async () => {
      const manager = new ResourceManager()

      const cleanupOrder: string[] = []

      manager.register('base', () => {
        cleanupOrder.push('base')
      })

      manager.register(
        'dependent',
        () => {
          cleanupOrder.push('dependent')
        },
        {
          dependencies: ['base'],
        },
      )

      await manager.cleanup()

      // Dependent should be cleaned before base
      return cleanupOrder[0] === 'dependent' && cleanupOrder[1] === 'base'
    },
    { iterations: 200 },
  )

  bench(
    'complex dependency chain',
    async () => {
      const manager = new ResourceManager()

      const cleanupOrder: string[] = []

      // Create dependency chain: child -> parent -> grandparent
      manager.register('grandparent', () => {
        cleanupOrder.push('grandparent')
      })

      manager.register(
        'parent',
        () => {
          cleanupOrder.push('parent')
        },
        {
          dependencies: ['grandparent'],
        },
      )

      manager.register(
        'child',
        () => {
          cleanupOrder.push('child')
        },
        {
          dependencies: ['parent'],
        },
      )

      await manager.cleanup()

      return cleanupOrder
    },
    { iterations: 100 },
  )

  bench(
    'multiple dependencies',
    async () => {
      const manager = new ResourceManager()

      const cleanupOrder: string[] = []

      // Create resources with multiple dependencies
      manager.register('dep1', () => cleanupOrder.push('dep1'))
      manager.register('dep2', () => cleanupOrder.push('dep2'))
      manager.register('dep3', () => cleanupOrder.push('dep3'))

      manager.register(
        'main',
        () => {
          cleanupOrder.push('main')
        },
        {
          dependencies: ['dep1', 'dep2', 'dep3'],
        },
      )

      await manager.cleanup()
      return cleanupOrder
    },
    { iterations: 100 },
  )
})

describe('error handling performance', () => {
  bench(
    'cleanup with errors',
    async () => {
      const manager = new ResourceManager()

      const successCount = { value: 0 }
      const errorCount = { value: 0 }

      // Mix of successful and failing cleanups
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Failing cleanup
          manager.register(`failing-${i}`, () => {
            errorCount.value++
            throw new Error(`Cleanup failed for ${i}`)
          })
        } else {
          // Successful cleanup
          manager.register(`success-${i}`, () => {
            successCount.value++
          })
        }
      }

      const result = await manager.cleanup()

      return {
        successful: successCount.value,
        failed: errorCount.value,
        hasErrors: result.errors.length > 0,
      }
    },
    { iterations: 100 },
  )

  bench(
    'timeout handling',
    async () => {
      const manager = new ResourceManager({
        defaultTimeout: 10, // Very short timeout
      })

      let timeoutOccurred = false

      manager.register('slow-resource', async () => {
        // This should timeout
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      const result = await manager.cleanup()

      timeoutOccurred = result.errors.some((error) => error.error.message.includes('timeout'))

      return timeoutOccurred
    },
    { iterations: 50 },
  )
})

describe('resource stats and monitoring', () => {
  bench(
    'getStats performance',
    () => {
      const manager = new ResourceManager()
      managers.push(manager)

      // Register various resources
      for (let i = 0; i < 50; i++) {
        manager.register(`resource-${i}`, () => {}, {
          category: Object.values(ResourceCategory)[
            i % Object.values(ResourceCategory).length
          ] as ResourceCategory,
        })
      }

      return manager.getStats()
    },
    { iterations: 1000 },
  )

  bench(
    'leak detection performance',
    () => {
      const manager = new ResourceManager({
        leakDetectionAge: 1000, // 1 second
      })
      managers.push(manager)

      // Register resources with different ages
      for (let i = 0; i < 20; i++) {
        manager.register(`resource-${i}`, () => {})
      }

      return manager.detectLeaks()
    },
    { iterations: 500 },
  )

  bench(
    'category summary generation',
    async () => {
      const manager = new ResourceManager()

      // Register resources in various categories
      const categories = Object.values(ResourceCategory)
      for (let i = 0; i < 30; i++) {
        const category = categories[i % categories.length] as ResourceCategory
        manager.register(`resource-${i}`, () => {}, { category })
      }

      const result = await manager.cleanup()
      return result.summary
    },
    { iterations: 100 },
  )
})

describe('stress and memory tests', () => {
  bench(
    'many resources registration',
    () => {
      const manager = new ResourceManager()
      managers.push(manager)

      for (let i = 0; i < 1000; i++) {
        manager.register(`stress-resource-${i}`, () => {}, {
          category: ResourceCategory.GENERAL,
          description: `Stress test resource ${i}`,
        })
      }

      return manager.getStats().totalResources
    },
    { iterations: 10 },
  )

  bench(
    'resource churn (register/cleanup cycles)',
    async () => {
      const manager = new ResourceManager()

      for (let cycle = 0; cycle < 10; cycle++) {
        // Register resources
        for (let i = 0; i < 20; i++) {
          manager.register(`cycle-${cycle}-resource-${i}`, () => {})
        }

        // Cleanup all
        await manager.cleanup()
      }

      return manager.getStats().totalResources
    },
    { iterations: 20 },
  )

  bench(
    'concurrent registration',
    async () => {
      const manager = new ResourceManager()
      managers.push(manager)

      const registrations = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(() => {
          manager.register(`concurrent-${i}`, () => {}, {
            category: ResourceCategory.GENERAL,
          })
        }),
      )

      await Promise.all(registrations)
      return manager.getStats().totalResources
    },
    { iterations: 100 },
  )
})

describe('event system performance', () => {
  bench(
    'event listener registration',
    () => {
      const manager = new ResourceManager()
      managers.push(manager)

      let eventCount = 0
      manager.on('resourceCleaned', () => {
        eventCount++
      })

      return eventCount
    },
    { iterations: 1000 },
  )

  bench(
    'cleanup with event emission',
    async () => {
      const manager = new ResourceManager()

      let eventsReceived = 0
      manager.on('resourceCleaned', () => {
        eventsReceived++
      })

      // Register multiple resources
      for (let i = 0; i < 10; i++) {
        manager.register(`event-resource-${i}`, () => {})
      }

      await manager.cleanup()
      return eventsReceived
    },
    { iterations: 100 },
  )
})
