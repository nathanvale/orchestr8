# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-09-03-quality-check-extraction/spec.md

> Created: 2025-09-03  
> Version: 2.0.0

## Test Coverage Strategy

### End-to-End Integration Tests Only

Following Voice Vault patterns, this package focuses exclusively on end-to-end
integration tests that validate the complete Claude Code PostToolUse hook
workflow with correlation ID tracking.

**No Unit Tests Required** - The package architecture is intentionally simple
with minimal abstractions to reduce maintenance overhead and testing complexity.

## Integration Test Categories

### 1. Claude Code Hook Integration Tests

**Purpose:** Validate complete PostToolUse hook workflow from JSON input to
validation output

#### Hook Input Format Validation

```typescript
describe('Claude Code PostToolUse Integration', () => {
  test('handles production format with file_path', async () => {
    const input = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: '/project/root',
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: '/project/src/component.tsx',
        content: 'export function Button() { return <div>Click</div> }',
      },
      tool_response: {
        filePath: '/project/src/component.tsx',
        success: true,
      },
    }

    const result = await runQualityCheckHook(input)
    expect(result.correlationId).toMatch(/^qc-[a-z0-9]{6}-[a-z0-9]{6}$/)
    expect(result.exitCode).toBe(0)
  })

  test('handles legacy format with data.file_path', async () => {
    const input = {
      type: 'PostToolUse',
      data: {
        file_path: '/project/src/utils.ts',
      },
    }

    const result = await runQualityCheckHook(input)
    expect(result.correlationId).toMatch(/^qc-[a-z0-9]{6}-[a-z0-9]{6}$/)
    expect(result.exitCode).toBe(0)
  })
})
```

#### File Path Extraction Tests

```typescript
describe('File Path Extraction', () => {
  test('extracts file_path from Claude Code production format', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      tool_input: { file_path: '/src/component.tsx' },
    }

    expect(extractFilePath(input)).toBe('/src/component.tsx')
  })

  test('extracts path from tool_input alternative', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      tool_input: { path: '/src/utils.ts' },
    }

    expect(extractFilePath(input)).toBe('/src/utils.ts')
  })

  test('extracts notebook_path for Jupyter files', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      tool_input: { notebook_path: '/src/analysis.ipynb' },
    }

    expect(extractFilePath(input)).toBe('/src/analysis.ipynb')
  })

  test('handles legacy test format', () => {
    const input = {
      type: 'PostToolUse',
      data: { file_path: '/src/legacy.ts' },
    }

    expect(extractFilePath(input)).toBe('/src/legacy.ts')
  })

  test('returns null for invalid input', () => {
    expect(extractFilePath({})).toBe(null)
    expect(extractFilePath({ type: 'InvalidType' })).toBe(null)
  })
})
```

### 2. Quality Checker Integration Tests

**Purpose:** Validate ESLint, Prettier, and TypeScript checking with auto-fix
capabilities

#### ESLint Integration Tests

```typescript
describe('ESLint Quality Checking', () => {
  test('validates TypeScript file with no errors', async () => {
    const filePath = await createTempFile(`
      export function add(a: number, b: number): number {
        return a + b
      }
    `)

    const result = await runEslintCheck(filePath)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.autoFixes).toHaveLength(0)
  })

  test('fixes common ESLint issues automatically', async () => {
    const filePath = await createTempFile(`
      const unused = 'variable'
      export function test( ) {
        console.log("hello world")
      }
    `)

    const result = await runEslintCheck(filePath)
    expect(result.autoFixes.length).toBeGreaterThan(0)
    expect(result.autoFixes).toContain('Removed unused variable')
    expect(result.autoFixes).toContain('Fixed spacing in function parameters')
  })

  test('reports unfixable ESLint errors', async () => {
    const filePath = await createTempFile(`
      export function broken(): string {
        return 42 // Type error
      }
    `)

    const result = await runEslintCheck(filePath)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain(
      "Type 'number' is not assignable to type 'string'",
    )
  })
})
```

#### Prettier Integration Tests

