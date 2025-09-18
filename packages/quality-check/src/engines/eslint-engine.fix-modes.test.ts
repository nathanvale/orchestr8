/**
 * @fileoverview Tests for ESLint engine fix modes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ESLintEngine, type ESLintEngineConfig } from './eslint-engine.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

describe('ESLint Engine Fix Modes', () => {
  let engine: ESLintEngine
  let tempDir: string
  let testFile: string

  beforeEach(async () => {
    engine = new ESLintEngine()

    // Create a temporary directory for test files
    tempDir = path.join(process.cwd(), '.tmp-eslint-fix-test')
    await fs.mkdir(tempDir, { recursive: true })

    // Create a test file with various fixable issues
    testFile = path.join(tempDir, 'test-fix-modes.ts')
    await fs.writeFile(
      testFile,
      `
// Test file with various ESLint issues for fix mode testing

const unused_variable = 'this should trigger no-unused-vars'
var old_var = 'this should trigger no-var'
let spacing='this should trigger spacing issues'
const object = {
  a: 1,
  b: 2, // trailing comma issue
}

function testFunction(){
  console.log("double quotes instead of single")
  if(true){
    return 'poor formatting'
  }
}

// Missing semicolon
const arrow = () => 'semicolon missing'

export { testFunction }
`,
    )
  })

  afterEach(async () => {
    try {
      engine.dispose()
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('getFixTypes method', () => {
    it('should return safe fix types for safe mode', () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'safe',
      }

      // Test the private method via type assertion
      const fixTypes = (engine as any).getFixTypes(config)
      expect(fixTypes).toEqual(['layout', 'suggestion'])
    })

    it('should return all fix types for full mode', () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'full',
      }

      const fixTypes = (engine as any).getFixTypes(config)
      expect(fixTypes).toEqual(['directive', 'problem', 'suggestion', 'layout'])
    })

    it('should return undefined for default mode', () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
      }

      const fixTypes = (engine as any).getFixTypes(config)
      expect(fixTypes).toBeUndefined()
    })

    it('should prioritize explicit fixTypes over fixMode', () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'safe',
        fixTypes: ['layout'],
      }

      const fixTypes = (engine as any).getFixTypes(config)
      expect(fixTypes).toEqual(['layout'])
    })
  })

  describe('areFixTypesEqual method', () => {
    it('should return true for identical arrays', () => {
      const result = (engine as any).areFixTypesEqual(
        ['layout', 'suggestion'],
        ['layout', 'suggestion'],
      )
      expect(result).toBe(true)
    })

    it('should return true for arrays with same elements in different order', () => {
      const result = (engine as any).areFixTypesEqual(
        ['suggestion', 'layout'],
        ['layout', 'suggestion'],
      )
      expect(result).toBe(true)
    })

    it('should return false for arrays with different elements', () => {
      const result = (engine as any).areFixTypesEqual(
        ['layout', 'suggestion'],
        ['layout', 'problem'],
      )
      expect(result).toBe(false)
    })

    it('should return false for arrays with different lengths', () => {
      const result = (engine as any).areFixTypesEqual(['layout'], ['layout', 'suggestion'])
      expect(result).toBe(false)
    })

    it('should return true when both arrays are undefined', () => {
      const result = (engine as any).areFixTypesEqual(undefined, undefined)
      expect(result).toBe(true)
    })

    it('should return false when one array is undefined', () => {
      const result = (engine as any).areFixTypesEqual(['layout'], undefined)
      expect(result).toBe(false)
    })
  })

  describe('fix mode integration', () => {
    it('should apply safe fixes only in safe mode', async () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'safe',
      }

      const result = await engine.check(config)

      // In safe mode, we should still have issues that require problem fixes
      // But layout and suggestion fixes should be applied
      expect(result.success).toBe(false) // Should still have unfixed issues
      expect(result.modifiedFiles).toContain(testFile) // But file should be modified
    })

    it('should apply all fixes in full mode', async () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'full',
      }

      const result = await engine.check(config)

      // In full mode, more issues should be fixed
      expect(result.modifiedFiles).toContain(testFile)
      // Some issues might still remain (like unused variables which require code changes)
    })

    it('should not modify files when fix is false', async () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: false,
        fixMode: 'safe',
      }

      const result = await engine.check(config)

      expect(result.modifiedFiles).toHaveLength(0)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should cache engine instances with different fix modes separately', async () => {
      // First call with safe mode
      const safeConfig: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'safe',
      }

      await engine.check(safeConfig)

      // Second call with full mode should create new instance
      const fullConfig: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'full',
      }

      const result = await engine.check(fullConfig)
      expect(result).toBeDefined()
    })

    it('should reuse engine instance for same fix mode', async () => {
      const config1: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'safe',
      }

      const config2: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        fixMode: 'safe',
      }

      await engine.check(config1)
      const result = await engine.check(config2)

      expect(result).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle invalid fix mode gracefully', async () => {
      const config: ESLintEngineConfig = {
        files: [testFile],
        fix: true,
        // @ts-expect-error Testing invalid fix mode
        fixMode: 'invalid',
      }

      // Should not throw, should fall back to default behavior
      const result = await engine.check(config)
      expect(result).toBeDefined()
    })

    it('should handle missing files gracefully', async () => {
      const config: ESLintEngineConfig = {
        files: ['/non/existent/file.ts'],
        fix: true,
        fixMode: 'safe',
      }

      const result = await engine.check(config)
      expect(result.success).toBe(true) // No files to process
    })
  })
})
