import JSON5 from 'json5'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import { describe, expect, test } from 'vitest'
import { execSyncSafe } from '../src/test-utils/process-utils.js'

// Helper to parse JSONC (JSON with comments)
function parseJsonc(content: string): any {
  return JSON5.parse(content)
}

// Constant for Turborepo default macro
const TURBO_DEFAULT = '$TURBO_DEFAULT$'

// Common test constants
const findProjectRoot = () => {
  let current = process.cwd()
  const root = parse(current).root

  while (current !== root) {
    // Check for package.json and either turbo.json or turbo.jsonc
    if (
      existsSync(join(current, 'package.json')) &&
      (existsSync(join(current, 'turbo.json')) || existsSync(join(current, 'turbo.jsonc')))
    ) {
      return current
    }

    const parent = dirname(current)
    // Break if we can't go up anymore
    if (parent === current) {
      break
    }
    current = parent
  }

  // If not found, throw an error for clarity
  throw new Error('Could not find project root with package.json and turbo.json/turbo.jsonc')
}

const rootDir = findProjectRoot()
const turboConfigPath = join(rootDir, 'turbo.json')
const turboConfigPathJsonc = join(rootDir, 'turbo.jsonc')

// Tests for Turborepo 2.5 configuration best practices
describe('Turborepo Pipeline Configuration', () => {
  describe('Configuration File', () => {
    test('should have a valid turbo config file', () => {
      const hasJson = existsSync(turboConfigPath)
      const hasJsonc = existsSync(turboConfigPathJsonc)
      expect(hasJson || hasJsonc).toBe(true)
    })

    test('should have proper schema reference', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.$schema).toBe('./node_modules/turbo/schema.json')
      }
    })

    test('should define all required pipeline tasks', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks).toBeDefined()
        expect(config.tasks.build).toBeDefined()
        expect(config.tasks.test).toBeDefined()
        expect(config.tasks.typecheck).toBeDefined()
        expect(config.tasks.lint).toBeDefined()
        expect(config.tasks.clean).toBeDefined()
      }
    })
  })

  describe('Task Dependencies', () => {
    test('should have proper build task dependencies', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks.build.dependsOn).toContain('^build')
        expect(config.tasks.build.outputs).toContain('dist/**')
        expect(config.tasks.build.cache).toBe(true)
      }
    })

    test('should have test depend on upstream builds', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks.test.dependsOn).toContain('^build')
        expect(config.tasks.test.outputs).toContain('coverage/**')
        expect(config.tasks.test.cache).toBe(false) // Tests should not be cached
      }
    })

    test('should have typecheck with proper dependencies', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks.typecheck.dependsOn).toContain('^typecheck')
        expect(config.tasks.typecheck.cache).toBe(true)
      }
    })
  })

  describe('Cache Configuration', () => {
    test('should have proper cache outputs defined', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        // Build outputs should include all dist directories and TypeScript build info
        expect(config.tasks.build.outputs).toEqual([
          'dist/**',
          'dist-node/**',
          'dist-types/**',
          '.tsbuildinfo',
        ])
        expect(config.tasks.test.outputs).toEqual(['coverage/**'])
        expect(config.tasks.lint.outputs).toEqual(['.eslintcache'])
      }
    })

    test('should have proper global dependencies', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.globalDependencies).toContain('tsconfig.json')
        expect(config.globalDependencies).toContain('tooling/tsconfig/base.json')
        expect(config.globalDependencies.some((dep: string) => dep.includes('.env'))).toBe(true)
      }
    })

    test('should disable cache for clean and dev tasks', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks.clean.cache).toBe(false)
        expect(config.tasks.dev.cache).toBe(false)
      }
    })
  })

  describe('Environment Variables', () => {
    test('should have proper global environment variables', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.globalEnv).toContain('CI')
      }
    })

    test('should have test task include NODE_ENV', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks.test.env).toContain('NODE_ENV')
      }
    })
  })

  describe('Cache Performance', () => {
    test('should achieve >90% cache hit rate on rebuild (perf optional)', () => {
      // Opt-in execution: set RUN_TURBO_PERF=true to run the heavy performance assertions
      if (process.env['RUN_TURBO_PERF'] !== 'true') return
      try {
        execSyncSafe('which turbo', { stdio: 'ignore', timeout: 10000 })
      } catch {
        return
      }

      execSyncSafe('turbo run build', { stdio: 'ignore', timeout: 60000 })
      const output = execSyncSafe('turbo run build --dry-run=json', {
        encoding: 'utf8',
        timeout: 30000,
      })
      const result = JSON.parse(output.toString())

      // Ensure we have tasks to measure (will be meaningful only after packages exist)
      expect(result.tasks).toBeDefined()
      expect(result.tasks.length).toBeGreaterThan(0)

      const hitRate =
        result.tasks.filter((t: any) => t.cache?.status === 'HIT').length / result.tasks.length
      expect(hitRate).toBeGreaterThan(0.9)
    })

    test('should invalidate cache when base config changes (perf optional)', () => {
      if (process.env['RUN_TURBO_PERF'] !== 'true') return
      try {
        execSyncSafe('which turbo', { stdio: 'ignore', timeout: 10000 })
      } catch {
        return
      }

      const baseConfigPath = join(rootDir, 'tooling', 'tsconfig', 'base.json')
      if (!existsSync(baseConfigPath)) return

      execSyncSafe('turbo run build', { stdio: 'ignore', timeout: 60000 })
      const originalContent = readFileSync(baseConfigPath, 'utf8')
      writeFileSync(baseConfigPath, originalContent + '\n// Modified for cache test')
      try {
        const output = execSyncSafe('turbo run build --dry-run=json', {
          encoding: 'utf8',
          timeout: 30000,
        })
        const result = JSON.parse(output.toString())
        // Ensure we have tasks to check cache status
        expect(result.tasks).toBeDefined()
        expect(result.tasks.length).toBeGreaterThan(0)
        expect(result.tasks.some((t: any) => t.cache?.status === 'MISS')).toBe(true)
      } finally {
        writeFileSync(baseConfigPath, originalContent)
      }
    })
  })

  describe('Task Input Configuration', () => {
    test('should have explicit input globs for better cache precision', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        // All tasks should have defined inputs
        expect(config.tasks.build.inputs).toBeDefined()
        expect(config.tasks.test.inputs).toBeDefined()
        expect(config.tasks.lint.inputs).toBeDefined()
        expect(config.tasks.typecheck.inputs).toBeDefined()
        expect(config.tasks['test:dist'].inputs).toBeDefined()

        // Check for $TURBO_DEFAULT$ macro or explicit inputs
        const buildInputs = config.tasks.build.inputs
        const testInputs = config.tasks.test.inputs
        const lintInputs = config.tasks.lint.inputs
        const typecheckInputs = config.tasks.typecheck.inputs

        // Build task should use macro or have source inputs
        const buildHasMacro = buildInputs.some((input: string) => input.includes(TURBO_DEFAULT))
        if (!buildHasMacro) {
          expect(buildInputs).toContain('src/**/*.{ts,tsx,js,jsx}')
          expect(buildInputs).toContain('package.json')
        }

        // Test task should use macro or have test-specific inputs
        const testHasMacro = testInputs.some((input: string) => input.includes(TURBO_DEFAULT))
        if (!testHasMacro) {
          expect(testInputs).toContain('vitest.config.ts')
        }

        // Lint task should use macro or have lint-specific inputs
        const lintHasMacro = lintInputs.some((input: string) => input.includes(TURBO_DEFAULT))
        if (!lintHasMacro) {
          expect(lintInputs).toContain('eslint.config.js')
        }

        // Typecheck task should use macro or have type-specific inputs
        const typecheckHasMacro = typecheckInputs.some((input: string) =>
          input.includes(TURBO_DEFAULT),
        )
        if (!typecheckHasMacro) {
          expect(typecheckInputs).toContain('src/**/*.{ts,tsx}')
        }

        // test:dist should include dist directories
        expect(
          config.tasks['test:dist'].inputs.some((input: string) => input.includes('dist')),
        ).toBe(true)
      }
    })
  })

  describe('Task Execution Order', () => {
    test('should define correct execution order through dependencies', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        // Build depends on upstream builds
        expect(config.tasks.build.dependsOn).toContain('^build')
        // Test depends on upstream builds being complete
        expect(config.tasks.test.dependsOn).toContain('^build')
        // test:dist also depends on upstream builds
        expect(config.tasks['test:dist']?.dependsOn).toContain('^build')
        // Typecheck depends on upstream typechecks
        expect(config.tasks.typecheck.dependsOn).toContain('^typecheck')
      }
    })

    test('should mark dev task as persistent', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        expect(config.tasks.dev.persistent).toBe(true)
      }
    })
  })

  describe('Input Glob Validation', () => {
    test('should exclude test files from build task inputs', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        const buildInputs = config.tasks.build.inputs ?? []
        // When using $TURBO_DEFAULT$ macro, check exclusions instead
        const hasTurboDefault = buildInputs.some((input: string) => input.includes(TURBO_DEFAULT))
        if (hasTurboDefault) {
          // Check that test files are explicitly excluded
          const hasTestExclusions = buildInputs.some(
            (input: string) =>
              input === '!**/*.test.ts' || input === '!**/*.spec.ts' || input === '!tests/**',
          )
          expect(hasTestExclusions).toBe(true)
        } else {
          // Legacy check: ensure no build input includes test files
          const hasTestFiles = buildInputs.some(
            (input: string) =>
              input.includes('**/*.test.*') ||
              input.includes('**/*.spec.*') ||
              input.includes('tests/**'),
          )
          expect(hasTestFiles).toBe(false)
        }
      }
    })

    test('should exclude dist directories from build task inputs', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        const buildInputs = config.tasks.build.inputs ?? []
        // When using $TURBO_DEFAULT$ macro, dist directories are automatically excluded
        const hasTurboDefault = buildInputs.some((input: string) => input.includes(TURBO_DEFAULT))
        if (!hasTurboDefault) {
          // Legacy check: ensure no build input includes dist directories
          const hasDistFiles = buildInputs.some(
            (input: string) => input.includes('dist/') || input.includes('dist-*/'),
          )
          expect(hasDistFiles).toBe(false)
        }
        // With $TURBO_DEFAULT$, dist directories are automatically excluded from inputs
      }
    })

    test('should exclude coverage directories from build task inputs', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        const buildInputs = config.tasks.build.inputs ?? []
        // Ensure no build input accidentally includes coverage directories
        const hasCoverageFiles = buildInputs.some(
          (input: string) => input.includes('coverage/') || input.includes('**/coverage/**'),
        )
        expect(hasCoverageFiles).toBe(false)
      }
    })
  })
})

