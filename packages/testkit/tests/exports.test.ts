import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

describe('Package exports', () => {
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))

  it('should have correct exports configuration', () => {
    expect(packageJson.exports).toBeDefined()
    expect(packageJson.exports['.']).toBeDefined()
    expect(packageJson.exports['./cli']).toBeDefined()
    expect(packageJson.exports['./register']).toBeDefined()
    expect(packageJson.exports['./msw']).toBeDefined()
    expect(packageJson.exports['./msw/browser']).toBeDefined()
    expect(packageJson.exports['./containers']).toBeDefined()
    expect(packageJson.exports['./convex']).toBeDefined()
    expect(packageJson.exports['./sqlite']).toBeDefined()
    expect(packageJson.exports['./env']).toBeDefined()
    expect(packageJson.exports['./utils']).toBeDefined()
    expect(packageJson.exports['./fs']).toBeDefined()
    expect(packageJson.exports['./config']).toBeDefined()
    expect(packageJson.exports['./config/vitest']).toBeDefined()
  })

  it('should have all vitest conditions pointing to dist files', () => {
    const exports = packageJson.exports
    Object.entries(exports).forEach(([exportPath, exportConfig]) => {
      if (exportPath !== '.' && typeof exportConfig === 'object' && exportConfig.vitest) {
        expect(exportConfig.vitest).toMatch(/^\.\/dist\//)
        expect(exportConfig.development).toMatch(/^\.\/dist\//)
      }
    })
  })

  it.skipIf(!existsSync(resolve(__dirname, '../dist/index.js')))(
    'should be able to import built files directly',
    async () => {
      // Test that the actual built files can be imported
      // This test only runs when dist files exist (after build)
      const mainModule = await import('../dist/index.js')
      expect(mainModule).toBeDefined()

      const utilsModule = await import('../dist/utils/index.js')
      expect(utilsModule).toBeDefined()

      const configModule = await import('../dist/config/index.js')
      expect(configModule).toBeDefined()

      const vitestConfigModule = await import('../dist/config/vitest.base.js')
      expect(vitestConfigModule).toBeDefined()
    },
  )

  it('should have optional peer dependencies properly configured', () => {
    expect(packageJson.peerDependencies).toBeDefined()
    expect(packageJson.peerDependenciesMeta).toBeDefined()

    const optionalDeps = ['better-sqlite3', 'convex-test', 'testcontainers', 'mysql2', 'pg']

    optionalDeps.forEach((dep) => {
      expect(packageJson.peerDependencies[dep]).toBeDefined()
      expect(packageJson.peerDependenciesMeta[dep]?.optional).toBe(true)
    })
  })
})
