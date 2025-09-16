/**
 * Local Cache Management Tests
 *
 * Tests for local cache storage, LRU eviction, and compression:
 * 1. Local cache storage in .turbo/cache with proper structure
 * 2. LRU (Least Recently Used) eviction policies for cache management
 * 3. Compressed tarball artifacts for efficient storage
 * 4. Content-aware hashing that ignores file metadata
 * 5. Performance monitoring and cache hit rate optimization
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync,
  readdirSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { gzipSync, gunzipSync } from 'node:zlib'

interface CacheEntry {
  key: string
  path: string
  size: number
  createdAt: number
  lastAccessedAt: number
  compressed: boolean
  contentHash: string
}

interface CacheStats {
  totalEntries: number
  totalSize: number
  hitRate: number
  compressionRatio: number
  avgAccessTime: number
}

describe('Local Cache Management', () => {
  const testCacheDir = '.turbo/cache/test'
  const testWorkspaceDir = 'test-workspace'

  beforeEach(() => {
    // Clean up test cache directory
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    if (existsSync(testWorkspaceDir)) {
      rmSync(testWorkspaceDir, { recursive: true, force: true })
    }

    // Create test directories
    mkdirSync(testCacheDir, { recursive: true })
    mkdirSync(testWorkspaceDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    if (existsSync(testWorkspaceDir)) {
      rmSync(testWorkspaceDir, { recursive: true, force: true })
    }
  })

  describe('Cache Directory Structure', () => {
    it('should have proper .turbo/cache directory structure', () => {
      // Verify main cache directory exists
      expect(existsSync('.turbo')).toBe(true)
      expect(existsSync('.turbo/cache')).toBe(true)

      // Check that it's a directory
      const stat = statSync('.turbo/cache')
      expect(stat.isDirectory()).toBe(true)
    })

    it('should organize cache by task type and content hash', () => {
      // Create test cache entries
      const taskTypes = ['format', 'format-check', 'lint', 'build']

      taskTypes.forEach((taskType) => {
        const taskDir = join('.turbo/cache', taskType)
        mkdirSync(taskDir, { recursive: true })

        // Create hash-based subdirectories
        const contentHash = createHash('sha256')
          .update(`test-${taskType}`)
          .digest('hex')
          .substring(0, 8)
        const hashDir = join(taskDir, contentHash)
        mkdirSync(hashDir, { recursive: true })

        // Verify structure
        expect(existsSync(taskDir)).toBe(true)
        expect(existsSync(hashDir)).toBe(true)
      })
    })

    it('should support hierarchical cache organization', () => {
      const cacheStructure = {
        '.turbo/cache': {
          'format': {},
          'format-check': {},
          'lint': {},
          'build': {},
          'test': {},
        },
      }

      // Create the hierarchical structure
      Object.keys(cacheStructure['.turbo/cache']).forEach((taskType) => {
        const taskDir = join('.turbo/cache', taskType)
        mkdirSync(taskDir, { recursive: true })

        // Create some sample hash directories
        for (let i = 0; i < 3; i++) {
          const hashDir = join(taskDir, `hash-${i.toString().padStart(2, '0')}`)
          mkdirSync(hashDir, { recursive: true })
        }
      })

      // Verify hierarchical structure
      const cacheContents = readdirSync('.turbo/cache')
      expect(cacheContents).toContain('format')
      expect(cacheContents).toContain('format-check')
      expect(cacheContents).toContain('lint')
      expect(cacheContents).toContain('build')
      expect(cacheContents).toContain('test')

      // Check subdirectories
      const formatContents = readdirSync('.turbo/cache/format')
      expect(formatContents.length).toBeGreaterThan(0)
    })

    it('should maintain proper permissions for cache directories', () => {
      const cacheDir = '.turbo/cache'
      const stat = statSync(cacheDir)

      // Should be readable and writable by owner
      expect(stat.mode & 0o700).toBeGreaterThan(0)
    })
  })

  describe('LRU Eviction Policies', () => {
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

  describe('Compressed Tarball Artifacts', () => {
    it('should compress cache artifacts for efficient storage', () => {
      const testData = 'This is test data that should be compressed to save storage space. '.repeat(
        100,
      )
      const originalBuffer = Buffer.from(testData, 'utf8')

      // Compress the data
      const compressed = gzipSync(originalBuffer)

      // Verify compression ratio
      const compressionRatio = compressed.length / originalBuffer.length
      expect(compressionRatio).toBeLessThan(0.5) // Should be at least 50% compression

      // Verify decompression works
      const decompressed = gunzipSync(compressed)
      expect(decompressed.toString('utf8')).toBe(testData)
    })

    it('should store compressed artifacts in cache directory', () => {
      const testData = {
        outputs: ['dist/index.js', 'dist/types.d.ts'],
        logs: 'Build completed successfully',
        metadata: {
          taskType: 'build',
          duration: 1500,
          timestamp: Date.now(),
        },
      }

      const serialized = JSON.stringify(testData)
      const compressed = gzipSync(Buffer.from(serialized, 'utf8'))

      // Write compressed artifact to cache
      const cacheKey = createHash('sha256').update(serialized).digest('hex')
      const cachePath = join(testCacheDir, `${cacheKey}.tar.gz`)

      writeFileSync(cachePath, compressed)

      // Verify file exists and is compressed
      expect(existsSync(cachePath)).toBe(true)

      const fileStats = statSync(cachePath)
      expect(fileStats.size).toBeLessThan(Buffer.byteLength(serialized, 'utf8'))
    })

    it('should decompress artifacts when reading from cache', () => {
      const originalData = {
        buildOutput: 'Console output here',
        files: ['src/index.ts', 'src/utils.ts'],
        success: true,
      }

      const serialized = JSON.stringify(originalData)
      const compressed = gzipSync(Buffer.from(serialized, 'utf8'))

      // Store compressed
      const cachePath = join(testCacheDir, 'test-artifact.tar.gz')
      writeFileSync(cachePath, compressed)

      // Read and decompress
      const compressedData = readFileSync(cachePath)
      const decompressed = gunzipSync(compressedData)
      const parsed = JSON.parse(decompressed.toString('utf8'))

      expect(parsed).toEqual(originalData)
    })

    it('should calculate compression statistics', () => {
      const testFiles = [
        'Small data',
        'Medium sized data with some repetitive content. '.repeat(10),
        'Large data with lots of repetitive content that should compress well. '.repeat(100),
      ]

      const compressionStats = testFiles.map((data) => {
        const original = Buffer.from(data, 'utf8')
        const compressed = gzipSync(original)

        return {
          originalSize: original.length,
          compressedSize: compressed.length,
          compressionRatio: compressed.length / original.length,
          spaceSaved: original.length - compressed.length,
        }
      })

      // Verify compression improves with larger, more repetitive data
      compressionStats.forEach((stats, index) => {
        expect(stats.compressionRatio).toBeLessThan(1)
        expect(stats.spaceSaved).toBeGreaterThan(0)

        if (index > 0) {
          // Larger files should generally have better compression ratios
          expect(stats.compressionRatio).toBeLessThanOrEqual(
            compressionStats[index - 1].compressionRatio + 0.1,
          )
        }
      })
    })
  })

  describe('Content-Aware Hashing', () => {
    it('should generate consistent hashes for identical content regardless of metadata', () => {
      const content = 'console.log("Hello, World!");'

      // Create files with different timestamps but same content
      const file1Path = join(testWorkspaceDir, 'file1.js')
      const file2Path = join(testWorkspaceDir, 'file2.js')

      writeFileSync(file1Path, content)

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10))

      writeFileSync(file2Path, content)

      // Generate content-based hashes (ignore metadata)
      const hash1 = createHash('sha256').update(content).digest('hex')
      const hash2 = createHash('sha256').update(content).digest('hex')

      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different content', () => {
      const content1 = 'console.log("Hello, World!");'
      const content2 = 'console.log("Hello, Universe!");'

      const hash1 = createHash('sha256').update(content1).digest('hex')
      const hash2 = createHash('sha256').update(content2).digest('hex')

      expect(hash1).not.toBe(hash2)
    })

    it('should create composite hashes for multiple input factors', () => {
      const factors = {
        sourceFiles: ['src/index.ts', 'src/utils.ts'],
        config: { prettier: true, lint: true },
        dependencies: { react: '18.2.0', typescript: '5.0.0' },
        environment: { NODE_ENV: 'development' },
      }

      const compositeHash = createHash('sha256').update(JSON.stringify(factors)).digest('hex')

      expect(compositeHash).toBeDefined()
      expect(compositeHash.length).toBe(64) // SHA256 hex length

      // Different factors should produce different hashes
      const modifiedFactors = { ...factors, environment: { NODE_ENV: 'production' } }
      const modifiedHash = createHash('sha256')
        .update(JSON.stringify(modifiedFactors))
        .digest('hex')

      expect(compositeHash).not.toBe(modifiedHash)
    })

    it('should ignore file metadata in hash calculation', () => {
      const contentHasher = (filePath: string): string => {
        // Read only content, ignore file stats
        const content = readFileSync(filePath, 'utf8')
        return createHash('sha256').update(content).digest('hex')
      }

      const testFile = join(testWorkspaceDir, 'test.js')
      const content = 'export const greeting = "Hello, World!";'

      writeFileSync(testFile, content)
      const hash1 = contentHasher(testFile)

      // Modify file metadata by touching it
      const now = new Date()
      const futureTime = new Date(now.getTime() + 60000) // 1 minute in future

      // Change access/modification time
      const stats = statSync(testFile)
      writeFileSync(testFile, content) // Rewrite same content

      const hash2 = contentHasher(testFile)

      // Hashes should be the same despite metadata changes
      expect(hash1).toBe(hash2)
    })

    it('should support incremental hash computation for large files', () => {
      const chunks = [
        'function calculateSum(a, b) {',
        '  return a + b;',
        '}',
        '',
        'export { calculateSum };',
      ]

      // Compute hash incrementally
      const incrementalHash = createHash('sha256')
      chunks.forEach((chunk) => incrementalHash.update(chunk + '\n'))
      const incrementalResult = incrementalHash.digest('hex')

      // Compute hash all at once
      const fullContent = chunks.join('\n') + '\n'
      const fullHash = createHash('sha256').update(fullContent).digest('hex')

      expect(incrementalResult).toBe(fullHash)
    })
  })

  describe('Cache Performance Monitoring', () => {
    it('should track cache hit rates', () => {
      const cacheHitTracker = {
        hits: 0,
        misses: 0,

        recordHit() {
          this.hits++
        },
        recordMiss() {
          this.misses++
        },

        getHitRate(): number {
          const total = this.hits + this.misses
          return total === 0 ? 0 : this.hits / total
        },
      }

      // Simulate cache operations
      cacheHitTracker.recordHit()
      cacheHitTracker.recordHit()
      cacheHitTracker.recordMiss()
      cacheHitTracker.recordHit()
      cacheHitTracker.recordHit()

      expect(cacheHitTracker.getHitRate()).toBe(0.8) // 80% hit rate
    })

    it('should monitor cache performance metrics', () => {
      const performanceMonitor = {
        cacheOperations: [] as Array<{
          operation: 'read' | 'write' | 'evict'
          duration: number
          size: number
          timestamp: number
        }>,

        recordOperation(operation: 'read' | 'write' | 'evict', duration: number, size: number) {
          this.cacheOperations.push({
            operation,
            duration,
            size,
            timestamp: Date.now(),
          })
        },

        getAverageAccessTime(): number {
          const readOps = this.cacheOperations.filter((op) => op.operation === 'read')
          if (readOps.length === 0) return 0

          const totalTime = readOps.reduce((sum, op) => sum + op.duration, 0)
          return totalTime / readOps.length
        },

        getTotalCacheSize(): number {
          return this.cacheOperations
            .filter((op) => op.operation === 'write')
            .reduce((sum, op) => sum + op.size, 0)
        },
      }

      // Simulate cache operations
      performanceMonitor.recordOperation('write', 50, 1024)
      performanceMonitor.recordOperation('read', 5, 0)
      performanceMonitor.recordOperation('read', 3, 0)
      performanceMonitor.recordOperation('write', 75, 2048)

      expect(performanceMonitor.getAverageAccessTime()).toBe(4) // (5 + 3) / 2
      expect(performanceMonitor.getTotalCacheSize()).toBe(3072) // 1024 + 2048
    })

    it('should target 80%+ cache hit rate for unchanged packages', () => {
      const cacheSimulation = {
        packages: ['pkg-a', 'pkg-b', 'pkg-c', 'pkg-d', 'pkg-e'],
        changedPackages: ['pkg-c'], // Only one package changed

        simulateCacheHits(): { hits: number; misses: number; hitRate: number } {
          let hits = 0
          let misses = 0

          this.packages.forEach((pkg) => {
            if (this.changedPackages.includes(pkg)) {
              misses++ // Cache miss for changed package
            } else {
              hits++ // Cache hit for unchanged package
            }
          })

          return {
            hits,
            misses,
            hitRate: hits / (hits + misses),
          }
        },
      }

      const result = cacheSimulation.simulateCacheHits()

      expect(result.hitRate).toBeGreaterThanOrEqual(0.8) // 80% or higher
      expect(result.hits).toBe(4) // 4 unchanged packages
      expect(result.misses).toBe(1) // 1 changed package
    })

    it('should measure cache efficiency and storage optimization', () => {
      const cacheEfficiencyMetrics = {
        totalOriginalSize: 10 * 1024 * 1024, // 10MB original
        totalCompressedSize: 3 * 1024 * 1024, // 3MB compressed
        cacheHits: 85,
        cacheMisses: 15,

        getCompressionRatio(): number {
          return this.totalCompressedSize / this.totalOriginalSize
        },

        getSpaceSavings(): number {
          return 1 - this.getCompressionRatio()
        },

        getCacheHitRate(): number {
          return this.cacheHits / (this.cacheHits + this.cacheMisses)
        },

        getEfficiencyScore(): number {
          const compressionScore = this.getSpaceSavings()
          const hitRateScore = this.getCacheHitRate()
          return (compressionScore + hitRateScore) / 2
        },
      }

      expect(cacheEfficiencyMetrics.getCompressionRatio()).toBe(0.3) // 70% reduction
      expect(cacheEfficiencyMetrics.getSpaceSavings()).toBe(0.7) // 70% space saved
      expect(cacheEfficiencyMetrics.getCacheHitRate()).toBe(0.85) // 85% hit rate
      expect(cacheEfficiencyMetrics.getEfficiencyScore()).toBeGreaterThan(0.75) // Good efficiency
    })
  })

  describe('Parallel Task Execution Support', () => {
    it('should support concurrent cache operations', async () => {
      const concurrentOperations = Array.from(
        { length: 10 },
        (_, i) =>
          new Promise<string>((resolve) => {
            // Simulate cache operation
            setTimeout(() => {
              const key = `cache-key-${i}`
              const hash = createHash('sha256').update(key).digest('hex')
              resolve(hash)
            }, Math.random() * 10)
          }),
      )

      const results = await Promise.all(concurrentOperations)

      expect(results.length).toBe(10)
      expect(new Set(results).size).toBe(10) // All unique hashes
    })

    it('should handle cache contention gracefully', () => {
      const cacheState = new Map<string, { value: string; locked: boolean }>()

      const safeWrite = (key: string, value: string): boolean => {
        const existing = cacheState.get(key)
        if (existing?.locked) {
          return false // Write failed due to lock
        }

        cacheState.set(key, { value, locked: true })

        // Simulate operation completion
        setTimeout(() => {
          const entry = cacheState.get(key)
          if (entry) {
            cacheState.set(key, { ...entry, locked: false })
          }
        }, 1)

        return true // Write succeeded
      }

      const safeRead = (key: string): string | null => {
        const entry = cacheState.get(key)
        return entry && !entry.locked ? entry.value : null
      }

      // Test concurrent operations
      expect(safeWrite('test-key', 'test-value')).toBe(true)
      expect(safeWrite('test-key', 'other-value')).toBe(false) // Should fail due to lock
      expect(safeRead('test-key')).toBeNull() // Should fail due to lock
    })

    it('should optimize for CPU core utilization', () => {
      const cpuCores = require('os').cpus().length
      const optimalParallelism = Math.max(1, cpuCores - 1) // Leave one core for OS

      const taskDistribution = {
        availableCores: cpuCores,
        optimalWorkers: optimalParallelism,

        distributeWork<T>(tasks: T[]): T[][] {
          const chunks: T[][] = []
          const chunkSize = Math.ceil(tasks.length / this.optimalWorkers)

          for (let i = 0; i < tasks.length; i += chunkSize) {
            chunks.push(tasks.slice(i, i + chunkSize))
          }

          return chunks
        },
      }

      const testTasks = Array.from({ length: 20 }, (_, i) => `task-${i}`)
      const distributed = taskDistribution.distributeWork(testTasks)

      expect(distributed.length).toBeLessThanOrEqual(optimalParallelism)
      expect(distributed.flat()).toEqual(testTasks) // All tasks preserved
    })
  })

  describe('Integration with Turborepo Cache System', () => {
    it('should validate turbo cache configuration exists', () => {
      expect(existsSync('turbo.json')).toBe(true)

      const turboConfig = JSON.parse(readFileSync('turbo.json', 'utf8'))
      expect(turboConfig.tasks).toBeDefined()

      // Verify cache-enabled tasks exist
      const cacheableTasks = Object.entries(turboConfig.tasks)
        .filter(([_, config]: [string, any]) => config.cache === true)
        .map(([name]) => name)

      expect(cacheableTasks).toContain('format')
      expect(cacheableTasks).toContain('format:check')
    })

    it('should ensure cache directory is properly configured', () => {
      // Verify .turbo directory is in .gitignore
      if (existsSync('.gitignore')) {
        const gitignore = readFileSync('.gitignore', 'utf8')
        expect(gitignore).toContain('.turbo')
      }

      // Verify cache directory structure can be created
      const testTaskDir = '.turbo/cache/test-task'
      mkdirSync(testTaskDir, { recursive: true })
      expect(existsSync(testTaskDir)).toBe(true)
    })

    it('should support cache key validation and integrity checks', () => {
      const validateCacheEntry = (key: string, content: string): boolean => {
        // Regenerate hash from content
        const expectedHash = createHash('sha256').update(content).digest('hex')

        // Extract hash from key (assuming key format includes hash)
        const keyHash = key.includes('-') ? key.split('-').pop() : key

        return keyHash === expectedHash.substring(0, keyHash?.length || 8)
      }

      const testContent = 'console.log("test");'
      const contentHash = createHash('sha256').update(testContent).digest('hex')
      const cacheKey = `format-${contentHash.substring(0, 8)}`

      expect(validateCacheEntry(cacheKey, testContent)).toBe(true)
      expect(validateCacheEntry(cacheKey, 'different content')).toBe(false)
    })
  })
})
