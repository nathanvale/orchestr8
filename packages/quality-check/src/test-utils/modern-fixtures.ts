/**
 * Modern fixture factory patterns for integration tests
 * Replaces brittle file system and process spawning patterns with in-memory mocking
 */

import type { QualityCheckOptions } from '../types.js'

/**
 * Configuration for ESLint engine tests
 */
export interface ESLintFixtureConfig {
  rules?: Record<string, unknown>
  extends?: string[]
  ignorePatterns?: string[]
  flatConfig?: boolean
  parserOptions?: Record<string, unknown>
}

/**
 * Configuration for TypeScript engine tests
 */
export interface TypeScriptFixtureConfig {
  compilerOptions?: Record<string, unknown>
  include?: string[]
  exclude?: string[]
  strict?: boolean
}

/**
 * Configuration for Prettier engine tests
 */
export interface PrettierFixtureConfig {
  semi?: boolean
  singleQuote?: boolean
  tabWidth?: number
  useTabs?: boolean
  printWidth?: number
  trailingComma?: 'all' | 'es5' | 'none'
  bracketSpacing?: boolean
  arrowParens?: 'always' | 'avoid'
}

/**
 * Mock file content for testing
 */
export interface MockFile {
  path: string
  content: string
  exists?: boolean
}

/**
 * Expected message from engine
 */
export interface ExpectedMessage {
  file: string
  line: number
  column: number
  rule?: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * Expected engine results for assertions
 */
export interface ExpectedEngineResult {
  success: boolean
  errorCount?: number
  warningCount?: number
  fixableCount?: number
  containsErrors?: string[]
  containsWarnings?: string[]
  messages?: ExpectedMessage[]
  duration?: number
}

/**
 * Complete test fixture combining all configurations
 */
export interface TestFixture {
  description: string
  files: MockFile[]
  eslintConfig?: ESLintFixtureConfig
  typescriptConfig?: TypeScriptFixtureConfig
  prettierConfig?: PrettierFixtureConfig
  options?: QualityCheckOptions
  expected: {
    eslint?: ExpectedEngineResult
    typescript?: ExpectedEngineResult
    prettier?: ExpectedEngineResult
    overall: {
      success: boolean
      executionTime?: number
    }
  }
}

/**
 * Factory for creating ESLint flat config fixtures
 */
export class ESLintFixtureFactory {
  static createFlatConfig(config: ESLintFixtureConfig): MockFile {
    const flatConfigContent = `export default [
  {
    ${config.ignorePatterns ? `ignores: ${JSON.stringify(config.ignorePatterns)},` : ''}
    rules: ${JSON.stringify(config.rules || {}, null, 4)}
  }
];`

    return {
      path: 'eslint.config.js',
      content: flatConfigContent,
      exists: true,
    }
  }

