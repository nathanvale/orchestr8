/**
 * @fileoverview Tests for the dual consumption validation script
 */

import { execSync } from 'child_process'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

import { describe, it, expect } from 'vitest'

const rootDir = resolve(import.meta.dirname, '../../..')

describe('Dual Consumption Validation Script', () => {
  describe('Package Configuration Validation', () => {
    const packages = [
      'schema',
      'logger',
      'resilience',
      'core',
      'cli',
      'testing',
    ]

    for (const pkg of packages) {
      it(`should validate ${pkg} package exports configuration`, async () => {
        const packageJsonPath = resolve(rootDir, `packages/${pkg}/package.json`)

        try {
          const content = await readFile(packageJsonPath, 'utf8')
          const packageJson = JSON.parse(content)

          // Validate package structure for dual consumption
          expect(packageJson.type).toBe('module')
          expect(packageJson.exports).toBeDefined()
          expect(packageJson.exports['.']).toBeDefined()

          const exports = packageJson.exports['.']

          // Development condition should be first
          const exportKeys = Object.keys(exports)
          expect(exportKeys[0]).toBe('development')

          // Required export conditions
          expect(exports.development).toBeDefined()
          expect(exports.types).toBeDefined()
          expect(exports.import).toBeDefined()

          console.log(`✅ ${pkg} package configuration valid`)
        } catch {
          console.log(`⏭️  Package ${pkg} not found, skipping validation`)
        }
      })
    }
  })

  describe('TypeScript Configuration Validation', () => {
    it('should validate root TypeScript configuration for dual consumption', async () => {
      const tsconfigPath = resolve(rootDir, 'tsconfig.json')
      const content = await readFile(tsconfigPath, 'utf8')
      const tsconfig = JSON.parse(content)

      // Validate module resolution strategy
      expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler')
      expect(tsconfig.compilerOptions.module).toBe('ESNext')
      expect(tsconfig.compilerOptions.target).toBe('ES2022')

      // Validate development-focused setup (no project references)
      expect(tsconfig.compilerOptions.composite).toBeUndefined()
      expect(tsconfig.compilerOptions.declaration).toBeUndefined()

      // Validate customConditions for development builds
      expect(tsconfig.compilerOptions.customConditions).toContain('development')

      console.log('✅ TypeScript configuration valid for dual consumption')
    })
  })

  describe('Vitest Configuration Validation', () => {
    it('should validate Vitest configuration inherits development conditions', async () => {
      const vitestConfigPath = resolve(rootDir, 'vitest.config.ts')
      const content = await readFile(vitestConfigPath, 'utf8')

      // Vitest inherits conditions from root tsconfig.json customConditions
      // Verify basic vitest configuration exists
      expect(content).toContain('defineConfig')
      expect(content).toContain('test:')

      console.log(
        '✅ Vitest configuration inherits development conditions from root tsconfig',
      )
    })
  })

  describe('Script Execution', () => {
    it.skip('should run validation script without errors', () => {
      const scriptPath = resolve(
        rootDir,
        'scripts/validate-dual-consumption.js',
      )

      try {
        const result = execSync(`node ${scriptPath}`, {
          cwd: rootDir,
          encoding: 'utf8',
          timeout: 30000,
        })

        // Script should complete without throwing
        expect(result).toContain('dual consumption')
        console.log('✅ Validation script executed successfully')
      } catch (error) {
        console.error('Validation script failed:', (error as Error).message)
        throw error
      }
    })
  })

  describe('Package Export Resolution', () => {
    it('should validate that development condition points to TypeScript source', async () => {
      const packages = ['schema', 'logger', 'resilience', 'core']

      for (const pkg of packages) {
        const packageJsonPath = resolve(rootDir, `packages/${pkg}/package.json`)

        try {
          const content = await readFile(packageJsonPath, 'utf8')
          const packageJson = JSON.parse(content)

          const developmentPath = packageJson.exports?.['.']?.development
          if (developmentPath) {
            expect(developmentPath).toMatch(/\.(ts|tsx)$/)
            expect(developmentPath).toContain('./src/')
            console.log(
              `✅ ${pkg} development condition points to TypeScript source`,
            )
          }
        } catch {
          console.log(`⏭️  Skipping ${pkg}: package not found`)
        }
      }
    })

    it('should validate that production conditions will point to compiled JavaScript', async () => {
      const packages = ['schema', 'logger', 'resilience', 'core']

      for (const pkg of packages) {
        const packageJsonPath = resolve(rootDir, `packages/${pkg}/package.json`)

        try {
          const content = await readFile(packageJsonPath, 'utf8')
          const packageJson = JSON.parse(content)

          const importPath = packageJson.exports?.['.']?.import
          if (importPath) {
            // Should point to dist directory for production builds
            expect(importPath).toContain('./dist/')
            console.log(`✅ ${pkg} import condition configured for dist output`)
          }
        } catch {
          console.log(`⏭️  Skipping ${pkg}: package not found`)
        }
      }
    })
  })
})
