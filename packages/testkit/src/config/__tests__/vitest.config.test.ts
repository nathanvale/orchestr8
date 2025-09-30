/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  baseVitestConfig,
  createBaseVitestConfig,
  createCIOptimizedConfig,
  createWallabyOptimizedConfig,
  defineVitestConfig,
} from '../vitest.base.js'

describe('vitest.base - Configuration Functions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createBaseVitestConfig', () => {
    it('should create base configuration with defaults', () => {
      const config = createBaseVitestConfig()

      expect(config).toHaveProperty('test')
      expect(config.test).toHaveProperty('environment', 'node')
      expect(config.test).toHaveProperty('globals', false)
      expect(config.test).toHaveProperty('pool', 'forks')
      expect(config.test).toHaveProperty('isolate', true)
      // Setup files depend on where tests are run from (root vs package)
      const setupFiles = config.test?.setupFiles as string[]
      expect(setupFiles).toBeDefined()
      expect(setupFiles).toHaveLength(1)
      expect(
        setupFiles[0] === './src/register.ts' || setupFiles[0] === '@orchestr8/testkit/register',
      ).toBe(true)
      expect(config.test).toHaveProperty('include')
      expect(config.test).toHaveProperty('exclude')
    })

    it('should merge overrides correctly', () => {
      const overrides = {
        test: {
          environment: 'happy-dom' as const,
          globals: true,
          pool: 'threads' as const,
        },
      }

      const config = createBaseVitestConfig(overrides)

      expect(config.test?.environment).toBe('happy-dom')
      expect(config.test?.globals).toBe(true)
      expect(config.test?.pool).toBe('threads')
      // Should preserve other base config properties
      expect(config.test?.isolate).toBe(true)
    })

    it('should merge nested configurations correctly', () => {
      const overrides = {
        test: {
          env: {
            CUSTOM_VAR: 'test-value',
          },
          poolOptions: {
            threads: {
              maxThreads: 8,
            },
          },
        },
      }

      const config = createBaseVitestConfig(overrides)

      expect(config.test?.env).toEqual({
        NODE_ENV: 'test',
        VITEST: 'true',
        CUSTOM_VAR: 'test-value',
      })
      expect(config.test?.poolOptions?.threads?.maxThreads).toBe(8)
      // Should preserve other poolOptions
      expect(config.test?.poolOptions?.forks).toBeDefined()
    })

    it('should handle bail configuration correctly', () => {
      process.env.CI = 'true'
      const config = createBaseVitestConfig()

      // In CI, bail should be 1 (converted from boolean true)
      expect(config.test?.bail).toBe(1)
    })

    it('should apply all coverage thresholds equally', () => {
      process.env.COVERAGE_THRESHOLD = '85'
      const config = createBaseVitestConfig()
      const thresholds = (config.test as any)?.coverage?.thresholds

      expect(thresholds.statements).toBe(85)
      expect(thresholds.branches).toBe(85)
      expect(thresholds.functions).toBe(85)
      expect(thresholds.lines).toBe(85)
    })

    it('should include correct coverage exclusion patterns', () => {
      const config = createBaseVitestConfig()
      const exclude = (config.test as any)?.coverage?.exclude

      expect(exclude).toContain('node_modules/')
      expect(exclude).toContain('dist/')
      expect(exclude).toContain('coverage/')
      expect(exclude).toContain('**/*.d.ts')
      expect(exclude).toContain('**/*.config.*')
      expect(exclude).toContain('**/index.ts')
    })

    it('should configure coverage provider and reports directory', () => {
      const config = createBaseVitestConfig()
      const coverage = (config.test as any)?.coverage

      expect(coverage.provider).toBe('v8')
      expect(coverage.reportsDirectory).toBe('./test-results/coverage')
    })

    it('should configure reporters correctly for each environment', () => {
      // CI environment
      process.env.CI = 'true'
      process.env.WALLABY_ENV = undefined as unknown as string
      const ciConfig = createBaseVitestConfig()
      expect(ciConfig.test?.reporters).toEqual(['verbose', 'junit'])
      expect(ciConfig.test?.outputFile).toEqual({ junit: './test-results/junit.xml' })

      // Wallaby environment
      process.env.CI = 'false'
      process.env.WALLABY_ENV = 'true'
      const wallabyConfig = createBaseVitestConfig()
      expect(wallabyConfig.test?.reporters).toEqual(['verbose'])
      expect(wallabyConfig.test?.outputFile).toBeUndefined()

      // Local environment
      process.env.CI = 'false'
      process.env.WALLABY_ENV = undefined as unknown as string
      const localConfig = createBaseVitestConfig()
      expect(localConfig.test?.reporters).toEqual(['default'])
      expect(localConfig.test?.outputFile).toBeUndefined()
    })

    it('should merge deeply nested configurations', () => {
      const overrides = {
        test: {
          poolOptions: {
            forks: {
              singleFork: true,
              isolate: false,
            },
            threads: {
              singleThread: false,
              isolate: true,
            },
          },
          coverage: {
            provider: 'c8' as const,
            reportsDirectory: './custom-coverage',
            thresholds: {
              statements: 90,
              functions: 85,
            },
          },
        },
      }

      const config = createBaseVitestConfig(overrides)

      expect(config.test?.poolOptions?.forks?.singleFork).toBe(true)
      expect(config.test?.poolOptions?.forks?.isolate).toBe(false)
      expect(config.test?.poolOptions?.threads?.singleThread).toBe(false)
      expect(config.test?.coverage?.provider).toBe('c8')
      expect(config.test?.coverage?.reportsDirectory).toBe('./custom-coverage')
      expect((config.test?.coverage as any)?.thresholds?.statements).toBe(90)
      expect((config.test?.coverage as any)?.thresholds?.functions).toBe(85)
    })

    it('should preserve base configuration when merging', () => {
      const overrides = {
        test: {
          environment: 'happy-dom' as const,
        },
        customProperty: 'test-value',
      }

      const config = createBaseVitestConfig(overrides)

      // Override should be applied
      expect(config.test?.environment).toBe('happy-dom')
      expect((config as any).customProperty).toBe('test-value')

      // Base configuration should be preserved
      expect(config.test?.pool).toBe('forks')
      expect(config.test?.isolate).toBe(true)
      expect(config.test?.include).toBeDefined()
      expect(config.test?.exclude).toBeDefined()
    })
  })

  describe('defineVitestConfig', () => {
    it('should return a defineConfig result', () => {
      const config = defineVitestConfig()

      expect(config).toHaveProperty('test')
      expect(typeof config).toBe('object')
    })

    it('should accept overrides', () => {
      const config = defineVitestConfig({
        test: {
          environment: 'happy-dom',
        },
      })

      expect(config.test?.environment).toBe('happy-dom')
    })

    it('should handle defineVitestConfig with complex overrides', () => {
      const config = defineVitestConfig({
        test: {
          environment: 'jsdom',
          setupFiles: ['./custom-setup.ts'],
        },
        plugins: [],
      })

      expect(config).toBeDefined()
      expect(config.test?.environment).toBe('jsdom')
      expect(config.test?.setupFiles).toEqual(['./custom-setup.ts'])
      expect(config.plugins).toEqual([])
    })
  })

  describe('createWallabyOptimizedConfig', () => {
    it('should create Wallaby-optimized configuration', () => {
      const config = createWallabyOptimizedConfig()

      expect(config.test?.pool).toBe('forks')
      expect(config.test?.poolOptions?.forks?.singleFork).toBe(true)
      expect(config.test?.poolOptions?.forks?.maxForks).toBe(1)
      expect(config.test?.isolate).toBe(true)
      expect(config.test?.coverage).toBeDefined()
      // Coverage is disabled in Wallaby but the object shape is retained
      // to satisfy tooling that reads coverage.reporter, etc.
      expect((config.test as any).coverage.enabled).toBe(false)
      expect(config.test?.reporters).toEqual(['verbose'])
    })

    it('should merge with overrides', () => {
      const config = createWallabyOptimizedConfig({
        test: {
          environment: 'happy-dom',
        },
      })

      expect(config.test?.environment).toBe('happy-dom')
      expect(config.test?.pool).toBe('forks') // Should preserve Wallaby optimizations
    })
  })

  describe('createCIOptimizedConfig', () => {
    it('should create CI-optimized configuration', () => {
      const config = createCIOptimizedConfig()

      expect(config.test?.pool).toBe('forks')
      expect(config.test?.poolOptions?.forks?.maxForks).toBe(2)
      expect(config.test?.bail).toBe(1)
      expect(config.test?.reporters).toEqual(['verbose', 'junit'])
      expect(config.test?.outputFile).toEqual({
        junit: './test-results/junit.xml',
      })
    })

    it('should merge with overrides', () => {
      const config = createCIOptimizedConfig({
        test: {
          environment: 'happy-dom',
          bail: 3,
        },
      })

      expect(config.test?.environment).toBe('happy-dom')
      expect(config.test?.bail).toBe(3) // Override should take precedence
      expect(config.test?.pool).toBe('forks') // Should preserve CI optimizations
    })
  })

  describe('baseVitestConfig export', () => {
    it('should provide default base configuration', () => {
      expect(baseVitestConfig).toHaveProperty('test')
      expect(baseVitestConfig.test).toHaveProperty('environment', 'node')
      expect(baseVitestConfig.test).toHaveProperty('pool', 'forks')
    })

    it('should export baseVitestConfig with correct structure', () => {
      expect(baseVitestConfig).toBeDefined()
      expect(baseVitestConfig).toHaveProperty('test')
      expect(baseVitestConfig.test).toHaveProperty('environment')
      expect(baseVitestConfig.test).toHaveProperty('pool')
      expect(baseVitestConfig.test).toHaveProperty('isolate')
    })
  })

  describe('configuration merging edge cases', () => {
    it('should handle undefined overrides gracefully', () => {
      const config = createBaseVitestConfig(undefined)

      expect(config).toHaveProperty('test')
      expect(config.test).toBeDefined()
    })

    it('should handle empty overrides', () => {
      const config = createBaseVitestConfig({})

      expect(config).toHaveProperty('test')
      expect(config.test).toBeDefined()
    })

    it('should handle partial test overrides', () => {
      const config = createBaseVitestConfig({
        test: {
          environment: 'happy-dom',
        },
      })

      expect(config.test?.environment).toBe('happy-dom')
      expect(config.test?.pool).toBe('forks') // Should preserve base config
    })

    it('should handle non-test overrides', () => {
      const config = createBaseVitestConfig({
        define: {
          __TEST__: true,
        },
      })

      expect(config).toHaveProperty('define')
      expect(config.define).toEqual({ __TEST__: true })
      expect(config.test).toBeDefined() // Should preserve test config
    })

    it('should handle null and undefined values in overrides', () => {
      const config = createBaseVitestConfig({
        test: {
          environment: null as any,
          globals: undefined,
          pool: 'threads',
        },
      })

      expect(config.test?.environment).toBeNull()
      expect(config.test?.globals).toBeUndefined()
      expect(config.test?.pool).toBe('threads')
    })

    it('should handle complex array merging scenarios', () => {
      const config = createBaseVitestConfig({
        test: {
          include: ['custom/**/*.test.ts'],
          exclude: ['custom-exclude/**'],
        },
      })

      // Arrays should be replaced, not merged
      expect(config.test?.include).toEqual(['custom/**/*.test.ts'])
      expect(config.test?.exclude).toEqual(['custom-exclude/**'])
    })

    it('should handle invalid configuration overrides gracefully', () => {
      const config = createBaseVitestConfig({
        test: {
          // @ts-expect-error Testing invalid config
          invalidProperty: 'should-be-ignored',
          testTimeout: 'invalid' as any,
        },
      })

      expect(config.test).toBeDefined()
      expect((config.test as any).invalidProperty).toBe('should-be-ignored')
      expect((config.test as any).testTimeout).toBe('invalid')
    })
  })

  describe('edge cases and error scenarios', () => {
    it('should handle process.cwd() errors gracefully', () => {
      const originalCwd = process.cwd
      process.cwd = vi.fn().mockImplementation(() => {
        throw new Error('cwd error')
      })

      // Should not throw, should gracefully fallback
      expect(() => createBaseVitestConfig()).not.toThrow()

      process.cwd = originalCwd
    })
  })
})
