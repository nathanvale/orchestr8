/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBaseVitestConfig } from '../vitest.base.js'

// Mock fs module at the top level for ESM compatibility
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}))

// Import the mocked fs module
import * as fs from 'node:fs'

describe('vitest.base - Project Configuration', () => {
  const originalEnv = process.env
  const originalCwd = process.cwd

  beforeEach(() => {
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
      expect((config.test as any)?.coverage?.thresholds?.statements).toBe(68)
    })

    it('should respect COVERAGE_THRESHOLD env var', () => {
      process.env.COVERAGE_THRESHOLD = '80'
      const config = createBaseVitestConfig()
      expect((config.test as any)?.coverage?.thresholds?.statements).toBe(80)
    })

    it('should fallback to default on invalid threshold', () => {
      process.env.COVERAGE_THRESHOLD = 'invalid'
      const config = createBaseVitestConfig()
      expect((config.test as any)?.coverage?.thresholds?.statements).toBe(68)
    })
  })
})
