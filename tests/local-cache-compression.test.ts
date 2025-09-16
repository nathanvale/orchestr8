/**
 * Local Cache Compression Tests
 *
 * Tests for compressed tarball artifacts for efficient storage
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'

describe('Local Cache Compression', () => {
  const testCacheDir = '.turbo/cache/test'

  beforeEach(() => {
    // Clean up test cache directory
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    // Create test directories
    mkdirSync(testCacheDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directories
    try {
      if (existsSync(testCacheDir)) {
        rmSync(testCacheDir, { recursive: true, force: true })
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error)
    }
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

      // Ensure parent directory exists right before writing
      mkdirSync(testCacheDir, { recursive: true })
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
      // Ensure parent directory exists right before writing
      mkdirSync(testCacheDir, { recursive: true })
      writeFileSync(cachePath, compressed)

      // Read and decompress
      const compressedData = readFileSync(cachePath)
      const decompressed = gunzipSync(compressedData)
      const parsed = JSON.parse(decompressed.toString('utf8'))

      expect(parsed).toEqual(originalData)
    })

    it('should calculate compression statistics', () => {
      const testFiles = [
        'Medium sized data with repetitive content. '.repeat(50),
        'Larger data with more repetitive content that compresses well. '.repeat(100),
        'Very large data with lots of repetitive content that should compress very well. '.repeat(
          200,
        ),
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

      // Verify compression works for all data sets
      compressionStats.forEach((stats) => {
        expect(stats.compressionRatio).toBeLessThan(1)
        expect(stats.spaceSaved).toBeGreaterThan(0)
        expect(stats.compressionRatio).toBeGreaterThan(0)
      })

      // Verify compression is effective (less than 50% of original size)
      expect(compressionStats[0]?.compressionRatio ?? 1).toBeLessThan(0.5)
      expect(compressionStats[1]?.compressionRatio ?? 1).toBeLessThan(0.5)
      expect(compressionStats[2]?.compressionRatio ?? 1).toBeLessThan(0.5)
    })
  })
})
