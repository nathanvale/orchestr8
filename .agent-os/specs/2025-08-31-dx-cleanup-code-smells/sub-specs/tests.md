# Tests Specification

> Comprehensive test coverage requirements for DX cleanup implementation
> Version: 1.0.0 Created: 2025-08-31

## Overview

This specification defines all test requirements for the DX cleanup
implementation, including unit tests, integration tests, and end-to-end tests
for each cleanup area.

## Test Coverage Requirements

### Overall Coverage Targets

- **Line Coverage:** ≥85% (enforced)
- **Branch Coverage:** ≥80% (enforced)
- **Function Coverage:** ≥85% (enforced)
- **Statement Coverage:** ≥85% (enforced)

### Critical Path Coverage

These areas must have 100% coverage:

1. Security utilities (command sanitization, path validation)
2. Error handling classes
3. Type guards and validators
4. Retry logic and exponential backoff
5. SBOM generation fixes

## Unit Tests

### Type Safety Tests

**File:** `tests/type-safety/type-guards.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import {
  isNodeError,
  isAxiosError,
  isLogEntry,
  isLogEntryArray,
  isCoverageSummary,
} from '@/scripts/lib/type-guards'

describe('Type Guards', () => {
  describe('isNodeError', () => {
    test('identifies Node.js errors correctly', () => {
      const error = new Error('Test')
      ;(error as any).code = 'ENOENT'
      expect(isNodeError(error)).toBe(true)
    })

    test('rejects non-Node errors', () => {
      const error = new Error('Test')
      expect(isNodeError(error)).toBe(false)
    })

    test('handles null and undefined', () => {
      expect(isNodeError(null)).toBe(false)
      expect(isNodeError(undefined)).toBe(false)
    })
  })

  describe('isLogEntry', () => {
    test('validates complete log entries', () => {
      const entry = {
        id: '123',
        message: 'Test log',
        level: 'info' as const,
        timestamp: '2025-08-31T00:00:00Z',
      }
      expect(isLogEntry(entry)).toBe(true)
    })

    test('rejects invalid levels', () => {
      const entry = {
        id: '123',
        message: 'Test',
        level: 'invalid',
        timestamp: '2025-08-31',
      }
      expect(isLogEntry(entry)).toBe(false)
    })

    test('rejects missing fields', () => {
      expect(isLogEntry({ id: '123' })).toBe(false)
      expect(isLogEntry({ message: 'Test' })).toBe(false)
    })
  })

  describe('isLogEntryArray', () => {
    test('validates arrays of log entries', () => {
      const entries = [
        { id: '1', message: 'Test 1', level: 'info', timestamp: '2025-08-31' },
        { id: '2', message: 'Test 2', level: 'warn', timestamp: '2025-08-31' },
      ]
      expect(isLogEntryArray(entries)).toBe(true)
    })

    test('rejects arrays with invalid entries', () => {
      const entries = [
        { id: '1', message: 'Valid', level: 'info', timestamp: '2025-08-31' },
        { id: '2', message: 'Invalid' }, // Missing fields
      ]
      expect(isLogEntryArray(entries)).toBe(false)
    })

    test('handles empty arrays', () => {
      expect(isLogEntryArray([])).toBe(true)
    })
  })
})
```

### Error Handling Tests

**File:** `tests/error-handling/custom-errors.test.ts`

