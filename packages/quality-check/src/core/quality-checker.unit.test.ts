import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QualityChecker } from './quality-checker.js'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'

vi.mock('node:child_process')
vi.mock('node:fs')

describe('QualityChecker with Enhanced Error Parsing', () => {
  let checker: QualityChecker
  const mockExecSync = vi.mocked(childProcess.execSync)
  const mockExistsSync = vi.mocked(fs.existsSync)

  beforeEach(() => {
    vi.clearAllMocks()
    checker = new QualityChecker()
  })

  describe('TypeScript error enhancement', () => {
    it('should_provide_detailed_typescript_errors_when_compilation_fails', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true)
      const tsError = new Error(`src/app.ts(10,5): error TS2304: Cannot find name 'unknownVariable'.
src/app.ts(15,10): error TS2322: Type 'string' is not assignable to type 'number'.`)

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('tsc')) {
          throw tsError
        }
        return ''
      })

      // Act
      const result = await checker.check(['src/app.ts'], { eslint: false, prettier: false })

      // Assert
      expect(result.checkers.typescript?.success).toBe(false)
      expect(result.checkers.typescript?.errors).toBeDefined()
      expect(result.checkers.typescript?.errors?.[0]).toContain('src/app.ts:10:5')
      expect(result.checkers.typescript?.errors?.[0]).toContain('TS2304')
      expect(result.checkers.typescript?.errors?.[0]).toContain('unknownVariable')
      expect(result.checkers.typescript?.errors?.[1]).toContain('src/app.ts:15:10')
      expect(result.checkers.typescript?.errors?.[1]).toContain('TS2322')
    })

    it('should_handle_empty_typescript_errors_when_no_specific_errors_found', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true)
      const tsError = new Error('Command failed: npx tsc --noEmit')

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('tsc')) {
          throw tsError
        }
        return ''
      })

      // Act
      const result = await checker.check(['src/app.ts'], { eslint: false, prettier: false })

      // Assert
      expect(result.checkers.typescript?.success).toBe(false)
      expect(result.checkers.typescript?.errors).toContain('Command failed: npx tsc --noEmit')
    })
  })

  describe('ESLint error enhancement', () => {
    it('should_format_eslint_errors_consistently_when_json_output_available', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true)
      const eslintOutput = JSON.stringify([
        {
          filePath: '/project/src/app.ts',
          errorCount: 2,
          warningCount: 0,
          messages: [
            {
              severity: 2,
              message: 'Missing semicolon',
              ruleId: 'semi',
              line: 10,
              column: 25,
            },
            {
              severity: 2,
              message: "'config' is defined but never used",
              ruleId: 'no-unused-vars',
              line: 5,
              column: 7,
            },
          ],
        },
      ])

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('eslint')) {
          return eslintOutput
        }
        return ''
      })

      // Act
      const result = await checker.check(['src/app.ts'], { prettier: false, typescript: false })

      // Assert
      expect(result.checkers.eslint?.success).toBe(false)
      expect(result.checkers.eslint?.errors).toHaveLength(2)
      expect(result.checkers.eslint?.errors?.[0]).toBe(
        '/project/src/app.ts:10:25 - Missing semicolon (semi)',
      )
    })
  })

  describe('Combined error reporting', () => {
    it('should_report_all_errors_when_multiple_tools_fail', async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true)

      // TypeScript error
      const tsError = new Error(
        "src/app.ts(10,5): error TS2304: Cannot find name 'unknownVariable'.",
      )

      // ESLint output
      const eslintOutput = JSON.stringify([
        {
          filePath: '/project/src/app.ts',
          errorCount: 1,
          warningCount: 0,
          messages: [
            {
              severity: 2,
              message: 'Missing semicolon',
              ruleId: 'semi',
              line: 10,
              column: 25,
            },
          ],
        },
      ])

      mockExecSync.mockImplementation((cmd) => {
        const cmdStr = cmd.toString()
        if (cmdStr.includes('tsc')) {
          throw tsError
        }
        if (cmdStr.includes('eslint')) {
          return eslintOutput
        }
        if (cmdStr.includes('prettier')) {
          throw new Error('Formatting needed')
        }
        return ''
      })

      // Act
      const result = await checker.check(['src/app.ts'], {})

      // Assert
      expect(result.success).toBe(false)
      expect(result.checkers.typescript?.errors?.[0]).toContain('TS2304')
      expect(result.checkers.eslint?.errors?.[0]).toContain('semi')
      expect(result.checkers.prettier?.errors?.[0]).toContain('formatting')
    })
  })
})
