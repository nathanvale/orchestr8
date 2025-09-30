/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createVitestEnvironmentConfig,
  createVitestPoolOptions,
  createVitestTimeouts,
  createVitestCoverage,
  createVitestBaseConfig,
  type VitestEnvironmentConfig,
} from '../vitest.base.js'

describe('vitest.base - Core Functions', () => {
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

    it('should handle WALLABY_ENV with different values', () => {
      // Test various WALLABY_ENV values
      const testCases = [
        { value: 'true', expected: true },
        { value: 'false', expected: false },
        { value: '1', expected: false },
        { value: '', expected: false },
        { value: undefined, expected: false },
      ]

      testCases.forEach(({ value, expected }) => {
        process.env.WALLABY_ENV = value as any
        const envConfig = createVitestEnvironmentConfig()
        expect(envConfig.isWallaby).toBe(expected)
      })
    })

    it('should handle CI environment variations', () => {
      const testCases = [
        { value: 'true', expected: true },
        { value: '1', expected: true },
        { value: 'yes', expected: true },
        { value: 'false', expected: false },
        { value: '0', expected: false },
        { value: '', expected: false },
        { value: undefined, expected: false },
      ]

      testCases.forEach(({ value, expected }) => {
        process.env.CI = value as any
        const envConfig = createVitestEnvironmentConfig()
        expect(envConfig.isCI).toBe(expected)
      })
    })

    it('should handle environment variables edge cases', () => {
      // Test with mixed case and undefined values
      process.env.CI = undefined
      process.env.WALLABY_ENV = undefined as unknown as string
      process.env.VITEST = undefined as unknown as string
      process.env.JEST_WORKER_ID = '1'
      process.env.NODE_ENV = 'development'

      const envConfig = createVitestEnvironmentConfig()

      expect(envConfig).toEqual({
        isCI: false,
        isWallaby: false,
        isVitest: false,
        isJest: true,
        nodeEnv: 'development',
      })
    })

    it('should handle missing NODE_ENV gracefully', () => {
      const originalNodeEnv = process.env.NODE_ENV
      delete process.env.NODE_ENV

      const envConfig = createVitestEnvironmentConfig()

      expect(envConfig.nodeEnv).toBe('test') // Should default to 'test'

      // Restore
      process.env.NODE_ENV = originalNodeEnv
    })

    it('should handle missing environment variables', () => {
      const originalEnv = process.env
      process.env = {} as any

      const envConfig = createVitestEnvironmentConfig()

      expect(envConfig.isCI).toBe(false)
      expect(envConfig.isWallaby).toBe(false)
      expect(envConfig.isVitest).toBe(false)
      expect(envConfig.isJest).toBe(false)
      expect(envConfig.nodeEnv).toBe('test')

      process.env = originalEnv
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

    it('should configure pool options correctly for different environments', () => {
      // Test different environment scenarios
      const scenarios = [
        {
          env: { isCI: true, isWallaby: false, isVitest: true, isJest: false, nodeEnv: 'test' },
          expected: { maxWorkers: 2, bail: 1 },
        },
        {
          env: { isCI: false, isWallaby: true, isVitest: true, isJest: false, nodeEnv: 'test' },
          expected: { maxWorkers: 1, bail: false },
        },
        {
          env: { isCI: false, isWallaby: false, isVitest: true, isJest: false, nodeEnv: 'test' },
          expected: { maxWorkers: 4, bail: false },
        },
      ]

      scenarios.forEach(({ env, expected }) => {
        const poolOptions = createVitestPoolOptions(env)
        expect(poolOptions.maxWorkers).toBe(expected.maxWorkers)
        expect(poolOptions.bail).toBe(expected.bail)
        expect(poolOptions.pool).toBe('forks')
        expect(poolOptions.isolate).toBe(true)
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

    it('should handle timeouts correctly in different environments', () => {
      // Test CI timeouts
      process.env.CI = 'true'
      const ciTimeouts = createVitestTimeouts(createVitestEnvironmentConfig())
      expect(ciTimeouts.test).toBeGreaterThan(5000) // Should be doubled

      // Test local timeouts
      process.env.CI = 'false'
      const localTimeouts = createVitestTimeouts(createVitestEnvironmentConfig())
      expect(localTimeouts.test).toBe(5000) // Base timeout
      expect(localTimeouts.teardown).toBe(20_000) // Always 20s
    })
  })

  describe('createVitestBaseConfig', () => {
    it('should create complete base configuration object', () => {
      process.env.CI = 'false'
      process.env.WALLABY_ENV = undefined as unknown as string
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestBaseConfig()

      expect(config).toMatchObject({
        environment: {
          isCI: false,
          isWallaby: false,
          isVitest: true,
          isJest: false,
          nodeEnv: 'test',
        },
        poolOptions: {
          pool: 'forks',
          isolate: true,
          bail: false,
          maxWorkers: 4,
          minWorkers: 1,
        },
        timeouts: {
          test: expect.any(Number),
          hook: expect.any(Number),
          teardown: 20_000,
        },
        coverage: {
          enabled: false,
          threshold: 68,
          reporter: ['text', 'html'],
        },
      })
    })

    it('should create CI-optimized base configuration', () => {
      process.env.CI = 'true'
      process.env.WALLABY_ENV = undefined as unknown as string
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestBaseConfig()

      expect(config.environment.isCI).toBe(true)
      expect(config.poolOptions.bail).toBe(1)
      expect(config.poolOptions.maxWorkers).toBe(2)
      expect(config.coverage.enabled).toBe(true)
      expect(config.coverage.reporter).toEqual(['json', 'clover'])
    })

    it('should create Wallaby-optimized base configuration', () => {
      process.env.CI = 'false'
      process.env.WALLABY_ENV = 'true'
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestBaseConfig()

      expect(config.environment.isWallaby).toBe(true)
      expect(config.poolOptions.maxWorkers).toBe(1)
      expect(config.poolOptions.minWorkers).toBe(1)
      expect(config.coverage.enabled).toBe(false)
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
        threshold: 68,
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
        threshold: 68,
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
        threshold: 68,
        reporter: ['text', 'html'],
      })
    })

    it('should respect custom coverage threshold from environment', () => {
      process.env.COVERAGE_THRESHOLD = '80'
      const envConfig: VitestEnvironmentConfig = {
        isCI: true,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const coverage = createVitestCoverage(envConfig)

      expect(coverage.threshold).toBe(80)
    })

    it('should fallback to default threshold on invalid value', () => {
      process.env.COVERAGE_THRESHOLD = 'invalid'
      const envConfig: VitestEnvironmentConfig = {
        isCI: true,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const coverage = createVitestCoverage(envConfig)

      expect(coverage.threshold).toBe(68) // Default threshold
    })

    it('should handle zero and negative thresholds', () => {
      process.env.COVERAGE_THRESHOLD = '0'
      const envConfig: VitestEnvironmentConfig = {
        isCI: true,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }
      let coverage = createVitestCoverage(envConfig)
      expect(coverage.threshold).toBe(0)

      process.env.COVERAGE_THRESHOLD = '-10'
      coverage = createVitestCoverage(envConfig)
      expect(coverage.threshold).toBe(-10)
    })

    it('should handle very high thresholds', () => {
      process.env.COVERAGE_THRESHOLD = '100'
      const envConfig: VitestEnvironmentConfig = {
        isCI: true,
        isWallaby: false,
        isVitest: true,
        isJest: false,
        nodeEnv: 'test',
      }

      const coverage = createVitestCoverage(envConfig)
      expect(coverage.threshold).toBe(100)
    })
  })
})