```typescript
describe('Prettier Code Formatting', () => {
  test('formats unformatted TypeScript code', async () => {
    const filePath = await createTempFile(`
      export   function    messy(param:string,other:number){
      return{value:param,count:other}}
    `)

    const result = await runPrettierCheck(filePath)
    expect(result.autoFixes).toHaveLength(1)
    expect(result.autoFixes[0]).toBe('Applied Prettier formatting')

    const formattedContent = await readFile(filePath, 'utf-8')
    expect(formattedContent).toContain(
      'export function messy(param: string, other: number) {',
    )
  })

  test('skips already formatted files', async () => {
    const filePath = await createTempFile(`
      export function clean(param: string, other: number) {
        return { value: param, count: other }
      }
    `)

    const result = await runPrettierCheck(filePath)
    expect(result.autoFixes).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })
})
```

#### TypeScript Integration Tests

```typescript
describe('TypeScript Type Checking', () => {
  test('validates correct TypeScript types', async () => {
    const filePath = await createTempFile(`
      interface User {
        name: string
        age: number
      }

      export function greet(user: User): string {
        return \`Hello, \${user.name}!\`
      }
    `)

    const result = await runTypescriptCheck(filePath)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  test('reports TypeScript type errors', async () => {
    const filePath = await createTempFile(`
      interface User {
        name: string
        age: number
      }

      export function greet(user: User): string {
        return user.invalidProperty // Error
      }
    `)

    const result = await runTypescriptCheck(filePath)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain(
      "Property 'invalidProperty' does not exist",
    )
  })

  test('uses compile cache for performance', async () => {
    const filePath = await createTempFile(`
      export const test = 'cache performance test'
    `)

    const startTime = Date.now()
    await runTypescriptCheck(filePath)
    const firstRun = Date.now() - startTime

    const startTime2 = Date.now()
    await runTypescriptCheck(filePath)
    const secondRun = Date.now() - startTime2

    // Second run should be significantly faster due to cache
    expect(secondRun).toBeLessThan(firstRun * 0.5)
  })
})
```

### 3. Performance Integration Tests

**Purpose:** Validate <2s execution time target and performance optimizations

#### Performance Benchmarks

```typescript
describe('Performance Requirements', () => {
  test('completes full validation in under 2 seconds', async () => {
    const filePath = await createTempFile(`
      import { useState, useEffect } from 'react'

      interface Props {
        initialCount: number
        onCountChange?: (count: number) => void
      }

      export function Counter({ initialCount, onCountChange }: Props): React.JSX.Element {
        const [count, setCount] = useState(initialCount)

        useEffect(() => {
          onCountChange?.(count)
        }, [count, onCountChange])

        return (
          <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(c => c + 1)}>
              Increment
            </button>
          </div>
        )
      }
    `)

    const startTime = Date.now()
    const result = await runQualityChecks(filePath)
    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(2000) // <2s requirement
    expect(result.correlationId).toMatch(/^qc-[a-z0-9]{6}-[a-z0-9]{6}$/)
  })

  test('leverages multithread ESLint for performance', async () => {
    const filePath = await createTempFile(`
      // Large file to test multithread performance
      ${Array.from(
        { length: 100 },
        (_, i) => `
        export function func${i}(param: string): string {
          return param.toUpperCase()
        }
      `,
      ).join('\n')}
    `)

    const startTime = Date.now()
    await runEslintCheck(filePath)
    const duration = Date.now() - startTime

    // Should complete quickly even with large file
    expect(duration).toBeLessThan(1500)
  })
})
```

### 4. Environment Variable Integration Tests

**Purpose:** Validate CLAUDE_PROJECT_DIR and configuration resolution

#### Environment Configuration Tests

```typescript
describe('Environment Variable Integration', () => {
  test('resolves project paths using CLAUDE_PROJECT_DIR', async () => {
    process.env.CLAUDE_PROJECT_DIR = '/test/project/root'

    const resolvedPath = resolveProjectPath('src/component.tsx')
    expect(resolvedPath).toBe('/test/project/root/src/component.tsx')
  })

  test('falls back to process.cwd() when CLAUDE_PROJECT_DIR not set', async () => {
    delete process.env.CLAUDE_PROJECT_DIR

    const resolvedPath = resolveProjectPath('src/component.tsx')
    expect(resolvedPath).toBe(path.resolve(process.cwd(), 'src/component.tsx'))
  })

  test('loads project-specific configuration', async () => {
    process.env.CLAUDE_PROJECT_DIR = '/test/project/root'

    await createConfigFile('/test/project/root/.quality-check.json', {
      eslint: { enabled: false },
      prettier: { enabled: true },
      typescript: { enabled: true, strict: true },
    })

    const config = await loadConfig()
    expect(config.eslintEnabled).toBe(false)
    expect(config.prettierEnabled).toBe(true)
    expect(config.typescriptEnabled).toBe(true)
  })
})
```

### 5. Correlation ID and Logging Tests

**Purpose:** Validate structured logging and correlation ID tracking following
Voice Vault patterns

#### Correlation ID Tests

```typescript
describe('Correlation ID Integration', () => {
  test('generates valid correlation IDs following Voice Vault pattern', () => {
    const correlationId = generateCorrelationId()
    expect(correlationId).toMatch(/^qc-[a-z0-9]{6}-[a-z0-9]{6}$/)
  })

  test('includes correlation ID in all log entries', async () => {
    const logOutput = []
    const mockLogger = createTestLogger(logOutput)

    const filePath = await createTempFile('export const test = "value"')
    await runQualityChecks(filePath, { logger: mockLogger })

    expect(logOutput.length).toBeGreaterThan(0)
    logOutput.forEach((entry) => {
      expect(entry.correlationId).toMatch(/^qc-[a-z0-9]{6}-[a-z0-9]{6}$/)
    })
  })

  test('tracks performance metrics with correlation ID', async () => {
    const logOutput = []
    const mockLogger = createTestLogger(logOutput)

    const filePath = await createTempFile('export const test = "value"')
    await runQualityChecks(filePath, { logger: mockLogger })

    const performanceLog = logOutput.find(
      (entry) => entry.message === 'Quality check completed',
    )
    expect(performanceLog).toBeDefined()
    expect(performanceLog.duration).toBeGreaterThan(0)
    expect(performanceLog.errors).toBe(0)
    expect(performanceLog.warnings).toBe(0)
    expect(performanceLog.autoFixes).toBe(0)
  })
})
```

### 6. CLI Binary Integration Tests

**Purpose:** Validate global NPM package installation and CLI binary
functionality

#### CLI Hook Mode Tests

```typescript
describe('CLI Binary Integration', () => {
  test('handles hook mode with stdin JSON input', async () => {
    const hookInput = {
      hook_event_name: 'PostToolUse',
      tool_input: {
        file_path: await createTempFile('export const test = "value"'),
      },
    }

    const result = await runCliCommand(
      'quality-check --hook',
      JSON.stringify(hookInput),
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('✅')
    expect(result.stdout).toContain('passed all quality checks')
  })

  test('handles file mode with direct file path', async () => {
    const filePath = await createTempFile('export const test = "value"')
    const result = await runCliCommand(`quality-check --file ${filePath}`)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('✅')
  })

  test('reports validation errors with proper exit codes', async () => {
    const filePath = await createTempFile(
      'export function broken(): string { return 42 }',
    )
    const result = await runCliCommand(`quality-check --file ${filePath}`)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('❌')
    expect(result.stderr).toContain(
      "Type 'number' is not assignable to type 'string'",
    )
  })
})
```

### 7. Atomic File Operations Tests

**Purpose:** Validate atomic writes with backup/restore capability

#### Atomic Write Tests

```typescript
describe('Atomic File Operations', () => {
  test('performs atomic write with backup creation', async () => {
    const filePath = await createTempFile('original content')
    const safeOps = new SafeFileOperations(path.dirname(filePath))

    await safeOps.safeAutoFix(filePath, 'modified content')

    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('modified content')

    // Verify backup was cleaned up on success
    const backupDir = path.join(
      path.dirname(filePath),
      '.cache',
      'quality-check',
      'backups',
    )
    const backups = await fs.readdir(backupDir).catch(() => [])
    expect(backups).toHaveLength(0)
  })

  test('restores from backup on write failure', async () => {
    const filePath = await createTempFile('original content')
    const safeOps = new SafeFileOperations(path.dirname(filePath))

    // Simulate write failure
    jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Write failed'))

    await expect(
      safeOps.safeAutoFix(filePath, 'modified content'),
    ).rejects.toThrow('Write failed')

    // Verify original content was restored
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('original content')
  })

  test('handles concurrent file access with locking', async () => {
    const filePath = await createTempFile('initial content')
    const safeOps = new SafeFileOperations(path.dirname(filePath))

    // Attempt concurrent writes
    const write1 = safeOps.safeAutoFix(filePath, 'content 1')
    const write2 = safeOps.safeAutoFix(filePath, 'content 2')

    await Promise.all([write1, write2])

    // One write should win, file should be consistent
    const finalContent = await fs.readFile(filePath, 'utf-8')
    expect(['content 1', 'content 2']).toContain(finalContent)
  })
})
```

### 8. Security Tests

**Purpose:** Validate path traversal prevention, input sanitization, and
resource limits

#### Path Security Tests

```typescript
describe('Security Validations', () => {
  test('prevents path traversal attacks', async () => {
    const validator = new PathValidator('/project/root')

    expect(() => validator.validatePath('../../../etc/passwd')).toThrow(
      'Path traversal detected',
    )

    expect(() =>
      validator.validatePath('/project/root/../../../etc/passwd'),
    ).toThrow('Path traversal detected')

    expect(() => validator.validatePath('./src/../../../etc/passwd')).toThrow(
      'Path traversal detected',
    )
  })

  test('prevents symlink escape attacks', async () => {
    const projectRoot = '/project/root'
    const validator = new PathValidator(projectRoot)

    // Create symlink pointing outside project
    const linkPath = path.join(projectRoot, 'evil-link')
    await fs.symlink('/etc/passwd', linkPath)

    expect(() => validator.validatePath('evil-link')).toThrow(
      'Symlink escape detected',
    )
  })

  test('sanitizes command injection attempts', () => {
    const sanitizer = new InputSanitizer()

    expect(sanitizer.sanitizeCommand('test; rm -rf /')).toBe('test rm -rf /')

    expect(sanitizer.sanitizeCommand('test && malicious')).toBe(
      'test  malicious',
    )

    expect(sanitizer.sanitizeCommand('test`evil`command')).toBe(
      'testevilcommand',
    )
  })

  test('enforces resource limits', async () => {
    const limiter = new ResourceLimiter()

    // Test memory limit enforcement
    const largeOperation = async () => {
      const arrays = []
      for (let i = 0; i < 1000; i++) {
        arrays.push(new Array(1024 * 1024)) // 1MB arrays
      }
    }

    await expect(largeOperation()).rejects.toThrow('Memory limit exceeded')
  })
})
```

### 9. Git Integration Tests

**Purpose:** Validate gitignore respect and pre-commit mode functionality

#### Git-Aware Processing Tests

```typescript
describe('Git Integration', () => {
  test('respects .gitignore patterns', async () => {
    const projectRoot = await createTempProject({
      '.gitignore': 'node_modules/\n*.log\nbuild/',
      'src/valid.ts': 'export const valid = true',
      'node_modules/ignored.ts': 'export const ignored = true',
      'debug.log': 'log content',
    })

    const git = new GitIntegration(projectRoot)

    expect(await git.shouldProcess('src/valid.ts')).toBe(true)
    expect(await git.shouldProcess('node_modules/ignored.ts')).toBe(false)
    expect(await git.shouldProcess('debug.log')).toBe(false)
  })

  test('processes only staged files in pre-commit mode', async () => {
    const projectRoot = await createGitRepo({
      'staged.ts': { content: 'export const staged = true', staged: true },
      'unstaged.ts': { content: 'export const unstaged = true', staged: false },
      'untracked.ts': {
        content: 'export const untracked = true',
        staged: false,
      },
    })

    const git = new GitIntegration(projectRoot)
    const files = await git.getStagedFiles()

    expect(files).toContain('staged.ts')
    expect(files).not.toContain('unstaged.ts')
    expect(files).not.toContain('untracked.ts')
  })
})
```

### 10. Exit Code Tests

**Purpose:** Validate exit code communication strategy with Claude Code

#### Exit Code Validation Tests

```typescript
describe('Exit Code Strategy', () => {
  test('returns 0 for successful validation', async () => {
    const filePath = await createTempFile('export const valid = true')
    const result = await runQualityChecks(filePath)

    expect(result.exitCode).toBe(0)
  })

  test('returns 1 for validation errors', async () => {
    const filePath = await createTempFile(
      'export function broken(): string { return 42 }',
    )
    const result = await runQualityChecks(filePath)

    expect(result.exitCode).toBe(1)
  })

  test('returns 2 for configuration errors', async () => {
    await createConfigFile('.quality-check.json', '{ invalid json')
    const result = await runQualityChecks('test.ts')

    expect(result.exitCode).toBe(2)
  })

  test('returns 3 for file not found', async () => {
    const result = await runQualityChecks('/non/existent/file.ts')

    expect(result.exitCode).toBe(3)
  })

  test('returns 4 for unsupported file type', async () => {
    const filePath = await createTempFile('.test { color: red }', '.css')
    const result = await runQualityChecks(filePath)

    expect(result.exitCode).toBe(4)
  })

  test('returns 5 for resource/timeout errors', async () => {
    const filePath = await createTempFile('export const test = true')
    process.env.QUALITY_CHECK_TIMEOUT = '1' // 1ms timeout

    const result = await runQualityChecks(filePath)

    expect(result.exitCode).toBe(5)
  })

  test('returns 124 for timeout/termination', async () => {
    const filePath = await createTempFile(
      Array(10000).fill('export const test = true').join('\n'),
    )

    // Simulate termination signal
    const promise = runQualityChecks(filePath)
    setTimeout(() => process.kill(process.pid, 'SIGTERM'), 100)

    const result = await promise
    expect(result.exitCode).toBe(124)
  })
})
```

### 11. File Type Support Tests

**Purpose:** Validate supported file types and graceful handling of unsupported
files

#### File Type Validation Tests

```typescript
describe('File Type Support', () => {
  test('processes TypeScript files (.ts, .tsx)', async () => {
    const tsFile = await createTempFile(
      'export const value: string = "test"',
      '.ts',
    )
    const tsxFile = await createTempFile(
      'export function App(): React.JSX.Element { return <div>Test</div> }',
      '.tsx',
    )

    expect(isSupportedFile(tsFile)).toBe(true)
    expect(isSupportedFile(tsxFile)).toBe(true)
  })

  test('processes JavaScript files (.js, .jsx)', async () => {
    const jsFile = await createTempFile('export const value = "test"', '.js')
    const jsxFile = await createTempFile(
      'export function App() { return <div>Test</div> }',
      '.jsx',
    )

    expect(isSupportedFile(jsFile)).toBe(true)
    expect(isSupportedFile(jsxFile)).toBe(true)
  })

  test('skips unsupported file types gracefully', async () => {
    const cssFile = await createTempFile('.test { color: red; }', '.css')
    const result = await runQualityChecks(cssFile)

    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('Unsupported file type')
  })

  test('handles missing files gracefully', async () => {
    const result = await runQualityChecks('/non/existent/file.ts')

    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('File not found')
  })
})
```

## Test Utilities and Helpers

### Mock File System

```typescript
export async function createTempFile(
  content: string,
  extension = '.tsx',
): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'quality-check-test-'),
  )
  const filePath = path.join(tempDir, `test${extension}`)
  await fs.writeFile(filePath, content, 'utf-8')
  return filePath
}

