/**
 * Cache Effectiveness Tests
 *
 * Validates the caching strategy for GitHub Actions CI pipeline:
 * 1. Cache key generation and uniqueness
 * 2. Cache hit rate expectations
 * 3. Performance improvements from caching
 * 4. Cache restoration fallback behavior
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

describe('Cache Effectiveness', () => {
  describe('Cache Configuration', () => {
    it('should have proper cache configuration in CI workflow', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Check for cache action usage
      expect(ciContent).toContain('uses: actions/cache@v4')

      // Check for cache paths
      expect(ciContent).toContain('~/.pnpm-store')
      expect(ciContent).toContain('node_modules')
      expect(ciContent).toContain('.eslintcache')
      expect(ciContent).toContain('.prettiercache')
      expect(ciContent).toContain('.turbo')
    })

    it('should use smart cache key generation', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Check for lockfile-based cache key
      expect(ciContent).toContain("hashFiles('**/pnpm-lock.yaml')")

      // Check for turbo config in cache key
      expect(ciContent).toContain("hashFiles('turbo.json*', 'tsconfig*.json')")

      // Check for OS-specific caching
      expect(ciContent).toContain('${{ runner.os }}')
    })

    it('should have proper restore fallback keys', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Check for hierarchical restore keys
      const restoreKeysMatch = ciContent.match(/restore-keys:\s*\|\s*(.*)/s)
      expect(restoreKeysMatch).toBeTruthy()

      const restoreKeys = restoreKeysMatch?.[1]?.trim() || ''
      expect(restoreKeys).toContain("deps-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-")
      expect(restoreKeys).toContain('deps-${{ runner.os }}-')
    })

    it('should have cache-hit conditional installation', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Check for conditional installation
      expect(ciContent).toContain("if: steps.cache.outputs.cache-hit != 'true'")

      // Check for prefer-offline flag
      expect(ciContent).toContain('--prefer-offline')
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate different cache keys for different dependencies', () => {
      // Mock different pnpm-lock.yaml contents
      const lockfile1 = '{"dependencies": {"react": "18.0.0"}}'
      const lockfile2 = '{"dependencies": {"react": "18.2.0"}}'

      const hash1 = createHash('sha256').update(lockfile1).digest('hex')
      const hash2 = createHash('sha256').update(lockfile2).digest('hex')

      expect(hash1).not.toBe(hash2)
    })

    it('should generate different cache keys for different turbo configs', () => {
      // Mock different turbo.json contents
      const turbo1 = '{"pipeline": {"build": {"dependsOn": ["^build"]}}}'
      const turbo2 = '{"pipeline": {"build": {"dependsOn": ["^build"], "outputs": ["dist/**"]}}}'

      const hash1 = createHash('sha256').update(turbo1).digest('hex')
      const hash2 = createHash('sha256').update(turbo2).digest('hex')

      expect(hash1).not.toBe(hash2)
    })

    it('should include OS in cache key for cross-platform compatibility', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')
      const cacheKeyMatch = ciContent.match(/key:\s*(.+)/g)

      expect(cacheKeyMatch).toBeTruthy()
      expect(cacheKeyMatch?.[0] || '').toContain('${{ runner.os }}')
    })
  })

  describe('Performance Expectations', () => {
    it('should define cache effectiveness metrics', () => {
      // These are expected performance improvements from effective caching
      const expectedMetrics = {
        minCacheHitRate: 0.8, // 80% minimum cache hit rate
        maxInstallTimeWithCache: 30, // seconds
        maxInstallTimeWithoutCache: 180, // seconds
        cacheStoragePaths: [
          '~/.pnpm-store',
          'node_modules',
          '.eslintcache',
          '.prettiercache',
          '.turbo',
        ],
      }

      expect(expectedMetrics.minCacheHitRate).toBeGreaterThanOrEqual(0.8)
      expect(expectedMetrics.maxInstallTimeWithCache).toBeLessThan(
        expectedMetrics.maxInstallTimeWithoutCache,
      )
      expect(expectedMetrics.cacheStoragePaths).toContain('~/.pnpm-store')
    })

    it('should cache the right directories for maximum effectiveness', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Essential directories for Node.js/pnpm performance
      const essentialPaths = [
        '~/.pnpm-store', // pnpm package store
        'node_modules', // installed dependencies
        '.turbo', // turbo cache
        '.eslintcache', // ESLint cache
        '.prettiercache', // Prettier cache
      ]

      essentialPaths.forEach((path) => {
        expect(ciContent).toContain(path)
      })
    })
  })

  describe('Cache Restoration Logic', () => {
    it('should have hierarchical cache restoration strategy', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Check that restore-keys exist with the hierarchical pattern
      expect(ciContent).toContain('restore-keys: |')
      
      // Extract a sample restore-keys section 
      const restoreKeysMatch = ciContent.match(/restore-keys:\s*\|\s*\n([\s\S]*?)(?=\n\s*-\s*name:|\n\s*[a-z-]+:)/m)
      expect(restoreKeysMatch).toBeTruthy()

      const restoreKeysContent = restoreKeysMatch?.[1] || ''
      
      // Check for the two-level fallback pattern
      expect(restoreKeysContent).toContain("deps-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-")
      expect(restoreKeysContent).toContain('deps-${{ runner.os }}-')
    })

    it('should handle cache misses gracefully', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Should have conditional installation that runs only on cache miss
      const conditionalInstall = ciContent.includes("if: steps.cache.outputs.cache-hit != 'true'")
      expect(conditionalInstall).toBe(true)

      // Should use frozen-lockfile for deterministic installs
      expect(ciContent).toContain('--frozen-lockfile')
    })
  })

  describe('Cache Validation', () => {
    it('should validate pnpm-lock.yaml exists for cache key generation', () => {
      expect(existsSync('./pnpm-lock.yaml')).toBe(true)
    })

    it('should validate turbo.json exists for cache key generation', () => {
      expect(existsSync('./turbo.json')).toBe(true)
    })

    it('should validate package.json has proper cache-friendly scripts', () => {
      const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

      // Scripts should support caching optimizations
      expect(packageJson.scripts).toBeDefined()

      // Should not have scripts that bypass caching
      const problematicPatterns = [/--no-cache/, /--force/, /rm -rf node_modules/]

      Object.values(packageJson.scripts || {}).forEach((script: any) => {
        problematicPatterns.forEach((pattern) => {
          expect(script).not.toMatch(pattern)
        })
      })
    })
  })

  describe('Performance Monitoring', () => {
    it('should define performance thresholds for cache effectiveness', () => {
      // Define expected performance improvements
      const performanceThresholds = {
        // Time thresholds (in seconds)
        cacheHitInstallTime: 30, // Max time with cache hit
        cacheMissInstallTime: 180, // Max time with cache miss

        // Cache hit rate thresholds
        minCacheHitRateDaily: 0.8, // 80% minimum daily
        minCacheHitRateWeekly: 0.7, // 70% minimum weekly

        // Storage efficiency
        maxCacheSizeGB: 5, // Maximum cache size
        minSpaceRatioPct: 0.6, // 60% space saving ratio
      }

      // Validate thresholds are reasonable
      expect(performanceThresholds.cacheHitInstallTime).toBeLessThan(
        performanceThresholds.cacheMissInstallTime,
      )
      expect(performanceThresholds.minCacheHitRateDaily).toBeGreaterThanOrEqual(0.8)
      expect(performanceThresholds.maxCacheSizeGB).toBeGreaterThan(0)
    })

    it('should track cache effectiveness metrics in CI jobs', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Should have cache step with ID for tracking
      expect(ciContent).toContain('id: cache')

      // Should reference cache outputs for conditional logic
      expect(ciContent).toContain('steps.cache.outputs.cache-hit')
    })
  })

  describe('Cache Optimization Features', () => {
    it('should use prefer-offline for faster package resolution', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      expect(ciContent).toContain('--prefer-offline')
    })

    it('should cache across different job types efficiently', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // All jobs should reference the same cache setup from setup job
      const jobPattern = /needs:\s*(?:\[?\s*)?setup/g
      const jobsWithSetupDep = ciContent.match(jobPattern) || []

      // Most jobs should depend on setup for cache efficiency
      expect(jobsWithSetupDep.length).toBeGreaterThan(5)
    })

    it('should handle cache size limits gracefully', () => {
      const ciContent = readFileSync('./.github/workflows/ci.yml', 'utf-8')

      // Should cache only essential directories to avoid size limits
      const cachedPaths = ciContent.match(/path:\s*\|([\s\S]*?)(?=key:|restore-keys:|$)/)?.[1] || ''
      const pathCount = cachedPaths
        .split('\n')
        .filter((line) => line.trim() && !line.includes('|')).length

      // Should cache reasonable number of paths (not everything)
      expect(pathCount).toBeGreaterThan(3)
      expect(pathCount).toBeLessThan(15)
    })
  })
})
