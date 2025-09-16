/**
 * Local Cache LRU Eviction Tests
 *
 * Tests for LRU (Least Recently Used) eviction policies for cache management
 */
import { describe, it, expect } from 'vitest'

describe('Local Cache LRU Eviction', () => {
  class LRUCache<T> {
    private cache = new Map<string, { value: T; lastAccessed: number }>()
    private maxSize: number

    constructor(maxSize: number) {
      this.maxSize = maxSize
    }

    get(key: string): T | undefined {
      const entry = this.cache.get(key)
      if (entry) {
        entry.lastAccessed = Date.now()
        return entry.value
      }
      return undefined
    }

    set(key: string, value: T): void {
      if (this.cache.size >= this.maxSize) {
        this.evictLRU()
      }
      this.cache.set(key, { value, lastAccessed: Date.now() })
    }

    private evictLRU(): void {
      let lruKey = ''
      let lruTime = Infinity

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < lruTime) {
          lruTime = entry.lastAccessed
          lruKey = key
        }
      }

      if (lruKey) {
        this.cache.delete(lruKey)
      }
    }

    size(): number {
      return this.cache.size
    }

    keys(): string[] {
      return Array.from(this.cache.keys())
    }
  }

  describe('LRU Eviction Policies', () => {
    it('should implement LRU eviction when cache size limit is reached', () => {
      const cache = new LRUCache<string>(3)

      // Add entries
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      expect(cache.size()).toBe(3)

      // Add fourth entry, should evict LRU
      cache.set('key4', 'value4')

      expect(cache.size()).toBe(3)
      expect(cache.get('key1')).toBeUndefined() // Should be evicted
      expect(cache.get('key4')).toBe('value4')
    })

    it('should update access time when cache entry is accessed', () => {
      const cache = new LRUCache<string>(3)

      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Access key1 to make it recently used
      cache.get('key1')

      // Add new entry, should evict key2 (oldest unaccessed)
      cache.set('key4', 'value4')

      expect(cache.get('key1')).toBe('value1') // Should still exist
      expect(cache.get('key2')).toBeUndefined() // Should be evicted
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })

    it('should support configurable cache size limits', () => {
      // Test different cache sizes
      const sizes = [1, 5, 10, 100]

      sizes.forEach((size) => {
        const cache = new LRUCache<string>(size)

        // Fill cache to capacity
        for (let i = 0; i < size; i++) {
          cache.set(`key${i}`, `value${i}`)
        }

        expect(cache.size()).toBe(size)

        // Add one more, should trigger eviction
        cache.set('overflow', 'overflow-value')
        expect(cache.size()).toBe(size)
      })
    })

    it('should track cache entry metadata for eviction decisions', () => {
      interface CacheEntryWithMetadata {
        value: string
        size: number
        createdAt: number
        lastAccessedAt: number
        accessCount: number
      }

      const createCacheEntry = (value: string): CacheEntryWithMetadata => ({
        value,
        size: Buffer.byteLength(value, 'utf8'),
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 0,
      })

      const entry1 = createCacheEntry('test-value-1')
      const entry2 = createCacheEntry('longer-test-value-2')

      expect(entry1.size).toBeLessThan(entry2.size)
      expect(entry1.createdAt).toBeDefined()
      expect(entry1.lastAccessedAt).toBeDefined()
      expect(entry1.accessCount).toBe(0)
    })
  })
})