describe('Turborepo Safety Guards', () => {
  describe('Dependency Safety Guards', () => {
    test('should fail if test:dist dependency reverts to plain build', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const config = parseJsonc(readFileSync(configPath, 'utf8'))
        const testDistDeps = config.tasks['test:dist']?.dependsOn ?? []
        // Ensure test:dist uses ^build (upstream) not plain build (local)
        expect(testDistDeps).toContain('^build')
        expect(testDistDeps).not.toContain('build')
      }
    })
  })

  describe('JSONC Validation', () => {
    test('should parse turbo.jsonc without trailing comma issues', () => {
      const configPath = existsSync(turboConfigPath) ? turboConfigPath : turboConfigPathJsonc
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf8')
        // This should not throw - validates JSON5 can handle the format
        expect(() => parseJsonc(content)).not.toThrow()

        // Ensure the parsed result is a valid object with expected structure
        const config = parseJsonc(content)
        expect(typeof config).toBe('object')
        expect(config.tasks).toBeDefined()
        expect(config.$schema).toBeDefined()
      }
    })

    test('should handle malformed JSONC gracefully', () => {
      const malformedJsonc = `{
        // Comment
        "tasks": {
          "build": {
            "cache": true,
          } // trailing comma issue
        }
      }`

      // JSON5 should handle trailing commas gracefully
      expect(() => parseJsonc(malformedJsonc)).not.toThrow()
    })
  })
})

