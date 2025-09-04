/**
 * ErrorParser - Structured error extraction from tool outputs
 * Minimal implementation following YAGNI principles
 */

import type { ParsedError } from '../types.js'

interface ParseOptions {
  maxErrors?: number
}

export class ErrorParser {
  // Auto-fixable ESLint rules (common formatting/style rules)
  private readonly FIXABLE_RULES = new Set([
    'semi',
    'quotes',
    'indent',
    'comma-dangle',
    'space-before-function-paren',
    'object-curly-spacing',
    'no-trailing-spaces',
    'eol-last',
    'no-multiple-empty-lines',
    'arrow-parens',
    'no-extra-semi',
    'comma-spacing',
    'key-spacing',
    'keyword-spacing',
    'space-infix-ops',
    'padded-blocks',
    '@typescript-eslint/semi',
    '@typescript-eslint/quotes',
    '@typescript-eslint/indent',
    '@typescript-eslint/comma-dangle',
    '@typescript-eslint/member-delimiter-style',
  ])

  // TypeScript error regex pattern
  // Matches: src/app.ts(10,5): error TS2304: Cannot find name 'unknownVariable'.
  private readonly TS_ERROR_PATTERN = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+?)$/

  /**
   * Parse TypeScript compiler errors from stderr output
   */
  parseTypeScriptErrors(stderr: string, options: ParseOptions = {}): ParsedError[] {
    if (!stderr) return []

    const maxErrors = options.maxErrors ?? 50
    const errors: ParsedError[] = []
    const lines = stderr.split('\n')

    for (const line of lines) {
      if (errors.length >= maxErrors) break

      const match = this.TS_ERROR_PATTERN.exec(line.trim())
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          code: match[4],
          message: match[5].replace(/\.$/, ''), // Remove trailing period
          severity: 'error',
          source: 'typescript',
          fixable: false,
        })
      }
    }

    return errors
  }

  /**
   * Parse ESLint JSON output into structured errors
   */
  parseESLintErrors(jsonOutput: string): ParsedError[] {
    try {
      const results = JSON.parse(jsonOutput)
      const errors: ParsedError[] = []

      for (const file of results) {
        for (const msg of file.messages) {
          errors.push({
            file: file.filePath,
            line: msg.line || 0,
            column: msg.column || 0,
            code: msg.ruleId || 'unknown',
            message: msg.message,
            severity: msg.severity === 2 ? 'error' : 'warning',
            source: 'eslint',
            fixable: msg.fix !== undefined || this.FIXABLE_RULES.has(msg.ruleId || ''),
          })
        }
      }

      return errors
    } catch {
      return []
    }
  }

  /**
   * Parse Prettier output (simple format)
   */
  parsePrettierErrors(files: string[]): ParsedError[] {
    // Prettier doesn't provide detailed errors, just files that need formatting
    return files.map((file) => ({
      file,
      line: 0,
      column: 0,
      code: 'prettier',
      message: 'File needs formatting',
      severity: 'error' as const,
      source: 'prettier' as const,
      fixable: true,
    }))
  }

  /**
   * Categorize an error for better classification
   */
  categorizeError(error: ParsedError): ParsedError {
    // All Prettier errors are fixable
    if (error.source === 'prettier') {
      return { ...error, fixable: true, category: 'style' }
    }

    // TypeScript errors are never auto-fixable
    if (error.source === 'typescript') {
      return { ...error, fixable: false, category: 'type' }
    }

    // ESLint errors depend on the rule
    if (error.source === 'eslint') {
      const isFixable = this.FIXABLE_RULES.has(error.code)
      let category: ParsedError['category'] = 'style'

      // Categorize based on rule name patterns
      if (error.code.includes('complexity') || error.code.includes('max-')) {
        category = 'complexity'
      } else if (error.code.includes('no-unused') || error.code.includes('no-undef')) {
        category = 'syntax'
      } else if (error.code.includes('typescript') || error.code.includes('type')) {
        category = 'type'
      }

      return { ...error, fixable: isFixable, category }
    }

    return error
  }

  /**
   * Format errors for display
   */
  formatError(error: ParsedError): string {
    const location = error.line > 0 ? `:${error.line}:${error.column}` : ''
    const code = error.code !== 'unknown' ? ` (${error.code})` : ''
    return `${error.file}${location} - ${error.message}${code}`
  }

  /**
   * Group errors by source tool
   */
  groupBySource(errors: ParsedError[]): Record<string, ParsedError[]> {
    const grouped: Record<string, ParsedError[]> = {
      eslint: [],
      prettier: [],
      typescript: [],
    }

    for (const error of errors) {
      if (grouped[error.source]) {
        grouped[error.source].push(error)
      }
    }

    return grouped
  }

  /**
   * Filter errors by fixability
   */
  filterByFixability(errors: ParsedError[]): {
    fixable: ParsedError[]
    unfixable: ParsedError[]
  } {
    const fixable: ParsedError[] = []
    const unfixable: ParsedError[] = []

    for (const error of errors) {
      const categorized = this.categorizeError(error)
      if (categorized.fixable) {
        fixable.push(categorized)
      } else {
        unfixable.push(categorized)
      }
    }

    return { fixable, unfixable }
  }
}