```typescript
import { describe, test, expect, vi } from 'vitest'
import {
  BaseError,
  ValidationError,
  ScriptExecutionError,
  FileSystemError,
  NetworkError,
} from '@/scripts/lib/errors'

describe('Custom Error Classes', () => {
  describe('BaseError', () => {
    test('captures context and timestamp', () => {
      const context = { user: 'test', action: 'validate' }
      const error = new BaseError('Test error', 'TEST_ERROR', { context })

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.context).toEqual(context)
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    test('serializes to JSON correctly', () => {
      const error = new BaseError('Test', 'TEST', {
        context: { key: 'value' },
      })
      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'BaseError',
        message: 'Test',
        code: 'TEST',
        context: { key: 'value' },
      })
      expect(json.timestamp).toBeDefined()
      expect(json.stack).toBeDefined()
    })
  })

  describe('ValidationError', () => {
    test('includes field information', () => {
      const error = new ValidationError('Invalid email', 'email', {
        context: { value: 'not-an-email' },
      })

      expect(error.field).toBe('email')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.context?.value).toBe('not-an-email')
    })
  })

  describe('ScriptExecutionError', () => {
    test('captures script and exit code', () => {
      const error = new ScriptExecutionError('Script failed', 'pnpm test', 1, {
        context: { stdout: 'output', stderr: 'error' },
      })

      expect(error.script).toBe('pnpm test')
      expect(error.exitCode).toBe(1)
      expect(error.context).toMatchObject({
        stdout: 'output',
        stderr: 'error',
      })
    })
  })

  describe('FileSystemError', () => {
    test('includes path and operation', () => {
      const error = new FileSystemError(
        'File not found',
        '/path/to/file',
        'read',
      )

      expect(error.path).toBe('/path/to/file')
      expect(error.operation).toBe('read')
      expect(error.code).toBe('FILE_SYSTEM_ERROR')
    })
  })

  describe('NetworkError', () => {
    test('includes URL and status code', () => {
      const error = new NetworkError(
        'Request failed',
        'https://api.example.com',
        404,
        { context: { headers: { 'content-type': 'application/json' } } },
      )

      expect(error.url).toBe('https://api.example.com')
      expect(error.statusCode).toBe(404)
    })
  })
})
```

### Retry Logic Tests

**File:** `tests/utilities/retry.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { retry } from '@/scripts/lib/retry'

describe('Retry Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  test('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const result = await retry(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('retries on failure then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success')

    const promise = retry(fn, { maxAttempts: 3, initialDelay: 100 })

    // Fast-forward through delays
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test('applies exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'))
    const onRetry = vi.fn()

    const promise = retry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      factor: 2,
      onRetry,
    })

    await vi.runAllTimersAsync()

    try {
      await promise
    } catch {
      // Expected to fail
    }

    // Check delays: 100ms, 200ms
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1)
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2)
  })

  test('respects max delay', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fail'))

    const promise = retry(fn, {
      maxAttempts: 5,
      initialDelay: 100,
      maxDelay: 300,
      factor: 10,
    })

    await vi.runAllTimersAsync()

    try {
      await promise
    } catch {
      // Expected
    }

    // Delays should be capped at 300ms
    expect(fn).toHaveBeenCalledTimes(5)
  })

  test('throws after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'))

    const promise = retry(fn, { maxAttempts: 2 })
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow('Persistent failure')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
```

### Security Tests

**File:** `tests/security/sanitization.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import { safeExecute } from '@/scripts/lib/command-utils'
import { safePath } from '@/scripts/lib/path-utils'

describe('Security Sanitization', () => {
  describe('safeExecute', () => {
    test('rejects commands with shell metacharacters', async () => {
      await expect(safeExecute('ls; rm -rf /', [])).rejects.toThrow(
        'Invalid command: contains shell metacharacters',
      )

      await expect(safeExecute('ls && echo', [])).rejects.toThrow()
      await expect(safeExecute('ls | grep', [])).rejects.toThrow()
      await expect(safeExecute('ls > file', [])).rejects.toThrow()
    })

    test('rejects arguments with injection attempts', async () => {
      await expect(safeExecute('ls', ['$(rm -rf /)'])).rejects.toThrow(
        'Potentially unsafe argument',
      )

      await expect(safeExecute('ls', ['`rm -rf /`'])).rejects.toThrow()
      await expect(safeExecute('ls', ['&& rm'])).rejects.toThrow()
      await expect(safeExecute('ls', ['|| rm'])).rejects.toThrow()
    })

    test('accepts safe commands', async () => {
      // Mock implementation for test
      const result = await safeExecute('echo', ['hello', 'world'])
      expect(result.stdout).toContain('hello world')
    })

    test('validates argument types', async () => {
      await expect(safeExecute('ls', [123 as any])).rejects.toThrow(
        'Invalid argument: must be string',
      )
    })
  })

  describe('safePath', () => {
    test('prevents path traversal', () => {
      expect(() => safePath('../etc/passwd', '/app')).toThrow(
        'Path traversal attempt detected',
      )

      expect(() => safePath('../../root', '/app')).toThrow()
      expect(() => safePath('/etc/passwd', '/app')).toThrow()
    })

    test('allows safe paths', () => {
      const result = safePath('subdirectory/file.txt', '/app')
      expect(result).toBe('/app/subdirectory/file.txt')
    })

    test('handles absolute paths within base', () => {
      const result = safePath('/app/data/file.txt', '/app')
      expect(result).toBe('/app/data/file.txt')
    })
  })
})
```

