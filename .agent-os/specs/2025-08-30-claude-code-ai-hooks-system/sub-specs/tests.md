# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/spec.md

> Created: 2025-08-30 Version: 1.0.0

## Test Strategy Overview

### Testing Pyramid Structure

- **Unit Tests (70%)**: Core validation logic, formatters, parsers
- **Integration Tests (25%)**: Hook handlers, tool integrations, CLI commands
- **End-to-End Tests (5%)**: Complete Claude Code integration workflows

### Test Framework Configuration

- **Primary Framework**: Vitest for all TypeScript testing
- **Test Environment**: Node.js with jsdom for DOM testing if needed
- **Mocking Strategy**: Minimal mocking, prefer real implementations with
  fixtures
- **Coverage Target**: >90% line coverage, >85% branch coverage

## Unit Tests

### Core Validation Engine Tests

**File**: `src/validators/__tests__/eslint-validator.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ESLintValidator } from '../eslint-validator'
import { createMockESLintResult } from '../../__fixtures__/eslint-fixtures'

describe('ESLintValidator', () => {
  let validator: ESLintValidator

  beforeEach(() => {
    validator = new ESLintValidator()
  })

  test('validates TypeScript file with ESLint errors', async () => {
    const filePath = 'src/app.ts'
    const mockResult = createMockESLintResult([
      {
        line: 23,
        column: 5,
        ruleId: 'no-unused-vars',
        severity: 2,
        message: 'Variable is unused',
      },
    ])

    vi.mocked(validator.runESLint).mockResolvedValueOnce(mockResult)

    const result = await validator.validateFile(filePath)

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toEqual({
      f: filePath,
      l: 23,
      c: 5,
      r: 'no-unused-vars',
      s: 2,
      m: 'Variable is unused',
    })
    expect(result.summary.errors).toBe(1)
    expect(result.summary.warnings).toBe(0)
  })

  test('handles ESLint configuration errors gracefully', async () => {
    const filePath = 'src/invalid.ts'

    vi.mocked(validator.runESLint).mockRejectedValueOnce(
      new Error('Configuration error'),
    )

    const result = await validator.validateFile(filePath)

    expect(result.issues).toHaveLength(0)
    expect(result.error).toBe('Configuration error')
    expect(result.tool).toBe('eslint')
  })

  test('formats auto-fixable issues correctly', async () => {
    const mockResult = createMockESLintResult([
      {
        line: 15,
        column: 10,
        ruleId: 'prefer-const',
        severity: 1,
        message: 'Use const instead of let',
        fix: { range: [10, 13], text: 'const' },
      },
    ])

    vi.mocked(validator.runESLint).mockResolvedValueOnce(mockResult)

    const result = await validator.validateFile('test.ts')

    expect(result.issues[0].fix).toBe('const')
    expect(result.summary.fixes).toBe(1)
  })

  test('categorizes issues by type', async () => {
    const mockResult = createMockESLintResult([
      { ruleId: 'no-unused-vars', severity: 2, message: 'Variable unused' },
      { ruleId: 'eqeqeq', severity: 2, message: 'Use ===' },
      { ruleId: 'semi', severity: 1, message: 'Missing semicolon' },
    ])

    vi.mocked(validator.runESLint).mockResolvedValueOnce(mockResult)

    const result = await validator.validateFile('test.ts')

    expect(result.issues.find((i) => i.cat === 'logic')).toBeDefined()
    expect(result.issues.find((i) => i.cat === 'style')).toBeDefined()
  })
})
```

### Token-Optimized Formatters Tests

