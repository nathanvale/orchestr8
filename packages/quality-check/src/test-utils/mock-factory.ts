/**
 * Mock Factory Pattern for Test Infrastructure
 * Provides centralized creation of mock objects for testing
 */

import { expect } from 'vitest'
import {
  MockQualityChecker,
  InMemoryFileSystem,
  MockConfigLoader,
  MockReadable,
  MockWritable,
  setupTestEnvironment,
  type TestEnvironment,
} from './test-environment.js'

/**
 * Configuration for mock environment
 */
export interface MockEnvironmentConfig {
  disableHooks?: boolean
  silentMode?: boolean
  nodeEnv?: string
  defaultQualityCheckResult?: {
    success: boolean
    issues: Array<{
      line: number
      column: number
      message: string
      severity: string
      engine: string
      ruleId?: string
    }>
  }
  defaultConfigs?: {
    eslint?: unknown
    prettier?: unknown
    typescript?: unknown
  }
}

/**
 * Complete mock environment for integration tests
 */
export interface MockEnvironment extends TestEnvironment {
  qualityChecker: MockQualityChecker
  fileSystem: InMemoryFileSystem
  configLoader: MockConfigLoader
}

/**
 * Factory for creating mock quality checker with common presets
 */
export class MockQualityCheckerFactory {
  static createWithSuccess(): MockQualityChecker {
    const checker = new MockQualityChecker()
    return checker
  }

  static createWithTypeScriptErrors(): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult('test.ts', {
      filePath: 'test.ts',
      success: false,
      issues: [
        {
          line: 10,
          column: 5,
          message: "Type 'string' is not assignable to type 'number'",
          severity: 'error',
          engine: 'typescript',
          ruleId: 'TS2322',
        },
      ],
    })
    return checker
  }

  static createWithESLintWarnings(): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult('test.js', {
      filePath: 'test.js',
      success: true,
      issues: [
        {
          line: 5,
          column: 10,
          message: 'Missing semicolon',
          severity: 'warning',
          engine: 'eslint',
          ruleId: 'semi',
        },
      ],
    })
    return checker
  }

  static createWithPrettierIssues(): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult('test.js', {
      filePath: 'test.js',
      success: false,
      issues: [
        {
          line: 1,
          column: 1,
          message: 'File is not formatted with Prettier',
          severity: 'warning',
          engine: 'prettier',
          ruleId: 'format',
        },
      ],
    })
    return checker
  }

  static createWithMixedIssues(): MockQualityChecker {
    const checker = new MockQualityChecker()
    checker.setPredefinedResult('test.ts', {
      filePath: 'test.ts',
      success: false,
      issues: [
        {
          line: 10,
          column: 5,
          message: "Type 'string' is not assignable to type 'number'",
          severity: 'error',
          engine: 'typescript',
          ruleId: 'TS2322',
        },
        {
          line: 15,
          column: 10,
          message: 'Missing semicolon',
          severity: 'warning',
          engine: 'eslint',
          ruleId: 'semi',
        },
        {
          line: 1,
          column: 1,
          message: 'File is not formatted with Prettier',
          severity: 'warning',
          engine: 'prettier',
          ruleId: 'format',
        },
      ],
    })
    return checker
  }
}

/**
 * Factory for creating mock file systems with common test files
 */
export class MockFileSystemFactory {
  static createWithTestFiles(): InMemoryFileSystem {
    const fs = new InMemoryFileSystem()
    fs.write('src/index.ts', 'export const hello = "world";\n')
    fs.write(
      'src/utils.ts',
      'export function add(a: number, b: number): number {\n  return a + b;\n}\n',
    )
    fs.write(
      'test/index.test.ts',
      'import { hello } from "../src/index";\n\ntest("hello", () => {\n  expect(hello).toBe("world");\n});\n',
    )
    return fs
  }

  static createWithConfigFiles(): InMemoryFileSystem {
    const fs = new InMemoryFileSystem()
    fs.write('package.json', JSON.stringify({ name: 'test-package', version: '1.0.0' }, null, 2))
    fs.write('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }, null, 2))
    fs.write('.eslintrc.json', JSON.stringify({ extends: ['eslint:recommended'] }, null, 2))
    fs.write('.prettierrc', JSON.stringify({ semi: true, singleQuote: true }, null, 2))
    return fs
  }

  static createEmpty(): InMemoryFileSystem {
    return new InMemoryFileSystem()
  }
}

/**
 * Factory for creating mock config loaders with common configurations
 */
export class MockConfigLoaderFactory {
  static createWithStrictConfigs(): MockConfigLoader {
    const loader = new MockConfigLoader()
    loader.setConfig('typescript', {
      compilerOptions: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
      },
    })
    loader.setConfig('eslint', {
      rules: {
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'no-unused-vars': 'error',
      },
    })
    loader.setConfig('prettier', {
      semi: true,
      singleQuote: true,
      tabWidth: 2,
    })
    return loader
  }

