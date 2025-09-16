import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ESLintEngine } from './eslint-engine'

describe('ESLintEngine - Resource Disposal', () => {
  let engine: ESLintEngine

  beforeEach(() => {
    engine = new ESLintEngine()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Ensure cleanup after each test
    if (engine) {
      engine.dispose?.()
    }
  })

  describe('dispose()', () => {
    it('should clear the ESLint instance', async () => {
      // Initialize engine with a test file
      await engine.check({ files: ['test.js'] })

      // Verify eslint instance exists
      const eslintBeforeDispose = (engine as any).eslint
      expect(eslintBeforeDispose).toBeDefined()

      // Dispose resources
      engine.dispose()

      // Verify eslint instance is cleared
      const eslintAfterDispose = (engine as any).eslint
      expect(eslintAfterDispose).toBeUndefined()
    })

    it('should clear cached configurations', async () => {
      // First check to populate config cache
      await engine.check({ files: ['test.js'] })

      // Access internal cache (if exists)
      const configCacheBeforeDispose = (engine as any).configCache
      if (configCacheBeforeDispose) {
        expect(configCacheBeforeDispose.size).toBeGreaterThan(0)
      }

      // Dispose resources
      engine.dispose()

      // Verify cache is cleared
      const configCacheAfterDispose = (engine as any).configCache
      if (configCacheAfterDispose) {
        expect(configCacheAfterDispose.size).toBe(0)
      }
    })

    it('should be safe to call dispose multiple times', async () => {
      // Initialize engine
      await engine.check({ files: ['test.js'] })

      // Call dispose multiple times
      expect(() => {
        engine.dispose()
        engine.dispose()
        engine.dispose()
      }).not.toThrow()

      // Verify resources are still cleared
      const eslint = (engine as any).eslint
      expect(eslint).toBeUndefined()
    })

    it('should allow checking files after disposal', async () => {
      // First check
      await engine.check({ files: ['test.js'] })

      // Dispose resources
      engine.dispose()

      // Should be able to check again (recreates resources)
      const result = await engine.check({ files: ['test.js'] })
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()

      // Verify eslint was recreated
      const eslint = (engine as any).eslint
      expect(eslint).toBeDefined()
    })

    it('should properly clean up memory references', () => {
      // Mock memory usage to verify cleanup
      const initialMemory = process.memoryUsage().heapUsed

      // Create and dispose multiple times to check for leaks
      for (let i = 0; i < 5; i++) {
        const testEngine = new ESLintEngine()
        testEngine.check({ files: ['test.js'] })
        testEngine.dispose()
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory

      // Memory growth should be minimal (allowing for test overhead)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // 50MB threshold
    })
  })

  describe('clearCache()', () => {
    it('should clear the ESLint cache', async () => {
      // First check to populate cache
      await engine.check({ files: ['test.js'] })

      // Clear cache
      engine.clearCache()

      // Verify eslint is cleared (clearCache should call dispose internally)
      const eslint = (engine as any).eslint
      expect(eslint).toBeUndefined()
    })

    it('should be compatible with dispose()', async () => {
      // Initialize engine
      await engine.check({ files: ['test.js'] })

      // Clear cache then dispose
      engine.clearCache()
      engine.dispose()

      // Should not throw
      await expect(engine.check({ files: ['test.js'] })).resolves.toBeDefined()
    })
  })

  describe('Memory leak prevention', () => {
    it('should not accumulate ESLint instances', async () => {
      const testFiles = ['test1.js', 'test2.js', 'test3.js']
      const instances: any[] = []

      // Perform multiple checks without disposal
      for (const file of testFiles) {
        await engine.check({ files: [file] })
        const eslint = (engine as any).eslint
        if (eslint && !instances.includes(eslint)) {
          instances.push(eslint)
        }
      }

      // Should reuse the same eslint instance
      expect(instances.length).toBe(1)
    })

    it('should release old configurations when updating', async () => {
      // Check initial file
      await engine.check({ files: ['initial.js'] })
      const initialEslint = (engine as any).eslint

      // Check different file (should reuse eslint)
      await engine.check({ files: ['updated.js'] })
      const updatedEslint = (engine as any).eslint

      // Should reuse the same eslint instance
      expect(updatedEslint).toBe(initialEslint)

      // Dispose to clean up
      engine.dispose()

      // After disposal, eslint should be gone
      const disposedEslint = (engine as any).eslint
      expect(disposedEslint).toBeUndefined()
    })

    it('should handle disposal during concurrent operations gracefully', async () => {
      // Start a check operation
      const checkPromise = engine.check({ files: ['test.js'] })

      // Dispose while operation might be ongoing
      engine.dispose()

      // Wait for check to complete
      const result = await checkPromise

      // Should still get a valid result
      expect(result).toBeDefined()

      // Resources should be cleaned up
      const eslint = (engine as any).eslint
      expect(eslint).toBeUndefined()
    })
  })
})