export async function createConfigFile(
  configPath: string,
  config: object,
): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
}
```

### Test Logger

```typescript
export function createTestLogger(
  output: any[],
): ReturnType<typeof createLogger> {
  return {
    info: (message: string, meta?: object) => {
      output.push({ level: 'info', message, ...meta })
    },
    error: (message: string, meta?: object) => {
      output.push({ level: 'error', message, ...meta })
    },
    warn: (message: string, meta?: object) => {
      output.push({ level: 'warn', message, ...meta })
    },
    debug: (message: string, meta?: object) => {
      output.push({ level: 'debug', message, ...meta })
    },
  }
}
```

### CLI Test Helper

```typescript
export async function runCliCommand(
  command: string,
  stdin?: string,
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    if (stdin) {
      child.stdin.write(stdin)
      child.stdin.end()
    }

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })
  })
}
```

## Test Execution Strategy

### CI/CD Pipeline Tests

- Run all integration tests on Node.js 20 LTS
- Test with both Linux and macOS environments
- Validate NPM global package installation
- Test CLI binary functionality in clean environments
- Verify correlation ID uniqueness across concurrent runs

### Performance Test Thresholds

- **Individual file validation**: <2s (hard requirement)
- **ESLint multithread performance**: 30-60% improvement over single-thread
- **TypeScript cache hit rate**: >85% on repeated validations
- **Prettier cache effectiveness**: Skip formatting on unchanged files

### Coverage Requirements

- **End-to-End Integration**: 100% of core workflows covered
- **Error Scenarios**: All error paths tested with proper correlation IDs
- **Performance Edge Cases**: Large files, concurrent execution, cache scenarios
- **CLI Integration**: All command-line interfaces and modes tested

## Migration Tests

### Claude Hooks Migration Tests

```typescript
describe('Migration from claude-hooks', () => {
  test('handles legacy claude-hooks configuration', async () => {
    const legacyConfig = {
      quality_check: {
        eslint: true,
        prettier: true,
        typescript: true,
        auto_fix: true,
      },
    }

    await createConfigFile('.claude-hooks.json', legacyConfig)
    const config = await loadConfig()

    expect(config.eslintEnabled).toBe(true)
    expect(config.prettierEnabled).toBe(true)
    expect(config.typescriptEnabled).toBe(true)
    expect(config.autoFix).toBe(true)
  })

  test('migrates claude-hooks cache directory', async () => {
    const oldCacheDir = '.cache/claude-hooks/quality-check'
    const newCacheDir = '.cache/quality-check'

    await fs.mkdir(oldCacheDir, { recursive: true })
    await fs.writeFile(path.join(oldCacheDir, 'cache.json'), '{}', 'utf-8')

    await migrateCache()

    expect(await fs.access(newCacheDir)).toBe(undefined)
    expect(
      await fs.readFile(path.join(newCacheDir, 'cache.json'), 'utf-8'),
    ).toBe('{}')
  })
})
```

## Success Criteria

1. **Complete Hook Integration**: All Claude Code PostToolUse formats handled
   correctly
2. **Performance Target Met**: <2s execution time for typical TypeScript files
3. **Correlation ID Traceability**: All operations tracked with unique
   correlation IDs
4. **Auto-fix Capability**: ESLint and Prettier fixes applied automatically
5. **Error Reporting**: Clear, actionable error messages with proper exit codes
6. **Environment Integration**: CLAUDE_PROJECT_DIR and configuration resolution
   working
7. **NPM Distribution**: Global package installation and CLI binary
   functionality verified

## Excluded from Testing

- **Unit Tests**: Intentionally excluded to reduce maintenance overhead
- **Complex Mock Scenarios**: Focus on real file system operations
- **Multi-file Validation**: Package designed for single file checking only
- **UI/Browser Testing**: CLI-only package with no browser components
- **Legacy Node.js Versions**: Support limited to Node.js 20 LTS+
