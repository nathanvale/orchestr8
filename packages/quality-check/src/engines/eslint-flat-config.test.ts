import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { ESLintEngine } from './eslint-engine.js'

describe('ESLint Flat Config Detection', () => {
  let engine: ESLintEngine
  let tempDir: string

  beforeEach(() => {
    engine = new ESLintEngine()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-flat-config-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    engine.clearCache()
  })

  describe('Flat Config File Detection', () => {
    it('should detect eslint.config.js (CommonJS)', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, 'const unused = 1;')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].ruleId).toBe('no-unused-vars')
    })

    it('should detect eslint.config.mjs (ESM)', async () => {
      const configPath = path.join(tempDir, 'eslint.config.mjs')
      fs.writeFileSync(
        configPath,
        `export default [
          {
            files: ['**/*.js'],
            rules: {
              'no-console': 'warn'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, 'console.log("test");')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].ruleId).toBe('no-console')
      expect(result.issues[0].severity).toBe('warning')
    })

    it('should detect eslint.config.cjs (CommonJS explicit)', async () => {
      const configPath = path.join(tempDir, 'eslint.config.cjs')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            rules: {
              'semi': ['error', 'never']
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, 'const x = 1;')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].ruleId).toBe('semi')
    })

    it('should handle TypeScript files with flat config', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.ts', '**/*.tsx'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.ts')
      fs.writeFileSync(testFile, 'const unused: string = "test";')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should handle multiple config objects in flat config', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            rules: {
              'no-unused-vars': 'error'
            }
          },
          {
            files: ['**/*.test.js'],
            rules: {
              'no-unused-vars': 'off'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'code.test.js')
      fs.writeFileSync(testFile, 'const unused = 1;')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Should be success because no-unused-vars is turned off for test files
      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should handle ignores pattern in flat config', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            ignores: ['**/node_modules/**', '**/dist/**']
          },
          {
            files: ['**/*.js'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      // Create a dist directory with a file that should be ignored
      const distDir = path.join(tempDir, 'dist')
      fs.mkdirSync(distDir)
      const ignoredFile = path.join(distDir, 'ignored.js')
      fs.writeFileSync(ignoredFile, 'const unused = 1;')

      const srcFile = path.join(tempDir, 'src.js')
      fs.writeFileSync(srcFile, 'const used = 1; export default used;')

      const result = await engine.check({
        files: [srcFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should handle language options in flat config', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            languageOptions: {
              ecmaVersion: 2022,
              sourceType: 'module',
              globals: {
                console: 'readonly',
                process: 'readonly'
              }
            },
            rules: {
              'no-undef': 'error'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(
        testFile,
        `console.log(process.env.NODE_ENV);
export const test = 1;`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Should succeed because console and process are defined as globals
      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should gracefully handle missing flat config', async () => {
      // No config file created
      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, 'const x = 1;')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Should handle gracefully - either no rules applied or use defaults
      expect(result).toBeDefined()
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should handle invalid flat config gracefully', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = "not an array";`, // Invalid config
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, 'const x = 1;')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Should capture the configuration error
      expect(result).toBeDefined()
      if (!result.success && result.issues.length > 0) {
        expect(result.issues[0].message).toBeDefined()
      }
    })

    it('should properly detect config when using isConfigured method', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      // Change to the temp directory
      const originalCwd = process.cwd()
      process.chdir(tempDir)

      try {
        const isConfigured = await engine.isConfigured()
        expect(isConfigured).toBe(true)
      } finally {
        process.chdir(originalCwd)
      }
    })

    it('should support processor in flat config', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.md'],
            processor: 'markdown/markdown'
          },
          {
            files: ['**/*.md/*.js'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.md')
      fs.writeFileSync(
        testFile,
        `# Test
\`\`\`js
const unused = 1;
\`\`\``,
      )

      // This test verifies that processor configuration is accepted
      // Actual processor functionality depends on whether the plugin is installed
      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result).toBeDefined()
    })

    it('should support linter options in flat config', async () => {
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            linterOptions: {
              noInlineConfig: true,
              reportUnusedDisableDirectives: true
            },
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(
        testFile,
        `/* eslint-disable no-unused-vars */
const unused = 1;`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // With noInlineConfig: true, the eslint-disable comment should be ignored
      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Config Priority and Resolution', () => {
    it('should prefer eslint.config.js over legacy .eslintrc', async () => {
      // Create both configs
      const flatConfigPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        flatConfigPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];`,
      )

      const legacyConfigPath = path.join(tempDir, '.eslintrc.json')
      fs.writeFileSync(
        legacyConfigPath,
        JSON.stringify({
          rules: {
            'no-unused-vars': 'off',
          },
        }),
      )

      const testFile = path.join(tempDir, 'test.js')
      fs.writeFileSync(testFile, 'const unused = 1;')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Flat config should be used (error), not legacy config (off)
      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].ruleId).toBe('no-unused-vars')
    })

    it('should search for config in parent directories', async () => {
      // Create config in parent directory
      const configPath = path.join(tempDir, 'eslint.config.js')
      fs.writeFileSync(
        configPath,
        `module.exports = [
          {
            files: ['**/*.js'],
            rules: {
              'no-console': 'warn'
            }
          }
        ];`,
      )

      // Create subdirectory with test file
      const subDir = path.join(tempDir, 'src', 'components')
      fs.mkdirSync(subDir, { recursive: true })
      const testFile = path.join(subDir, 'test.js')
      fs.writeFileSync(testFile, 'console.log("test");')

      const result = await engine.check({
        files: [testFile],
        cwd: subDir, // Run from subdirectory
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].ruleId).toBe('no-console')
    })
  })
})
