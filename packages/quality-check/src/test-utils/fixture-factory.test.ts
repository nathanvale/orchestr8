/**
 * Tests for fixture factory patterns
 * Validates that fixture factories produce correct test data structures
 */

import { describe, it, expect } from 'vitest'
import {
  ESLintFixtureFactory,
  TypeScriptFixtureFactory,
  PrettierFixtureFactory,
  MultiEngineFixtureFactory,
  ExitCodeFixtureFactory,
  type TestFixture,
  type MockFile,
  type ESLintFixtureConfig,
  type TypeScriptFixtureConfig,
  type PrettierFixtureConfig,
} from './modern-fixtures.js'

describe('ESLintFixtureFactory', () => {
  describe('createFlatConfig', () => {
    it('should create valid flat config with rules', () => {
      const config: ESLintFixtureConfig = {
        rules: {
          'no-console': 'warn',
          'semi': ['error', 'never'],
        },
      }

      const mockFile = ESLintFixtureFactory.createFlatConfig(config)

      expect(mockFile.path).toBe('eslint.config.js')
      expect(mockFile.exists).toBe(true)
      expect(mockFile.content).toContain('export default')
      expect(mockFile.content).toContain('"no-console": "warn"')
      expect(mockFile.content).toContain('"semi": [')
      expect(mockFile.content).toContain('"error"')
      expect(mockFile.content).toContain('"never"')
    })

    it('should handle ignore patterns', () => {
      const config: ESLintFixtureConfig = {
        ignorePatterns: ['dist/**', '*.min.js'],
        rules: {},
      }

      const mockFile = ESLintFixtureFactory.createFlatConfig(config)

      expect(mockFile.content).toContain('ignores: ["dist/**","*.min.js"]')
    })

    it('should create minimal config when no options provided', () => {
      const mockFile = ESLintFixtureFactory.createFlatConfig({})

      expect(mockFile.content).toContain('rules: {}')
      expect(mockFile.content).not.toContain('ignores:')
    })
  })

  describe('createLegacyConfig', () => {
    it('should create valid legacy .eslintrc.json', () => {
      const config: ESLintFixtureConfig = {
        extends: ['eslint:recommended', 'plugin:react/recommended'],
        rules: {
          indent: ['error', 2],
        },
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      }

      const mockFile = ESLintFixtureFactory.createLegacyConfig(config)

      expect(mockFile.path).toBe('.eslintrc.json')
      expect(mockFile.exists).toBe(true)

      const parsed = JSON.parse(mockFile.content)
      expect(parsed.root).toBe(true)
      expect(parsed.extends).toEqual(['eslint:recommended', 'plugin:react/recommended'])
      expect(parsed.rules.indent).toEqual(['error', 2])
      expect(parsed.parserOptions.ecmaVersion).toBe(2022)
    })

    it('should use defaults when not specified', () => {
      const mockFile = ESLintFixtureFactory.createLegacyConfig({})
      const parsed = JSON.parse(mockFile.content)

      expect(parsed.extends).toEqual(['eslint:recommended'])
      expect(parsed.parserOptions.ecmaVersion).toBe('latest')
      expect(parsed.env.node).toBe(true)
    })
  })

  describe('pre-configured fixtures', () => {
    it('should create Airbnb-style fixture with expected errors', () => {
      const fixture = ESLintFixtureFactory.createAirbnbStyleFixture()

      expect(fixture.description).toBe('ESLint flat config with Airbnb-style rules')
      expect(fixture.files).toHaveLength(2)
      expect(fixture.files[0].path).toBe('eslint.config.js')
      expect(fixture.files[1].path).toBe('src/test.js')

      expect(fixture.expected.eslint?.errorCount).toBe(4)
      expect(fixture.expected.eslint?.containsErrors).toContain('arrow-parens')
      expect(fixture.expected.eslint?.containsErrors).toContain('object-curly-spacing')
      expect(fixture.expected.eslint?.containsErrors).toContain('quotes')
      expect(fixture.expected.overall.success).toBe(false)
    })

    it('should create auto-fixable issues fixture', () => {
      const fixture = ESLintFixtureFactory.createAutoFixableIssuesFixture()

      expect(fixture.description).toBe('ESLint auto-fixable issues that should be resolved')
      expect(fixture.expected.eslint?.errorCount).toBe(5)
      expect(fixture.expected.eslint?.fixableCount).toBe(5)
      expect(fixture.expected.eslint?.messages).toHaveLength(5)

      const ruleNames = fixture.expected.eslint?.messages?.map((m) => m.rule)
      expect(ruleNames).toContain('no-extra-semi')
      expect(ruleNames).toContain('space-before-function-paren')
      expect(ruleNames).toContain('indent')
    })
  })
})

