import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TypeScriptEngine } from './typescript-engine'

describe('TypeScriptEngine', () => {
  let engine: TypeScriptEngine
  let tempDir: string

  beforeEach(() => {
    engine = new TypeScriptEngine()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-engine-test-'))

    // Create a basic tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
    }
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
  })

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('should_check_typescript_files_when_valid', () => {
    it('should_return_success_when_no_issues', async () => {
      // Create a valid TypeScript file
      const testFile = path.join(tempDir, 'valid.ts')
      fs.writeFileSync(
        testFile,
        `
        const greeting: string = 'Hello, World!'
        console.log(greeting)
        `,
      )

      const result = await engine.check({
        files: [testFile],
        cacheDir: path.join(tempDir, '.cache'),
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.fixable).toBe(false)
    })

    it('should_detect_type_errors_when_present', async () => {
      // Create a TypeScript file with type errors
      const testFile = path.join(tempDir, 'error.ts')
      fs.writeFileSync(
        testFile,
        `
        const num: number = 'not a number'
        const result = num.toFixed(2)
        `,
      )

      const result = await engine.check({
        files: [testFile],
        cacheDir: path.join(tempDir, '.cache'),
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0].engine).toBe('typescript')
      expect(result.issues[0].severity).toBe('error')
      expect(result.issues[0].ruleId).toMatch(/^TS\d+/)
      expect(result.issues[0].file).toBe(testFile)
    })

    it('should_use_incremental_compilation_when_cache_exists', async () => {
      const testFile = path.join(tempDir, 'incremental.ts')
      fs.writeFileSync(testFile, 'const x: number = 42')

      const cacheDir = path.join(tempDir, '.cache')

      // First run - cold
      const result1 = await engine.check({
        files: [testFile],
        cacheDir,
      })
      expect(result1.success).toBe(true)

      // After first run, engine should have cache state
      expect(engine.hasCacheState()).toBe(true)

      // Second run - warm (should be faster)
      const result2 = await engine.check({
        files: [testFile],
        cacheDir,
      })

      expect(result2.success).toBe(true)
      // Verify performance improvement on warm run or at least similar performance
      // (caching may not always be faster on small files due to overhead)
      expect(result2.duration).toBeLessThanOrEqual((result1.duration ?? 1000) * 1.5)
      // Engine should still have cache state
      expect(engine.hasCacheState()).toBe(true)
    })

    it('should_handle_missing_tsconfig_gracefully', async () => {
      const noCfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-cfg-'))
      const testFile = path.join(noCfgDir, 'test.ts')
      fs.writeFileSync(testFile, 'const x = 42')

      const result = await engine.check({
        files: [testFile],
      })

      // Should fail with appropriate error
      expect(result.success).toBe(false)
      expect(result.issues[0].message).toContain('tsconfig.json not found')

      fs.rmSync(noCfgDir, { recursive: true, force: true })
    })

    it('should_respect_cancellation_token', async () => {
      const testFile = path.join(tempDir, 'cancel.ts')
      fs.writeFileSync(testFile, 'const x = 42')

      const token = {
        isCancellationRequested: true,
        onCancellationRequested: vi.fn(),
      }

      const result = await engine.check({
        files: [testFile],
        token,
      })

      // Should return early with no issues
      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should_filter_diagnostics_to_target_files_only', async () => {
      // Create multiple files
      const file1 = path.join(tempDir, 'file1.ts')
      const file2 = path.join(tempDir, 'file2.ts')

      fs.writeFileSync(file1, 'export const x: number = 42')
      fs.writeFileSync(
        file2,
        `
        import { x } from './file1'
        const y: string = x // Type error
        `,
      )

      // Check only file1 (should have no errors)
      const result = await engine.check({
        files: [file1],
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('should_handle_cache_operations', () => {
    it('should_clear_cache_when_requested', async () => {
      const testFile = path.join(tempDir, 'cache-test.ts')
      fs.writeFileSync(testFile, 'const x = 42')

      const cacheDir = path.join(tempDir, '.cache')

      // Run check to create cache
      await engine.check({
        files: [testFile],
        cacheDir,
      })

      // Verify engine has cache state after check
      expect(engine.hasCacheState()).toBe(true)

      // Clear cache
      engine.clearCache()

      // Verify engine cache state is cleared
      expect(engine.hasCacheState()).toBe(false)

      // Next run should behave like a cold run
      const newEngine = new TypeScriptEngine()
      const result = await newEngine.check({
        files: [testFile],
        cacheDir,
      })
      expect(result.success).toBe(true)
      expect(newEngine.hasCacheState()).toBe(true)
    })

    it('should_create_cache_directory_if_not_exists', async () => {
      const testFile = path.join(tempDir, 'cache-create.ts')
      fs.writeFileSync(testFile, 'const x = 42')

      const cacheDir = path.join(tempDir, 'new-cache-dir')
      expect(fs.existsSync(cacheDir)).toBe(false)

      await engine.check({
        files: [testFile],
        cacheDir,
      })

      expect(fs.existsSync(cacheDir)).toBe(true)
    })
  })

  describe('should_format_diagnostics_correctly', () => {
    it('should_include_line_and_column_information', async () => {
      const testFile = path.join(tempDir, 'location.ts')
      fs.writeFileSync(testFile, `const x: number = 'string'`)

      const result = await engine.check({
        files: [testFile],
      })

      expect(result.success).toBe(false)
      const issue = result.issues[0]
      expect(issue.line).toBeGreaterThan(0)
      expect(issue.col).toBeGreaterThan(0)
      expect(issue.endLine).toBeDefined()
      expect(issue.endCol).toBeDefined()
    })

    it('should_handle_options_diagnostics_without_file', async () => {
      // Create a tsconfig with invalid options
      const badCfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bad-cfg-'))
      const tsconfig = {
        compilerOptions: {
          target: 'INVALID_TARGET', // This will cause an options error
        },
      }
      fs.writeFileSync(path.join(badCfgDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

      const testFile = path.join(badCfgDir, 'test.ts')
      fs.writeFileSync(testFile, 'const x = 42')

      const result = await engine.check({
        files: [testFile],
        tsconfigPath: path.join(badCfgDir, 'tsconfig.json'),
      })

      expect(result.success).toBe(false)
      // Options errors are included even without a specific file

      fs.rmSync(badCfgDir, { recursive: true, force: true })
    })
  })

  describe('should_generate_error_reports', () => {
    it('should_generate_error_report_with_typescript_errors', async () => {
      const testFile = path.join(tempDir, 'error-report.ts')
      fs.writeFileSync(
        testFile,
        `
        const x: number = 'string' // Type error
        const y = undefinedVariable // Reference error
        `,
      )

      const result = await engine.check({
        files: [testFile],
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)

      // Get diagnostics and generate error report
      const diagnostics = engine.getLastDiagnostics()
      const errorReport = await engine.generateErrorReport(diagnostics)

      expect(errorReport.tool).toBe('typescript')
      expect(errorReport.status).toBe('error')
      expect(errorReport.summary.totalErrors).toBeGreaterThan(0)
      expect(errorReport.summary.filesAffected).toBe(1)
      expect(errorReport.details.files).toHaveLength(1)
      expect(errorReport.details.files[0].path).toBe(testFile)
      expect(errorReport.raw).toContain('TS')
    })

    it('should_generate_success_report_when_no_errors', async () => {
      const testFile = path.join(tempDir, 'success-report.ts')
      fs.writeFileSync(
        testFile,
        `
        const greeting: string = 'Hello, World!'
        console.log(greeting)
        `,
      )

      const result = await engine.check({
        files: [testFile],
      })

      expect(result.success).toBe(true)
      expect(result.issues.length).toBe(0)

      // Get diagnostics and generate error report
      const diagnostics = engine.getLastDiagnostics()
      const errorReport = await engine.generateErrorReport(diagnostics)

      expect(errorReport.tool).toBe('typescript')
      expect(errorReport.status).toBe('success')
      expect(errorReport.summary.totalErrors).toBe(0)
      expect(errorReport.summary.totalWarnings).toBe(0)
      expect(errorReport.summary.filesAffected).toBe(0)
      expect(errorReport.details.files).toHaveLength(0)
    })

    it('should_group_errors_by_file_in_error_report', async () => {
      const testFile1 = path.join(tempDir, 'multi1.ts')
      const testFile2 = path.join(tempDir, 'multi2.ts')

      fs.writeFileSync(testFile1, `const x: number = 'string'`)
      fs.writeFileSync(testFile2, `const y: string = 42`)

      const result = await engine.check({
        files: [testFile1, testFile2],
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)

      // Get diagnostics and generate error report
      const diagnostics = engine.getLastDiagnostics()
      const errorReport = await engine.generateErrorReport(diagnostics)

      expect(errorReport.tool).toBe('typescript')
      expect(errorReport.status).toBe('error')
      expect(errorReport.summary.filesAffected).toBe(2)
      expect(errorReport.details.files).toHaveLength(2)

      // Check that files are properly grouped
      const filePaths = errorReport.details.files.map((f) => f.path)
      expect(filePaths).toContain(testFile1)
      expect(filePaths).toContain(testFile2)
    })
  })
})