**File**: `src/formatters/__tests__/ai-compact.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import { AICompactFormatter } from '../ai-compact'
import { createValidationResult } from '../../__fixtures__/validation-fixtures'

describe('AICompactFormatter', () => {
  test('generates token-efficient JSON output', () => {
    const input = createValidationResult({
      issues: [
        {
          file: 'src/very-long-filename-that-should-be-truncated.ts',
          line: 123,
          column: 45,
          ruleId: 'no-unused-vars',
          severity: 2,
          message:
            'This is a very long error message that should be truncated to stay within token limits',
        },
      ],
    })

    const formatter = new AICompactFormatter()
    const result = formatter.format(input)

    expect(result.issues[0]).toEqual({
      f: 'src/very-long-filename-that-should-be-truncated.ts',
      l: 123,
      c: 45,
      r: 'no-unused-vars',
      s: 2,
      m: 'This is a very long error message that should be truncated to stay within token limits',
    })

    // Verify token efficiency
    const jsonSize = JSON.stringify(result).length
    const originalSize = JSON.stringify(input).length
    expect(jsonSize).toBeLessThan(originalSize * 0.6) // >40% reduction
  })

  test('truncates long messages appropriately', () => {
    const longMessage = 'A'.repeat(300) // 300 character message
    const input = createValidationResult({
      issues: [{ message: longMessage, severity: 1 }],
    })

    const formatter = new AICompactFormatter()
    const result = formatter.format(input)

    expect(result.issues[0].m.length).toBeLessThanOrEqual(150)
    expect(result.issues[0].m).toMatch(/\.\.\.$/) // Ends with ellipsis
  })
})
```

### Baseline Tracking Tests

**File**: `src/baseline/__tests__/tracker.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { BaselineTracker } from '../tracker'
import { createValidationResult } from '../../__fixtures__/validation-fixtures'
import { promises as fs } from 'fs'

describe('BaselineTracker', () => {
  let tracker: BaselineTracker
  const tempDir = '.test-baseline'

  beforeEach(async () => {
    tracker = new BaselineTracker(tempDir)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('creates initial baseline from validation results', async () => {
    const results = createValidationResult({
      issues: [
        { file: 'app.ts', line: 10, ruleId: 'no-console', severity: 1 },
        { file: 'utils.ts', line: 25, ruleId: 'prefer-const', severity: 1 },
      ],
    })

    await tracker.updateBaseline(results)

    const baseline = await tracker.getBaseline()
    expect(baseline.totalIssues).toBe(2)
    expect(baseline.issuesByFile['app.ts']).toBe(1)
    expect(baseline.issuesByFile['utils.ts']).toBe(1)
  })

  test('compares current results against baseline', async () => {
    const baselineResults = createValidationResult({
      issues: [
        { file: 'app.ts', line: 10, ruleId: 'no-console', severity: 1 },
        { file: 'utils.ts', line: 25, ruleId: 'prefer-const', severity: 1 },
      ],
    })
    await tracker.updateBaseline(baselineResults)

    const currentResults = createValidationResult({
      issues: [
        { file: 'app.ts', line: 10, ruleId: 'no-console', severity: 1 }, // Same issue
        { file: 'app.ts', line: 15, ruleId: 'no-unused-vars', severity: 2 }, // New issue
        // utils.ts issue resolved
      ],
    })

    const comparison = await tracker.compareWithBaseline(currentResults)

    expect(comparison.newIssues).toBe(1)
    expect(comparison.resolvedIssues).toBe(1)
    expect(comparison.unchangedIssues).toBe(1)
    expect(comparison.trend).toBe('stable') // Same total count
  })

  test('calculates quality trends correctly', async () => {
    const baseline = createValidationResult({ issues: Array(10).fill({}) })
    await tracker.updateBaseline(baseline)

    const improved = createValidationResult({ issues: Array(5).fill({}) })
    const comparison = await tracker.compareWithBaseline(improved)

    expect(comparison.trend).toBe('improving')
    expect(comparison.percentageChange).toBe(-50)
  })
})
```

## Integration Tests

### Hook Handler Integration Tests

