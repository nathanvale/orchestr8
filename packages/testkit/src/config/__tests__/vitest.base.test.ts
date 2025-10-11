/* eslint-disable max-lines-per-function */
/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  baseVitestConfig,
  createBaseVitestConfig,
  createCIOptimizedConfig,
  createVitestBaseConfig,
  createVitestCoverage,
  createVitestEnvironmentConfig,
  createVitestPoolOptions,
  createVitestTimeouts,
  createWallabyOptimizedConfig,
  type VitestEnvironmentConfig,
} from '../vitest.base.js'

// Mock fs module at the top level for ESM compatibility
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}))

import * as fs from 'node:fs'

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
      delete process.env.CI
      delete process.env.WALLABY_ENV
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
      delete process.env.WALLABY_ENV
      process.env.VITEST = 'true'
      process.env.NODE_ENV = 'test'

      const config = createVitestEnvironmentConfig()

      expect(config.isCI).toBe(true)
      expect(config.isWallaby).toBe(false)
    })

    it('should detect Wallaby environment', () => {
      delete process.env.CI
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
      delete process.env.CI
      delete process.env.WALLABY_ENV
      delete process.env.VITEST
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
      delete process.env.WALLABY_ENV
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
          threshold: 53.5,
          reporter: ['text', 'html'],
        },
      })
    })

    it('should create CI-optimized base configuration', () => {
      process.env.CI = 'true'
      delete process.env.WALLABY_ENV
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
        threshold: 53.5,
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
        threshold: 53.5,
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
        threshold: 53.5,
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

      expect(coverage.threshold).toBe(53.5) // Default threshold
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
      // Setup files depend on where tests are run from (root vs package)
      const setupFiles = config.test?.setupFiles as string[]
      expect(setupFiles).toBeDefined()
      expect(setupFiles).toHaveLength(1)
      expect(
        setupFiles[0] === './src/register.ts' || setupFiles[0] === '@orchestr8/testkit/register',
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
      // CI environment (hanging-process reporter auto-enabled)
      process.env.CI = 'true'
      delete process.env.WALLABY_ENV
      delete process.env.TESTKIT_REPORT_HANGS // Let it default to 'on' in CI
      const ciConfig = createBaseVitestConfig()
      expect(ciConfig.test?.reporters).toEqual(['verbose', 'junit', 'hanging-process'])
      expect(ciConfig.test?.outputFile).toEqual({ junit: './test-results/junit.xml' })

      // Wallaby environment
      process.env.CI = 'false'
      process.env.WALLABY_ENV = 'true'
      const wallabyConfig = createBaseVitestConfig()
      expect(wallabyConfig.test?.reporters).toEqual(['verbose'])
      expect(wallabyConfig.test?.outputFile).toBeUndefined()

      // Local environment
      process.env.CI = 'false'
      delete process.env.WALLABY_ENV
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

  describe('environment detection and project selection', () => {
    const originalEnv = process.env
    const originalCwd = process.cwd

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv }
      delete process.env.TESTKIT_LOCAL
      delete process.env.TESTKIT_ENABLE_EDGE_RUNTIME
      delete process.env.TESTKIT_INCLUDE_EXAMPLES
    })

    afterEach(() => {
      process.env = originalEnv
      process.cwd = originalCwd
    })

    describe('setupFiles selection', () => {
      it('should use local path when TESTKIT_LOCAL=1', () => {
        process.env.TESTKIT_LOCAL = '1'
        const config = createBaseVitestConfig()
        const setupFiles = config.test?.setupFiles as string[]
        expect(setupFiles[0]).toBe('./src/register.ts')
      })

      it('should use published package when not in testkit', () => {
        // Mock cwd to not include 'packages/testkit'
        process.cwd = vi.fn().mockReturnValue('/some/other/path')
        const config = createBaseVitestConfig()
        const setupFiles = config.test?.setupFiles as string[]
        expect(setupFiles[0]).toBe('@orchestr8/testkit/register')
      })

      it('should use local path when cwd includes packages/testkit', () => {
        process.cwd = vi.fn().mockReturnValue('/path/to/packages/testkit')
        const config = createBaseVitestConfig()
        const setupFiles = config.test?.setupFiles as string[]
        expect(setupFiles[0]).toBe('./src/register.ts')
      })

      it('should respect setupFiles overrides', () => {
        const customSetup = ['./custom-setup.ts']
        const config = createBaseVitestConfig({
          test: { setupFiles: customSetup },
        })
        const setupFiles = config.test?.setupFiles as string[]
        expect(setupFiles).toEqual(customSetup)
      })

      it('should handle setupFiles as array override', () => {
        const customSetupFiles = ['./setup1.ts', './setup2.ts']

        const config = createBaseVitestConfig({
          test: { setupFiles: customSetupFiles },
        })

        expect(config.test?.setupFiles).toEqual(customSetupFiles)
      })

      it('should handle setupFiles as string override', () => {
        const customSetupFile = './custom-setup.ts'

        const config = createBaseVitestConfig({
          test: { setupFiles: customSetupFile as any },
        })

        expect(config.test?.setupFiles).toEqual([customSetupFile])
      })
    })

    describe('project configuration', () => {
      it('should include examples when TESTKIT_INCLUDE_EXAMPLES=1', () => {
        process.env.TESTKIT_INCLUDE_EXAMPLES = '1'
        process.cwd = vi.fn().mockReturnValue('/some/consumer/path')
        const config = createBaseVitestConfig()

        // Should have projects with examples included
        expect(config.test?.projects).toBeDefined()
        const projects = config.test?.projects as any[]
        const unitProject = projects.find((p) =>
          p.test?.include?.some((pattern: string) => pattern.includes('src/')),
        )
        expect(unitProject?.test?.include).toContain(
          'examples/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        )
      })

      it('should exclude examples by default', () => {
        process.cwd = vi.fn().mockReturnValue('/some/consumer/path')
        const config = createBaseVitestConfig()

        const projects = config.test?.projects as any[]
        const unitProject = projects.find((p) =>
          p.test?.include?.some((pattern: string) => pattern.includes('src/')),
        )
        expect(unitProject?.test?.include).not.toContain(
          'examples/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        )
      })

      it('should exclude Convex tests from unit project', () => {
        process.cwd = vi.fn().mockReturnValue('/some/consumer/path')

        const config = createBaseVitestConfig()

        const projects = config.test?.projects as any[]
        const unitProject = projects.find((p) =>
          p.test?.include?.some((pattern: string) => pattern.includes('src/')),
        )
        expect(unitProject?.test?.exclude).toContain('**/convex/**')
      })

      it('should handle projects override correctly', () => {
        const customProjects = [
          {
            test: {
              environment: 'happy-dom',
              include: ['src/components/**/*.test.ts'],
            },
          },
        ]

        const config = createBaseVitestConfig({
          test: { projects: customProjects },
        })

        expect(config.test?.projects).toEqual(customProjects)
      })
    })

    describe('edge runtime project', () => {
      const originalImportMeta = globalThis.import?.meta

      beforeEach(() => {
        // Reset the mock to default behavior
        vi.mocked(fs.existsSync).mockReturnValue(false)
      })

      afterEach(() => {
        vi.restoreAllMocks()
        if (originalImportMeta) {
          globalThis.import = { meta: originalImportMeta }
        }
      })

      it('should include edge runtime when TESTKIT_ENABLE_EDGE_RUNTIME=1', () => {
        process.env.TESTKIT_ENABLE_EDGE_RUNTIME = '1'
        process.cwd = vi.fn().mockReturnValue('/some/consumer/path')
        const config = createBaseVitestConfig()

        const projects = config.test?.projects as any[]
        const edgeProject = projects.find((p) => p.test?.environment === 'edge-runtime')
        expect(edgeProject).toBeDefined()
        expect(edgeProject?.test?.include).toEqual([
          '**/convex/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ])
        expect(edgeProject?.test?.server?.deps?.inline).toEqual(['convex-test'])
      })

      it('should skip edge runtime when disabled', () => {
        process.env.TESTKIT_DISABLE_EDGE_RUNTIME = '1'
        process.cwd = vi.fn().mockReturnValue('/some/consumer/path')
        const config = createBaseVitestConfig()

        const projects = config.test?.projects as any[]
        const edgeProject = projects.find((p) => p.test?.environment === 'edge-runtime')
        expect(edgeProject).toBeUndefined()
      })

      it('should handle TESTKIT_DISABLE_EDGE_RUNTIME environment variable', () => {
        process.env.TESTKIT_DISABLE_EDGE_RUNTIME = '1'
        process.cwd = vi.fn().mockReturnValue('/some/consumer/path')

        const config = createBaseVitestConfig()

        const projects = config.test?.projects as any[]
        if (projects) {
          const edgeProject = projects.find((p) => p.test?.environment === 'edge-runtime')
          expect(edgeProject).toBeUndefined()
        }
      })

      it('should not add projects when running inside testkit package', () => {
        process.env.TESTKIT_LOCAL = '1'
        const config = createBaseVitestConfig()

        // When running inside testkit, projects should not be added
        expect(config.test?.projects).toBeUndefined()
      })

      it('should handle edge runtime detection when import.meta.resolve is unavailable', () => {
        // Mock import.meta to not have resolve
        globalThis.import = { meta: {} } as any

        const config = createBaseVitestConfig()

        // Should not include edge runtime project when import.meta.resolve is unavailable
        const projects = config.test?.projects as any[]
        if (projects) {
          const edgeProject = projects.find((p) => p.test?.environment === 'edge-runtime')
          expect(edgeProject).toBeUndefined()
        }
      })

      it('should handle file system errors gracefully', () => {
        // Mock fs.existsSync to throw an error
        vi.mocked(fs.existsSync).mockImplementation(() => {
          throw new Error('File system error')
        })

        // Should not throw when checking for Convex tests
        expect(() => createBaseVitestConfig()).not.toThrow()
      })
    })

    describe('coverage threshold configuration', () => {
      it('should use default coverage threshold', () => {
        const config = createBaseVitestConfig()
        expect((config.test as any)?.coverage?.thresholds?.statements).toBe(53.5)
      })

      it('should respect COVERAGE_THRESHOLD env var', () => {
        process.env.COVERAGE_THRESHOLD = '80'
        const config = createBaseVitestConfig()
        expect((config.test as any)?.coverage?.thresholds?.statements).toBe(80)
      })

      it('should fallback to default on invalid threshold', () => {
        process.env.COVERAGE_THRESHOLD = 'invalid'
        const config = createBaseVitestConfig()
        expect((config.test as any)?.coverage?.thresholds?.statements).toBe(53.5)
      })
    })
  })
})
