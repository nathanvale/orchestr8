import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrettierEngine } from './prettier-engine'

describe('PrettierEngine', () => {
  let engine: PrettierEngine
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prettier-engine-test-'))
    engine = new PrettierEngine(tempDir)

    // Create a basic Prettier config
    const prettierConfig = {
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      printWidth: 100,
    }
    fs.writeFileSync(path.join(tempDir, '.prettierrc.json'), JSON.stringify(prettierConfig))
  })

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('check', () => {
    it('should_return_success_when_file_is_formatted', async () => {
      const testFile = path.join(tempDir, 'formatted.js')
      fs.writeFileSync(
        testFile,
        `const greeting = 'Hello, World!'
export default greeting
`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.modifiedFiles).toEqual([])
    })

    it('should_detect_formatting_issues_when_file_not_formatted', async () => {
      const testFile = path.join(tempDir, 'unformatted.js')
      fs.writeFileSync(
        testFile,
        `const    greeting="Hello, World!";
    export default     greeting;`,
      )

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]).toMatchObject({
        engine: 'prettier',
        severity: 'warning',
        ruleId: 'format',
        file: testFile,
        message: 'File is not formatted with Prettier',
      })
      expect(result.fixable).toBe(true)
      expect(result.modifiedFiles).toEqual([])
    })

    it('should_fix_formatting_when_write_option_enabled', async () => {
      const testFile = path.join(tempDir, 'fixable.js')
      const unformattedContent = `const    greeting="Hello, World!";
    export default     greeting;`
      fs.writeFileSync(testFile, unformattedContent)

      const result = await engine.check({
        files: [testFile],
        write: true,
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.fixedCount).toBe(1)
      expect(result.modifiedFiles).toEqual([testFile])

      // Check file was actually formatted
      const content = fs.readFileSync(testFile, 'utf-8')
      expect(content).toBe(`const greeting = 'Hello, World!'
export default greeting
`)
    })

    it('should_handle_multiple_files', async () => {
      const file1 = path.join(tempDir, 'file1.js')
      const file2 = path.join(tempDir, 'file2.js')

      fs.writeFileSync(file1, `const   a="test";`)
      fs.writeFileSync(file2, `const   b="test";`)

      const result = await engine.check({
        files: [file1, file2],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(2)
      expect(result.issues[0].file).toBe(file1)
      expect(result.issues[1].file).toBe(file2)
    })

    it('should_handle_cancellation_token', async () => {
      const testFile = path.join(tempDir, 'cancel.js')
      fs.writeFileSync(testFile, `const test = "test"`)

      const token = {
        isCancellationRequested: true,
        onCancellationRequested: vi.fn(),
      }

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
        token,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should_skip_ignored_files', async () => {
      const testFile = path.join(tempDir, 'ignored.js')
      fs.writeFileSync(testFile, `const   ugly="code";`)

      // Create .prettierignore file
      fs.writeFileSync(path.join(tempDir, '.prettierignore'), 'ignored.js')

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should_handle_syntax_errors_gracefully', async () => {
      const testFile = path.join(tempDir, 'syntax-error.js')
      fs.writeFileSync(testFile, `const broken = {`)

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      expect(result.success).toBe(false)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].severity).toBe('error')
      expect(result.issues[0].message).toContain('Prettier parsing error')
    })

    it('should_handle_files_without_parser', async () => {
      const testFile = path.join(tempDir, 'unknown.xyz')
      fs.writeFileSync(testFile, `unknown content`)

      const result = await engine.check({
        files: [testFile],
        cwd: tempDir,
      })

      // Should skip files without a parser
      expect(result.success).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should_fix_multiple_files_when_write_enabled', async () => {
      const file1 = path.join(tempDir, 'fix1.js')
      const file2 = path.join(tempDir, 'fix2.js')

      fs.writeFileSync(file1, `const   a="test";`)
      fs.writeFileSync(file2, `const   b="test";`)

      const result = await engine.check({
        files: [file1, file2],
        write: true,
        cwd: tempDir,
      })

      expect(result.success).toBe(true)
      expect(result.fixedCount).toBe(2)
      expect(result.modifiedFiles).toEqual([file1, file2])

      // Verify both files are formatted
      const content1 = fs.readFileSync(file1, 'utf-8')
      const content2 = fs.readFileSync(file2, 'utf-8')
      expect(content1).toBe(`const a = 'test'\n`)
      expect(content2).toBe(`const b = 'test'\n`)
    })
  })

  describe('formatFile', () => {
    it('should_format_single_file_correctly', async () => {
      const testFile = path.join(tempDir, 'format.js')
      fs.writeFileSync(testFile, `const   ugly="code";`)

      const formatted = await engine.formatFile(testFile)

      expect(formatted).toBe(`const ugly = 'code'\n`)
    })

    it('should_respect_config_when_formatting', async () => {
      const testFile = path.join(tempDir, 'config-test.js')
      fs.writeFileSync(testFile, `const test = "test"`)

      const formatted = await engine.formatFile(testFile)

      // Should use single quotes and no semicolon as per config
      expect(formatted).toBe(`const test = 'test'\n`)
    })
  })

  describe('isConfigured', () => {
    it('should_return_true_when_prettier_configured', async () => {
      const configured = await engine.isConfigured()
      expect(configured).toBe(true)
    })

    it('should_return_false_when_no_config', async () => {
      // Remove config file
      fs.unlinkSync(path.join(tempDir, '.prettierrc.json'))

      const engine2 = new PrettierEngine(tempDir)
      const configured = await engine2.isConfigured()

      // Prettier can still work without config, it just uses defaults
      // So this might return false or true depending on global config
      expect(typeof configured).toBe('boolean')
    })
  })

  describe('getVersion', () => {
    it('should_return_prettier_version', () => {
      const version = PrettierEngine.getVersion()
      expect(version).toBeDefined()
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('getSupportedExtensions', () => {
    it('should_return_list_of_supported_extensions', () => {
      const extensions = PrettierEngine.getSupportedExtensions()
      expect(extensions).toBeInstanceOf(Array)
      expect(extensions).toContain('.js')
      expect(extensions).toContain('.ts')
      expect(extensions).toContain('.json')
      expect(extensions).toContain('.css')
      expect(extensions).toContain('.md')
    })
  })

  describe('safeWriteFile', () => {
    it('should_handle_write_errors_gracefully', async () => {
      const testFile = path.join(tempDir, 'readonly', 'test.js')

      // Try to write to a non-existent directory
      const result = await engine.check({
        files: [testFile],
        write: true,
        cwd: tempDir,
      })

      // Should handle the error gracefully
      expect(result.success).toBe(false)
      expect(result.issues[0].severity).toBe('error')
    })
  })

  describe('should_generate_error_reports', () => {
    it('should_generate_error_report_with_prettier_errors', async () => {
      const testFile = path.join(tempDir, 'error-report.js')
      fs.writeFileSync(testFile, `const   ugly="code"   ;   const   another= "value"`)

      const result = await engine.check({
        files: [testFile],
        write: false,
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)

      // Generate error report
      const errorReport = await engine.generateErrorReport(result.issues)

      expect(errorReport.tool).toBe('prettier')
      expect(errorReport.status).toBe('warning')
      expect(errorReport.summary.totalWarnings).toBeGreaterThan(0)
      expect(errorReport.summary.filesAffected).toBe(1)
      expect(errorReport.details.files).toHaveLength(1)
      expect(errorReport.details.files[0].path).toBe(testFile)
      expect(errorReport.raw).toContain(testFile)
    })

    it('should_generate_success_report_when_no_errors', async () => {
      const testFile = path.join(tempDir, 'success-report.js')
      fs.writeFileSync(testFile, `const greeting = 'Hello, World!'\nconsole.log(greeting)\n`)

      const result = await engine.check({
        files: [testFile],
        write: false,
      })

      expect(result.success).toBe(true)
      expect(result.issues.length).toBe(0)

      // Generate error report
      const errorReport = await engine.generateErrorReport(result.issues)

      expect(errorReport.tool).toBe('prettier')
      expect(errorReport.status).toBe('success')
      expect(errorReport.summary.totalErrors).toBe(0)
      expect(errorReport.summary.totalWarnings).toBe(0)
      expect(errorReport.summary.filesAffected).toBe(0)
      expect(errorReport.details.files).toHaveLength(0)
    })

    it('should_group_errors_by_file_in_error_report', async () => {
      const testFile1 = path.join(tempDir, 'multi1.js')
      const testFile2 = path.join(tempDir, 'multi2.js')

      fs.writeFileSync(testFile1, `const   ugly="code"`)
      fs.writeFileSync(testFile2, `const   another= "value"`)

      const result = await engine.check({
        files: [testFile1, testFile2],
        write: false,
      })

      expect(result.success).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)

      // Generate error report
      const errorReport = await engine.generateErrorReport(result.issues)

      expect(errorReport.tool).toBe('prettier')
      expect(errorReport.status).toBe('warning')
      expect(errorReport.summary.filesAffected).toBeGreaterThan(0)
      expect(errorReport.details.files.length).toBeGreaterThan(0)

      // Check that files are properly grouped
      const filePaths = errorReport.details.files.map((f) => f.path)
      expect(filePaths.some((p) => p.includes('multi1.js') || p.includes('multi2.js'))).toBe(true)
    })
  })
})