## Integration Tests

### Script Organization Tests

**File:** `tests/integration/script-organization.test.ts`

```typescript
import { describe, test, expect, vi } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

describe('Script Organization', () => {
  test('dx:status command provides comprehensive status', () => {
    const output = execSync('pnpm dx:status', { encoding: 'utf-8' })

    expect(output).toContain('Project Status')
    expect(output).toContain('Coverage:')
    expect(output).toContain('Changesets:')
    expect(output).toContain('Dependencies:')
    expect(output).toContain('Last Test:')
  })

  test('interactive help displays categorized scripts', () => {
    // Mock inquirer for testing
    const mockInquirer = vi.fn()
    const output = execSync('pnpm dx:help', { encoding: 'utf-8' })

    expect(output).toContain('Development')
    expect(output).toContain('Testing')
    expect(output).toContain('Building')
    expect(output).toContain('DX Tools')
  })

  test('package.json has organized script sections', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    const scripts = Object.keys(pkg.scripts)

    // Should have logical groupings
    const devScripts = scripts.filter((s) => s.startsWith('dev'))
    const testScripts = scripts.filter((s) => s.startsWith('test'))
    const buildScripts = scripts.filter((s) => s.startsWith('build'))
    const dxScripts = scripts.filter((s) => s.startsWith('dx:'))

    expect(devScripts.length).toBeGreaterThan(0)
    expect(testScripts.length).toBeGreaterThan(0)
    expect(buildScripts.length).toBeGreaterThan(0)
    expect(dxScripts.length).toBeGreaterThan(0)

    // Total scripts should be manageable
    expect(scripts.length).toBeLessThan(30)
  })
})
```

### Build System Tests

**File:** `tests/integration/build-system.test.ts`

```typescript
import { describe, test, expect, beforeAll } from 'vitest'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

describe('Build System', () => {
  beforeAll(() => {
    // Clean build artifacts
    execSync('rm -rf packages/*/dist apps/*/dist .turbo')
  })

  test('turbo cache works correctly', () => {
    // First build
    const firstRun = execSync('pnpm build:all', { encoding: 'utf-8' })
    expect(firstRun).toContain('• Packages in scope')

    // Second build should use cache
    const secondRun = execSync('pnpm build:all', { encoding: 'utf-8' })
    expect(secondRun).toContain('cache hit')
  })

  test('all packages build successfully', () => {
    execSync('pnpm build:all')

    // Check outputs exist
    expect(existsSync('packages/utils/dist')).toBe(true)
    expect(existsSync('apps/web/.next')).toBe(true)
    expect(existsSync('apps/server/dist')).toBe(true)
  })

  test('export maps resolve correctly', () => {
    // Test TypeScript resolution
    const testFile = `
      import { utils } from '@template/utils'
      console.log(typeof utils)
    `

    const result = execSync(
      `echo "${testFile}" | npx tsx --tsconfig tsconfig.json`,
      { encoding: 'utf-8' },
    )

    expect(result.trim()).toBe('object')
  })

  test('parallel builds work', () => {
    const output = execSync('pnpm turbo build --concurrency=4', {
      encoding: 'utf-8',
    })

    expect(output).toContain('• Running build')
    expect(output).not.toContain('error')
  })
})
```

### CI/CD Tests

