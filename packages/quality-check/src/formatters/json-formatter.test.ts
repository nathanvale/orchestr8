import { describe, expect, it, beforeEach } from 'vitest'
import { JsonFormatter } from './json-formatter'
import type { Issue } from '../types/issue-types'

describe('JsonFormatter', () => {
  let formatter: JsonFormatter

  beforeEach(() => {
    formatter = new JsonFormatter()
  })

  describe('format', () => {
    it('should_format_empty_array_as_json', () => {
      const issues: Issue[] = []

      const formatted = formatter.format(issues)

      expect(formatted).toBe('[]')
      expect(() => JSON.parse(formatted)).not.toThrow()
    })

    it('should_format_single_issue_with_indentation', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: '/path/to/file.js',
          line: 10,
          col: 5,
          message: 'Unexpected token',
          ruleId: 'no-unused-vars',
        },
      ]

      const formatted = formatter.format(issues)
      const parsed = JSON.parse(formatted)

      expect(formatted).toContain('\n')
      expect(formatted).toContain('  ')
      expect(parsed).toHaveLength(1)
      expect(parsed[0].engine).toBe('eslint')
      expect(parsed[0].severity).toBe('error')
      expect(parsed[0].line).toBe(10)
    })

    it('should_format_multiple_issues_correctly', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: 'test1.ts',
          line: 1,
          col: 1,
          message: 'Type error',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: 'test2.js',
          line: 2,
          col: 3,
          message: 'Linting warning',
          ruleId: 'no-console',
        },
        {
          engine: 'prettier',
          severity: 'info',
          file: 'test3.css',
          line: 5,
          col: 10,
          message: 'Formatting issue',
        },
      ]

      const formatted = formatter.format(issues)
      const parsed = JSON.parse(formatted)

      expect(parsed).toHaveLength(3)
      expect(parsed[0].engine).toBe('typescript')
      expect(parsed[1].engine).toBe('eslint')
      expect(parsed[2].engine).toBe('prettier')
    })

    it('should_include_optional_fields_when_present', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: 'test.js',
          line: 10,
          col: 5,
          endLine: 10,
          endCol: 15,
          message: 'Error message',
          ruleId: 'some-rule',
          suggestion: 'Fix suggestion',
        },
      ]

      const formatted = formatter.format(issues)
      const parsed = JSON.parse(formatted)

      expect(parsed[0].endLine).toBe(10)
      expect(parsed[0].endCol).toBe(15)
      expect(parsed[0].suggestion).toBe('Fix suggestion')
    })
  })

  describe('formatCompact', () => {
    it('should_format_without_indentation', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: 'test.js',
          line: 1,
          col: 1,
          message: 'Error',
        },
      ]

      const formatted = formatter.formatCompact(issues)

      expect(formatted).not.toContain('\n')
      expect(formatted).not.toContain('  ')
      expect(() => JSON.parse(formatted)).not.toThrow()
    })

    it('should_produce_valid_compact_json', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Error 1',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: 'test.js',
          line: 2,
          col: 2,
          message: 'Warning 1',
        },
      ]

      const formatted = formatter.formatCompact(issues)
      const parsed = JSON.parse(formatted)

      expect(parsed).toHaveLength(2)
      expect(formatted.length).toBeLessThan(formatter.format(issues).length)
    })
  })

  describe('formatWithMetadata', () => {
    it('should_include_metadata_in_output', () => {
      const issues: Issue[] = []
      const metadata = {
        timestamp: '2024-01-01T00:00:00Z',
        duration: 150,
        fileCount: 3,
        correlationId: 'test-123',
      }

      const formatted = formatter.formatWithMetadata(issues, metadata)
      const parsed = JSON.parse(formatted)

      expect(parsed.timestamp).toBe(metadata.timestamp)
      expect(parsed.duration).toBe(metadata.duration)
      expect(parsed.fileCount).toBe(metadata.fileCount)
      expect(parsed.correlationId).toBe(metadata.correlationId)
      expect(parsed.issues).toEqual([])
    })

    it('should_calculate_issue_counts_correctly', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: 'test.ts',
          line: 1,
          col: 1,
          message: 'Error',
        },
        {
          engine: 'eslint',
          severity: 'error',
          file: 'test.js',
          line: 1,
          col: 1,
          message: 'Error',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: 'test.js',
          line: 2,
          col: 1,
          message: 'Warning',
        },
        {
          engine: 'prettier',
          severity: 'info',
          file: 'test.css',
          line: 1,
          col: 1,
          message: 'Info',
        },
      ]

      const formatted = formatter.formatWithMetadata(issues, {})
      const parsed = JSON.parse(formatted)

      expect(parsed.issueCount).toBe(4)
      expect(parsed.errorCount).toBe(2)
      expect(parsed.warningCount).toBe(1)
      expect(parsed.infoCount).toBe(1)
      expect(parsed.issues).toHaveLength(4)
    })

    it('should_handle_partial_metadata', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'warning',
          file: 'test.js',
          line: 1,
          col: 1,
          message: 'Warning',
        },
      ]

      const formatted = formatter.formatWithMetadata(issues, {
        duration: 100,
      })
      const parsed = JSON.parse(formatted)

      expect(parsed.duration).toBe(100)
      expect(parsed.timestamp).toBeUndefined()
      expect(parsed.fileCount).toBeUndefined()
      expect(parsed.correlationId).toBeUndefined()
      expect(parsed.issueCount).toBe(1)
    })

    it('should_format_with_proper_indentation', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: 'test.js',
          line: 1,
          col: 1,
          message: 'Error',
        },
      ]

      const formatted = formatter.formatWithMetadata(issues, {
        timestamp: '2024-01-01',
      })

      expect(formatted).toContain('\n')
      expect(formatted).toContain('  ')
      expect(() => JSON.parse(formatted)).not.toThrow()
    })
  })
})