**File**: `src/handlers/__tests__/post-tool-handler.integration.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

describe('PostToolUse Hook Handler Integration', () => {
  const tempDir = './test-project'
  const hookCommand = 'node dist/cli.js post-edit'

  beforeEach(async () => {
    await mkdir(tempDir, { recursive: true })

    // Create minimal project structure
    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        devDependencies: { eslint: '^9.0.0' },
      }),
    )

    await writeFile(
      path.join(tempDir, '.eslintrc.json'),
      JSON.stringify({
        env: { node: true },
        rules: { 'no-unused-vars': 'error' },
      }),
    )

    // Test file with ESLint error
    await writeFile(
      path.join(tempDir, 'test.js'),
      `
      const unused = 'variable';
      console.log('hello');
    `,
    )
  })

  test('processes PostToolUse Write events and provides Claude feedback', async () => {
    const hookInput = {
      session_id: 'test-session',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: tempDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(tempDir, 'test.js'),
        content: 'const unused = "variable";\nconsole.log("hello");',
      },
      tool_response: {
        success: true,
        filePath: path.join(tempDir, 'test.js'),
      },
    }

    const { stdout, stderr } = await execAsync(hookCommand, {
      input: JSON.stringify(hookInput),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tempDir },
    })

    expect(stderr).toBe('') // No error output

    const response = JSON.parse(stdout)
    expect(response).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: expect.stringContaining('no-unused-vars'),
      },
    })
    expect(response.hookSpecificOutput.additionalContext).toMatch(
      /Variable 'unused' is defined but never used/,
    )
  })

  test('handles files with no validation issues', async () => {
    await writeFile(path.join(tempDir, 'clean.js'), 'console.log("hello");')

    const hookInput = {
      session_id: 'test-session',
      cwd: tempDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: path.join(tempDir, 'clean.js') },
      tool_response: { success: true },
    }

    const { stdout, stderr } = await execAsync(hookCommand, {
      input: JSON.stringify(hookInput),
    })

    expect(stderr).toBe('')
    expect(stdout.trim()).toBe('') // No output for clean files
  })

  test('times out appropriately for long-running validations', async () => {
    // Create large file that will take time to validate
    const largeContent = 'console.log("line");\n'.repeat(10000)
    await writeFile(path.join(tempDir, 'large.js'), largeContent)

    const hookInput = {
      session_id: 'test-session',
      cwd: tempDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: path.join(tempDir, 'large.js') },
    }

    const start = Date.now()
    const { stderr } = await execAsync(`timeout 6s ${hookCommand}`, {
      input: JSON.stringify(hookInput),
    }).catch((error) => ({ stderr: error.stderr || 'timeout' }))

    const duration = Date.now() - start
    expect(duration).toBeLessThan(7000) // Should timeout before 7s
  }, 10000)
})
```

### CLI Command Integration Tests

**File**: `src/cli/__tests__/commands.integration.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

describe('CLI Commands Integration', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'claude-hooks-test-'))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('init command creates proper Claude settings configuration', async () => {
    await writeFile(
      'package.json',
      JSON.stringify({
        devDependencies: { eslint: '^9.0.0', prettier: '^3.0.0' },
      }),
    )

    const output = execSync('npx snapcheck init --auto-detect', {
      encoding: 'utf-8',
    })

    expect(output).toContain('✓ Detected ESLint configuration')
    expect(output).toContain('✓ Detected Prettier configuration')
    expect(output).toContain('✓ Created .claude/settings.json')

    // Verify settings file content
    const settings = await import(path.join(tempDir, '.claude/settings.json'))
    expect(settings.hooks.PostToolUse).toBeDefined()
    expect(settings.hooks.PostToolUse[0].matcher).toBe('Write|Edit|MultiEdit')
  })

  test('validate command processes project files correctly', async () => {
    await writeFile(
      '.eslintrc.json',
      JSON.stringify({
        rules: { 'no-unused-vars': 'error' },
      }),
    )
    await writeFile('test.js', 'const unused = "variable";')

    const output = execSync('npx snapcheck validate --format=claude', {
      encoding: 'utf-8',
    })

    expect(output).toContain('Found 1 validation issue')
    expect(output).toContain('no-unused-vars')
    expect(output).toContain('test.js:1:7')
  })

  test('status command shows tool detection results', async () => {
    await writeFile('tsconfig.json', JSON.stringify({ compilerOptions: {} }))
    await writeFile('vitest.config.ts', 'export default {}')

    const output = execSync('npx snapcheck status --json', {
      encoding: 'utf-8',
    })
    const status = JSON.parse(output)

    expect(status.tools.typescript.enabled).toBe(true)
    expect(status.tools.vitest.enabled).toBe(true)
    expect(status.enabled).toBe(true)
  })
})
```

