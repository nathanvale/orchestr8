/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createBaseVitestConfig,
  createCIOptimizedConfig,
  createVitestCoverage,
  createVitestEnvironmentConfig,
  createVitestPoolOptions,
  createVitestTimeouts,
  createWallabyOptimizedConfig,
  defineVitestConfig,
  type VitestEnvironmentConfig,
} from '../vitest.base.js'

describe('vitest.base', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createVitestEnvironmentConfig', () => {
    it('should detect local development environment', () => {
      process.env.CI = undefined
      process.env.WALLABY_ENV = undefined as unknown as string
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestEnvironmentConfig()

      expect(config).toEqual({
        isCI: false,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      })
    })

    it('should detect CI environment', () => {
      process.env.CI = 'true'
      process.env.WALLABY_ENV = undefined as unknown as string
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestEnvironmentConfig()

      expect(config.isCI).toBe(true)
      expect(config.isWallaby).toBe(false)
    })

    it('should detect Wallaby environment', () => {
      process.env.CI = undefined
      process.env.WALLABY_ENV = 'true'
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestEnvironmentConfig()

      expect(config.isCI).toBe(false)
      expect(config.isWallaby).toBe(true)
    })
  })

  describe('createVitestPoolOptions', () => {
    it('should create default pool options for local development', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: false,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const poolOptions = createVitestPoolOptions(envConfig)

      expect(poolOptions).toEqual({
        pool: 'forks',
        isolate: true,
        bail: false,
        maxWorkers: 4,
        minWorkers: 1,
      })
    })

    it('should create optimized pool options for CI', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: true,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const poolOptions = createVitestPoolOptions(envConfig)

      expect(poolOptions).toEqual({
        pool: 'forks',
        isolate: true,
        bail: 1,
        maxWorkers: 2,
        minWorkers: 1,
      })
    })

    it('should create single-worker options for Wallaby', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: false,
        isWallaby: true,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const poolOptions = createVitestPoolOptions(envConfig)

      expect(poolOptions).toEqual({
        pool: 'forks',
        isolate: true,
        bail: false,
        maxWorkers: 1,
        minWorkers: 1,
      })
    })
  })

  describe('createVitestTimeouts', () => {
    it('should create timeout configuration', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: false,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const timeouts = createVitestTimeouts(envConfig)

      expect(timeouts).toEqual({
        test: expect.any(Number),
        hook: expect.any(Number),
        teardown: 20_000,
      })
      expect(timeouts.test).toBeGreaterThan(0)
      expect(timeouts.hook).toBeGreaterThan(0)
    })
  })

  describe('createVitestCoverage', () => {
    it('should disable coverage for local development (CI-only policy)', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: false,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const coverage = createVitestCoverage(envConfig)

      expect(coverage).toEqual({
        enabled: false,
        threshold: 69,
        reporter: ['text', 'html'],
      })
    })

    it('should use CI reporters for CI environment', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: true,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const coverage = createVitestCoverage(envConfig)

      expect(coverage).toEqual({
        enabled: true,
        threshold: 69,
        reporter: ['json', 'clover'],
      })
    })

    it('should disable coverage for Wallaby', () => {
      const envConfig: VitestEnvironmentConfig = {
        isCI: false,
        isWallaby: true,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const coverage = createVitestCoverage(envConfig)

      expect(coverage).toEqual({
        enabled: false,
        threshold: 69,
        reporter: ['text', 'html'],
      })
    })
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
        setupFiles[0] === './src/register.ts' || setupFiles[0] === '@template/testkit/register',
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
      // Setup files depend on where tests are run from (root vs package)
      const setupFiles = config.test?.setupFiles as string[]
      expect(setupFiles).toBeDefined()
      expect(setupFiles).toHaveLength(1)
      expect(
        setupFiles[0] === './src/register.ts' || setupFiles[0] === '@template/testkit/register',
      ).toBe(true)
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
        junit: './junit.xml',
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
  })
})
