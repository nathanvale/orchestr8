/**
 * Tests for cleanup utilities
 */

import { promises as fs } from 'node:fs'
import { describe, it, expect, afterEach } from 'vitest'
import { createTempDirectory, type TempDirectory } from '../temp.js'
import {
  useTempDirectory,
  useMultipleTempDirectories,
  createManagedTempDirectory,
  cleanupTempDirectory,
  cleanupAllTempDirectories,
  getTempDirectoryCount,
  withTempDirectoryScope,
} from '../cleanup.js'

describe('useTempDirectory', () => {
  it('should throw error when called outside test context', () => {
    const getTempDir = useTempDirectory()

    // Since we haven't set up beforeEach, this should throw
    expect(() => getTempDir()).toThrow(/No temp directory available/)
  })
})

describe('useMultipleTempDirectories', () => {
  it('should throw error when called outside test context', () => {
    const getTempDirs = useMultipleTempDirectories(2)

    expect(() => getTempDirs()).toThrow(/No temp directories available/)
  })
})

describe('createManagedTempDirectory', () => {
  let createdDirs: TempDirectory[] = []

  afterEach(async () => {
    // Clean up any directories we created
    await Promise.allSettled(createdDirs.map((dir) => dir.cleanup()))
    createdDirs = []
  })

  it('should create a managed temp directory', async () => {
    const tempDir = await createManagedTempDirectory()
    createdDirs.push(tempDir)

    expect(tempDir.path).toBeTruthy()

    // Verify directory exists
    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })

  it('should create managed temp directory with custom options', async () => {
    const tempDir = await createManagedTempDirectory({
      prefix: 'managed-test-',
    })
    createdDirs.push(tempDir)

    expect(tempDir.path).toMatch(/\/managed-test-.*/)

    // Verify directory exists
    const stat = await fs.stat(tempDir.path)
    expect(stat.isDirectory()).toBe(true)
  })
})

describe('cleanupTempDirectory', () => {
  it('should cleanup a specific temp directory', async () => {
    const tempDir = await createTempDirectory()

    // Create some content
    await tempDir.writeFile('test.txt', 'content')
    await tempDir.mkdir('subdir')

    // Verify it exists
    expect(await tempDir.exists('test.txt')).toBe(true)
    expect(await tempDir.exists('subdir')).toBe(true)

    // Cleanup
    await cleanupTempDirectory(tempDir)

    // Verify it's gone
    await expect(fs.access(tempDir.path)).rejects.toThrow()
  })

  it('should handle cleanup errors gracefully', async () => {
    const tempDir = await createTempDirectory()

    // Cleanup once
    await tempDir.cleanup()

    // Cleanup again through the cleanup function should not throw
    await expect(cleanupTempDirectory(tempDir)).resolves.toBeUndefined()
  })
})

describe('cleanupAllTempDirectories', () => {
  it('should cleanup all registered temp directories', async () => {
    // Create some managed directories
    const tempDir1 = await createManagedTempDirectory()
    const tempDir2 = await createManagedTempDirectory()

    // Create content
    await tempDir1.writeFile('file1.txt', 'content1')
    await tempDir2.writeFile('file2.txt', 'content2')

    // Verify they exist
    expect(await tempDir1.exists('file1.txt')).toBe(true)
    expect(await tempDir2.exists('file2.txt')).toBe(true)

    // Cleanup all
    await cleanupAllTempDirectories()

    // Verify they're gone
    await expect(fs.access(tempDir1.path)).rejects.toThrow()
    await expect(fs.access(tempDir2.path)).rejects.toThrow()
  })

  it('should handle empty registry', async () => {
    // Clean up everything first
    await cleanupAllTempDirectories()

    // Should not throw when cleaning up empty registry
    await expect(cleanupAllTempDirectories()).resolves.toBeUndefined()
  })
})

describe('getTempDirectoryCount', () => {
  let createdDirs: TempDirectory[] = []

  afterEach(async () => {
    await cleanupAllTempDirectories()
    await Promise.allSettled(createdDirs.map((dir) => dir.cleanup()))
    createdDirs = []
  })

  it('should return the number of registered temp directories', async () => {
    const initialCount = getTempDirectoryCount()

    const tempDir1 = await createManagedTempDirectory()
    const tempDir2 = await createManagedTempDirectory()
    createdDirs.push(tempDir1, tempDir2)

    expect(getTempDirectoryCount()).toBe(initialCount + 2)

    // Cleanup one
    await cleanupTempDirectory(tempDir1)
    expect(getTempDirectoryCount()).toBe(initialCount + 1)

    // Cleanup all
    await cleanupAllTempDirectories()
    expect(getTempDirectoryCount()).toBe(0)
  })

  it('should return 0 for empty registry', async () => {
    await cleanupAllTempDirectories()
    expect(getTempDirectoryCount()).toBe(0)
  })
})