  static createLegacyConfig(config: ESLintFixtureConfig): MockFile {
    const legacyConfig = {
      root: true,
      env: {
        browser: true,
        es2021: true,
        node: true,
      },
      extends: config.extends || ['eslint:recommended'],
      parserOptions: config.parserOptions || {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: config.rules || {},
    }

    return {
      path: '.eslintrc.json',
      content: JSON.stringify(legacyConfig, null, 2),
      exists: true,
    }
  }

  static createAirbnbStyleFixture(): TestFixture {
    return {
      description: 'ESLint flat config with Airbnb-style rules',
      files: [
        ESLintFixtureFactory.createFlatConfig({
          rules: {
            'comma-dangle': ['error', 'always-multiline'],
            'object-curly-spacing': ['error', 'always'],
            'arrow-parens': ['error', 'always'],
            'quotes': ['error', 'single'],
            'semi': ['error', 'never'],
          },
        }),
        {
          path: 'src/test.js',
          content: `export const myFunction = arg => {
  const obj = {test: "value",another: "test"}
  return obj
};`,
          exists: true,
        },
      ],
      options: { eslint: true, typescript: false, prettier: false },
      expected: {
        eslint: {
          success: false,
          errorCount: 4,
          warningCount: 0,
          messages: [
            {
              file: 'src/test.js',
              line: 1,
              column: 34,
              rule: 'arrow-parens',
              message: 'Expected parentheses around arrow function argument',
              severity: 'error',
            },
            {
              file: 'src/test.js',
              line: 2,
              column: 16,
              rule: 'object-curly-spacing',
              message: "A space is required after '{'",
              severity: 'error',
            },
            {
              file: 'src/test.js',
              line: 2,
              column: 22,
              rule: 'quotes',
              message: 'Strings must use singlequote',
              severity: 'error',
            },
            {
              file: 'src/test.js',
              line: 2,
              column: 45,
              rule: 'object-curly-spacing',
              message: "A space is required before '}'",
              severity: 'error',
            },
          ],
          containsErrors: ['object-curly-spacing', 'arrow-parens', 'quotes'],
        },
        overall: { success: false },
      },
    }
  }

  static createAutoFixableIssuesFixture(): TestFixture {
    return {
      description: 'ESLint auto-fixable issues that should be resolved',
      files: [
        ESLintFixtureFactory.createFlatConfig({
          rules: {
            'no-extra-semi': 'error',
            'space-before-function-paren': ['error', 'always'],
            'indent': ['error', 2],
          },
        }),
        {
          path: 'src/fixable.js',
          content: `function test() {;;
      return 42;;
  };;`,
          exists: true,
        },
      ],
      options: { eslint: true, typescript: false, prettier: false },
      expected: {
        eslint: {
          success: false,
          errorCount: 5,
          fixableCount: 5,
          messages: [
            {
              file: 'src/fixable.js',
              line: 1,
              column: 14,
              rule: 'space-before-function-paren',
              message: 'Missing space before function parentheses',
              severity: 'error',
            },
            {
              file: 'src/fixable.js',
              line: 1,
              column: 18,
              rule: 'no-extra-semi',
              message: 'Unnecessary semicolon',
              severity: 'error',
            },
            {
              file: 'src/fixable.js',
              line: 2,
              column: 1,
              rule: 'indent',
              message: 'Expected indentation of 2 spaces but found 6',
              severity: 'error',
            },
            {
              file: 'src/fixable.js',
              line: 2,
              column: 18,
              rule: 'no-extra-semi',
              message: 'Unnecessary semicolon',
              severity: 'error',
            },
            {
              file: 'src/fixable.js',
              line: 3,
              column: 4,
              rule: 'no-extra-semi',
              message: 'Unnecessary semicolon',
              severity: 'error',
            },
          ],
          containsErrors: ['no-extra-semi', 'space-before-function-paren', 'indent'],
        },
        overall: { success: false },
      },
    }
  }
}

/**
 * Factory for creating TypeScript config fixtures
 */
export class TypeScriptFixtureFactory {
  static createConfig(config: TypeScriptFixtureConfig): MockFile {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        skipLibCheck: true,
        ...config.compilerOptions,
      },
      include: config.include || ['src/**/*'],
      exclude: config.exclude || ['node_modules', 'dist'],
    }

    return {
      path: 'tsconfig.json',
      content: JSON.stringify(tsConfig, null, 2),
      exists: true,
    }
  }

  static createStrictModeFixture(): TestFixture {
    return {
      description: 'TypeScript strict mode violations',
      files: [
        TypeScriptFixtureFactory.createConfig({
          compilerOptions: {
            strict: true,
            strictNullChecks: true,
            noImplicitAny: true,
          },
        }),
        {
          path: 'src/strict.ts',
          content: `interface User {
  name: string
  email?: string
}

export function getEmail(user: User | null): string {
  return user.email // Should error: object possibly null and possibly undefined
}

export function process(data) { // Should error: implicit any
  return data.value
}`,
          exists: true,
        },
      ],
      options: { typescript: true, eslint: false, prettier: false },
      expected: {
        typescript: {
          success: false,
          errorCount: 3,
          messages: [
            {
              file: 'src/strict.ts',
              line: 7,
              column: 10,
              rule: 'TS2533',
              message: 'Object is possibly null',
              severity: 'error',
            },
            {
              file: 'src/strict.ts',
              line: 7,
              column: 10,
              rule: 'TS2532',
              message: 'Object is possibly undefined',
              severity: 'error',
            },
            {
              file: 'src/strict.ts',
              line: 10,
              column: 25,
              rule: 'TS7006',
              message: 'Parameter data implicitly has an any type',
              severity: 'error',
            },
          ],
          containsErrors: ['TS2533', 'TS7006'], // Object possibly null/undefined, implicit any
        },
        overall: { success: false },
      },
    }
  }

  static createNoUnusedFixture(): TestFixture {
    return {
      description: 'TypeScript unused parameters and locals',
      files: [
        TypeScriptFixtureFactory.createConfig({
          compilerOptions: {
            noUnusedLocals: true,
            noUnusedParameters: true,
          },
        }),
        {
          path: 'src/unused.ts',
          content: `export function calculate(value: number, unused: string, factor: number): number {
  const unusedLocal = 'not used'
  return value * factor
}`,
          exists: true,
        },
      ],
      options: { typescript: true, eslint: false, prettier: false },
      expected: {
        typescript: {
          success: false,
          errorCount: 2,
          messages: [
            {
              file: 'src/unused.ts',
              line: 1,
              column: 43,
              rule: 'TS6133',
              message: 'unused is declared but its value is never read',
              severity: 'error',
            },
            {
              file: 'src/unused.ts',
              line: 2,
              column: 9,
              rule: 'TS6133',
              message: 'unusedLocal is declared but its value is never read',
              severity: 'error',
            },
          ],
          containsErrors: ['TS6133'], // Unused parameter/local
        },
        overall: { success: false },
      },
    }
  }
}

