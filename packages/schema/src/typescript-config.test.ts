import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { describe, expect, it } from 'vitest'

describe('TypeScript Configuration', () => {
  // Get project root directory (3 levels up from packages/schema/src/)
  const currentFileDir = dirname(fileURLToPath(import.meta.url))
  const rootDir = resolve(currentFileDir, '../../..')

  describe('Root tsconfig.json', () => {
    it('should not have project references', () => {
      const tsconfigPath = resolve(rootDir, 'tsconfig.json')
      expect(existsSync(tsconfigPath)).toBe(true)

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))
      expect(tsconfig.references).toBeUndefined()
    })

    it('should have customConditions for development', () => {
      const tsconfigPath = resolve(rootDir, 'tsconfig.json')
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))

      expect(Array.isArray(tsconfig.compilerOptions?.customConditions)).toBe(
        true,
      )
      expect(tsconfig.compilerOptions?.customConditions).toContain(
        'development',
      )
    })

    it('should use bundler moduleResolution', () => {
      const tsconfigPath = resolve(rootDir, 'tsconfig.json')
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))

      expect(tsconfig.compilerOptions?.moduleResolution).toBe('bundler')
    })
  })

  describe('Package tsconfig.json files', () => {
    const packagesWithReferences = ['agent-base', 'core', 'testing']

    packagesWithReferences.forEach((pkg) => {
      it(`should not have project references in packages/${pkg}/tsconfig.json`, () => {
        const tsconfigPath = resolve(rootDir, 'packages', pkg, 'tsconfig.json')
        expect(existsSync(tsconfigPath)).toBe(true)

        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))
        expect(tsconfig.references).toBeUndefined()
      })

      it(`should not have composite mode in packages/${pkg}/tsconfig.json`, () => {
        const tsconfigPath = resolve(rootDir, 'packages', pkg, 'tsconfig.json')
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))

        expect(tsconfig.compilerOptions?.composite).toBeUndefined()
      })
    })
  })

  describe('Type-checking configuration', () => {
    const packages = [
      'agent-base',
      'cli',
      'core',
      'logger',
      'resilience',
      'schema',
      'testing',
    ]

    packages.forEach((pkg) => {
      it(`should not have tsconfig.typecheck.json in packages/${pkg}`, () => {
        const typecheckConfigPath = resolve(
          rootDir,
          'packages',
          pkg,
          'tsconfig.typecheck.json',
        )
        expect(existsSync(typecheckConfigPath)).toBe(false)
      })

      it(`should have type-check script using "tsc --noEmit" in packages/${pkg}/package.json`, () => {
        const packageJsonPath = resolve(
          rootDir,
          'packages',
          pkg,
          'package.json',
        )
        expect(existsSync(packageJsonPath)).toBe(true)

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        expect(packageJson.scripts?.['type-check']).toBe('tsc --noEmit')
      })
    })
  })

  describe('Package configuration validation', () => {
    const packages = [
      'agent-base',
      'core',
      'logger',
      'resilience',
      'schema',
      'testing',
    ]

    packages.forEach((pkg) => {
      describe(`packages/${pkg}`, () => {
        const packagePath = resolve(rootDir, 'packages', pkg)
        const packageJsonPath = resolve(packagePath, 'package.json')

        it(`should have valid package.json exports configuration`, () => {
          expect(existsSync(packageJsonPath)).toBe(true)

          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          const exports = packageJson.exports?.['.']

          expect(exports).toBeDefined()
          expect(exports.development).toMatch(/\.\/src\/.*\.ts$/)
          expect(exports.types).toMatch(/\.\/dist\/types\/.*\.d\.ts$/)
          expect(exports.import).toMatch(/\.\/dist\/esm\/.*\.js$/)

          // CLI package doesn't have CJS export
          if (packageJson.name !== '@orchestr8/cli') {
            expect(exports.require).toMatch(/\.\/dist\/cjs\/.*\.js$/)
          }
        })

        it(`should have proper TypeScript build configurations`, () => {
          const esmConfigPath = resolve(packagePath, 'tsconfig.esm.json')
          const typesConfigPath = resolve(packagePath, 'tsconfig.types.json')

          expect(existsSync(esmConfigPath)).toBe(true)
          expect(existsSync(typesConfigPath)).toBe(true)

          const esmConfig = JSON.parse(readFileSync(esmConfigPath, 'utf-8'))
          const typesConfig = JSON.parse(readFileSync(typesConfigPath, 'utf-8'))

          expect(esmConfig.compilerOptions?.outDir).toBe('./dist/esm')
          expect(typesConfig.compilerOptions?.outDir).toBe('./dist/types')
        })

        it(`should have build scripts defined in package.json`, () => {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          const scripts = packageJson.scripts

          expect(scripts.build).toBeDefined()
          expect(scripts['build:esm']).toBeDefined()
          expect(scripts['build:types']).toBeDefined()

          // CLI package doesn't build CJS
          if (packageJson.name !== '@orchestr8/cli') {
            expect(scripts['build:cjs']).toBeDefined()
          }
        })
      })
    })
  })

  describe('Development condition validation', () => {
    const packages = [
      'agent-base',
      'core',
      'logger',
      'resilience',
      'schema',
      'testing',
    ]

    packages.forEach((pkg) => {
      it(`should point development condition to source files in packages/${pkg}`, () => {
        const packageJsonPath = resolve(
          rootDir,
          'packages',
          pkg,
          'package.json',
        )
        expect(existsSync(packageJsonPath)).toBe(true)

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const developmentExport = packageJson.exports?.['.']?.development

        expect(developmentExport).toBeDefined()
        expect(developmentExport).toMatch(/\.\/src\/.*\.ts$/)
      })
    })
  })

  describe('CJS build configurations', () => {
    const packages = [
      'agent-base',
      'cli',
      'core',
      'logger',
      'resilience',
      'schema',
      'testing',
    ]

    packages.forEach((pkg) => {
      const cjsConfigPath = resolve(
        rootDir,
        'packages',
        pkg,
        'tsconfig.cjs.json',
      )

      if (existsSync(cjsConfigPath)) {
        it(`should have valid JSON syntax in packages/${pkg}/tsconfig.cjs.json`, () => {
          const content = readFileSync(cjsConfigPath, 'utf-8')
          expect(() => JSON.parse(content)).not.toThrow()
        })

        it(`should use node moduleResolution in packages/${pkg}/tsconfig.cjs.json`, () => {
          const tsconfig = JSON.parse(readFileSync(cjsConfigPath, 'utf-8'))
          expect(tsconfig.compilerOptions?.moduleResolution).toBe('node')
        })

        it(`should use CommonJS module in packages/${pkg}/tsconfig.cjs.json`, () => {
          const tsconfig = JSON.parse(readFileSync(cjsConfigPath, 'utf-8'))
          expect(tsconfig.compilerOptions?.module).toBe('CommonJS')
        })

        it(`should not inherit customConditions in packages/${pkg}/tsconfig.cjs.json`, () => {
          const tsconfig = JSON.parse(readFileSync(cjsConfigPath, 'utf-8'))

          // Check if it's standalone (no extends) or has customConditions overridden
          if (tsconfig.extends) {
            // If it extends, it should override customConditions to empty array or not have it
            expect(
              !tsconfig.compilerOptions?.customConditions ||
                (Array.isArray(tsconfig.compilerOptions?.customConditions) &&
                  tsconfig.compilerOptions?.customConditions.length === 0),
            ).toBe(true)
          } else {
            // If standalone, it shouldn't have customConditions at all
            expect(tsconfig.compilerOptions?.customConditions).toBeUndefined()
          }
        })
      }
    })
  })
})
