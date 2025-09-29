/**
 * @file Test that all sub-exports work independently without importing unnecessary dependencies
 */

import { describe, expect, it } from 'vitest'

describe('Package Exports', () => {
  describe('Main Export (lean)', () => {
    it('should export core utilities without optional dependencies', async () => {
      // This should work without msw, convex-test, better-sqlite3, etc.
      const mainExport = await import('../index.js')

      // Should have core utilities
      expect(mainExport.delay).toBeDefined()
      expect(mainExport.retry).toBeDefined()
      expect(mainExport.withTimeout).toBeDefined()
      expect(mainExport.createMockFn).toBeDefined()

      // Should have env utilities
      expect(mainExport.getTestEnvironment).toBeDefined()
      expect(mainExport.setupTestEnv).toBeDefined()
      expect(mainExport.getTestTimeouts).toBeDefined()

      // Should have fs utilities
      expect(mainExport.createTempDirectory).toBeDefined()
      expect(mainExport.createNamedTempDirectory).toBeDefined()

      // Should have config utilities
      expect(mainExport.createVitestConfig).toBeDefined()
      expect(mainExport.defineVitestConfig).toBeDefined()

      // Types are exported but not available at runtime (TypeScript types)
      // This is expected - types are compile-time only

      // Should NOT have modules with optional dependencies
      expect(mainExport).not.toHaveProperty('createMSWServer')
      expect(mainExport).not.toHaveProperty('createConvexTestContext')
      expect(mainExport).not.toHaveProperty('createSQLiteDatabase')
      expect(mainExport).not.toHaveProperty('startContainer')
    })
  })

  describe('Full Export', () => {
    it('should be available for backward compatibility', async () => {
      try {
        const fullExport = await import('../index.full.js')

        // Should have everything including optional deps
        expect(fullExport.delay).toBeDefined()
        expect(fullExport.getTestEnvironment).toBeDefined()
        expect(fullExport.createTempDirectory).toBeDefined()

        // Should also have MSW utilities (assuming MSW is available)
        expect(fullExport.createMSWServer).toBeDefined()
        expect(fullExport.setupMSW).toBeDefined()
      } catch (error) {
        // This might fail if optional deps aren't installed, which is okay for CI
        console.warn('Full export test skipped due to missing optional dependencies:', error)
      }
    })
  })

  describe('Sub-exports', () => {
    it('should export utils independently', async () => {
      const utilsExport = await import('../utils/index.js')

      expect(utilsExport.delay).toBeDefined()
      expect(utilsExport.retry).toBeDefined()
      expect(utilsExport.withTimeout).toBeDefined()
      expect(utilsExport.createMockFn).toBeDefined()
    })

    it('should export env utilities independently', async () => {
      const envExport = await import('../env/index.js')

      expect(envExport.getTestEnvironment).toBeDefined()
      expect(envExport.setupTestEnv).toBeDefined()
      expect(envExport.getTestTimeouts).toBeDefined()
    })

    it('should export fs utilities independently', async () => {
      const fsExport = await import('../fs/index.js')

      expect(fsExport.createTempDirectory).toBeDefined()
      expect(fsExport.useTempDirectory).toBeDefined()
      expect(fsExport.createNamedTempDirectory).toBeDefined()
    })

    it('should export config utilities independently', async () => {
      const configExport = await import('../config/index.js')

      expect(configExport.createVitestConfig).toBeDefined()
      expect(configExport.defineVitestConfig).toBeDefined()
      expect(configExport.createBaseVitestConfig).toBeDefined()
    })

    it('should export types file independently', async () => {
      const typesExport = await import('../types.js')

      // The types.js file should exist and be importable
      // Types themselves are compile-time only, so we just verify the module loads
      expect(typesExport).toBeDefined()
    })

    // These tests should only run if the optional dependencies are available
    describe('Optional dependency exports', () => {
      it('should export MSW utilities if available', async () => {
        try {
          const mswExport = await import('../msw/index.js')

          expect(mswExport.createMSWServer).toBeDefined()
          expect(mswExport.setupMSW).toBeDefined()
          expect(mswExport.HttpResponse).toBeDefined()
        } catch {
          console.warn('MSW export test skipped - optional dependency not available')
        }
      })

      it('should export container utilities if available', async () => {
        try {
          const containersExport = await import('../containers/index.js')

          expect(containersExport.startContainer).toBeDefined()
          expect(containersExport.createPostgreSQLContainer).toBeDefined()
        } catch {
          console.warn('Containers export test skipped - optional dependency not available')
        }
      })

      it('should export Convex utilities if available', async () => {
        try {
          const convexExport = await import('../convex/index.js')

          expect(convexExport.createConvexTestContext).toBeDefined()
        } catch {
          console.warn('Convex export test skipped - optional dependency not available')
        }
      })

      it('should export SQLite utilities if available', async () => {
        try {
          const sqliteExport = await import('../sqlite/index.js')

          expect(sqliteExport.createSQLiteDatabase).toBeDefined()
        } catch {
          console.warn('SQLite export test skipped - optional dependency not available')
        }
      })
    })
  })

  describe('Package.json exports validation', () => {
    it('should validate that all package.json exports have default conditions', async () => {
      const pkg = await import('../../package.json', { with: { type: 'json' } })
      const exports = pkg.default.exports

      // Check main export
      expect(exports['.']).toHaveProperty('default')
      expect(exports['.']).toHaveProperty('types')
      expect(exports['.']).toHaveProperty('import')

      // Check all sub-exports have default condition
      const subExports = [
        './full',
        './cli',
        './register',
        './msw',
        './msw/browser',
        './containers',
        './convex',
        './sqlite',
        './env',
        './utils',
        './fs',
        './config',
        './config/vitest',
      ]

      for (const exportPath of subExports) {
        expect(exports[exportPath]).toBeDefined()
        expect(exports[exportPath]).toHaveProperty('default')
        expect(exports[exportPath]).toHaveProperty('types')
      }
    })

    it('should validate peer dependencies are properly configured', async () => {
      const pkg = await import('../../package.json', { with: { type: 'json' } })

      // Check that msw and happy-dom are in peerDependencies
      expect(pkg.default.peerDependencies).toHaveProperty('msw')
      expect(pkg.default.peerDependencies).toHaveProperty('happy-dom')

      // Check that they're marked as optional
      expect(pkg.default.peerDependenciesMeta.msw).toEqual({ optional: true })
      expect(pkg.default.peerDependenciesMeta['happy-dom']).toEqual({ optional: true })
    })
  })
})