describe('TypeScriptFixtureFactory', () => {
  describe('createConfig', () => {
    it('should create valid tsconfig.json', () => {
      const config: TypeScriptFixtureConfig = {
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ES2022',
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['**/*.test.ts'],
      }

      const mockFile = TypeScriptFixtureFactory.createConfig(config)

      expect(mockFile.path).toBe('tsconfig.json')
      expect(mockFile.exists).toBe(true)

      const parsed = JSON.parse(mockFile.content)
      expect(parsed.compilerOptions.strict).toBe(true)
      expect(parsed.compilerOptions.noEmit).toBe(true)
      expect(parsed.compilerOptions.target).toBe('ES2022')
      expect(parsed.include).toEqual(['src/**/*.ts', 'src/**/*.tsx'])
      expect(parsed.exclude).toEqual(['**/*.test.ts'])
    })

    it('should merge with default compiler options', () => {
      const mockFile = TypeScriptFixtureFactory.createConfig({
        compilerOptions: { strict: true },
      })

      const parsed = JSON.parse(mockFile.content)
      expect(parsed.compilerOptions.target).toBe('ES2020')
      expect(parsed.compilerOptions.module).toBe('ESNext')
      expect(parsed.compilerOptions.moduleResolution).toBe('bundler')
      expect(parsed.compilerOptions.strict).toBe(true)
    })

    it('should use default include/exclude when not specified', () => {
      const mockFile = TypeScriptFixtureFactory.createConfig({})
      const parsed = JSON.parse(mockFile.content)

      expect(parsed.include).toEqual(['src/**/*'])
      expect(parsed.exclude).toEqual(['node_modules', 'dist'])
    })
  })

  describe('pre-configured fixtures', () => {
    it('should create strict mode fixture with TypeScript errors', () => {
      const fixture = TypeScriptFixtureFactory.createStrictModeFixture()

      expect(fixture.description).toBe('TypeScript strict mode violations')
      expect(fixture.files).toHaveLength(2)
      expect(fixture.files[0].path).toBe('tsconfig.json')
      expect(fixture.files[1].path).toBe('src/strict.ts')

      expect(fixture.expected.typescript?.errorCount).toBe(3)
      expect(fixture.expected.typescript?.messages).toHaveLength(3)

      const errorCodes = fixture.expected.typescript?.messages?.map((m) => m.rule)
      expect(errorCodes).toContain('TS2533') // Object possibly null
      expect(errorCodes).toContain('TS2532') // Object possibly undefined
      expect(errorCodes).toContain('TS7006') // Implicit any
    })

    it('should create unused locals/parameters fixture', () => {
      const fixture = TypeScriptFixtureFactory.createNoUnusedFixture()

      expect(fixture.description).toBe('TypeScript unused parameters and locals')
      expect(fixture.expected.typescript?.errorCount).toBe(2)
      expect(fixture.expected.typescript?.messages?.every((m) => m.rule === 'TS6133')).toBe(true)
      expect(fixture.expected.typescript?.messages?.[0].message).toContain('unused')
      expect(fixture.expected.typescript?.messages?.[1].message).toContain('unusedLocal')
    })
  })
})

