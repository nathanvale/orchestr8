/**
 * Performance benchmarks for concurrency control utilities
 */

import { bench, describe } from 'vitest'
import {
  ConcurrencyManager,
  limitConcurrency,
  limitedPromiseAll,
  limitedAll,
  limitedAllSettled,
  fileOperationsManager,
  databaseOperationsManager,
  delay,
} from '../src/utils'

describe('ConcurrencyManager performance', () => {
  bench(
    'ConcurrencyManager creation',
    () => {
      return new ConcurrencyManager({ limit: 5 })
    },
    { iterations: 10000 },
  )

  bench(
    'ConcurrencyManager execute immediate task',
    async () => {
      const manager = new ConcurrencyManager({ limit: 5 })
      await manager.execute(() => Promise.resolve('test'))
    },
    { iterations: 1000 },
  )

  bench(
    'ConcurrencyManager execute with delay',
    async () => {
      const manager = new ConcurrencyManager({ limit: 5 })
      await manager.execute(() => delay(1))
    },
    { iterations: 100 },
  )

  bench(
    'ConcurrencyManager batch small items',
    async () => {
      const manager = new ConcurrencyManager({ limit: 3 })
      const items = Array.from({ length: 10 }, (_, i) => i)
      await manager.batch(items, (item) => Promise.resolve(item * 2))
    },
    { iterations: 100 },
  )

  bench(
    'ConcurrencyManager batch large items',
    async () => {
      const manager = new ConcurrencyManager({ limit: 5 })
      const items = Array.from({ length: 50 }, (_, i) => i)
      await manager.batch(items, (item) => delay(1).then(() => item * 2))
    },
    { iterations: 20 },
  )

  bench(
    'ConcurrencyManager.map operation',
    async () => {
      const manager = new ConcurrencyManager({ limit: 4 })
      const items = Array.from({ length: 20 }, (_, i) => i)
      await manager.map(items, (item) => Promise.resolve(item * 3))
    },
    { iterations: 50 },
  )

  bench(
    'ConcurrencyManager stats access',
    () => {
      const manager = new ConcurrencyManager({ limit: 5 })
      return manager.getStats()
    },
    { iterations: 10000 },
  )
})

describe('limitConcurrency function performance', () => {
  bench(
    'limitConcurrency wrapper creation',
    () => {
      const fn = async (x: number) => x * 2
      return limitConcurrency(fn, 3)
    },
    { iterations: 1000 },
  )

  bench(
    'limitConcurrency function execution',
    async () => {
      const fn = async (x: number) => Promise.resolve(x * 2)
      const limited = limitConcurrency(fn, 3)
      await limited(5)
    },
    { iterations: 1000 },
  )

  bench(
    'limitConcurrency with multiple calls',
    async () => {
      const fn = async (x: number) => delay(1).then(() => x * 2)
      const limited = limitConcurrency(fn, 2)

      await Promise.all([limited(1), limited(2), limited(3), limited(4), limited(5)])
    },
    { iterations: 50 },
  )
})

describe('limitedPromiseAll performance', () => {
  bench(
    'limitedPromiseAll small batch',
    async () => {
      const promises = Array.from({ length: 10 }, (_, i) => () => Promise.resolve(i))
      await limitedPromiseAll(promises, { concurrency: 3 })
    },
    { iterations: 100 },
  )

  bench(
    'limitedPromiseAll medium batch',
    async () => {
      const promises = Array.from({ length: 25 }, (_, i) => () => delay(1).then(() => i))
      await limitedPromiseAll(promises, { concurrency: 5 })
    },
    { iterations: 20 },
  )

  bench(
    'limitedPromiseAll vs Promise.all (small)',
    async () => {
      const promises = Array.from({ length: 8 }, (_, i) => Promise.resolve(i))
      await Promise.all(promises)
    },
    { iterations: 1000 },
  )
})

