import { beforeEach, describe, expect, test } from 'vitest'
import { ClaudeFormatter } from './claude-formatter.js'
import type { Issue } from '../types/issue-types.js'

describe('ClaudeFormatter', () => {
  let formatter: ClaudeFormatter

  beforeEach(() => {
    formatter = new ClaudeFormatter()
  })

  describe('format', () => {
    test('should_return_empty_string_when_no_issues_provided', () => {
      const result = formatter.format([])
      expect(result).toBe('')
    })

    test('should_return_empty_string_when_issues_array_is_undefined', () => {
      const result = formatter.format(undefined as any)
      expect(result).toBe('')
    })

    test('should_format_single_typescript_error_with_xml_structure', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2307',
          file: '/src/components/Button.ts',
          line: 10,
          col: 5,
          message: "Cannot find module 'react'",
        },
      ]

      const result = formatter.format(issues)

      expect(result).toBe(`<quality-check-result>
  <typescript>
    <error file="/src/components/Button.ts" line="10" column="5" code="TS2307">
      Cannot find module &apos;react&apos;
    </error>
  </typescript>
</quality-check-result>`)
    })

    test('should_format_multiple_eslint_issues_with_proper_grouping', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'no-unused-vars',
          file: '/src/utils/helper.js',
          line: 15,
          col: 7,
          message: "'unusedVar' is assigned a value but never used",
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'prefer-const',
          file: '/src/utils/helper.js',
          line: 20,
          col: 3,
          message: "'let' is never reassigned. Use 'const' instead",
        },
      ]

      const result = formatter.format(issues)

      expect(result).toBe(`<quality-check-result>
  <eslint>
    <error file="/src/utils/helper.js" line="15" column="7" code="no-unused-vars">
      &apos;unusedVar&apos; is assigned a value but never used
    </error>
    <warning file="/src/utils/helper.js" line="20" column="3" code="prefer-const">
      &apos;let&apos; is never reassigned. Use &apos;const&apos; instead
    </warning>
  </eslint>
</quality-check-result>`)
    })

    test('should_format_prettier_issues_without_rule_codes', () => {
      const issues: Issue[] = [
        {
          engine: 'prettier',
          severity: 'error',
          file: '/src/styles/main.css',
          line: 1,
          col: 1,
          message: 'Replace `····` with `··`',
        },
      ]

      const result = formatter.format(issues)

      expect(result).toBe(`<quality-check-result>
  <prettier>
    <error file="/src/styles/main.css" line="1" column="1">
      Replace \`····\` with \`··\`
    </error>
  </prettier>
</quality-check-result>`)
    })

    test('should_format_mixed_engine_issues_with_proper_sections', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2322',
          file: '/src/App.tsx',
          line: 25,
          col: 10,
          message: "Type 'string' is not assignable to type 'number'",
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-console',
          file: '/src/App.tsx',
          line: 30,
          col: 5,
          message: 'Unexpected console statement',
        },
        {
          engine: 'prettier',
          severity: 'error',
          file: '/src/App.tsx',
          line: 35,
          col: 1,
          message: 'Delete `·`',
        },
      ]

      const result = formatter.format(issues)

      expect(result).toBe(`<quality-check-result>
  <typescript>
    <error file="/src/App.tsx" line="25" column="10" code="TS2322">
      Type &apos;string&apos; is not assignable to type &apos;number&apos;
    </error>
  </typescript>
  <eslint>
    <warning file="/src/App.tsx" line="30" column="5" code="no-console">
      Unexpected console statement
    </warning>
  </eslint>
  <prettier>
    <error file="/src/App.tsx" line="35" column="1">
      Delete \`·\`
    </error>
  </prettier>
</quality-check-result>`)
    })

    test('should_include_end_positions_when_provided', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2304',
          file: '/src/test.ts',
          line: 5,
          col: 10,
          endLine: 5,
          endCol: 20,
          message: "Cannot find name 'unknownVar'",
        },
      ]

      const result = formatter.format(issues)

      expect(result).toBe(`<quality-check-result>
  <typescript>
    <error file="/src/test.ts" line="5" column="10" code="TS2304" endLine="5" endColumn="20">
      Cannot find name &apos;unknownVar&apos;
    </error>
  </typescript>
</quality-check-result>`)
    })

    test('should_include_suggestions_when_provided', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'no-undef',
          file: '/src/script.js',
          line: 12,
          col: 8,
          message: "'React' is not defined",
          suggestion: "Import React from 'react'",
        },
      ]

      const result = formatter.format(issues)

      expect(result).toBe(`<quality-check-result>
  <eslint>
    <error file="/src/script.js" line="12" column="8" code="no-undef">
      &apos;React&apos; is not defined
      SUGGESTION: Import React from &apos;react&apos;
    </error>
  </eslint>
</quality-check-result>`)
    })
  })

  describe('formatSummary', () => {
    test('should_return_no_issues_message_when_empty_array', () => {
      const result = formatter.formatSummary([])
      expect(result).toBe('No quality issues found.')
    })

    test('should_provide_summary_statistics_for_single_issue', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: '/src/test.ts',
          line: 1,
          col: 1,
          message: 'Test error',
        },
      ]

      const result = formatter.formatSummary(issues)

      expect(result).toBe('1 TypeScript error')
    })

    test('should_provide_detailed_summary_for_multiple_issues', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: '/src/test.ts',
          line: 1,
          col: 1,
          message: 'TS error',
        },
        {
          engine: 'eslint',
          severity: 'warning',
          file: '/src/test.js',
          line: 2,
          col: 1,
          message: 'ESLint warning',
        },
        {
          engine: 'prettier',
          severity: 'error',
          file: '/src/test.css',
          line: 3,
          col: 1,
          message: 'Prettier error',
        },
      ]

      const result = formatter.formatSummary(issues)

      expect(result).toBe('1 TypeScript error, 1 Prettier error')
    })
  })

  describe('formatDetailed', () => {
    test('should_return_no_issues_message_when_empty', () => {
      const result = formatter.formatDetailed([])
      expect(result).toBe('No quality issues found.')
    })

    test('should_format_detailed_view_with_emojis_and_locations', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          ruleId: 'TS2307',
          file: '/src/Button.tsx',
          line: 10,
          col: 5,
          message: "Cannot find module 'react'",
        },
        {
          engine: 'eslint',
          severity: 'warning',
          ruleId: 'no-console',
          file: '/src/utils.js',
          line: 15,
          col: 8,
          message: 'Unexpected console statement',
          suggestion: 'Use a logging library instead',
        },
      ]

      const result = formatter.formatDetailed(issues)

      expect(result).toBe(`TypeScript Errors:
  ❌ /src/Button.tsx:10:5 (TS2307): Cannot find module 'react'

ESLint Issues:
  ⚠️ /src/utils.js:15:8 (no-console): Unexpected console statement
     💡 Use a logging library instead`)
    })

    test('should_handle_info_severity_with_appropriate_emoji', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'info',
          ruleId: 'no-inline-comments',
          file: '/src/test.js',
          line: 5,
          col: 10,
          message: 'Inline comment found',
        },
      ]

      const result = formatter.formatDetailed(issues)

      expect(result).toBe(`ESLint Issues:
  ℹ️ /src/test.js:5:10 (no-inline-comments): Inline comment found`)
    })
  })

  describe('XML escaping', () => {
    test('should_escape_xml_special_characters_in_messages', () => {
      const issues: Issue[] = [
        {
          engine: 'typescript',
          severity: 'error',
          file: '/src/test.ts',
          line: 1,
          col: 1,
          message: 'Error with <tags> & "quotes" and \'apostrophes\'',
        },
      ]

      const result = formatter.format(issues)

      expect(result).toContain(
        'Error with &lt;tags&gt; &amp; &quot;quotes&quot; and &apos;apostrophes&apos;',
      )
    })

    test('should_escape_xml_characters_in_file_paths', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          file: '/src/components/Button<Props>.tsx',
          line: 1,
          col: 1,
          message: 'Test error',
        },
      ]

      const result = formatter.format(issues)

      expect(result).toContain('file="/src/components/Button&lt;Props&gt;.tsx"')
    })

    test('should_escape_xml_characters_in_rule_codes', () => {
      const issues: Issue[] = [
        {
          engine: 'eslint',
          severity: 'error',
          ruleId: 'rule<with>tags',
          file: '/src/test.js',
          line: 1,
          col: 1,
          message: 'Test error',
        },
      ]

      const result = formatter.format(issues)

      expect(result).toContain('code="rule&lt;with&gt;tags"')
    })
  })
})