describe('PrettierFixtureFactory', () => {
  describe('createConfig', () => {
    it('should create valid .prettierrc', () => {
      const config: PrettierFixtureConfig = {
        semi: false,
        singleQuote: true,
        tabWidth: 2,
        useTabs: false,
        printWidth: 100,
        trailingComma: 'all',
        bracketSpacing: true,
        arrowParens: 'always',
      }

      const mockFile = PrettierFixtureFactory.createConfig(config)

      expect(mockFile.path).toBe('.prettierrc')
      expect(mockFile.exists).toBe(true)

      const parsed = JSON.parse(mockFile.content)
      expect(parsed.semi).toBe(false)
      expect(parsed.singleQuote).toBe(true)
      expect(parsed.tabWidth).toBe(2)
      expect(parsed.printWidth).toBe(100)
      expect(parsed.trailingComma).toBe('all')
    })

    it('should handle partial config', () => {
      const config: PrettierFixtureConfig = {
        semi: true,
        tabWidth: 4,
      }

      const mockFile = PrettierFixtureFactory.createConfig(config)
      const parsed = JSON.parse(mockFile.content)

      expect(parsed.semi).toBe(true)
      expect(parsed.tabWidth).toBe(4)
      expect(Object.keys(parsed)).toHaveLength(2)
    })
  })

  describe('pre-configured fixtures', () => {
    it('should create formatting issues fixture', () => {
      const fixture = PrettierFixtureFactory.createFormattingIssuesFixture()

      expect(fixture.description).toBe('Prettier formatting violations')
      expect(fixture.files).toHaveLength(2)
      expect(fixture.files[0].path).toBe('.prettierrc')
      expect(fixture.files[1].path).toBe('src/format.js')

      expect(fixture.expected.prettier?.success).toBe(false)
      expect(fixture.expected.prettier?.errorCount).toBe(1)
      expect(fixture.expected.prettier?.fixableCount).toBe(1)
      expect(fixture.expected.prettier?.messages?.[0].message).toContain('formatting')
    })

    it('should create auto-fix formatting fixture', () => {
      const fixture = PrettierFixtureFactory.createAutoFixFormattingFixture()

      expect(fixture.description).toBe('Prettier auto-fixable formatting')
      expect(fixture.expected.prettier?.success).toBe(false)
      expect(fixture.expected.prettier?.fixableCount).toBe(1)
      expect(fixture.files[1].content).toBe('const obj={key:"value",nested:{prop:"test"}};')
    })
  })
})

describe('MultiEngineFixtureFactory', () => {
  it('should create complex integration fixture with all engines', () => {
    const fixture = MultiEngineFixtureFactory.createComplexIntegrationFixture()

    expect(fixture.description).toContain('Multi-engine integration')
    expect(fixture.files).toHaveLength(4) // tsconfig, eslint, prettier, source file

    // Verify all engines have results
    expect(fixture.expected.typescript).toBeDefined()
    expect(fixture.expected.eslint).toBeDefined()
    expect(fixture.expected.prettier).toBeDefined()

    // TypeScript should catch implicit any
    expect(fixture.expected.typescript?.errorCount).toBe(1)
    expect(fixture.expected.typescript?.containsErrors).toContain('TS7006')

    // ESLint should catch unused variable and console
    expect(fixture.expected.eslint?.errorCount).toBe(1)
    expect(fixture.expected.eslint?.warningCount).toBe(1)
    expect(fixture.expected.eslint?.containsErrors).toContain('no-unused-vars')
    expect(fixture.expected.eslint?.containsWarnings).toContain('no-console')

    // Prettier should need formatting
    expect(fixture.expected.prettier?.errorCount).toBe(1)
    expect(fixture.expected.prettier?.fixableCount).toBe(1)

    // Overall should fail
    expect(fixture.expected.overall.success).toBe(false)
  })

  it('should create clean code fixture that passes all engines', () => {
    const fixture = MultiEngineFixtureFactory.createCleanCodeFixture()

    expect(fixture.description).toContain('Clean code')
    expect(fixture.files).toHaveLength(4)

    // All engines should pass
    expect(fixture.expected.typescript?.success).toBe(true)
    expect(fixture.expected.typescript?.errorCount).toBe(0)

    expect(fixture.expected.eslint?.success).toBe(true)
    expect(fixture.expected.eslint?.errorCount).toBe(0)

    expect(fixture.expected.prettier?.success).toBe(true)
    expect(fixture.expected.prettier?.errorCount).toBe(0)

    expect(fixture.expected.overall.success).toBe(true)
  })
})