/**
 * Factory for creating Prettier config fixtures
 */
export class PrettierFixtureFactory {
  static createConfig(config: PrettierFixtureConfig): MockFile {
    return {
      path: '.prettierrc',
      content: JSON.stringify(config, null, 2),
      exists: true,
    }
  }

  static createFormattingIssuesFixture(): TestFixture {
    return {
      description: 'Prettier formatting violations',
      files: [
        PrettierFixtureFactory.createConfig({
          semi: false,
          singleQuote: true,
          tabWidth: 2,
          printWidth: 80,
        }),
        {
          path: 'src/format.js',
          content: `const obj = {
    "key": "value",
      nested: {
        prop: "test"
    }
};`,
          exists: true,
        },
      ],
      options: { prettier: true, eslint: false, typescript: false },
      expected: {
        prettier: {
          success: false,
          errorCount: 1,
          fixableCount: 1,
          messages: [
            {
              file: 'src/format.js',
              line: 1,
              column: 1,
              rule: 'prettier/prettier',
              message: 'File needs formatting',
              severity: 'error',
            },
          ],
          containsErrors: ['formatting', 'needs formatting'],
        },
        overall: { success: false },
      },
    }
  }

  static createAutoFixFormattingFixture(): TestFixture {
    return {
      description: 'Prettier auto-fixable formatting',
      files: [
        PrettierFixtureFactory.createConfig({
          semi: false,
          singleQuote: true,
          tabWidth: 2,
        }),
        {
          path: 'src/autofix.js',
          content: `const obj={key:"value",nested:{prop:"test"}};`,
          exists: true,
        },
      ],
      options: { prettier: true, eslint: false, typescript: false },
      expected: {
        prettier: {
          success: false, // Should fail initially but be fixable
          errorCount: 1,
          fixableCount: 1,
          messages: [
            {
              file: 'src/autofix.js',
              line: 1,
              column: 1,
              rule: 'prettier/prettier',
              message: 'File needs formatting',
              severity: 'error',
            },
          ],
        },
        overall: { success: false },
      },
    }
  }
}

/**
 * Factory for creating auto-fix behavior test fixtures
 */
export class AutoFixBehaviorFactory {
  /**
   * Create fixture for testing ESLint auto-fix behavior
   */
  static createESLintAutoFixFixture(): TestFixture {
    return {
      description: 'ESLint auto-fix behavior test',
      files: [
        ESLintFixtureFactory.createFlatConfig({
          rules: {
            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'comma-spacing': ['error', { before: false, after: true }],
            'no-extra-semi': 'error',
          },
        }),
        {
          path: 'src/eslint-fix.js',
          content: `const test = "hello world";;
const arr = [1,2,3,4];`,
          exists: true,
        },
      ],
      options: { eslint: true, typescript: false, prettier: false, fix: true },
      expected: {
        eslint: {
          success: true, // After fix, should pass
          errorCount: 0,
          fixableCount: 4,
        },
        overall: { success: true },
      },
    }
  }

  /**
   * Create fixture for testing Prettier auto-fix behavior
   */
  static createPrettierAutoFixFixture(): TestFixture {
    return {
      description: 'Prettier auto-fix behavior test',
      files: [
        PrettierFixtureFactory.createConfig({
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'es5',
        }),
        {
          path: 'src/prettier-fix.js',
          content: `function test(a,b,c){return a+b+c}
const obj={key:"value",another:"test"}`,
          exists: true,
        },
      ],
      options: { prettier: true, eslint: false, typescript: false, fix: true },
      expected: {
        prettier: {
          success: true, // After fix, should pass
          errorCount: 0,
          fixableCount: 1,
        },
        overall: { success: true },
      },
    }
  }

  /**
   * Create fixture for testing mixed auto-fix behavior
   */
  static createMixedAutoFixFixture(): TestFixture {
    return {
      description: 'Mixed ESLint and Prettier auto-fix behavior',
      files: [
        ESLintFixtureFactory.createFlatConfig({
          rules: {
            'no-console': 'warn',
            'no-unused-vars': 'error',
            'semi': ['error', 'always'],
          },
        }),
        PrettierFixtureFactory.createConfig({
          semi: true,
          singleQuote: true,
          tabWidth: 2,
        }),
        {
          path: 'src/mixed-fix.js',
          content: `const test="hello world"
console.log(test)
const unused = 42`,
          exists: true,
        },
      ],
      options: { eslint: true, prettier: true, typescript: false, fix: true },
      expected: {
        eslint: {
          success: false, // no-unused-vars cannot be auto-fixed
          errorCount: 1,
          warningCount: 1,
          fixableCount: 1,
          containsErrors: ['no-unused-vars'],
          containsWarnings: ['no-console'],
        },
        prettier: {
          success: true, // Formatting can be fixed
          errorCount: 0,
          fixableCount: 1,
        },
        overall: { success: false },
      },
    }
  }
}

