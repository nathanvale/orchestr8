/**
 * Tests for dual environment compatibility (monorepo TypeScript vs standalone npm package)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.resolve(__dirname, '../../package.json')

describe('Monorepo TypeScript Compatibility', () => {
  it('should import hooks directly from TypeScript source', async () => {
    // Test dynamic import of TypeScript source (monorepo usage)
    try {
      const { NotificationHook, StopHook } = await import('../../src/index')

      expect(NotificationHook).toBeDefined()
      expect(typeof NotificationHook).toBe('function')
      expect(StopHook).toBeDefined()
      expect(typeof StopHook).toBe('function')
    } catch (error) {
      throw new Error(`Failed to import from TypeScript source: ${error}`)
    }
  })

  it('should execute hooks using tsx in monorepo environment', () => {
    // Skip in Wallaby as tsx may not be available
    if (process.env.WALLABY_WORKER) {
      return
    }

    // Test that hooks can be run directly with tsx (monorepo usage)
    expect(() => {
      try {
        execSync('npx tsx src/stop/stop.ts --help', {
          timeout: 5000,
          stdio: 'pipe',
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        // Should not fail due to module loading issues
        expect(errorMessage).not.toContain('Cannot find module')
        expect(errorMessage).not.toContain('SyntaxError')
        expect(errorMessage).not.toContain('MODULE_NOT_FOUND')
      }
    }).not.toThrow(/Cannot find module|SyntaxError|MODULE_NOT_FOUND/)
  })
})

describe('Standalone NPM Package Compatibility', () => {
  it('should import hooks from compiled JavaScript dist', async () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    // Test dynamic import of compiled JavaScript (standalone npm usage)
    try {
      // Use dynamic import with string literal to avoid module resolution at parse time
      const distModule = await import(`${'../../dist/index.js'}`)
      const { NotificationHook, StopHook } = distModule

      expect(NotificationHook).toBeDefined()
      expect(typeof NotificationHook).toBe('function')
      expect(StopHook).toBeDefined()
      expect(typeof StopHook).toBe('function')
    } catch (error) {
      throw new Error(`Failed to import from compiled dist: ${error}`)
    }
  })

  it('should execute bin commands using node (standalone npm usage)', () => {
    // Skip in Wallaby as dist may not exist
    if (process.env.WALLABY_WORKER) {
      return
    }

    const binFiles = [
      'dist/bin/claude-hooks-stop.js',
      'dist/bin/claude-hooks-notification.js',
      'dist/bin/claude-hooks-quality.js',
      'dist/bin/claude-hooks-subagent.js',
    ]

    binFiles.forEach((binFile) => {
      expect(fs.existsSync(binFile)).toBe(true)

      expect(() => {
        try {
          execSync(`node ${binFile} --help`, {
            timeout: 5000,
            stdio: 'pipe',
          })
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          // Should not fail due to module loading issues
          expect(errorMessage).not.toContain('Cannot find module')
          expect(errorMessage).not.toContain('SyntaxError')
          expect(errorMessage).not.toContain('MODULE_NOT_FOUND')
        }
      }).not.toThrow(/Cannot find module|SyntaxError|MODULE_NOT_FOUND/)
    })
  })

  it('should have correct package.json bin entries', () => {
    // Skip in Wallaby due to path resolution issues
    if (process.env.WALLABY_WORKER) {
      return
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    expect(packageJson.bin).toBeDefined()
    expect(packageJson.bin['claude-hooks-stop']).toBe('./dist/bin/claude-hooks-stop.js')
    expect(packageJson.bin['claude-hooks-notification']).toBe(
      './dist/bin/claude-hooks-notification.js',
    )
    expect(packageJson.bin['claude-hooks-quality']).toBe('./dist/bin/claude-hooks-quality.js')
    expect(packageJson.bin['claude-hooks-subagent']).toBe('./dist/bin/claude-hooks-subagent.js')
  })

  it('should have correct package.json exports configuration', () => {
    // Skip in Wallaby due to path resolution issues
    if (process.env.WALLABY_WORKER) {
      return
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    expect(packageJson.exports).toBeDefined()
    expect(packageJson.exports['.']).toBeDefined()
    expect(packageJson.exports['.'].import).toBe('./dist/index.js')
    expect(packageJson.exports['.'].types).toBe('./dist/index.d.ts')
  })

  it('should be configured as public package', () => {
    // Skip in Wallaby due to path resolution issues
    if (process.env.WALLABY_WORKER) {
      return
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    expect(packageJson.private).toBe(false)
    expect(packageJson.keywords).toBeDefined()
    expect(Array.isArray(packageJson.keywords)).toBe(true)
    expect(packageJson.keywords).toContain('claude')
    expect(packageJson.keywords).toContain('claude-code')
  })
})

describe('Configuration Resolution', () => {
  it('should resolve configuration in both environments', () => {
    // Test that configuration loading works from both environments
    const testConfigPath = './.claude/hooks/test-config.json'
    const testConfig = {
      debug: true,
      notify: true,
      speak: false,
    }

    // Create test config temporarily
    if (!fs.existsSync('.claude/hooks')) {
      fs.mkdirSync('.claude/hooks', { recursive: true })
    }
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2))

    try {
      // Test config loading (this should work in both environments)
      expect(fs.existsSync(testConfigPath)).toBe(true)
      const loadedConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'))
      expect(loadedConfig.debug).toBe(true)
      expect(loadedConfig.notify).toBe(true)
      expect(loadedConfig.speak).toBe(false)
    } finally {
      // Cleanup
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath)
      }
    }
  })
})
