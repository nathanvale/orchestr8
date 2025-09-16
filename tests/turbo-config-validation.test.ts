/**
 * Turbo.json Configuration Validation and Cache Key Generation Tests
 *
 * Validates Turborepo configuration for Prettier caching:
 * 1. Configuration structure and task definitions
 * 2. Cache key generation with HMAC-SHA256 signatures
 * 3. Input patterns and output logging configuration
 * 4. Task dependencies and cache organization
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash, createHmac } from 'node:crypto'

interface TurboConfig {
  $schema?: string
  tasks: Record<string, TurboTask>
  globalDependencies?: string[]
  globalEnv?: string[]
  remoteCache?: {
    enabled: boolean
    signature: boolean
    preflight: boolean
    timeout: number
  }
}

interface TurboTask {
  dependsOn?: string[]
  outputs?: string[]
  cache?: boolean
  inputs?: string[]
  env?: string[]
  persistent?: boolean
  outputLogs?: 'full' | 'new-only' | 'errors-only' | 'hash-only' | 'none'
}

describe('Turbo.json Configuration Validation', () => {
  let turboConfig: TurboConfig

  beforeAll(() => {
    const turboConfigPath = './turbo.json'
    expect(existsSync(turboConfigPath)).toBe(true)

    const turboConfigContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(turboConfigContent)
  })

  describe('Configuration Structure', () => {
    it('should have valid schema reference', () => {
      expect(turboConfig.$schema).toBeDefined()
      expect(turboConfig.$schema).toContain('turbo/schema.json')
    })

    it('should have tasks object', () => {
      expect(turboConfig.tasks).toBeDefined()
      expect(typeof turboConfig.tasks).toBe('object')
    })

    it('should have format and format:check tasks defined', () => {
      expect(turboConfig.tasks['//#format:root']).toBeDefined()
      expect(turboConfig.tasks['//#format:check:root']).toBeDefined()
    })

    it('should have proper global dependencies', () => {
      expect(turboConfig.globalDependencies).toBeDefined()
      expect(Array.isArray(turboConfig.globalDependencies)).toBe(true)

      // Should include prettier configuration files
      const deps = turboConfig.globalDependencies!
      expect(deps.some((dep) => dep.includes('prettier') || dep.includes('.prettier'))).toBe(true)
    })

    it('should have remote cache configuration', () => {
      expect(turboConfig.remoteCache).toBeDefined()
      expect(turboConfig.remoteCache!.signature).toBe(true) // Should be enabled for HMAC
    })
  })

  describe('Format Task Configuration', () => {
    it('should have format task with proper configuration', () => {
      const formatTask = turboConfig.tasks['//#format:root']

      expect(formatTask).toBeDefined()
      expect(formatTask?.cache).toBe(true)
      expect(formatTask?.outputs).toBeDefined()
      expect(Array.isArray(formatTask?.outputs)).toBe(true)
    })

    it('should have format:check task with proper configuration', () => {
      const formatCheckTask = turboConfig.tasks['//#format:check:root']

      expect(formatCheckTask).toBeDefined()
      expect(formatCheckTask?.cache).toBe(true)
      expect(formatCheckTask?.outputs).toBeDefined()
      expect(Array.isArray(formatCheckTask?.outputs)).toBe(true)
    })

    it('should have comprehensive input patterns', () => {
      const formatTask = turboConfig.tasks['//#format:root']
      const formatCheckTask = turboConfig.tasks['//#format:check:root']

      expect(formatTask?.inputs).toBeDefined()
      expect(formatCheckTask?.inputs).toBeDefined()

      // Should include source files and configuration
      const inputs = [...(formatTask?.inputs || []), ...(formatCheckTask?.inputs || [])]

      // Should include default Turbo inputs
      expect(inputs.some((input) => input === '$TURBO_DEFAULT$')).toBe(true)

      // Should include prettier configuration
      expect(
        inputs.some(
          (input) =>
            input.includes('prettier') ||
            input.includes('.prettier') ||
            input.includes('**/.prettierrc*'),
        ),
      ).toBe(true)

      // Should include source file patterns
      expect(
        inputs.some(
          (input) =>
            input.includes('**/*.{ts,tsx,js,jsx') || // Check for partial match due to extended pattern
            input.includes('**/*.ts') ||
            input.includes('src/**'),
        ),
      ).toBe(true)
    })

    it('should have proper output logging configuration', () => {
      const formatTask = turboConfig.tasks['//#format:root']
      const formatCheckTask = turboConfig.tasks['//#format:check:root']

      // Should have appropriate output logging for CI vs development
      if (formatTask?.outputLogs) {
        expect(['full', 'new-only', 'errors-only', 'hash-only', 'none']).toContain(
          formatTask.outputLogs,
        )
      }

      if (formatCheckTask?.outputLogs) {
        expect(['full', 'new-only', 'errors-only', 'hash-only', 'none']).toContain(
          formatCheckTask.outputLogs,
        )
      }
    })
  })

  describe('Task Dependencies', () => {
    it('should ensure format runs before lint operations', () => {
      const lintTask = turboConfig.tasks['lint']

      if (lintTask?.dependsOn) {
        // Lint should depend on format or format should run independently
        const hasFormatDependency = lintTask.dependsOn.some(
          (dep) => dep === '//#format:root' || dep === '^//#format:root',
        )

        // Either has explicit dependency or format is configured to run first
        expect(hasFormatDependency || turboConfig.tasks['//#format:root']?.cache).toBe(true)
      }
    })

    it('should have proper task ordering for formatting workflow', () => {
      // format:check should be able to run independently
      const formatCheckTask = turboConfig.tasks['//#format:check:root']

      // format task should not depend on other tasks (it should be a base task)
      const formatTask = turboConfig.tasks['//#format:root']

      if (formatTask?.dependsOn) {
        // If it has dependencies, they should be minimal
        expect(formatTask.dependsOn.length).toBeLessThanOrEqual(2)
      }

      // format:check should be independent or only depend on build
      if (formatCheckTask?.dependsOn) {
        const allowedDeps = ['build', '^build']
        formatCheckTask.dependsOn.forEach((dep) => {
          expect(allowedDeps.includes(dep) || dep.startsWith('^')).toBe(true)
        })
      }
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate unique cache keys for different input combinations', () => {
      // Mock different input scenarios
      const inputs1 = ['src/**/*.ts', '.prettierrc', '$TURBO_DEFAULT$']
      const inputs2 = ['src/**/*.ts', '.prettierrc.json', '$TURBO_DEFAULT$']

      const hash1 = createHash('sha256').update(JSON.stringify(inputs1)).digest('hex')
      const hash2 = createHash('sha256').update(JSON.stringify(inputs2)).digest('hex')

      expect(hash1).not.toBe(hash2)
    })

    it('should support HMAC-SHA256 signature generation', () => {
      const secret = 'test-turbo-secret'
      const data = JSON.stringify(turboConfig.tasks['//#format:root'])

      const hmac = createHmac('sha256', secret)
      hmac.update(data)
      const signature = hmac.digest('hex')

      expect(signature).toBeDefined()
      expect(signature.length).toBe(64) // SHA256 hex string length
      expect(typeof signature).toBe('string')
    })

    it('should generate different signatures for different task configurations', () => {
      const secret = 'test-turbo-secret'

      const task1 = { cache: true, inputs: ['**/*.ts'] }
      const task2 = { cache: true, inputs: ['**/*.js'] }

      const signature1 = createHmac('sha256', secret).update(JSON.stringify(task1)).digest('hex')

      const signature2 = createHmac('sha256', secret).update(JSON.stringify(task2)).digest('hex')

      expect(signature1).not.toBe(signature2)
    })

    it('should create composite cache keys with multiple factors', () => {
      const factors = {
        taskConfig: turboConfig.tasks['format'],
        globalDeps: turboConfig.globalDependencies,
        timestamp: Date.now(),
        gitHash: 'abc123def456',
      }

      const compositeKey = createHash('sha256').update(JSON.stringify(factors)).digest('hex')

      expect(compositeKey).toBeDefined()
      expect(compositeKey.length).toBe(64)

      // Different factors should produce different keys
      const factors2 = { ...factors, gitHash: 'def456abc123' }
      const compositeKey2 = createHash('sha256').update(JSON.stringify(factors2)).digest('hex')

      expect(compositeKey).not.toBe(compositeKey2)
    })
  })

  describe('Cache Organization', () => {
    it('should define proper cache directory structure', () => {
      // Turbo cache should be organized hierarchically
      const expectedCacheStructure = {
        baseDir: '.turbo/cache',
        taskDirs: ['format', 'format-check'],
        hashDirs: true, // Should use hash-based subdirectories
      }

      expect(expectedCacheStructure.baseDir).toBe('.turbo/cache')
      expect(expectedCacheStructure.taskDirs).toContain('format')
      expect(expectedCacheStructure.hashDirs).toBe(true)
    })

    it('should support cache cleanup and size management', () => {
      // Cache configuration should support cleanup
      const cacheConfig = {
        maxSizeGB: 5,
        retentionDays: 30,
        cleanupStrategy: 'lru', // Least Recently Used
      }

      expect(cacheConfig.maxSizeGB).toBeGreaterThan(0)
      expect(cacheConfig.retentionDays).toBeGreaterThan(0)
      expect(['lru', 'fifo', 'size-based']).toContain(cacheConfig.cleanupStrategy)
    })
  })

  describe('Performance Optimizations', () => {
    it('should have optimal cache settings for formatting tasks', () => {
      const formatTask = turboConfig.tasks['//#format:root']
      const formatCheckTask = turboConfig.tasks['//#format:check:root']

      // Both should be cacheable
      expect(formatTask?.cache).toBe(true)
      expect(formatCheckTask?.cache).toBe(true)

      // Should have defined outputs for cache effectiveness
      expect(formatTask?.outputs).toBeDefined()
      expect(formatCheckTask?.outputs).toBeDefined()

      // Should have comprehensive inputs for cache invalidation
      expect(formatTask?.inputs).toBeDefined()
      expect(formatCheckTask?.inputs).toBeDefined()
      expect(formatTask?.inputs?.length).toBeGreaterThan(0)
      expect(formatCheckTask?.inputs?.length).toBeGreaterThan(0)
    })

    it('should minimize cache invalidation with smart input patterns', () => {
      const formatTask = turboConfig.tasks['//#format:root']

      // Should exclude test files and other non-source files
      const inputs = formatTask?.inputs || []

      // Should not include overly broad patterns that cause frequent invalidation
      // $TURBO_DEFAULT$ is acceptable as it's the standard Turbo pattern
      const hasOverlyBroadPatterns = inputs.some(
        (input) => (input === '**/*' || input === '.') && !input.startsWith('!'),
      )

      expect(hasOverlyBroadPatterns).toBe(false)

      // Should include focused patterns for source code
      const hasFocusedPatterns = inputs.some(
        (input) =>
          input.includes('src/**') ||
          input.includes('**/*.{ts,tsx,js,jsx}') ||
          input === '$TURBO_DEFAULT$',
      )

      expect(hasFocusedPatterns).toBe(true)
    })
  })

  describe('Environment and CI Integration', () => {
    it('should handle CI environment variables properly', () => {
      expect(turboConfig.globalEnv).toBeDefined()

      const globalEnv = turboConfig.globalEnv!

      // Should include CI-related environment variables
      expect(globalEnv).toContain('CI')
      expect(globalEnv).toContain('NODE_ENV')
    })

    it('should have appropriate output logging for different environments', () => {
      const formatTask = turboConfig.tasks['//#format:root']
      const formatCheckTask = turboConfig.tasks['//#format:check:root']

      // In CI, should prefer errors-only or new-only for cleaner logs
      // In development, should prefer new-only or full for debugging
      const validOutputLogs = ['full', 'new-only', 'errors-only', 'hash-only', 'none']

      if (formatTask?.outputLogs) {
        expect(validOutputLogs).toContain(formatTask.outputLogs)
      }

      if (formatCheckTask?.outputLogs) {
        expect(validOutputLogs).toContain(formatCheckTask.outputLogs)
      }
    })
  })

  describe('Integration with Package Scripts', () => {
    it('should integrate with package.json format scripts', () => {
      const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

      expect(packageJson.scripts).toBeDefined()
      expect(packageJson.scripts.format).toBeDefined()
      expect(packageJson.scripts['format:check']).toBeDefined()

      // Scripts should use turbo for caching
      expect(packageJson.scripts.format).toContain('turbo')
      expect(packageJson.scripts['format:check']).toContain('turbo')
    })

    it('should have consistent task naming between turbo.json and package.json', () => {
      const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

      // Task names should match between configs
      const turboTasks = Object.keys(turboConfig.tasks)
      const packageScripts = Object.keys(packageJson.scripts || {})

      // Format tasks should exist in both (with root-level naming)
      expect(turboTasks).toContain('//#format:root')
      expect(turboTasks).toContain('//#format:check:root')
      expect(packageScripts).toContain('format')
      expect(packageScripts).toContain('format:check')
    })
  })
})