/**
 * Factory for creating multi-engine integration fixtures
 */
export class MultiEngineFixtureFactory {
  static createComplexIntegrationFixture(): TestFixture {
    return {
      description: 'Multi-engine integration with TypeScript, ESLint, and Prettier',
      files: [
        TypeScriptFixtureFactory.createConfig({
          compilerOptions: {
            strict: true,
            noEmit: true,
          },
        }),
        ESLintFixtureFactory.createFlatConfig({
          rules: {
            'no-unused-vars': 'error',
            'no-console': 'warn',
          },
        }),
        PrettierFixtureFactory.createConfig({
          semi: true,
          singleQuote: false,
          tabWidth: 4,
        }),
        {
          path: 'src/multi.ts',
          content: `const unused = 42;
function test(param: any) {
        console.log(    param    );
}
export { test };`,
          exists: true,
        },
      ],
      options: { typescript: true, eslint: true, prettier: true },
      expected: {
        typescript: {
          success: false,
          errorCount: 1,
          messages: [
            {
              file: 'src/multi.ts',
              line: 2,
              column: 15,
              rule: 'TS7006',
              message: 'Parameter param implicitly has an any type',
              severity: 'error',
            },
          ],
          containsErrors: ['TS7006'], // implicit any
        },
        eslint: {
          success: false,
          errorCount: 1,
          warningCount: 1,
          messages: [
            {
              file: 'src/multi.ts',
              line: 1,
              column: 7,
              rule: 'no-unused-vars',
              message: 'unused is defined but never used',
              severity: 'error',
            },
            {
              file: 'src/multi.ts',
              line: 3,
              column: 9,
              rule: 'no-console',
              message: 'Unexpected console statement',
              severity: 'warning',
            },
          ],
          containsErrors: ['no-unused-vars'],
          containsWarnings: ['no-console'],
        },
        prettier: {
          success: false,
          errorCount: 1,
          fixableCount: 1,
          messages: [
            {
              file: 'src/multi.ts',
              line: 1,
              column: 1,
              rule: 'prettier/prettier',
              message: 'File needs formatting',
              severity: 'error',
            },
          ],
        },
        overall: { success: false },
      },
    }
  }

  static createCleanCodeFixture(): TestFixture {
    return {
      description: 'Clean code that should pass all engines',
      files: [
        TypeScriptFixtureFactory.createConfig({
          compilerOptions: {
            strict: true,
            noEmit: true,
          },
        }),
        ESLintFixtureFactory.createFlatConfig({
          rules: {
            'no-unused-vars': 'error',
          },
        }),
        PrettierFixtureFactory.createConfig({
          semi: true,
          singleQuote: false,
        }),
        {
          path: 'src/clean.ts',
          content: `export function add(a: number, b: number): number {
  return a + b;
}`,
          exists: true,
        },
      ],
      options: { typescript: true, eslint: true, prettier: true },
      expected: {
        typescript: { success: true, errorCount: 0 },
        eslint: { success: true, errorCount: 0 },
        prettier: { success: true, errorCount: 0 },
        overall: { success: true },
      },
    }
  }
}

/**
 * Exit code fixtures for testing deterministic behavior
 */
export class ExitCodeFixtureFactory {
  static createSuccessFixture(): TestFixture {
    return {
      description: 'Clean code should return exit code 0',
      files: [
        {
          path: 'src/clean.js',
          content: 'export const clean = 42;',
          exists: true,
        },
      ],
      options: { eslint: true, prettier: true, typescript: false },
      expected: {
        eslint: { success: true, errorCount: 0 },
        prettier: { success: true, errorCount: 0 },
        overall: { success: true },
      },
    }
  }

  static createErrorFixture(): TestFixture {
    return {
      description: 'Code with errors should return exit code 1',
      files: [
        ESLintFixtureFactory.createFlatConfig({
          rules: { 'no-unused-vars': 'error' },
        }),
        {
          path: 'src/error.js',
          content: 'const unused = 42;',
          exists: true,
        },
      ],
      options: { eslint: true, typescript: false, prettier: false },
      expected: {
        eslint: {
          success: false,
          errorCount: 1,
          messages: [
            {
              file: 'src/error.js',
              line: 1,
              column: 7,
              rule: 'no-unused-vars',
              message: 'unused is defined but never used',
              severity: 'error',
            },
          ],
        },
        overall: { success: false },
      },
    }
  }
}
