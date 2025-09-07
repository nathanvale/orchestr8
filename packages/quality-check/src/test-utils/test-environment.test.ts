/**
 * Tests for Test Environment Utilities
 */

import { describe, expect, test, beforeEach } from 'vitest'
import {
  MockQualityChecker,
  InMemoryFileSystem,
  MockConfigLoader,
  MockReadable,
  MockWritable,
  setupTestEnvironment,
  teardownTestEnvironment,
  getTestExitCode,
  createTestPayload,
  createMockEnvironment,
  standardTestSetup,
  standardTestTeardown,
} from './test-environment.js'

describe('MockQualityChecker', () => {
  let checker: MockQualityChecker

  beforeEach(() => {
    checker = new MockQualityChecker()
  })

  test('should return predefined results when set', async () => {
    // Arrange
    const testResult = {
      filePath: 'test.ts',
      success: false,
      issues: [
        {
          line: 10,
          column: 5,
          message: 'Test error',
          severity: 'error',
          engine: 'typescript',
          ruleId: 'TS2322',
        },
      ],
    }
    checker.setPredefinedResult('test.ts', testResult)

    // Act
    const result = await checker.check(['test.ts'])

    // Assert
    expect(result.success).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toEqual(testResult.issues[0])
  })

  test('should return default success for unknown files', async () => {
    // Act
    const result = await checker.check(['unknown.ts'])

    // Assert
    expect(result.success).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  test('should handle multiple files with mixed results', async () => {
    // Arrange
    checker.setPredefinedResult('error.ts', {
      filePath: 'error.ts',
      success: false,
      issues: [
        {
          line: 1,
          column: 1,
          message: 'Error',
          severity: 'error',
          engine: 'eslint',
        },
      ],
    })

    // Act
    const result = await checker.check(['error.ts', 'success.ts'])

    // Assert
    expect(result.success).toBe(false)
    expect(result.issues).toHaveLength(1)
  })

  test('should clear predefined results', () => {
    // Arrange
    checker.setPredefinedResult('test.ts', {
      filePath: 'test.ts',
      success: false,
      issues: [],
    })

    // Act
    checker.clear()

    // Assert
    checker.check(['test.ts']).then((result) => {
      expect(result.success).toBe(true)
    })
  })
})

describe('InMemoryFileSystem', () => {
  let fs: InMemoryFileSystem

  beforeEach(() => {
    fs = new InMemoryFileSystem()
  })

  test('should write and read files', () => {
    // Act
    fs.write('test.ts', 'const test = 123')

    // Assert
    expect(fs.read('test.ts')).toBe('const test = 123')
    expect(fs.exists('test.ts')).toBe(true)
  })

  test('should return undefined for non-existent files', () => {
    // Assert
    expect(fs.read('nonexistent.ts')).toBeUndefined()
    expect(fs.exists('nonexistent.ts')).toBe(false)
  })

  test('should delete files', () => {
    // Arrange
    fs.write('test.ts', 'content')

    // Act
    const deleted = fs.delete('test.ts')

    // Assert
    expect(deleted).toBe(true)
    expect(fs.exists('test.ts')).toBe(false)
  })

  test('should list all files', () => {
    // Arrange
    fs.write('file1.ts', 'content1')
    fs.write('file2.ts', 'content2')

    // Act
    const files = fs.listFiles()

    // Assert
    expect(files).toHaveLength(2)
    expect(files).toContain('file1.ts')
    expect(files).toContain('file2.ts')
  })

  test('should clear all files', () => {
    // Arrange
    fs.write('file1.ts', 'content1')
    fs.write('file2.ts', 'content2')

    // Act
    fs.clear()

    // Assert
    expect(fs.listFiles()).toHaveLength(0)
  })
})

describe('MockConfigLoader', () => {
  let loader: MockConfigLoader

  beforeEach(() => {
    loader = new MockConfigLoader()
  })

  test('should store and retrieve configs', () => {
    // Arrange
    const eslintConfig = { rules: { semi: 'error' } }

    // Act
    loader.setConfig('eslint', eslintConfig)

    // Assert
    expect(loader.getConfig('eslint')).toEqual(eslintConfig)
  })

  test('should return undefined for unknown configs', () => {
    // Assert
    expect(loader.getConfig('unknown')).toBeUndefined()
  })

  test('should load ESLint config with defaults', () => {
    // Act
    const config = loader.loadESLintConfig()

    // Assert
    expect(config).toEqual({ rules: {} })
  })

  test('should load Prettier config with defaults', () => {
    // Act
    const config = loader.loadPrettierConfig()

    // Assert
    expect(config).toEqual({ semi: true })
  })

  test('should load TypeScript config with defaults', () => {
    // Act
    const config = loader.loadTypeScriptConfig()

    // Assert
    expect(config).toEqual({ compilerOptions: { strict: true } })
  })

  test('should override defaults when config is set', () => {
    // Arrange
    const customConfig = { customRule: true }
    loader.setConfig('eslint', customConfig)

    // Act
    const config = loader.loadESLintConfig()

    // Assert
    expect(config).toEqual(customConfig)
  })

  test('should clear all configs', () => {
    // Arrange
    loader.setConfig('eslint', { test: true })
    loader.setConfig('prettier', { test: true })

    // Act
    loader.clear()

    // Assert
    expect(loader.getConfig('eslint')).toBeUndefined()
    expect(loader.getConfig('prettier')).toBeUndefined()
  })
})

describe('MockReadable', () => {
  test('should read data set via constructor', () => {
    return new Promise<void>((resolve) => {
      // Arrange
      const readable = new MockReadable('test data')
      let result = ''

      // Act
      readable.on('data', (chunk) => {
        result += chunk
      })

      readable.on('end', () => {
        // Assert
        expect(result).toBe('test data')
        resolve()
      })
    })
  })

  test('should read data set via setData', () => {
    return new Promise<void>((resolve) => {
      // Arrange
      const readable = new MockReadable()
      readable.setData('new data')
      let result = ''

      // Act
      readable.on('data', (chunk) => {
        result += chunk
      })

      readable.on('end', () => {
        // Assert
        expect(result).toBe('new data')
        resolve()
      })
    })
  })
})

describe('MockWritable', () => {
  test('should capture written data', () => {
    // Arrange
    const writable = new MockWritable()

    // Act
    writable.write('test ')
    writable.write('data')

    // Assert
    expect(writable.getOutput()).toBe('test data')
  })

  test('should clear output', () => {
    // Arrange
    const writable = new MockWritable()
    writable.write('test')

    // Act
    writable.clear()

    // Assert
    expect(writable.getOutput()).toBe('')
  })
})

describe('Test Environment Setup', () => {
  test('should setup and teardown environment', () => {
    // Act
    const env = setupTestEnvironment()

    // Assert
    expect(process.env.CLAUDE_HOOK_DISABLED).toBe('true')
    expect(env.stdin).toBeDefined()
    expect(env.stdout).toBeDefined()
    expect(env.stderr).toBeDefined()
    expect(env.processExit).toBeDefined()

    // Cleanup
    teardownTestEnvironment(env)
    expect(process.env.CLAUDE_HOOK_DISABLED).toBeUndefined()
  })

  test('should capture process.exit without throwing', () => {
    // Arrange
    const env = setupTestEnvironment()

    // Act
    process.exit(42)

    // Assert
    expect(getTestExitCode()).toBe(42)

    // Cleanup
    teardownTestEnvironment(env)
  })

  test('should handle different exit code types', () => {
    // Arrange
    const env = setupTestEnvironment()

    // Test number
    process.exit(1)
    expect(getTestExitCode()).toBe(1)

    // Test string
    process.exit('2' as any)
    expect(getTestExitCode()).toBe(2)

    // Test null
    process.exit(null as any)
    expect(getTestExitCode()).toBe(1)

    // Test undefined
    process.exit(undefined as any)
    expect(getTestExitCode()).toBe(0)

    // Cleanup
    teardownTestEnvironment(env)
  })
})

describe('Test Payload Creation', () => {
  test('should create valid Write payload', () => {
    // Act
    const payload = createTestPayload('Write', 'test.ts', 'const x = 1')

    // Assert
    const parsed = JSON.parse(payload)
    expect(parsed.tool_name).toBe('Write')
    expect(parsed.tool_input.file_path).toBe('test.ts')
    expect(parsed.tool_input.content).toBe('const x = 1')
  })

  test('should create valid Edit payload without content', () => {
    // Act
    const payload = createTestPayload('Edit', 'test.ts')

    // Assert
    const parsed = JSON.parse(payload)
    expect(parsed.tool_name).toBe('Edit')
    expect(parsed.tool_input.file_path).toBe('test.ts')
    expect(parsed.tool_input.content).toBeUndefined()
  })
})

describe('Mock Environment Integration', () => {
  test('should create complete mock environment', () => {
    // Act
    const env = createMockEnvironment()

    // Assert
    expect(env.qualityChecker).toBeDefined()
    expect(env.fileSystem).toBeDefined()
    expect(env.configLoader).toBeDefined()
    expect(env.stdin).toBeDefined()
    expect(env.stdout).toBeDefined()
    expect(env.stderr).toBeDefined()
    expect(env.processExit).toBeDefined()

    // Cleanup
    teardownTestEnvironment(env)
  })

  test('should setup standard test environment', () => {
    // Act
    const env = standardTestSetup()

    // Assert
    expect(process.env.CLAUDE_HOOK_DISABLED).toBe('true')
    expect(process.env.CLAUDE_HOOK_SILENT).toBe('true')
    expect(process.env.NODE_ENV).toBe('test')

    // Cleanup
    standardTestTeardown(env)
  })

  test('should teardown standard test environment', () => {
    // Arrange
    const env = standardTestSetup()
    env.fileSystem.write('test.ts', 'content')
    env.qualityChecker.setPredefinedResult('test.ts', {
      filePath: 'test.ts',
      success: true,
      issues: [],
    })
    env.configLoader.setConfig('test', {})

    // Act
    standardTestTeardown(env)

    // Assert
    expect(env.fileSystem.listFiles()).toHaveLength(0)
    expect(process.env.CLAUDE_HOOK_DISABLED).toBeUndefined()
  })
})