describe('limitedAll vs limitedAllSettled performance', () => {
  bench(
    'limitedAll with success',
    async () => {
      const promises = Array.from({ length: 15 }, (_, i) => () => Promise.resolve(i))
      await limitedAll(promises, 4)
    },
    { iterations: 100 },
  )

  bench(
    'limitedAllSettled with mixed results',
    async () => {
      const promises = Array.from(
        { length: 15 },
        (_, i) => () => (i % 3 === 0 ? Promise.reject(new Error('test')) : Promise.resolve(i)),
      )
      await limitedAllSettled(promises, 4)
    },
    { iterations: 100 },
  )

  bench(
    'limitedAllSettled vs Promise.allSettled',
    async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0 ? Promise.resolve(i) : Promise.reject(new Error('test')),
      )
      await Promise.allSettled(promises)
    },
    { iterations: 1000 },
  )
})

describe('global concurrency managers performance', () => {
  bench(
    'fileOperationsManager execute',
    async () => {
      await fileOperationsManager.execute(() => Promise.resolve('file-op'))
    },
    { iterations: 1000 },
  )

  bench(
    'databaseOperationsManager execute',
    async () => {
      await databaseOperationsManager.execute(() => Promise.resolve('db-op'))
    },
    { iterations: 1000 },
  )

  bench(
    'multiple manager types concurrently',
    async () => {
      await Promise.all([
        fileOperationsManager.execute(() => delay(1)),
        databaseOperationsManager.execute(() => delay(1)),
        fileOperationsManager.execute(() => Promise.resolve('test')),
        databaseOperationsManager.execute(() => Promise.resolve('test')),
      ])
    },
    { iterations: 100 },
  )
})

describe('concurrency stress tests', () => {
  bench(
    'high concurrency with queue buildup',
    async () => {
      const manager = new ConcurrencyManager({ limit: 2 })
      const promises = Array.from({ length: 20 }, (_, i) =>
        manager.execute(() => delay(5).then(() => i)),
      )
      await Promise.all(promises)
    },
    { iterations: 10 },
  )

  bench(
    'concurrent managers interference',
    async () => {
      const manager1 = new ConcurrencyManager({ limit: 3 })
      const manager2 = new ConcurrencyManager({ limit: 3 })

      const tasks1 = Array.from({ length: 10 }, (_, i) =>
        manager1.execute(() => delay(2).then(() => `m1-${i}`)),
      )

      const tasks2 = Array.from({ length: 10 }, (_, i) =>
        manager2.execute(() => delay(2).then(() => `m2-${i}`)),
      )

      await Promise.all([...tasks1, ...tasks2])
    },
    { iterations: 5 },
  )

  bench(
    'dynamic concurrency adjustment',
    async () => {
      const items = Array.from({ length: 30 }, (_, i) => i)

      // Simulate adjusting concurrency based on load
      const firstBatch = items.slice(0, 10)
      const secondBatch = items.slice(10, 20)
      const thirdBatch = items.slice(20)

      const manager1 = new ConcurrencyManager({ limit: 2 })
      const manager2 = new ConcurrencyManager({ limit: 4 })
      const manager3 = new ConcurrencyManager({ limit: 6 })

      await Promise.all([
        manager1.batch(firstBatch, (item) => delay(1).then(() => item)),
        manager2.batch(secondBatch, (item) => delay(1).then(() => item)),
        manager3.batch(thirdBatch, (item) => delay(1).then(() => item)),
      ])
    },
    { iterations: 10 },
  )
})

describe('memory efficiency tests', () => {
  bench(
    'many concurrent managers',
    () => {
      const managers = Array.from({ length: 100 }, () => new ConcurrencyManager({ limit: 5 }))
      return managers.length
    },
    { iterations: 100 },
  )

  bench(
    'manager cleanup and recreation',
    async () => {
      for (let i = 0; i < 10; i++) {
        const manager = new ConcurrencyManager({ limit: 3 })
        await manager.execute(() => Promise.resolve(i))
        await manager.drain()
      }
    },
    { iterations: 50 },
  )

  bench(
    'large queue management',
    async () => {
      const manager = new ConcurrencyManager({ limit: 1 })

      // Queue up many tasks
      const promises = Array.from({ length: 100 }, (_, i) =>
        manager.execute(() => Promise.resolve(i)),
      )

      await Promise.all(promises)
    },
    { iterations: 10 },
  )
})