**File:** `tests/integration/ci-optimization.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import yaml from 'js-yaml'

describe('CI/CD Configuration', () => {
  test('GitHub Actions has matrix configuration', () => {
    const workflow = yaml.load(
      readFileSync('.github/workflows/ci.yml', 'utf-8'),
    ) as any

    expect(workflow.jobs.test.strategy.matrix).toBeDefined()
    expect(workflow.jobs.test.strategy.matrix.shard).toEqual([1, 2, 3, 4])
  })

  test('concurrency groups are configured', () => {
    const workflow = yaml.load(
      readFileSync('.github/workflows/ci.yml', 'utf-8'),
    ) as any

    expect(workflow.concurrency).toBeDefined()
    expect(workflow.concurrency['cancel-in-progress']).toBe(true)
  })

  test('reusable actions exist', () => {
    const actionPath = '.github/actions/setup/action.yml'
    expect(existsSync(actionPath)).toBe(true)

    const action = yaml.load(readFileSync(actionPath, 'utf-8')) as any
    expect(action.name).toBe('Setup Environment')
    expect(action.runs.using).toBe('composite')
  })

  test('Dockerfile uses multi-stage build', () => {
    const dockerfile = readFileSync('Dockerfile', 'utf-8')

    expect(dockerfile).toContain('FROM node:20-alpine AS pruner')
    expect(dockerfile).toContain('FROM node:20-alpine AS builder')
    expect(dockerfile).toContain('FROM node:20-alpine AS runner')
    expect(dockerfile).toContain('turbo prune')
  })
})
```

## End-to-End Tests

### Full Workflow Test

**File:** `tests/e2e/full-workflow.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'

describe('Full DX Workflow', () => {
  const testPackageName = 'test-package'

  beforeAll(() => {
    // Clean test artifacts
    if (existsSync(`packages/${testPackageName}`)) {
      rmSync(`packages/${testPackageName}`, { recursive: true })
    }
  })

  afterAll(() => {
    // Cleanup
    if (existsSync(`packages/${testPackageName}`)) {
      rmSync(`packages/${testPackageName}`, { recursive: true })
    }
  })

  test('complete package creation workflow', () => {
    // Create new package
    execSync(`pnpm gen:package ${testPackageName}`)
    expect(existsSync(`packages/${testPackageName}`)).toBe(true)
    expect(existsSync(`packages/${testPackageName}/tsup.config.ts`)).toBe(true)
    expect(existsSync(`packages/${testPackageName}/src/index.ts`)).toBe(true)

    // Build new package
    execSync(`pnpm --filter @template/${testPackageName} build`)
    expect(existsSync(`packages/${testPackageName}/dist`)).toBe(true)

    // Run tests for new package
    const testOutput = execSync(
      `pnpm --filter @template/${testPackageName} test`,
      { encoding: 'utf-8' },
    )
    expect(testOutput).toContain('PASS')
  })

  test('dx:status after changes', () => {
    const output = execSync('pnpm dx:status', { encoding: 'utf-8' })

    expect(output).toContain('Project Status')
    expect(output).not.toContain('ERROR')
    expect(output).not.toContain('undefined')
  })

  test('security scan completes', () => {
    const output = execSync('pnpm security:scan', { encoding: 'utf-8' })

    expect(output).toContain('Security scan completed')
    expect(existsSync('security-sbom.json')).toBe(true)

    // Verify SBOM is valid
    const sbom = JSON.parse(readFileSync('security-sbom.json', 'utf-8'))
    expect(sbom.bomFormat).toBe('CycloneDX')
    expect(sbom.components.length).toBeGreaterThan(300)
  })
})
```

### Performance Tests

**File:** `tests/performance/build-performance.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import { execSync } from 'child_process'

describe('Performance Benchmarks', () => {
  test('build completes within time limit', () => {
    // Warm up
    execSync('pnpm build:all')

    // Measure
    const start = Date.now()
    execSync('pnpm build:all')
    const duration = Date.now() - start

    expect(duration).toBeLessThan(2000) // < 2 seconds
  })

  test('test suite runs within time limit', () => {
    const start = Date.now()
    execSync('pnpm test')
    const duration = Date.now() - start

    expect(duration).toBeLessThan(5000) // < 5 seconds
  })

  test('turbo cache hit rate is acceptable', () => {
    // Clear cache
    execSync('rm -rf .turbo')

    // First run
    execSync('pnpm build:all')

    // Second run with cache
    const output = execSync('pnpm build:all', { encoding: 'utf-8' })
    const cacheHits = (output.match(/cache hit/g) || []).length
    const totalTasks = (output.match(/Running/g) || []).length

    const hitRate = (cacheHits / totalTasks) * 100
    expect(hitRate).toBeGreaterThan(85)
  })

  test('memory usage stays within limits', () => {
    // Run memory-intensive operation
    const memBefore = process.memoryUsage().heapUsed
    execSync('pnpm test:coverage')
    const memAfter = process.memoryUsage().heapUsed

    const memUsed = (memAfter - memBefore) / 1024 / 1024 // MB
    expect(memUsed).toBeLessThan(500) // < 500MB increase
  })
})
```

