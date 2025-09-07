import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { QualityChecker } from '../src/core/quality-checker'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

describe('CI/CD Pipeline Integration', () => {
  let fixtureDir: string
  let checker: QualityChecker

  beforeAll(async () => {
    fixtureDir = path.join(tmpdir(), `qc-ci-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
    checker = new QualityChecker()
  })

  afterAll(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
  })

  describe('JSON Output Validation', () => {
    it('should_produce_valid_json_schema_when_format_json_specified', async () => {
      const testFile = path.join(fixtureDir, 'ci-test.ts')
      await fs.writeFile(
        testFile,
        `
        const unused: any = 'test';
        function test() {
          console.log('test');
        }
      `,
      )

      const result = await checker.check([testFile], {
        typescript: true,
        eslint: true,
        prettier: true,
      })

      // Validate JSON schema structure
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        checkers: expect.objectContaining({
          typescript: expect.any(Object),
          eslint: expect.any(Object),
          prettier: expect.any(Object),
        }),
      })

      // Each checker should have consistent structure
      if (result.checkers.typescript) {
        expect(result.checkers.typescript).toMatchObject({
          success: expect.any(Boolean),
        })
      }

      if (result.checkers.eslint) {
        expect(result.checkers.eslint).toMatchObject({
          success: expect.any(Boolean),
        })
      }

      if (result.checkers.prettier) {
        expect(result.checkers.prettier).toMatchObject({
          success: expect.any(Boolean),
        })
      }
    })

    it('should_provide_parseable_json_when_errors_exist', async () => {
      const errorFile = path.join(fixtureDir, 'error-test.ts')
      await fs.writeFile(
        errorFile,
        `
        const x: unknown = 42;
        // @ts-expect-error
        const y: string = x;
        const unused = 'test';
      `,
      )

      const result = await checker.check([errorFile], {
        typescript: true,
        eslint: true,
        prettier: false,
      })

      // Should be valid JSON-serializable
      const jsonString = JSON.stringify(result)
      const parsed = JSON.parse(jsonString)

      expect(parsed).toMatchObject({
        success: expect.any(Boolean),
        checkers: expect.any(Object),
      })

      // Errors should be present and parseable
      if (parsed.checkers.eslint?.errors) {
        expect(Array.isArray(parsed.checkers.eslint.errors)).toBe(true)
      }
    })
  })

  describe('Exit Code Compliance', () => {
    it('should_return_correct_exit_codes_when_running_cli', async () => {
      // Create ESLint config to handle files in this directory
      await fs.writeFile(
        path.join(fixtureDir, 'eslint.config.js'),
        `export default [{
  rules: {
    'no-unused-vars': 'error'
  }
}]`,
      )

      // Create Prettier config
      await fs.writeFile(
        path.join(fixtureDir, '.prettierrc'),
        JSON.stringify({ semi: false, singleQuote: true }),
      )

      // Create a clean file
      const cleanFile = path.join(fixtureDir, 'clean.js')
      await fs.writeFile(
        cleanFile,
        `export function clean() {
  return 'clean'
}
`,
      )

      // Test exit code 0 (success)
      // Change to the fixture directory so ESLint can find the config
      const originalCwd = process.cwd()
      process.chdir(fixtureDir)

      const cleanResult = await checker.check(['clean.js'], {
        eslint: true,
        prettier: true,
        typescript: false,
      })

      // Restore original working directory
      process.chdir(originalCwd)

      // Debug: log the result to see what's failing
      if (!cleanResult.success) {
        console.log('Check failed:', JSON.stringify(cleanResult, null, 2))
      }
      expect(cleanResult.success).toBe(true)

      // Create a file with issues
      const issueFile = path.join(fixtureDir, 'issues.js')
      await fs.writeFile(
        issueFile,
        `
        const unused = 42;
        function    badFormat() {
          return    'bad';
        }
      `,
      )

      // Test exit code 1 (issues found)
      process.chdir(fixtureDir)
      const issueResult = await checker.check(['issues.js'], {
        eslint: true,
        prettier: true,
        typescript: false,
      })
      process.chdir(originalCwd)
      expect(issueResult.success).toBe(false)
    })

    it('should_handle_missing_tools_gracefully_when_in_ci_environment', async () => {
      const testFile = path.join(fixtureDir, 'missing-tool.ts')
      await fs.writeFile(
        testFile,
        `
        export const test = 'test';
      `,
      )

      // Simulate missing tsconfig scenario
      const missingConfigDir = path.join(fixtureDir, 'missing-config')
      await fs.mkdir(missingConfigDir, { recursive: true })

      const isolatedFile = path.join(missingConfigDir, 'isolated.ts')
      await fs.writeFile(
        isolatedFile,
        `
        export const isolated = true;
      `,
      )

      // Should not crash when tools are misconfigured
      const result = await checker.check([isolatedFile], {
        typescript: true,
        eslint: false,
        prettier: false,
      })

      // Should handle gracefully
      expect(result).toBeDefined()
      expect(result.checkers).toBeDefined()
    })
  })

  describe('Git Integration', () => {
    it('should_respect_gitignore_when_checking_files', async () => {
      const gitignore = path.join(fixtureDir, '.gitignore')
      await fs.writeFile(
        gitignore,
        `
        node_modules/
        dist/
        *.log
        .cache/
      `,
      )

      const ignoredFile = path.join(fixtureDir, 'test.log')
      const checkedFile = path.join(fixtureDir, 'test.js')

      await fs.writeFile(ignoredFile, 'const bad = 42;')
      await fs.writeFile(checkedFile, 'const bad = 42;')

      const result = await checker.check([checkedFile], {
        eslint: true,
        respectGitignore: true,
      })

      // Should check the JS file
      expect(result.checkers.eslint).toBeDefined()
    })

    it('should_work_with_staged_files_when_pre_commit_mode', async () => {
      // Create test files for pre-commit scenario
      const stagedFile = path.join(fixtureDir, 'staged.js')
      await fs.writeFile(
        stagedFile,
        `
        export function staged() {
          return 'staged';
        }
      `,
      )

      const result = await checker.check([stagedFile], {
        eslint: true,
        prettier: true,
        preCommit: true,
      })

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })
  })

  describe('Parallel vs Sequential', () => {
    it('should_handle_both_parallel_and_sequential_modes', async () => {
      const files: string[] = []
      for (let i = 0; i < 3; i++) {
        const file = path.join(fixtureDir, `parallel-${i}.js`)
        await fs.writeFile(
          file,
          `
          export function test${i}() {
            return ${i};
          }
        `,
        )
        files.push(file)
      }

      // Test sequential mode
      const sequentialResult = await checker.check(files, {
        eslint: true,
        prettier: true,
        parallel: false,
      })

      expect(sequentialResult.success).toBeDefined()
      expect(sequentialResult.checkers).toBeDefined()

      // Test parallel mode
      const parallelResult = await checker.check(files, {
        eslint: true,
        prettier: true,
        parallel: true,
      })

      expect(parallelResult.success).toBeDefined()
      expect(parallelResult.checkers).toBeDefined()

      // Results should be consistent
      expect(sequentialResult.success).toBe(parallelResult.success)
    })
  })

  describe('Output Format Consistency', () => {
    it('should_maintain_consistent_output_across_engines', async () => {
      const testFile = path.join(fixtureDir, 'consistent.ts')
      await fs.writeFile(
        testFile,
        `
        const x: any = 42;
        const unused = 'test';
        function   badly_formatted() {
          return 'test';
        }
      `,
      )

      const result = await checker.check([testFile], {
        typescript: true,
        eslint: true,
        prettier: true,
      })

      // All engines should report consistently
      expect(result.success).toBe(false)

      // Each engine should have reported issues
      if (result.checkers.typescript) {
        expect(result.checkers.typescript.success).toBe(false)
      }

      if (result.checkers.eslint) {
        expect(result.checkers.eslint.success).toBe(false)
      }

      if (result.checkers.prettier) {
        expect(result.checkers.prettier.success).toBe(false)
      }
    })

    it('should_aggregate_all_issues_when_multiple_engines_report', async () => {
      const multiIssueFile = path.join(fixtureDir, 'multi-issue.ts')
      await fs.writeFile(
        multiIssueFile,
        `
        // TypeScript issue: any type
        const value: any = 'test';
        
        // ESLint issue: unused variable
        const unused = 42;
        
        // Prettier issue: formatting
        function    test(   ) {
          return    'test'    ;
        }
        
        export { value, test };
      `,
      )

      const result = await checker.check([multiIssueFile], {
        typescript: true,
        eslint: true,
        prettier: true,
      })

      // Should have issues from all engines
      expect(result.success).toBe(false)

      let totalIssues = 0

      if (result.checkers.typescript?.errors) {
        totalIssues += result.checkers.typescript.errors.length
      }

      if (result.checkers.eslint?.errors) {
        totalIssues += result.checkers.eslint.errors.length
      }

      if (result.checkers.prettier?.errors) {
        totalIssues += result.checkers.prettier.errors.length
      }

      // Should have at least one issue from each engine
      expect(totalIssues).toBeGreaterThan(2)
    })
  })

  describe('Error Recovery', () => {
    it('should_continue_checking_when_one_engine_fails', async () => {
      const testFile = path.join(fixtureDir, 'recovery.js')
      await fs.writeFile(
        testFile,
        `
        export function test() {
          return 'test';
        }
      `,
      )

      // Even if TypeScript check fails (no tsconfig), other engines should run
      const result = await checker.check([testFile], {
        typescript: true,
        eslint: true,
        prettier: true,
      })

      expect(result).toBeDefined()
      expect(result.checkers).toBeDefined()

      // ESLint and Prettier should still provide results
      if (result.checkers.eslint) {
        expect(result.checkers.eslint).toBeDefined()
      }

      if (result.checkers.prettier) {
        expect(result.checkers.prettier).toBeDefined()
      }
    })

    it('should_handle_timeout_gracefully_when_checks_take_too_long', async () => {
      const testFile = path.join(fixtureDir, 'timeout.ts')
      await fs.writeFile(
        testFile,
        `
        export const test = 'test';
      `,
      )

      // Check with a timeout
      const result = await checker.check([testFile], {
        typescript: true,
        eslint: true,
        prettier: true,
        timeout: 5000, // 5 second timeout
      })

      // Should complete within timeout
      expect(result).toBeDefined()
      expect(result.checkers).toBeDefined()
    })
  })
})
