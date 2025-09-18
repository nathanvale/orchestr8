/**
 * @fileoverview Tests for environment detection utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  detectEnvironment,
  isCIEnvironment,
  getCIEnvironment,
  isTestEnvironment,
  isInteractiveEnvironment,
  getDefaultFixMode,
  getEnvironmentContext,
} from './environment.js'

describe('Environment Detection', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
    // Clear relevant environment variables
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.TRAVIS
    delete process.env.CIRCLECI
    delete process.env.TF_BUILD
    delete process.env.JENKINS_URL
    delete process.env.NODE_ENV
    delete process.env.VITEST
    delete process.env.JEST_WORKER_ID
    delete process.env.WALLABY_WORKER
    delete process.env.npm_lifecycle_event
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('detectEnvironment', () => {
    it('should detect test environment when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test'
      expect(detectEnvironment()).toBe('test')
    })

    it('should detect test environment when VITEST is set', () => {
      process.env.VITEST = 'true'
      expect(detectEnvironment()).toBe('test')
    })

    it('should detect test environment when JEST_WORKER_ID is set', () => {
      process.env.JEST_WORKER_ID = '1'
      expect(detectEnvironment()).toBe('test')
    })

    it('should detect test environment when WALLABY_WORKER is set', () => {
      process.env.WALLABY_WORKER = 'true'
      expect(detectEnvironment()).toBe('test')
    })

    it('should detect CI environment when CI is set', () => {
      process.env.CI = 'true'
      expect(detectEnvironment()).toBe('ci')
    })

    it('should detect CI environment when GITHUB_ACTIONS is set', () => {
      process.env.GITHUB_ACTIONS = 'true'
      expect(detectEnvironment()).toBe('ci')
    })

    it('should detect interactive environment when no CI or test env is set', () => {
      expect(detectEnvironment()).toBe('interactive')
    })

    it('should prioritize test environment over CI environment', () => {
      process.env.CI = 'true'
      process.env.NODE_ENV = 'test'
      expect(detectEnvironment()).toBe('test')
    })
  })

  describe('isCIEnvironment', () => {
    it('should return true when CI is set', () => {
      process.env.CI = 'true'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return true when GITHUB_ACTIONS is set', () => {
      process.env.GITHUB_ACTIONS = 'true'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return true when GITLAB_CI is set', () => {
      process.env.GITLAB_CI = 'true'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return true when TRAVIS is set', () => {
      process.env.TRAVIS = 'true'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return true when CIRCLECI is set', () => {
      process.env.CIRCLECI = 'true'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return true when TF_BUILD is set (Azure DevOps)', () => {
      process.env.TF_BUILD = 'true'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return true when JENKINS_URL is set', () => {
      process.env.JENKINS_URL = 'http://jenkins.example.com'
      expect(isCIEnvironment()).toBe(true)
    })

    it('should return false when no CI environment variables are set', () => {
      expect(isCIEnvironment()).toBe(false)
    })
  })

  describe('getCIEnvironment', () => {
    it('should return GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'true'
      const env = getCIEnvironment()
      expect(env).toEqual({
        name: 'GitHub Actions',
        isCI: true,
        variables: ['GITHUB_ACTIONS', 'CI'],
      })
    })

    it('should return GitLab CI environment', () => {
      process.env.GITLAB_CI = 'true'
      const env = getCIEnvironment()
      expect(env).toEqual({
        name: 'GitLab CI',
        isCI: true,
        variables: ['GITLAB_CI', 'CI'],
      })
    })

    it('should return null when no CI environment is detected', () => {
      expect(getCIEnvironment()).toBeNull()
    })

    it('should return first matching environment when multiple are set', () => {
      process.env.GITHUB_ACTIONS = 'true'
      process.env.GITLAB_CI = 'true'
      const env = getCIEnvironment()
      expect(env?.name).toBe('GitHub Actions')
    })
  })

  describe('isTestEnvironment', () => {
    it('should return true when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test'
      expect(isTestEnvironment()).toBe(true)
    })

    it('should return true when VITEST is set', () => {
      process.env.VITEST = 'true'
      expect(isTestEnvironment()).toBe(true)
    })

    it('should return true when JEST_WORKER_ID is set', () => {
      process.env.JEST_WORKER_ID = '1'
      expect(isTestEnvironment()).toBe(true)
    })

    it('should return true when WALLABY_WORKER is set', () => {
      process.env.WALLABY_WORKER = 'true'
      expect(isTestEnvironment()).toBe(true)
    })

    it('should return true when npm_lifecycle_event contains test', () => {
      process.env.npm_lifecycle_event = 'test:unit'
      expect(isTestEnvironment()).toBe(true)
    })

    it('should return false when no test environment variables are set', () => {
      expect(isTestEnvironment()).toBe(false)
    })
  })

  describe('isInteractiveEnvironment', () => {
    it('should return true when environment is interactive', () => {
      expect(isInteractiveEnvironment()).toBe(true)
    })

    it('should return false when environment is CI', () => {
      process.env.CI = 'true'
      expect(isInteractiveEnvironment()).toBe(false)
    })

    it('should return false when environment is test', () => {
      process.env.NODE_ENV = 'test'
      expect(isInteractiveEnvironment()).toBe(false)
    })
  })

  describe('getDefaultFixMode', () => {
    it('should return safe mode for CI environment', () => {
      process.env.CI = 'true'
      expect(getDefaultFixMode()).toBe('safe')
    })

    it('should return safe mode for test environment', () => {
      process.env.NODE_ENV = 'test'
      expect(getDefaultFixMode()).toBe('safe')
    })

    it('should return full mode for interactive environment', () => {
      expect(getDefaultFixMode()).toBe('full')
    })

    it('should prioritize test over CI for fix mode', () => {
      process.env.CI = 'true'
      process.env.NODE_ENV = 'test'
      expect(getDefaultFixMode()).toBe('safe')
    })
  })

  describe('getEnvironmentContext', () => {
    it('should return complete context for interactive environment', () => {
      const context = getEnvironmentContext()

      expect(context.type).toBe('interactive')
      expect(context.isCI).toBe(false)
      expect(context.isTest).toBe(false)
      expect(context.isInteractive).toBe(true)
      expect(context.ciEnvironment).toBeNull()
      expect(context.defaultFixMode).toBe('full')
      expect(context.variables).toEqual(
        expect.objectContaining({
          NODE_ENV: undefined,
          CI: undefined,
          GITHUB_ACTIONS: undefined,
        }),
      )
    })

    it('should return complete context for CI environment', () => {
      process.env.CI = 'true'
      process.env.GITHUB_ACTIONS = 'true'

      const context = getEnvironmentContext()

      expect(context.type).toBe('ci')
      expect(context.isCI).toBe(true)
      expect(context.isTest).toBe(false)
      expect(context.isInteractive).toBe(false)
      expect(context.ciEnvironment?.name).toBe('GitHub Actions')
      expect(context.defaultFixMode).toBe('safe')
      expect(context.variables.CI).toBe('true')
      expect(context.variables.GITHUB_ACTIONS).toBe('true')
    })

    it('should return complete context for test environment', () => {
      process.env.NODE_ENV = 'test'
      process.env.VITEST = 'true'

      const context = getEnvironmentContext()

      expect(context.type).toBe('test')
      expect(context.isCI).toBe(false)
      expect(context.isTest).toBe(true)
      expect(context.isInteractive).toBe(false)
      expect(context.ciEnvironment).toBeNull()
      expect(context.defaultFixMode).toBe('safe')
      expect(context.variables.NODE_ENV).toBe('test')
      expect(context.variables.VITEST).toBe('true')
    })

    it('should capture all relevant environment variables', () => {
      process.env.NODE_ENV = 'production'
      process.env.CI = 'true'
      process.env.GITHUB_ACTIONS = 'true'
      process.env.GITLAB_CI = undefined
      process.env.npm_lifecycle_event = 'build'

      const context = getEnvironmentContext()

      expect(context.variables).toEqual(
        expect.objectContaining({
          NODE_ENV: 'production',
          CI: 'true',
          GITHUB_ACTIONS: 'true',
          GITLAB_CI: undefined,
          npm_lifecycle_event: 'build',
        }),
      )
    })
  })
})
