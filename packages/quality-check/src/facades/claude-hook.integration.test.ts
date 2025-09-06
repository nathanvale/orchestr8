import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { ClaudeFacadeV2 } from './claude-facade-v2.js'
import type { QualityCheckOptions } from '../types.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('Claude Hook Integration - TypeScript Error Handling', () => {
  let facade: ClaudeFacadeV2
  let tempDir: string

  beforeEach(async () => {
    facade = new ClaudeFacadeV2()
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-hook-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('End-to-end tests with TypeScript errors', () => {
    test('should_handle_typescript_import_errors_when_module_not_found', async () => {
      // Arrange - Create a file with import error
      const testFile = path.join(tempDir, 'import-error.ts')
      await fs.writeFile(
        testFile,
        `import { nonExistent } from 'missing-module'
export const test = nonExistent`,
      )

      const options: QualityCheckOptions = {
        file: testFile,
        typescript: true,
        eslint: false,
        prettier: false,
        hookMode: true,
      }

      // Act
      const result = await facade.check(options)

      // Assert
      expect(result.success).toBe(false)
      expect(result.issues).toBeDefined()
      expect(result.issues.length).toBeGreaterThan(0)

      const tsError = result.issues.find((i) => i.engine === 'typescript')
      expect(tsError).toBeDefined()
      expect(tsError?.ruleId).toMatch(/TS2307/) // Cannot find module
      expect(tsError?.message).toContain('Cannot find module')
    })

    test('should_handle_typescript_type_errors_when_type_mismatch', async () => {
      // Arrange - Create a file with type error
      const testFile = path.join(tempDir, 'type-error.ts')
      await fs.writeFile(
        testFile,
        `const num: number = "string"
function add(a: number, b: number): number {
  return a + b
}
add(1, "2")`,
      )

      const options: QualityCheckOptions = {
        file: testFile,
        typescript: true,
        eslint: false,
        prettier: false,
        hookMode: true,
      }

      // Act
      const result = await facade.check(options)

      // Assert
      expect(result.success).toBe(false)
      expect(result.issues).toBeDefined()

      const typeErrors = result.issues.filter(
        (i) => i.engine === 'typescript' && i.ruleId?.startsWith('TS2'),
      )
      expect(typeErrors.length).toBeGreaterThan(0)
      expect(typeErrors.some((e) => e.message.includes('Type'))).toBe(true)
    })

    test('should_handle_mixed_errors_when_multiple_engines_enabled', async () => {
      // Arrange - Create a file with multiple types of errors
      const testFile = path.join(tempDir, 'mixed-errors.ts')
      await fs.writeFile(
        testFile,
        `const unused = "variable";
console.log("debug");
    function   badly_formatted(  ) {
return    42;
}`,
      )

      const options: QualityCheckOptions = {
        file: testFile,
        typescript: true,
        eslint: true,
        prettier: true,
        hookMode: true,
      }

      // Act
      const result = await facade.check(options)

      // Assert
      expect(result.success).toBe(false)
      expect(result.issues).toBeDefined()

      // Check for issues from different engines
      const engines = new Set(result.issues.map((i) => i.engine))
      expect(engines.size).toBeGreaterThanOrEqual(1) // At least one engine found issues

      // Verify issue structure
      result.issues.forEach((issue) => {
        expect(issue).toHaveProperty('engine')
        expect(issue).toHaveProperty('severity')
        expect(issue).toHaveProperty('file')
        expect(issue).toHaveProperty('line')
        expect(issue).toHaveProperty('col')
        expect(issue).toHaveProperty('message')
      })
    })
  })

  describe('Structured output format for Claude', () => {
    test('should_format_issues_in_xml_structure_when_hook_mode_enabled', async () => {
      // Arrange
      const testFile = path.join(tempDir, 'format-test.ts')
      await fs.writeFile(
        testFile,
        `const x: any = 42;
console.log(x);`,
      )

      const options: QualityCheckOptions = {
        file: testFile,
        typescript: false,
        eslint: true,
        prettier: false,
        hookMode: true,
        silent: true,
      }

      // Act
      const result = await facade.check(options)
      const formatted = facade.formatForClaude(result)

      // Assert
      expect(formatted).toContain('<quality-check-result>')
      expect(formatted).toContain('<issue>')
      expect(formatted).toContain('<engine>')
      expect(formatted).toContain('<severity>')
      expect(formatted).toContain('<location>')
      expect(formatted).toContain('</quality-check-result>')
    })

    test('should_group_issues_by_engine_when_formatting', async () => {
      // Arrange - Create multiple issues
      const mockResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript' as const,
            severity: 'error' as const,
            ruleId: 'TS2307',
            file: '/test.ts',
            line: 1,
            col: 1,
            message: 'Cannot find module',
          },
          {
            engine: 'eslint' as const,
            severity: 'warning' as const,
            ruleId: 'no-console',
            file: '/test.ts',
            line: 2,
            col: 1,
            message: 'Unexpected console',
          },
          {
            engine: 'typescript' as const,
            severity: 'error' as const,
            ruleId: 'TS2304',
            file: '/test.ts',
            line: 3,
            col: 1,
            message: 'Cannot find name',
          },
        ],
      }

      // Act
      const formatted = facade.formatForClaude(mockResult)

      // Assert
      expect(formatted).toContain('<typescript>')
      expect(formatted).toContain('<eslint>')

      // Verify TypeScript errors are grouped together
      const tsGroupMatch = formatted.match(/<typescript>([\s\S]*?)<\/typescript>/)
      expect(tsGroupMatch).toBeTruthy()
      const tsGroup = tsGroupMatch![1]
      expect(tsGroup.match(/<issue>/g)?.length).toBe(2) // 2 TypeScript issues
    })

    test('should_preserve_diagnostic_metadata_when_formatting', async () => {
      // Arrange
      const mockResult = {
        success: false,
        duration: 100,
        issues: [
          {
            engine: 'typescript' as const,
            severity: 'error' as const,
            ruleId: 'TS7006',
            file: '/test.ts',
            line: 10,
            col: 15,
            endLine: 10,
            endCol: 25,
            message: 'Parameter implicitly has an any type',
            suggestion: 'Add explicit type annotation',
          },
        ],
      }

      // Act
      const formatted = facade.formatForClaude(mockResult)

      // Assert
      expect(formatted).toContain('TS7006')
      expect(formatted).toContain('10') // line number
      expect(formatted).toContain('15') // column number
      expect(formatted).toContain('Parameter implicitly has an any type')
      if (formatted.includes('suggestion')) {
        expect(formatted).toContain('Add explicit type annotation')
      }
    })
  })

  describe('Autopilot integration with rich error data', () => {
    test('should_use_enhanced_autopilot_classification_when_processing_issues', async () => {
      // Arrange
      const testFile = path.join(tempDir, 'autopilot-test.ts')
      await fs.writeFile(
        testFile,
        `    const x   =    42    ;
console.log(x);`,
      )

      const options: QualityCheckOptions = {
        file: testFile,
        typescript: false,
        eslint: false,
        prettier: true,
        hookMode: true,
      }

      // Act
      const result = await facade.check(options)
      const decision = facade.getAutopilotDecision(result)

      // Assert
      expect(decision).toBeDefined()
      expect(decision.action).toBeDefined()
      expect(decision.confidence).toBeGreaterThan(0)

      // Prettier issues should be auto-fixable
      if (result.issues.some((i) => i.engine === 'prettier')) {
        expect(['FIX_SILENTLY', 'FIX_AND_REPORT']).toContain(decision.action)
      }
    })

    test('should_classify_typescript_errors_correctly_when_using_autopilot', async () => {
      // Arrange
      const testFile = path.join(tempDir, 'ts-classification.ts')
      await fs.writeFile(
        testFile,
        `import { missing } from 'not-found'
const x = unknownVariable
function test(param) { return param }`,
      )

      const options: QualityCheckOptions = {
        file: testFile,
        typescript: true,
        eslint: false,
        prettier: false,
        hookMode: true,
      }

      // Act
      const result = await facade.check(options)
      const decision = facade.getAutopilotDecision(result)

      // Assert
      expect(decision.action).toBe('REPORT_ONLY') // TypeScript errors are not auto-fixable
      expect(decision.issues).toBeDefined()
      expect(decision.issues?.length).toBeGreaterThan(0)
    })
  })
})
