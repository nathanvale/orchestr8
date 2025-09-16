import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TypeScriptEngine } from './typescript-engine'

describe('TypeScriptEngine - Resource Disposal', () => {
  let engine: TypeScriptEngine

  beforeEach(() => {
    engine = new TypeScriptEngine()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Ensure cleanup after each test
    if (engine) {
      engine.clearCache()
    }
  })

  describe('clearCache()', () => {
    it('should clear the TypeScript compiler cache', async () => {
      const testFiles = ['test.ts']

      // First check to populate cache
      await engine.check({ files: testFiles })

      // Clear cache
      engine.clearCache()

      // Verify program is cleared
      const program = (engine as any).program
      expect(program).toBeUndefined()
    })

    it('should be compatible with multiple clearCache() calls', async () => {
      const testFiles = ['test.ts']

      // Initialize engine
      await engine.check({ files: testFiles })

      // Clear cache twice
      engine.clearCache()
      engine.clearCache()

      // Should not throw and should be able to check again
      const result = await engine.check({ files: testFiles })
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })
  })

  describe('Memory leak prevention', () => {
    it('should not accumulate programs over multiple checks', async () => {
      const testFiles = ['test1.ts', 'test2.ts', 'test3.ts']
      const programs: any[] = []

      // Perform multiple checks without disposal
      for (const file of testFiles) {
        await engine.check({ files: [file] })
        const program = (engine as any).program
        if (program && !programs.includes(program)) {
          programs.push(program)
        }
      }

      // Should reuse the same program (incremental compilation)
      expect(programs.length).toBe(1)
    })

    it('should release old source files when updating', async () => {
      // Check initial file
      await engine.check({ files: ['initial.ts'] })
      const initialProgram = (engine as any).program

      // Check different file (should update program)
      await engine.check({ files: ['updated.ts'] })
      const updatedProgram = (engine as any).program

      // Programs should be the same reference (incremental)
      expect(updatedProgram).toBe(initialProgram)

      // Clear cache to clean up
      engine.clearCache()

      // After clearing cache, program should be gone
      const clearedProgram = (engine as any).program
      expect(clearedProgram).toBeUndefined()
    })

    it('should handle cache clearing during concurrent operations gracefully', async () => {
      const testFiles = ['test.ts']

      // Start a check operation
      const checkPromise = engine.check({ files: testFiles })

      // Clear cache while operation might be ongoing
      engine.clearCache()

      // Wait for check to complete
      const result = await checkPromise

      // Should still get a valid result
      expect(result).toBeDefined()

      // Resources should be cleaned up
      const program = (engine as any).program
      expect(program).toBeUndefined()
    })
  })
})
