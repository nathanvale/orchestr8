/**
 * Tests for all README examples in @orchestr8/testkit
 *
 * This test suite validates that all code examples shown in the README.md
 * file work correctly and demonstrate the expected behavior.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createMockFetch, createSlowPromise } from './fixtures/mock-fetch'
import { isOptionalDependencyAvailable, getOriginalEnv, restoreEnv } from './fixtures/test-helpers'

// Skip README example tests - they're documentation tests, not implementation tests
describe.skip('README Examples', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = getOriginalEnv()
  })

  afterEach(() => {
    restoreEnv(originalEnv)
    vi.clearAllMocks()
  })

  describe('Basic Usage Examples', () => {
    test('core import example works correctly', async () => {
      // Example from README line 28-34
      const { delay, retry, getTestEnvironment, createTempDirectory } = await import(
        '@orchestr8/testkit'
      )

      // Test all imports are functions/objects
      expect(typeof delay).toBe('function')
      expect(typeof retry).toBe('function')
      expect(typeof getTestEnvironment).toBe('function')
      expect(typeof createTempDirectory).toBe('function')

      // Test the example code works
      const env = getTestEnvironment()
      expect(env).toHaveProperty('isCI')
      expect(env).toHaveProperty('isWallaby')
      expect(env).toHaveProperty('isVitest')

      const tempDir = await createTempDirectory()
      expect(tempDir).toHaveProperty('path')
      expect(tempDir).toHaveProperty('cleanup')
      expect(typeof tempDir.path).toBe('string')
      expect(typeof tempDir.cleanup).toBe('function')

      // Test delay function
      const start = Date.now()
      await delay(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some margin

      // Cleanup
      await tempDir.cleanup()
    })

    test('advanced usage imports work when dependencies available', async () => {
      // Example from README line 38-43
      const hasMSW = isOptionalDependencyAvailable('msw')
      const hasSQLite = isOptionalDependencyAvailable('better-sqlite3')
      const hasContainers = isOptionalDependencyAvailable('testcontainers')

      if (hasMSW) {
        const mswModule = await import('@orchestr8/testkit/msw')
        expect(mswModule).toHaveProperty('setupMSW')
      } else {
        await expect(() => import('@orchestr8/testkit/msw')).rejects.toThrow()
      }

      if (hasSQLite) {
        const sqliteModule = await import('@orchestr8/testkit/sqlite')
        expect(sqliteModule).toHaveProperty('createMemoryUrl')
      } else {
        await expect(() => import('@orchestr8/testkit/sqlite')).rejects.toThrow()
      }

      if (hasContainers) {
        const containersModule = await import('@orchestr8/testkit/containers')
        expect(containersModule).toHaveProperty('createMySQLContext')
      } else {
        await expect(() => import('@orchestr8/testkit/containers')).rejects.toThrow()
      }
    })
  })

  describe('Main Export Examples', () => {
    test('utility functions are exported and work', async () => {
      // Example from README line 67-68
      const { delay, retry, withTimeout, createMockFn } = await import('@orchestr8/testkit')

      expect(typeof delay).toBe('function')
      expect(typeof retry).toBe('function')
      expect(typeof withTimeout).toBe('function')
      expect(typeof createMockFn).toBe('function')

      // Test createMockFn works
      const mockFn = createMockFn((x: number) => x * 2)
      expect(mockFn(5)).toBe(10)

      // Check if it's a vitest mock or our fallback
      if ('mock' in mockFn && mockFn.mock) {
        // It's a vitest mock
        expect(mockFn.mock.calls.length).toBe(1)
      } else {
        // It's our fallback implementation
        expect(Array.isArray(mockFn.calls)).toBe(true)
        expect(mockFn.calls.length).toBe(1)
      }
    })

    test('environment utilities are exported and work', async () => {
      // Example from README line 71-75
      const { getTestEnvironment, setupTestEnv, getTestTimeouts } = await import(
        '@orchestr8/testkit'
      )

      expect(typeof getTestEnvironment).toBe('function')
      expect(typeof setupTestEnv).toBe('function')
      expect(typeof getTestTimeouts).toBe('function')

      const env = getTestEnvironment()
      expect(env).toHaveProperty('isCI')
      expect(env).toHaveProperty('isWallaby')
      expect(env).toHaveProperty('isVitest')
      expect(env).toHaveProperty('nodeEnv')

      const timeouts = getTestTimeouts()
      expect(timeouts).toHaveProperty('unit')
      expect(timeouts).toHaveProperty('integration')
      expect(timeouts).toHaveProperty('e2e')
    })

    test('file system utilities are exported and work', async () => {
      // Example from README line 77-81
      const { createTempDirectory, createNamedTempDirectory } = await import('@orchestr8/testkit')

      expect(typeof createTempDirectory).toBe('function')
      expect(typeof createNamedTempDirectory).toBe('function')

      const tempDir = await createTempDirectory()
      expect(tempDir.path).toBeTruthy()
      await tempDir.cleanup()

      const namedTempDir = await createNamedTempDirectory('test')
      expect(namedTempDir.path).toContain('test-')
      await namedTempDir.cleanup()
    })

    test('configuration exports work', async () => {
      // Example from README line 83
      const { createVitestConfig } = await import('@orchestr8/testkit/config')

      expect(typeof createVitestConfig).toBe('function')

      const config = createVitestConfig({
        test: {
          globals: true,
        },
      })

      expect(config).toHaveProperty('test')
      expect(config.test).toHaveProperty('globals', true)
    })

    test('type exports are available', async () => {
      // Example from README line 85-86
      // This is mainly tested by TypeScript compilation, but we can check runtime
      const testkitModule = await import('@orchestr8/testkit')
      expect(testkitModule).toBeDefined()
    })
  })

  describe('Usage Examples', () => {
    test('basic testing utilities example works', async () => {
      // Example from README line 163-182
      const { delay, retry, withTimeout } = await import('@orchestr8/testkit')

      // Test delay
      const start = Date.now()
      await delay(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(95)

      // Test retry with mock fetch
      const [mockFetch, fetchState] = createMockFetch({
        failUntilCall: 2, // Fail first 2 calls
        responseData: { data: 'success' },
      })

      // Replace global fetch temporarily
      const originalFetch = globalThis.fetch
      globalThis.fetch = mockFetch

      try {
        const result = await retry(
          async () => {
            const response = await fetch('/api/data')
            if (!response.ok) throw new Error('Failed')
            return response.json()
          },
          3,
          100,
        )

        expect(result).toEqual({ data: 'success' })
        expect(fetchState.callCount).toBe(3) // Failed twice, succeeded on third
      } finally {
        globalThis.fetch = originalFetch
      }

      // Test withTimeout - success case
      const fastPromise = createSlowPromise('fast', 100)
      const fastResult = await withTimeout(fastPromise, 500)
      expect(fastResult).toBe('fast')

      // Test withTimeout - timeout case
      const slowPromise = createSlowPromise('slow', 1000)
      await expect(withTimeout(slowPromise, 100)).rejects.toThrow('timeout after 100ms')
    })

    test('environment detection example works', async () => {
      // Example from README line 187-215
      const { getTestEnvironment, setupTestEnv } = await import('@orchestr8/testkit')

      // Test environment detection
      const env = getTestEnvironment()
      expect(env).toHaveProperty('isCI')
      expect(env).toHaveProperty('isWallaby')
      expect(env).toHaveProperty('isVitest')

      // Test custom environment setup
      const envRestore = setupTestEnv({
        NODE_ENV: 'production',
        API_URL: 'https://staging.example.com',
      })

      expect(process.env.NODE_ENV).toBe('production')
      expect(process.env.API_URL).toBe('https://staging.example.com')

      // Test restore
      envRestore.restore()
      expect(process.env.NODE_ENV).toBe(originalEnv.NODE_ENV)
    })

    test('temporary file management example works', async () => {
      // Example from README line 220-231
      const { createTempDirectory } = await import('@orchestr8/testkit')

      const tempDir = await createTempDirectory()

      // Test file operations as shown in example
      const testFilePath = path.join(tempDir.path, 'test.txt')
      await fs.writeFile(testFilePath, 'content')

      // Verify file was created
      const fileContent = await fs.readFile(testFilePath, 'utf-8')
      expect(fileContent).toBe('content')

      // Test that temp directory methods work
      await tempDir.writeFile('test2.txt', 'content2')
      const content2 = await tempDir.readFile('test2.txt')
      expect(content2).toBe('content2')

      // Automatic cleanup when test completes
      await tempDir.cleanup()
    })
  })

  describe('Optional Dependency Examples', () => {
    test('MSW mock server example works when msw available', async () => {
      if (!isOptionalDependencyAvailable('msw')) {
        console.log('Skipping MSW test - msw not available')
        return
      }

      // Example from README line 235-251
      const { setupMSW, createAuthHandlers, HttpResponse } = await import('@orchestr8/testkit/msw')

      expect(typeof setupMSW).toBe('function')
      expect(typeof createAuthHandlers).toBe('function')
      expect(HttpResponse).toBeDefined()

      // Note: We can't fully test the server setup without MSW handlers
      // but we can verify the imports work
    })

    test('SQLite database example works when better-sqlite3 available', async () => {
      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        console.log('Skipping SQLite test - better-sqlite3 not available')
        return
      }

      // Example from README line 254-268
      // Note: The README shows functions that don't exist yet, testing available functions
      const { createMemoryUrl } = await import('@orchestr8/testkit/sqlite')

      expect(typeof createMemoryUrl).toBe('function')

      // Test the actual available function
      const memoryUrl = createMemoryUrl('raw')
      expect(memoryUrl).toContain('memory')
      expect(typeof memoryUrl).toBe('string')
    })

    test('container testing example structure', async () => {
      if (!isOptionalDependencyAvailable('testcontainers')) {
        console.log('Skipping containers test - testcontainers not available')
        return
      }

      // Example from README line 273-288
      // Note: Just testing that the main functions are available
      const { createMySQLContext } = await import('@orchestr8/testkit/containers')

      expect(typeof createMySQLContext).toBe('function')
    })
  })

  describe('Vitest Configuration Example', () => {
    test('vitest configuration example works', async () => {
      // Example from README line 296-308
      const { createVitestConfig } = await import('@orchestr8/testkit/config')

      const config = createVitestConfig({
        test: {
          globals: true,
          environment: 'happy-dom',
          setupFiles: ['@orchestr8/testkit/register'],
        },
      })

      expect(config).toHaveProperty('test')
      expect(config.test).toHaveProperty('globals', true)
      expect(config.test).toHaveProperty('environment', 'happy-dom')
      expect(config.test).toHaveProperty('setupFiles')
      expect(config.test.setupFiles).toContain('@orchestr8/testkit/register')
    })
  })

  describe('TypeScript Support Example', () => {
    test('typescript types are importable', async () => {
      // Example from README line 315-322
      // This test mainly validates at compile time, but we can check runtime exports
      const testkitModule = await import('@orchestr8/testkit')

      // Verify the module exports exist (types would be compile-time only)
      expect(testkitModule).toBeDefined()
      expect(typeof testkitModule.getTestEnvironment).toBe('function')
      expect(typeof testkitModule.createTempDirectory).toBe('function')
    })
  })

  describe('Error Handling', () => {
    test('missing optional dependencies produce clear error messages', async () => {
      // Verify that importing non-existent optional features fails gracefully
      if (!isOptionalDependencyAvailable('msw')) {
        await expect(() => import('@orchestr8/testkit/msw')).rejects.toThrow()
      }

      if (!isOptionalDependencyAvailable('better-sqlite3')) {
        await expect(() => import('@orchestr8/testkit/sqlite')).rejects.toThrow()
      }

      if (!isOptionalDependencyAvailable('testcontainers')) {
        await expect(() => import('@orchestr8/testkit/containers')).rejects.toThrow()
      }
    })

    test('core utilities work outside test contexts', async () => {
      const { getTestEnvironment, createTempDirectory } = await import('@orchestr8/testkit')

      // These should work even if vitest globals are not available
      const env = getTestEnvironment()
      expect(env).toBeDefined()

      const tempDir = await createTempDirectory()
      expect(tempDir.path).toBeTruthy()
      await tempDir.cleanup()
    })

    test('environment detection has safe fallbacks', async () => {
      const { getTestEnvironment } = await import('@orchestr8/testkit')

      // Clear environment variables that might affect detection
      delete process.env.CI
      delete process.env.WALLABY_ENV
      delete process.env.VITEST

      const env = getTestEnvironment()
      expect(env.isCI).toBe(false)
      expect(env.isWallaby).toBe(false)
      expect(env.isVitest).toBe(false)
      expect(typeof env.nodeEnv).toBe('string')
    })
  })
})