describe('withTempDirectoryScope', () => {
  it('should create scoped temp directories', async () => {
    const paths: string[] = []

    await withTempDirectoryScope(async (createTemp) => {
      const dir1 = await createTemp()
      const dir2 = await createTemp({ prefix: 'scoped-' })

      paths.push(dir1.path, dir2.path)

      // Create content
      await dir1.writeFile('file1.txt', 'content1')
      await dir2.writeFile('file2.txt', 'content2')

      // Verify they exist during scope
      expect(await dir1.exists('file1.txt')).toBe(true)
      expect(await dir2.exists('file2.txt')).toBe(true)
    })

    // After scope ends, directories should be cleaned up
    for (const path of paths) {
      await expect(fs.access(path)).rejects.toThrow()
    }
  })

  it('should cleanup directories even if scope throws', async () => {
    const paths: string[] = []

    await expect(
      withTempDirectoryScope(async (createTemp) => {
        const dir1 = await createTemp()
        const dir2 = await createTemp()

        paths.push(dir1.path, dir2.path)

        // Create content
        await dir1.writeFile('file1.txt', 'content1')
        await dir2.writeFile('file2.txt', 'content2')

        throw new Error('Simulated error')
      }),
    ).rejects.toThrow('Simulated error')

    // Directories should still be cleaned up
    for (const path of paths) {
      await expect(fs.access(path)).rejects.toThrow()
    }
  })

  it('should return value from scope function', async () => {
    const result = await withTempDirectoryScope(async (createTemp) => {
      const dir = await createTemp()
      await dir.writeFile('test.txt', 'test content')
      const content = await dir.readFile('test.txt')
      return content
    })

    expect(result).toBe('test content')
  })

  it('should handle nested scopes', async () => {
    const outerPaths: string[] = []
    const innerPaths: string[] = []

    await withTempDirectoryScope(async (createTemp) => {
      const outerDir = await createTemp()
      outerPaths.push(outerDir.path)

      await withTempDirectoryScope(async (createTemp) => {
        const innerDir = await createTemp()
        innerPaths.push(innerDir.path)

        await outerDir.writeFile('outer.txt', 'outer content')
        await innerDir.writeFile('inner.txt', 'inner content')

        // Both should exist
        expect(await outerDir.exists('outer.txt')).toBe(true)
        expect(await innerDir.exists('inner.txt')).toBe(true)
      })

      // Inner scope directories should be cleaned up
      for (const path of innerPaths) {
        await expect(fs.access(path)).rejects.toThrow()
      }

      // Outer directory should still exist
      expect(await outerDir.exists('outer.txt')).toBe(true)
    })

    // All directories should be cleaned up
    for (const path of [...outerPaths, ...innerPaths]) {
      await expect(fs.access(path)).rejects.toThrow()
    }
  })

  it('should handle empty scope', async () => {
    const result = await withTempDirectoryScope(async () => {
      return 'empty scope'
    })

    expect(result).toBe('empty scope')
  })
})

describe('error handling and resilience', () => {
  let createdDirs: TempDirectory[] = []

  afterEach(async () => {
    await cleanupAllTempDirectories()
    await Promise.allSettled(createdDirs.map((dir) => dir.cleanup()))
    createdDirs = []
  })

  it('should handle cleanup failures gracefully', async () => {
    const tempDir = await createTempDirectory()
    createdDirs.push(tempDir)

    // Manually remove the directory to simulate cleanup failure
    await tempDir.cleanup()

    // Registry cleanup should not throw even if directory is already gone
    await expect(cleanupTempDirectory(tempDir)).resolves.toBeUndefined()
  })

  it('should handle process exit cleanup', async () => {
    // This is hard to test directly, but we can verify the registry structure
    const tempDir = await createManagedTempDirectory()
    createdDirs.push(tempDir)

    expect(getTempDirectoryCount()).toBeGreaterThan(0)

    // Manual cleanup to simulate process exit
    await cleanupAllTempDirectories()
    expect(getTempDirectoryCount()).toBe(0)
  })
})

describe('performance and concurrency', () => {
  let createdDirs: TempDirectory[] = []

  afterEach(async () => {
    await cleanupAllTempDirectories()
    await Promise.allSettled(createdDirs.map((dir) => dir.cleanup()))
    createdDirs = []
  })

  it('should handle many concurrent temp directories', async () => {
    const count = 50
    const start = Date.now()

    // Create many directories concurrently
    const dirs = await Promise.all(
      Array.from({ length: count }, () => createManagedTempDirectory()),
    )
    createdDirs.push(...dirs)

    const createDuration = Date.now() - start
    expect(createDuration).toBeLessThan(5000) // Should take less than 5 seconds

    expect(getTempDirectoryCount()).toBeGreaterThanOrEqual(count)

    // Cleanup concurrently
    const cleanupStart = Date.now()
    await cleanupAllTempDirectories()
    const cleanupDuration = Date.now() - cleanupStart

    expect(cleanupDuration).toBeLessThan(3000) // Should take less than 3 seconds
    expect(getTempDirectoryCount()).toBe(0)

    createdDirs = [] // Already cleaned up
  })

  it('should handle rapid create/cleanup cycles', async () => {
    for (let i = 0; i < 10; i++) {
      const tempDir = await createManagedTempDirectory()
      await tempDir.writeFile('cycle.txt', `cycle ${i}`)
      await cleanupTempDirectory(tempDir)
    }

    expect(getTempDirectoryCount()).toBe(0)
  })
})