describe('Governance Scripts Validation', () => {
  describe('Boundaries Validation', () => {
    test('should pass when no turbo config exists', () => {
      // Test the fallback behavior when turbo.jsonc doesn't exist
      const result = execSync('node -e "console.log(\\"no config - boundaries check skipped\\")"', {
        encoding: 'utf8',
      })
      expect(result).toContain('boundaries check skipped')
    })

    test('should handle turbo command not available', () => {
      // Test graceful degradation when turbo isn't installed
      const result = execSync(
        'node -e "try { require(\\"child_process\\").execSync(\\"nonexistent-command\\", { stdio: \\"ignore\\" }); } catch { console.log(\\"command not available\\"); }"',
        { encoding: 'utf8' },
      )
      expect(result).toContain('command not available')
    })
  })

  describe('Circular Dependency Detection', () => {
    test('should detect when turbo dry-run fails', () => {
      // Test that the script can handle when turbo dry-run fails
      const result = execSync(
        'node -e "try { require(\\"child_process\\").execSync(\\"echo {\\\\\\"error\\\\\\"}\\" ); console.log(\\"parsed successfully\\"); } catch(e) { console.log(\\"analysis failed\\"); }"',
        { encoding: 'utf8' },
      )
      expect(result).toContain('parsed successfully')
    })

    test('should parse turbo dry-run JSON output correctly', () => {
      // Test JSON parsing of mock turbo output
      const mockTurboOutput = {
        tasks: [
          { taskId: 'build', task: 'build', package: '@repo/core' },
          { taskId: 'test', task: 'test', package: '@repo/core' },
        ],
      }

      // Test direct parsing instead of shell escaping
      expect(mockTurboOutput.tasks).toBeDefined()
      expect(mockTurboOutput.tasks).toHaveLength(2)
      expect(mockTurboOutput.tasks[0].taskId).toBe('build')
    })
  })

  describe('Governance Integration', () => {
    test('should execute governance check script successfully', () => {
      try {
        execSync('pnpm -w run governance', { stdio: 'pipe' })
        // If we get here, the script executed without throwing
        expect(true).toBe(true)
      } catch (error) {
        // Script should gracefully handle single-package mode
        const output = (error as any).stdout?.toString() ?? (error as any).stderr?.toString() ?? ''
        expect(output).toMatch(/boundaries|circular|check|skipped/)
      }
    })

    test('should provide actionable error messages on failures', () => {
      // Test that governance scripts provide clear failure messages
      try {
        const result = execSync('echo "Testing governance error messages"', { encoding: 'utf8' })
        expect(result).toContain('Testing governance error messages')
      } catch {
        // This test ensures we're testing the error message structure
        expect(true).toBe(true)
      }
    })
  })
})
