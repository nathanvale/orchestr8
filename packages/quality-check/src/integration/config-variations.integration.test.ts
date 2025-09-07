import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('ESLint Config Variations Integration', () => {
  let testProjectDir: string
  let originalCwd: string
  let cleanupPaths: string[]

  beforeEach(async () => {
    vi.clearAllMocks()
    cleanupPaths = []
    originalCwd = process.cwd()

    // Create temporary test project directory
    testProjectDir = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'test-temp',
      `eslint-config-test-${Date.now()}`,
    )
    await fs.mkdir(testProjectDir, { recursive: true })
    cleanupPaths.push(testProjectDir)
    process.chdir(testProjectDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)

    // Cleanup temp directories
    for (const cleanupPath of cleanupPaths) {
      try {
        await fs.rm(cleanupPath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  describe('Different ESLint configurations', () => {
    test('should_handle_airbnb_style_config', async () => {
      // Arrange - Setup project with Airbnb-style ESLint config
      await setupProjectWithEslintConfig(testProjectDir, {
        extends: ['eslint:recommended'],
        rules: {
          'comma-dangle': ['error', 'always-multiline'],
          'object-curly-spacing': ['error', 'always'],
          'arrow-parens': ['error', 'always'],
          'quotes': ['error', 'single'],
          'semi': ['error', 'never'],
        },
      })

      const codeViolatingAirbnbStyle = `export const myFunction = arg => {
        const obj = {test: "value",another: "test"}
        return obj
      };`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'airbnb-style.js'),
          content: codeViolatingAirbnbStyle,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should auto-fix style issues
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_standard_style_config', async () => {
      // Arrange - Setup project with StandardJS-style ESLint config
      await setupProjectWithEslintConfig(testProjectDir, {
        extends: ['eslint:recommended'],
        rules: {
          'no-var': 'error',
          'prefer-const': 'error',
          'space-before-function-paren': ['error', 'always'],
          'no-trailing-spaces': 'error',
          'indent': ['error', 2],
        },
      })

      const codeViolatingStandardStyle = `var myFunction = function() {
        var unused = 'test'  
        let mutable = 'should be const'
        return mutable
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'standard-style.js'),
          content: codeViolatingStandardStyle,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should auto-fix style issues
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_custom_enterprise_config', async () => {
      // Arrange - Custom enterprise ESLint config with specific rules
      await setupProjectWithEslintConfig(testProjectDir, {
        extends: ['eslint:recommended'],
        rules: {
          'max-len': ['error', { code: 100 }],
          'no-multiple-empty-lines': ['error', { max: 1 }],
          'newline-before-return': 'error',
          'padding-line-between-statements': [
            'error',
            { blankLine: 'always', prev: '*', next: 'return' },
          ],
          'prefer-template': 'error',
        },
      })

      const codeViolatingEnterpriseStyle = `export function processData(name, age) {
        const message = 'Name: ' + name + ', Age: ' + age + '. This is a very long line that exceeds the maximum line length of 100 characters.'


        return message
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'enterprise-style.js'),
          content: codeViolatingEnterpriseStyle,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should auto-fix fixable issues
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe('TypeScript strict mode scenarios', () => {
    test('should_handle_typescript_strict_null_checks', async () => {
      // Arrange - TypeScript with strict null checks
      await setupTypeScriptProject(testProjectDir, {
        strict: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
      })

      const strictNullCheckCode = `interface User {
        id: number
        name: string
        email?: string
      }

      export function getUserEmail(user: User | null): string {
        // This should trigger strict null check issues
        return user.email
      }

      export function processUsers(users: User[]): string[] {
        return users.map(u => u.email)
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'strict-null.ts'),
          content: strictNullCheckCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should report TypeScript strict mode errors
      expect(result.exitCode).toBe(2) // Should block for type safety issues
      // Accept either message since both indicate blocking for manual intervention
      expect(
        result.stderr.includes('Quality issues require manual intervention') ||
          result.stderr.includes('Some issues remain after auto-fix'),
      ).toBe(true)
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_typescript_no_implicit_any', async () => {
      // Arrange - TypeScript with noImplicitAny
      await setupTypeScriptProject(testProjectDir, {
        strict: false,
        noImplicitAny: true,
      })

      const implicitAnyCode = `export function processData(data) {
        return data.map(item => item.value * 2)
      }

      export const handler = (req, res) => {
        res.send({ status: 'ok' })
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'implicit-any.ts'),
          content: implicitAnyCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should report implicit any errors
      expect(result.exitCode).toBe(2)
      // Accept either message since both indicate blocking for manual intervention
      expect(
        result.stderr.includes('Quality issues require manual intervention') ||
          result.stderr.includes('Some issues remain after auto-fix'),
      ).toBe(true)
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_typescript_unused_parameters', async () => {
      // Arrange - TypeScript with noUnusedParameters
      await setupTypeScriptProject(testProjectDir, {
        noUnusedLocals: true,
        noUnusedParameters: true,
      })

      const unusedParametersCode = `export function calculate(value: number, unused: string, factor: number): number {
        const unusedLocal = 'not used'
        return value * factor
      }

      export class Calculator {
        compute(a: number, b: number, c: number): number {
          return a + b // c is unused
        }
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'unused-params.ts'),
          content: unusedParametersCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - TypeScript unused parameters require manual intervention
      // (auto-fixing would require AST manipulation which is not yet implemented)
      expect(result.exitCode).toBe(2)
      expect(
        result.stderr.includes('Quality issues require manual intervention') ||
          result.stderr.includes('Some issues remain after auto-fix'),
      ).toBe(true)
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe('Prettier config edge cases', () => {
    test('should_handle_prettier_with_custom_print_width', async () => {
      // Arrange - Prettier config with custom print width
      await setupProjectWithPrettier(testProjectDir, {
        printWidth: 60,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
      })

      const longLineCode = `export const myVeryLongFunctionNameThatExceedsThePrintWidth = (firstParameter: string, secondParameter: number, thirdParameter: boolean) => {
        return { first: firstParameter, second: secondParameter, third: thirdParameter }
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'long-lines.ts'),
          content: longLineCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should format according to Prettier config
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_prettier_with_tabs_vs_spaces', async () => {
      // Arrange - Prettier config with tabs
      await setupProjectWithPrettier(testProjectDir, {
        useTabs: true,
        tabWidth: 4,
        semi: false,
        singleQuote: false,
      })

      const spacesCode = `export function formatData() {
          const data = {
              name: 'test',
              value: 123
          }
          return data
      }`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'tabs-spaces.js'),
          content: spacesCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should auto-format to use tabs
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_prettier_with_trailing_comma_options', async () => {
      // Arrange - Prettier config with trailing comma settings
      await setupProjectWithPrettier(testProjectDir, {
        trailingComma: 'all',
        bracketSpacing: false,
        arrowParens: 'always',
      })

      const noTrailingCommaCode = `export const config = {
        api: { url: "https://api.example.com", timeout: 5000 },
        features: [ "feature1", "feature2", "feature3" ],
        settings: { theme: "dark", language: "en" }
      }

      export const transform = data => data.map(item => ({
        id: item.id,
        name: item.name
      }))`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'trailing-comma.js'),
          content: noTrailingCommaCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should add trailing commas per config
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)
  })

  describe('Mixed configuration scenarios', () => {
    test('should_handle_eslint_prettier_conflicts', async () => {
      // Arrange - Conflicting ESLint and Prettier rules
      await setupProjectWithEslintConfig(testProjectDir, {
        extends: ['eslint:recommended'],
        rules: {
          'max-len': ['error', { code: 80 }],
          'quotes': ['error', 'double'],
          'semi': ['error', 'always'],
        },
      })

      await setupProjectWithPrettier(testProjectDir, {
        printWidth: 120,
        singleQuote: true,
        semi: false,
      })

      const conflictingCode = `export const message = 'This is a string that might cause conflicts between ESLint and Prettier configurations';`

      const payload = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(testProjectDir, 'src', 'conflicts.js'),
          content: conflictingCode,
        },
      }

      // Act
      const result = await executeClaudeHook(JSON.stringify(payload))

      // Assert - Should handle gracefully, Prettier should win
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.duration).toBeLessThan(2000)
    }, 5000)

    test('should_handle_monorepo_with_different_configs', async () => {
      // Arrange - Simulate monorepo with different configs per package
      const packageADir = path.join(testProjectDir, 'packages', 'package-a')
      const packageBDir = path.join(testProjectDir, 'packages', 'package-b')

      await fs.mkdir(packageADir, { recursive: true })
      await fs.mkdir(packageBDir, { recursive: true })

      // Package A with strict config
      await setupProjectWithEslintConfig(packageADir, {
        extends: ['eslint:recommended'],
        rules: {
          'no-console': 'error',
          'no-debugger': 'error',
        },
      })

      // Package B with lenient config
      await setupProjectWithEslintConfig(packageBDir, {
        extends: ['eslint:recommended'],
        rules: {
          'no-console': 'warn',
          'no-debugger': 'warn',
        },
      })

      const codeWithConsole = `export function debug(message) {
        console.log('Debug:', message)
        debugger
        return message
      }`

      // Test in package A (strict)
      const payloadA = {
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(packageADir, 'src', 'debug.js'),
          content: codeWithConsole,
        },
      }

      // Act
      const resultA = await executeClaudeHook(JSON.stringify(payloadA))

      // Assert - Should handle based on package config
      expect(resultA.exitCode).toBe(0) // Autopilot should fix console/debugger
      expect(resultA.duration).toBeLessThan(2000)
    }, 5000)
  })
})

// Helper functions
async function setupProjectWithEslintConfig(projectDir: string, rules: any): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })

  const eslintConfig = {
    root: true,
    env: {
      browser: true,
      es2021: true,
      node: true,
    },
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    ...rules,
  }

  await fs.writeFile(path.join(projectDir, '.eslintrc.json'), JSON.stringify(eslintConfig, null, 2))

  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    type: 'module',
  }
  await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))
}

async function setupTypeScriptProject(projectDir: string, compilerOptions: any): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })

  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      skipLibCheck: true,
      ...compilerOptions,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }

  await fs.writeFile(path.join(projectDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))

  const packageJson = {
    name: 'typescript-test-project',
    version: '1.0.0',
    type: 'module',
    devDependencies: {
      'typescript': '^5.0.0',
      '@types/node': '^20.0.0',
    },
  }
  await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))
}

async function setupProjectWithPrettier(projectDir: string, prettierConfig: any): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })

  await fs.writeFile(path.join(projectDir, '.prettierrc'), JSON.stringify(prettierConfig, null, 2))

  const packageJson = {
    name: 'prettier-test-project',
    version: '1.0.0',
    type: 'module',
    devDependencies: {
      prettier: '^3.0.0',
    },
  }
  await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))
}

async function executeClaudeHook(payload: string): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    // Get the path to the claude hook binary
    const binaryPath = path.resolve(__dirname, '..', '..', 'bin', 'claude-hook')

    const child = spawn('node', [binaryPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      const endTime = Date.now()
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        duration: endTime - startTime,
      })
    })

    // Send payload via stdin
    child.stdin?.write(payload)
    child.stdin?.end()
  })
}
