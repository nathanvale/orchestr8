/**
 * Performance benchmarks for utility functions
 */

import { bench, describe } from 'vitest'
import { delay, retry, withTimeout, createMockFn } from '../src/utils'

describe('delay performance', () => {
  bench(
    'delay 1ms',
    async () => {
      await delay(1)
    },
    { iterations: 100 },
  )

  bench(
    'delay 10ms',
    async () => {
      await delay(10)
    },
    { iterations: 50 },
  )

  bench(
    'delay 0ms (immediate)',
    async () => {
      await delay(0)
    },
    { iterations: 1000 },
  )
})

describe('retry performance', () => {
  bench(
    'retry with immediate success',
    async () => {
      let callCount = 0
      await retry(
        () => {
          callCount++
          return Promise.resolve(`success-${callCount}`)
        },
        3,
        100,
      )
    },
    { iterations: 1000 },
  )

  bench(
    'retry with first failure then success',
    async () => {
      let callCount = 0
      await retry(
        () => {
          callCount++
          if (callCount === 1) {
            return Promise.reject(new Error('First attempt fails'))
          }
          return Promise.resolve(`success-${callCount}`)
        },
        3,
        10,
      ) // Shorter delay for benchmarking
    },
    { iterations: 100 },
  )

  bench(
    'retry with exponential backoff calculation',
    async () => {
      let callCount = 0
      await retry(
        () => {
          callCount++
          if (callCount <= 2) {
            return Promise.reject(new Error(`Attempt ${callCount} fails`))
          }
          return Promise.resolve(`success-${callCount}`)
        },
        3,
        5,
      ) // Very short delay for benchmarking
    },
    { iterations: 50 },
  )

  bench(
    'retry function creation overhead',
    () => {
      // Measure the overhead of creating retry functions
      const fn = () => Promise.resolve('test')
      return retry(fn, 3, 100)
    },
    { iterations: 1000 },
  )
})

describe('withTimeout performance', () => {
  bench(
    'withTimeout with fast resolution',
    async () => {
      await withTimeout(Promise.resolve('fast'), 1000)
    },
    { iterations: 1000 },
  )

  bench(
    'withTimeout with delayed resolution',
    async () => {
      await withTimeout(
        delay(5).then(() => 'delayed'),
        100,
      )
    },
    { iterations: 100 },
  )

  bench(
    'withTimeout promise race setup',
    () => {
      // Measure just the setup overhead
      const promise = Promise.resolve('test')
      return withTimeout(promise, 1000)
    },
    { iterations: 1000 },
  )
})

describe('createMockFn performance', () => {
  bench(
    'createMockFn creation',
    () => {
      return createMockFn(() => 'test')
    },
    { iterations: 10000 },
  )

  bench(
    'createMockFn execution',
    () => {
      const mockFn = createMockFn((x: number) => x * 2)
      return mockFn(5)
    },
    { iterations: 10000 },
  )

  bench(
    'createMockFn with tracking',
    () => {
      const mockFn = createMockFn((x: number) => x * 2)
      mockFn(1)
      mockFn(2)
      mockFn(3)
      return mockFn.calls.length
    },
    { iterations: 1000 },
  )

  bench(
    'createMockFn.mockClear',
    () => {
      const mockFn = createMockFn(() => 'test')
      mockFn()
      mockFn()
      mockFn.mockClear()
      return mockFn.calls.length
    },
    { iterations: 10000 },
  )
})

describe('complex utility combinations', () => {
  bench(
    'retry with timeout and delay',
    async () => {
      await retry(
        async () => {
          await delay(1)
          return await withTimeout(Promise.resolve('complex'), 100)
        },
        2,
        10,
      )
    },
    { iterations: 100 },
  )

  bench(
    'multiple concurrent delays',
    async () => {
      await Promise.all([delay(1), delay(1), delay(1), delay(1), delay(1)])
    },
    { iterations: 200 },
  )

  bench(
    'nested retry operations',
    async () => {
      let outerCount = 0
      await retry(
        async () => {
          outerCount++
          let innerCount = 0
          return await retry(
            () => {
              innerCount++
              if (outerCount === 1 && innerCount === 1) {
                return Promise.reject(new Error('Inner failure'))
              }
              return Promise.resolve(`outer-${outerCount}-inner-${innerCount}`)
            },
            2,
            5,
          )
        },
        2,
        5,
      )
    },
    { iterations: 50 },
  )
})

describe('memory allocation patterns', () => {
  bench(
    'create many promises',
    async () => {
      const promises = Array.from({ length: 100 }, (_, i) => delay(0).then(() => i))
      await Promise.all(promises)
    },
    { iterations: 100 },
  )

  bench(
    'create many mock functions',
    () => {
      const mocks = Array.from({ length: 100 }, (_, i) => createMockFn(() => i))
      return mocks.length
    },
    { iterations: 100 },
  )

  bench(
    'retry with large data',
    async () => {
      const largeData = new Array(1000).fill('test').join('-')
      await retry(() => Promise.resolve(largeData), 3, 10)
    },
    { iterations: 100 },
  )
})