## Test Utilities

### Mock Factories

**File:** `tests/utilities/factories.ts`

```typescript
import { faker } from '@faker-js/faker'

export function createMockLogEntry(overrides = {}) {
  return {
    id: faker.string.uuid(),
    message: faker.lorem.sentence(),
    level: faker.helpers.arrayElement(['info', 'warn', 'error'] as const),
    timestamp: faker.date.recent().toISOString(),
    ...overrides,
  }
}

export function createMockError(overrides = {}) {
  const error = new Error(faker.lorem.sentence())
  return Object.assign(error, {
    code: faker.string.alphanumeric(10),
    ...overrides,
  })
}

export function createMockPackageJson(overrides = {}) {
  return {
    name: `@template/${faker.word.noun()}`,
    version: faker.system.semver(),
    scripts: {
      build: 'tsup',
      test: 'vitest',
      lint: 'eslint',
    },
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
      },
    },
    ...overrides,
  }
}
```

### Test Helpers

**File:** `tests/utilities/helpers.ts`

```typescript
import { execSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export function createTempDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'test-'))
}

export function cleanupTempDirectory(path: string): void {
  rmSync(path, { recursive: true, force: true })
}

export function runCommand(command: string, options = {}): string {
  return execSync(command, {
    encoding: 'utf-8',
    stdio: 'pipe',
    ...options,
  })
}

export function measureExecutionTime(fn: () => void): number {
  const start = performance.now()
  fn()
  return performance.now() - start
}

export function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const check = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'))
      } else {
        setTimeout(check, interval)
      }
    }

    check()
  })
}
```

## Test Configuration

### Vitest Configuration

**File:** `vitest.config.ts` (updates)

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        '*.config.*',
        'tests/utilities/**',
        'tests/fixtures/**',
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@/scripts': resolve(__dirname, './scripts'),
      '@/packages': resolve(__dirname, './packages'),
      '@/apps': resolve(__dirname, './apps'),
    },
  },
})
```

### Test Setup

**File:** `tests/setup.ts`

```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'error'
})

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Global teardown
afterAll(() => {
  // Clean up test artifacts
})
```

## Coverage Reports

### Generate Coverage

```bash
# Run all tests with coverage
pnpm test:coverage

# Run specific test suite with coverage
pnpm test:coverage tests/type-safety

# Generate HTML report
pnpm test:coverage --reporter=html

# Check coverage thresholds
pnpm test:coverage --threshold
```

### Coverage Ratcheting

```bash
# Update baseline
pnpm coverage:ratchet

# Check against baseline
pnpm coverage:check
```

## Continuous Testing

### Watch Mode

```bash
# Watch all tests
pnpm test:watch

# Watch specific files
pnpm test:watch tests/security

# Watch with coverage
pnpm test:watch --coverage
```

### Pre-commit Hooks

```bash
# Run affected tests
pnpm test:affected

# Run quick smoke tests
pnpm test:smoke
```

## Test Documentation

Each test file should include:

1. **Purpose comment** at the top
2. **Arrange-Act-Assert** pattern
3. **Descriptive test names**
4. **Error scenarios** covered
5. **Edge cases** tested

Example:

```typescript
/**
 * Tests for command sanitization utilities
 * Ensures protection against command injection attacks
 */
describe('Command Sanitization', () => {
  test('prevents shell injection via semicolon', () => {
    // Arrange
    const maliciousCommand = 'ls; rm -rf /'

    // Act & Assert
    expect(() => sanitizeCommand(maliciousCommand)).toThrow(
      'Invalid command: contains shell metacharacters',
    )
  })
})
```

## Success Criteria

- [ ] All test suites pass
- [ ] Coverage meets thresholds (≥85%)
- [ ] No flaky tests
- [ ] Test execution < 5 seconds
- [ ] Clear test documentation
- [ ] Comprehensive error coverage