describe('ExitCodeFixtureFactory', () => {
  it('should create success fixture for exit code 0', () => {
    const fixture = ExitCodeFixtureFactory.createSuccessFixture()

    expect(fixture.description).toContain('exit code 0')
    expect(fixture.files).toHaveLength(1)
    expect(fixture.files[0].content).toBe('export const clean = 42;')

    expect(fixture.expected.eslint?.success).toBe(true)
    expect(fixture.expected.prettier?.success).toBe(true)
    expect(fixture.expected.overall.success).toBe(true)
  })

  it('should create error fixture for exit code 1', () => {
    const fixture = ExitCodeFixtureFactory.createErrorFixture()

    expect(fixture.description).toContain('exit code 1')
    expect(fixture.files).toHaveLength(2) // config + source

    expect(fixture.expected.eslint?.success).toBe(false)
    expect(fixture.expected.eslint?.errorCount).toBe(1)
    expect(fixture.expected.eslint?.messages?.[0].rule).toBe('no-unused-vars')
    expect(fixture.expected.overall.success).toBe(false)
  })
})

describe('TestFixture structure validation', () => {
  it('should have consistent structure across all fixtures', () => {
    const fixtures: TestFixture[] = [
      ESLintFixtureFactory.createAirbnbStyleFixture(),
      TypeScriptFixtureFactory.createStrictModeFixture(),
      PrettierFixtureFactory.createFormattingIssuesFixture(),
      MultiEngineFixtureFactory.createComplexIntegrationFixture(),
      ExitCodeFixtureFactory.createSuccessFixture(),
    ]

    fixtures.forEach((fixture) => {
      // All fixtures must have description
      expect(fixture.description).toBeTruthy()
      expect(typeof fixture.description).toBe('string')

      // All fixtures must have files array
      expect(Array.isArray(fixture.files)).toBe(true)
      expect(fixture.files.length).toBeGreaterThan(0)

      // All files must have required properties
      fixture.files.forEach((file) => {
        expect(file.path).toBeTruthy()
        expect(typeof file.path).toBe('string')
        expect(typeof file.content).toBe('string')
        expect(file.exists).toBe(true)
      })

      // All fixtures must have expected results
      expect(fixture.expected).toBeDefined()
      expect(fixture.expected.overall).toBeDefined()
      expect(typeof fixture.expected.overall.success).toBe('boolean')

      // Options must match expected results
      if (fixture.options?.eslint) {
        expect(fixture.expected.eslint).toBeDefined()
      }
      if (fixture.options?.typescript) {
        expect(fixture.expected.typescript).toBeDefined()
      }
      if (fixture.options?.prettier) {
        expect(fixture.expected.prettier).toBeDefined()
      }
    })
  })

  it('should have valid message structures', () => {
    const fixture = ESLintFixtureFactory.createAirbnbStyleFixture()

    fixture.expected.eslint?.messages?.forEach((message) => {
      expect(message.file).toBeTruthy()
      expect(typeof message.line).toBe('number')
      expect(message.line).toBeGreaterThan(0)
      expect(typeof message.column).toBe('number')
      expect(message.column).toBeGreaterThan(0)
      expect(message.rule).toBeTruthy()
      expect(message.message).toBeTruthy()
      expect(['error', 'warning']).toContain(message.severity)
    })
  })
})

describe('MockFile validation', () => {
  it('should create valid mock files', () => {
    const files: MockFile[] = [
      ESLintFixtureFactory.createFlatConfig({ rules: { 'no-console': 'warn' } }),
      TypeScriptFixtureFactory.createConfig({ compilerOptions: { strict: true } }),
      PrettierFixtureFactory.createConfig({ semi: false }),
    ]

    files.forEach((file) => {
      expect(file.path).toBeTruthy()
      expect(file.content).toBeTruthy()
      expect(file.exists).toBe(true)

      // Config files should be valid JSON or JS
      if (file.path.endsWith('.json') || file.path.endsWith('rc')) {
        expect(() => JSON.parse(file.content)).not.toThrow()
      } else if (file.path.endsWith('.js')) {
        expect(file.content).toContain('export')
      }
    })
  })
})