## End-to-End Tests

### Complete Claude Code Integration Tests

**File**: `__tests__/e2e/claude-code-integration.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { spawn, ChildProcess } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

describe('Claude Code Hook Integration E2E', () => {
  let mockClaudeProcess: ChildProcess
  const testProject = './e2e-test-project'

  beforeAll(async () => {
    // Setup test project with Claude hooks
    await mkdir(testProject, { recursive: true })
    await setupTestProject()

    // Start mock Claude Code process
    mockClaudeProcess = spawn('node', ['./test-utils/mock-claude.js'])
  })

  afterAll(() => {
    mockClaudeProcess?.kill()
  })

  test('complete validation workflow with Claude Code', async () => {
    // Simulate Claude Code Write tool usage
    const writeEvent = {
      session_id: 'e2e-test-session',
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(testProject, 'src/app.ts'),
        content:
          'const unused = "variable";\nexport default function App() { return null; }',
      },
      tool_response: { success: true },
    }

    // Send hook event and wait for response
    const response = await simulateHookExecution(writeEvent)

    expect(response).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: expect.stringContaining('ESLint'),
      },
    })

    // Verify Claude receives structured feedback
    expect(response.hookSpecificOutput.additionalContext).toMatch(
      /Variable 'unused' is defined but never used/,
    )
  }, 15000)

  test('session start context injection', async () => {
    const sessionStartEvent = {
      session_id: 'e2e-test-session',
      hook_event_name: 'SessionStart',
      source: 'startup',
    }

    const contextOutput = await simulateHookExecution(sessionStartEvent)

    expect(contextOutput).toContain('Project Validation Status')
    expect(contextOutput).toContain('Tools detected: ESLint, TypeScript')
    expect(contextOutput).toContain('Quick commands available')
  })

  async function setupTestProject() {
    // Create package.json with dev dependencies
    await writeFile(
      path.join(testProject, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        devDependencies: {
          '@claude-hooks/snapcheck': 'latest',
          'eslint': '^9.0.0',
          'typescript': '^5.0.0',
        },
      }),
    )

    // Create ESLint config
    await writeFile(
      path.join(testProject, '.eslintrc.json'),
      JSON.stringify({
        env: { node: true },
        parser: '@typescript-eslint/parser',
        rules: { 'no-unused-vars': 'error' },
      }),
    )

    // Create Claude settings
    await mkdir(path.join(testProject, '.claude'), { recursive: true })
    await writeFile(
      path.join(testProject, '.claude/settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write|Edit|MultiEdit',
              hooks: [
                {
                  type: 'command',
                  command: 'npx snapcheck post-edit',
                  timeout: 30,
                },
              ],
            },
          ],
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'npx snapcheck session-start',
                },
              ],
            },
          ],
        },
      }),
    )
  }

  async function simulateHookExecution(event: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const hookProcess = spawn('npx', ['snapcheck', 'post-edit'], {
        cwd: testProject,
        env: { ...process.env, CLAUDE_PROJECT_DIR: testProject },
      })

      let output = ''
      let error = ''

      hookProcess.stdout?.on('data', (data) => {
        output += data.toString()
      })

      hookProcess.stderr?.on('data', (data) => {
        error += data.toString()
      })

      hookProcess.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(output ? JSON.parse(output) : null)
          } catch {
            resolve(output)
          }
        } else {
          reject(new Error(`Hook failed with code ${code}: ${error}`))
        }
      })

      // Send event data to hook process
      hookProcess.stdin?.write(JSON.stringify(event))
      hookProcess.stdin?.end()
    })
  }
})
```

## Performance Tests

### Validation Speed Tests

**File**: `__tests__/performance/validation-speed.test.ts`