  static createWithRelaxedConfigs(): MockConfigLoader {
    const loader = new MockConfigLoader()
    loader.setConfig('typescript', {
      compilerOptions: {
        strict: false,
      },
    })
    loader.setConfig('eslint', {
      rules: {
        'semi': 'off',
        'no-unused-vars': 'warn',
      },
    })
    loader.setConfig('prettier', {
      semi: false,
      singleQuote: false,
    })
    return loader
  }

  static createDefault(): MockConfigLoader {
    return new MockConfigLoader()
  }
}

/**
 * Main factory for creating complete mock environments
 */
export class MockEnvironmentFactory {
  /**
   * Create a mock environment with all components
   */
  static create(config: MockEnvironmentConfig = {}): MockEnvironment {
    // Setup base test environment
    const baseEnv = setupTestEnvironment()

    // Set additional environment variables
    if (config.silentMode !== false) {
      process.env.CLAUDE_HOOK_SILENT = 'true'
    }
    if (config.nodeEnv) {
      process.env.NODE_ENV = config.nodeEnv
    } else {
      process.env.NODE_ENV = 'test'
    }

    // Create mock components
    const qualityChecker = new MockQualityChecker()
    const fileSystem = new InMemoryFileSystem()
    const configLoader = new MockConfigLoader()

    // Apply default configurations if provided
    if (config.defaultConfigs) {
      if (config.defaultConfigs.eslint) {
        configLoader.setConfig('eslint', config.defaultConfigs.eslint)
      }
      if (config.defaultConfigs.prettier) {
        configLoader.setConfig('prettier', config.defaultConfigs.prettier)
      }
      if (config.defaultConfigs.typescript) {
        configLoader.setConfig('typescript', config.defaultConfigs.typescript)
      }
    }

    return {
      ...baseEnv,
      qualityChecker,
      fileSystem,
      configLoader,
    }
  }

  /**
   * Create a standard test environment for integration tests
   */
  static createStandard(): MockEnvironment {
    return MockEnvironmentFactory.create({
      disableHooks: true,
      silentMode: true,
      nodeEnv: 'test',
    })
  }

  /**
   * Create an environment for testing with quality issues
   */
  static createWithIssues(): MockEnvironment {
    const env = MockEnvironmentFactory.createStandard()
    env.qualityChecker = MockQualityCheckerFactory.createWithMixedIssues()
    env.fileSystem = MockFileSystemFactory.createWithTestFiles()
    env.configLoader = MockConfigLoaderFactory.createWithStrictConfigs()
    return env
  }

  /**
   * Create an environment for testing successful quality checks
   */
  static createWithSuccess(): MockEnvironment {
    const env = MockEnvironmentFactory.createStandard()
    env.qualityChecker = MockQualityCheckerFactory.createWithSuccess()
    env.fileSystem = MockFileSystemFactory.createWithTestFiles()
    env.configLoader = MockConfigLoaderFactory.createWithRelaxedConfigs()
    return env
  }
}

/**
 * Helper to create mock stdin with payload
 */
export function createMockStdinWithPayload(payload: unknown): MockReadable {
  const stdin = new MockReadable()
  stdin.setData(JSON.stringify(payload))
  return stdin
}

/**
 * Helper to create Claude Code payload
 */
export function createClaudePayload(
  toolName: string,
  filePath: string,
  content?: string,
  edits?: Array<{ old_string: string; new_string: string }>,
): unknown {
  return {
    tool_name: toolName,
    tool_input: {
      file_path: filePath,
      content,
      edits,
    },
  }
}

/**
 * Helper to assert stdout/stderr output
 */
export function assertOutput(stream: MockWritable, expected: string | RegExp): void {
  const output = stream.getOutput()
  if (typeof expected === 'string') {
    expect(output).toContain(expected)
  } else {
    expect(output).toMatch(expected)
  }
}

/**
 * Helper to assert no output
 */
export function assertNoOutput(stream: MockWritable): void {
  expect(stream.getOutput()).toBe('')
}
