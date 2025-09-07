/**
 * Tests for unified error output formatting
 */

import { describe, expect, it, beforeEach } from 'vitest'
import type { Issue } from '../types/issue-types.js'
import { OutputFormatter, OutputMode } from './output-formatter.js'

describe('OutputFormatter', () => {
  let formatter: OutputFormatter

  beforeEach(() => {
    formatter = new OutputFormatter()
  })

  const mockIssues: Issue[] = [
    {
      engine: 'typescript',
      severity: 'error',
      ruleId: 'TS2307',
      file: 'src/test.ts',
      line: 10,
      col: 5,
      message: "Cannot find module '@missing/module'",
    },
    {
      engine: 'eslint',
      severity: 'warning',
      ruleId: 'no-unused-vars',
      file: 'src/test.ts',
      line: 15,
      col: 8,
      message: "'unused' is defined but never used",
      suggestion: 'Remove the unused variable',
    },
    {
      engine: 'prettier',
      severity: 'error',
      ruleId: 'prettier/prettier',
      file: 'src/test.ts',
      line: 20,
      col: 1,
      message: 'Insert semicolon',
    },
  ]

  describe('formatIssuesForOutput', () => {
    it('should format issues in XML mode', () => {
      const result = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.XML,
      })

      expect(result).toContain('<quality-check-result>')
      expect(result).toContain('<typescript>')
      expect(result).toContain('<eslint>')
      expect(result).toContain('<prettier>')
      expect(result).toContain('</quality-check-result>')
      expect(result).toContain('TS2307')
      expect(result).toContain('no-unused-vars')
    })

    it('should format issues in plain text mode', () => {
      const result = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.PLAIN_TEXT,
      })

      expect(result).toContain('TypeScript Errors:')
      expect(result).toContain('ESLint Issues:')
      expect(result).toContain('Prettier Formatting:')
      expect(result).toContain("Cannot find module '@missing/module'")
      expect(result).toContain("'unused' is defined but never used")
    })

    it('should format issues in JSON mode', () => {
      const result = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.JSON,
      })

      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('issues')
      expect(parsed.issues).toHaveLength(3)
      expect(parsed.issues[0]).toHaveProperty('engine', 'typescript')
      expect(parsed.issues[1]).toHaveProperty('engine', 'eslint')
      expect(parsed.issues[2]).toHaveProperty('engine', 'prettier')
    })

    it('should handle empty issues array', () => {
      const result = formatter.formatIssuesForOutput([], {
        mode: OutputMode.XML,
      })

      expect(result).toBe('')
    })

    it('should include context when provided', () => {
      const result = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.XML,
        context: 'Auto-fix failed',
      })

      expect(result).toContain('<context>Auto-fix failed</context>')
    })

    it('should apply XML escaping in XML mode', () => {
      const issuesWithSpecialChars: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'test-rule',
          file: 'src/test.ts',
          line: 1,
          col: 1,
          message: 'Message with <special> & "characters"',
        },
      ]

      const result = formatter.formatIssuesForOutput(issuesWithSpecialChars, {
        mode: OutputMode.XML,
      })

      expect(result).toContain('&lt;special&gt;')
      expect(result).toContain('&amp;')
      expect(result).toContain('&quot;characters&quot;')
    })

    it('should include summary in plain text mode when requested', () => {
      const result = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.PLAIN_TEXT,
        includeSummary: true,
      })

      expect(result).toContain('Found 3 issues')
      expect(result).toContain('2 errors')
      expect(result).toContain('1 warning')
    })

    it('should respect verbosity settings', () => {
      const detailedResult = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.PLAIN_TEXT,
        verbose: true,
      })

      const conciseResult = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.PLAIN_TEXT,
        verbose: false,
      })

      expect(detailedResult.length).toBeGreaterThan(conciseResult.length)
      expect(detailedResult).toContain('SUGGESTION:')
    })

    it('should group issues by file when requested', () => {
      const multiFileIssues: Issue[] = [
        ...mockIssues,
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2345',
          file: 'src/other.ts',
          line: 5,
          col: 10,
          message: 'Type error',
        },
      ]

      const result = formatter.formatIssuesForOutput(multiFileIssues, {
        mode: OutputMode.PLAIN_TEXT,
        groupByFile: true,
      })

      expect(result).toContain('src/test.ts')
      expect(result).toContain('src/other.ts')
    })
  })

  describe('getOutputMode', () => {
    it('should return XML mode by default', () => {
      const mode = formatter.getOutputMode()
      expect(mode).toBe(OutputMode.XML)
    })

    it('should return mode from environment variable', () => {
      process.env.QUALITY_CHECK_OUTPUT_MODE = 'json'
      const newFormatter = new OutputFormatter()
      const mode = newFormatter.getOutputMode()
      expect(mode).toBe(OutputMode.JSON)
      delete process.env.QUALITY_CHECK_OUTPUT_MODE
    })

    it('should fallback to XML for invalid environment value', () => {
      process.env.QUALITY_CHECK_OUTPUT_MODE = 'invalid'
      const newFormatter = new OutputFormatter()
      const mode = newFormatter.getOutputMode()
      expect(mode).toBe(OutputMode.XML)
      delete process.env.QUALITY_CHECK_OUTPUT_MODE
    })

    it('should allow override via options', () => {
      const mode = formatter.getOutputMode({ mode: OutputMode.PLAIN_TEXT })
      expect(mode).toBe(OutputMode.PLAIN_TEXT)
    })
  })

  describe('formatForBlockingOutput', () => {
    it('should include blocking header and footer', () => {
      const result = formatter.formatForBlockingOutput(mockIssues, {
        mode: OutputMode.XML,
        context: 'Quality issues detected',
      })

      expect(result).toContain('🚫 BLOCKING:')
      expect(result).toContain('❌ DO NOT PROCEED')
      expect(result).toContain('CONTEXT: Quality issues detected')
    })

    it('should use XML mode by default for blocking', () => {
      const result = formatter.formatForBlockingOutput(mockIssues)

      expect(result).toContain('<quality-check-result>')
      expect(result).toContain('🚫 BLOCKING:')
    })
  })

  describe('formatSummaryOnly', () => {
    it('should return only summary without details', () => {
      const result = formatter.formatSummaryOnly(mockIssues)

      expect(result).toContain('Found 3 issues')
      expect(result).toContain('By engine:')
      expect(result).toContain('TypeScript: 1 issue')
      expect(result).toContain('ESLint: 1 issue')
      expect(result).toContain('Prettier: 1 issue')
      expect(result).not.toContain('Cannot find module')
    })

    it('should handle empty issues', () => {
      const result = formatter.formatSummaryOnly([])
      expect(result).toBe('No quality issues found.')
    })
  })

  describe('validateOutput', () => {
    it('should validate XML output structure', () => {
      const xmlOutput = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.XML,
      })

      const isValid = formatter.validateOutput(xmlOutput, OutputMode.XML)
      expect(isValid).toBe(true)
    })

    it('should validate JSON output structure', () => {
      const jsonOutput = formatter.formatIssuesForOutput(mockIssues, {
        mode: OutputMode.JSON,
      })

      const isValid = formatter.validateOutput(jsonOutput, OutputMode.JSON)
      expect(isValid).toBe(true)
    })

    it('should return false for invalid JSON', () => {
      const isValid = formatter.validateOutput('not json', OutputMode.JSON)
      expect(isValid).toBe(false)
    })

    it('should return false for invalid XML', () => {
      const isValid = formatter.validateOutput('<unclosed', OutputMode.XML)
      expect(isValid).toBe(false)
    })
  })
})