```typescript
import { describe, test, expect } from 'vitest'
import { performance } from 'perf_hooks'
import { ESLintValidator } from '../src/validators/eslint-validator'
import { generateLargeTestFile } from '../test-utils/file-generator'

describe('Validation Performance', () => {
  test('validates typical TypeScript file within ADHD targets (<5s)', async () => {
    const testFile = generateLargeTestFile(500) // 500 lines
    const validator = new ESLintValidator()

    const start = performance.now()
    const result = await validator.validateFile(testFile)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(5000) // <5s requirement
    expect(result.issues.length).toBeGreaterThan(0)
  })

  test('JSON formatting completes within token efficiency targets (<500ms)', async () => {
    const largeResult = createValidationResult({
      issues: Array(100)
        .fill(null)
        .map((_, i) => ({
          file: `file${i}.ts`,
          line: i + 1,
          message: 'Test validation issue',
          severity: 1,
        })),
    })

    const formatter = new AICompactFormatter()

    const start = performance.now()
    const formatted = formatter.format(largeResult)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(500) // <500ms requirement
    expect(JSON.stringify(formatted).length).toBeLessThan(
      JSON.stringify(largeResult).length * 0.6,
    ) // >40% reduction
  })

  test('baseline comparison completes within targets (<200ms)', async () => {
    const tracker = new BaselineTracker('.test-baseline')
    const baselineResult = createValidationResult({
      issues: Array(50).fill({}),
    })
    const currentResult = createValidationResult({ issues: Array(45).fill({}) })

    await tracker.updateBaseline(baselineResult)

    const start = performance.now()
    const comparison = await tracker.compareWithBaseline(currentResult)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(200) // <200ms requirement
    expect(comparison.trend).toBe('improving')
  })
})
```

## Mocking Requirements

### ESLint API Mocking

**File**: `src/__mocks__/eslint.ts`

```typescript
export const ESLint = vi.fn().mockImplementation(() => ({
  lintFiles: vi.fn(),
  lintText: vi.fn(),
  loadFormatter: vi.fn(),
  calculateConfigForFile: vi.fn(),
  isPathIgnored: vi.fn(),
}))
```

### File System Mocking

**File**: `src/__mocks__/fs.ts`

```typescript
import { vi } from 'vitest'

export const promises = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}
```

### Claude Code Hook Input Fixtures

**File**: `src/__fixtures__/hook-inputs.ts`

```typescript
export const createPostToolUseInput = (overrides = {}) => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/test-transcript.jsonl',
  cwd: process.cwd(),
  hook_event_name: 'PostToolUse' as const,
  tool_name: 'Write' as const,
  tool_input: {
    file_path: 'src/test.ts',
    content: 'console.log("test");',
  },
  tool_response: {
    success: true,
    filePath: 'src/test.ts',
  },
  ...overrides,
})

export const createSessionStartInput = (overrides = {}) => ({
  session_id: 'test-session-123',
  transcript_path: '/tmp/test-transcript.jsonl',
  cwd: process.cwd(),
  hook_event_name: 'SessionStart' as const,
  source: 'startup' as const,
  ...overrides,
})
```

## Test Execution Strategy

### Local Development Testing

```bash
# Run all tests with coverage
pnpm test:coverage

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Performance testing
pnpm test:performance

# Watch mode for development
pnpm test:watch
```

### CI/CD Testing Pipeline

```yaml
test-matrix:
  strategy:
    matrix:
      node-version: [20, 21]
      os: [ubuntu-latest, macos-latest, windows-latest]

  steps:
    - name: Unit Tests
      run: pnpm test:unit --coverage

    - name: Integration Tests
      run: pnpm test:integration

    - name: Performance Tests
      run: pnpm test:performance

    - name: E2E Tests (Linux only)
      if: matrix.os == 'ubuntu-latest'
      run: pnpm test:e2e
```

### Coverage Requirements

- **Minimum Line Coverage**: 90%
- **Minimum Branch Coverage**: 85%
- **Critical Path Coverage**: 100% (hook handlers, formatters, CLI commands)
- **Performance Test Coverage**: All ADHD performance targets validated

This comprehensive test specification ensures the Claude Code AI hooks system is
thoroughly tested across all integration points and performance requirements.
