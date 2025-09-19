import { describe, expect, it, beforeEach } from 'vitest'
import { StylishFormatter } from './stylish-formatter'
import type { Issue } from '../types/issue-types'
import * as path from 'node:path'

describe('StylishFormatter', () => {
  let formatter: StylishFormatter
  const cwd = process.cwd()

  beforeEach(() => {
    formatter = new StylishFormatter()
  })

  describe('format', () => {
    it('should_return_empty_string_for_no_issues', () => {
      const issues: Issue[] = []

      const formatted = formatter.format(issues)

      expect(formatted).toBe('')
    })

    it('should_format_single_issue_correctly', () => {
      const testFile = path.join(cwd, 'test.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 10,
          col: 5,
          message: 'Unexpected token',
          ruleId: 'syntax-error',
        },
      ]

      const formatted = formatter.format(issues)

      expect(formatted).toContain('test.js')
      expect(formatted).toContain('10:5')
      expect(formatted).toContain('error')
      expect(formatted).toContain('Unexpected token')
      expect(formatted).toContain('(syntax-error)')
      expect(formatted).toContain('[eslint]')
      expect(formatted).toContain('✖ 1 error')
    })

    it('should_group_multiple_issues_by_file', () => {
      const file1 = path.join(cwd, 'src', 'file1.js')
      const file2 = path.join(cwd, 'src', 'file2.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: file1,
          line: 5,
          col: 10,
          message: 'Error in file1',
        },
        {
          engine: 'prettier',
          severity: 'warning',
          file: file2,
          line: 3,
          col: 1,
          message: 'Warning in file2',
        },
        {
          engine: 'typescript',
          severity: 'error',
          file: file1,
          line: 10,
          col: 15,
          message: 'Another error in file1',
        },
      ]

      const formatted = formatter.format(issues)

      // Check file grouping
      const lines = formatted.split('\n')
      const file1Index = lines.findIndex((l) => l.includes('src/file1.js'))
      const file2Index = lines.findIndex((l) => l.includes('src/file2.js'))

      expect(file1Index).toBeGreaterThan(-1)
      expect(file2Index).toBeGreaterThan(-1)
      expect(file1Index).toBeLessThan(file2Index)

      // Check that file1 issues are together
      expect(formatted).toContain('5:10')
      expect(formatted).toContain('10:15')
    })

    it('should_sort_issues_by_line_and_column', () => {
      const testFile = path.join(cwd, 'test.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 10,
          col: 5,
          message: 'Issue at 10:5',
        },
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 5,
          col: 10,
          message: 'Issue at 5:10',
        },
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 5,
          col: 3,
          message: 'Issue at 5:3',
        },
      ]

      const formatted = formatter.format(issues)
      const lines = formatted.split('\n').filter((l) => l.includes(':'))

      // Should be sorted: 5:3, 5:10, 10:5
      expect(lines[0]).toContain('5:3')
      expect(lines[1]).toContain('5:10')
      expect(lines[2]).toContain('10:5')
    })

    it('should_format_different_severities_correctly', () => {
      const testFile = path.join(cwd, 'test.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Error message',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: testFile,
          line: 2,
          col: 1,
          message: 'Warning message',
        },
        {
          engine: 'eslint',
          severity: 'info',
          file: testFile,
          line: 3,
          col: 1,
          message: 'Info message',
        },
      ]

      const formatted = formatter.format(issues)

      expect(formatted).toContain('error   ')
      expect(formatted).toContain('warning')
      expect(formatted).toContain('info   ')
    })

    it('should_handle_issues_without_ruleId', () => {
      const testFile = path.join(cwd, 'test.js')
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Type error without rule',
        },
      ]

      const formatted = formatter.format(issues)

      expect(formatted).toContain('Type error without rule')
      expect(formatted).toContain('[typescript]')
      expect(formatted).not.toContain('()')
    })

    it('should_format_summary_with_correct_pluralization', () => {
      const testFile = path.join(cwd, 'test.js')

      // Test single error
      let issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Error',
        },
      ]
      let formatted = formatter.format(issues)
      expect(formatted).toContain('✖ 1 error')

      // Test multiple errors
      issues = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Error 1',
        },
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 2,
          col: 1,
          message: 'Error 2',
        },
      ]
      formatted = formatter.format(issues)
      expect(formatted).toContain('✖ 2 errors')

      // Test single warning
      issues = [
        {
          engine: 'eslint',
          severity: 'warning',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Warning',
        },
      ]
      formatted = formatter.format(issues)
      expect(formatted).toContain('✖ 1 warning')

      // Test multiple warnings
      issues = [
        {
          engine: 'eslint',
          severity: 'warning',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Warning 1',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: testFile,
          line: 2,
          col: 1,
          message: 'Warning 2',
        },
      ]
      formatted = formatter.format(issues)
      expect(formatted).toContain('✖ 2 warnings')
    })

    it('should_format_mixed_severity_summary', () => {
      const testFile = path.join(cwd, 'test.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Error',
        },
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 2,
          col: 1,
          message: 'Error 2',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: testFile,
          line: 3,
          col: 1,
          message: 'Warning',
        },
        {
          engine: 'eslint',
          severity: 'info',
          file: testFile,
          line: 4,
          col: 1,
          message: 'Info',
        },
      ]

      const formatted = formatter.format(issues)

      expect(formatted).toContain('✖ 2 errors, 1 warning, 1 info')
    })

    it('should_use_relative_paths', () => {
      const absolutePath = path.join(cwd, 'deeply', 'nested', 'folder', 'file.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: absolutePath,
          line: 1,
          col: 1,
          message: 'Error',
        },
      ]

      const formatted = formatter.format(issues)

      expect(formatted).not.toContain(cwd)
      expect(formatted).toContain('deeply/nested/folder/file.js')
    })

    it('should_align_location_columns_properly', () => {
      const testFile = path.join(cwd, 'test.js')
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 1,
          col: 1,
          message: 'Short line',
        },
        {
          engine: 'eslint',
          severity: 'error',
          file: testFile,
          line: 100,
          col: 999,
          message: 'Long line',
        },
      ]

      const formatted = formatter.format(issues)
      const issueLines = formatted.split('\n').filter((l) => l.includes('error'))

      // Check that location is padded to 8 characters
      expect(issueLines[0]).toMatch(/1:1\s+error/)
      expect(issueLines[1]).toMatch(/100:999\s+error/)
    })
  })
})
