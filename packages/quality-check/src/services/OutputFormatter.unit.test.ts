/**
 * Tests for OutputFormatter Service - ANSI Console Output
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ErrorReport } from '../utils/logger'

// Mock chalk/picocolors before importing OutputFormatter
vi.mock('picocolors', () => ({
  default: {
    red: (text: string) => `[RED]${text}[/RED]`,
    yellow: (text: string) => `[YELLOW]${text}[/YELLOW]`,
    green: (text: string) => `[GREEN]${text}[/GREEN]`,
    blue: (text: string) => `[BLUE]${text}[/BLUE]`,
    cyan: (text: string) => `[CYAN]${text}[/CYAN]`,
    magenta: (text: string) => `[MAGENTA]${text}[/MAGENTA]`,
    gray: (text: string) => `[GRAY]${text}[/GRAY]`,
    bold: (text: string) => `[BOLD]${text}[/BOLD]`,
    dim: (text: string) => `[DIM]${text}[/DIM]`,
    underline: (text: string) => `[UNDERLINE]${text}[/UNDERLINE]`,
  },
}))

describe('OutputFormatter Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('formatErrorSummary', () => {
    it('should format error summary with colors', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'eslint',
        status: 'error',
        summary: {
          totalErrors: 5,
          totalWarnings: 2,
          filesAffected: 3,
        },
        details: {
          files: [
            {
              path: 'src/example.ts',
              errors: [
                {
                  line: 42,
                  column: 10,
                  message: 'Missing semicolon',
                  ruleId: 'semi',
                  severity: 'error',
                },
              ],
            },
          ],
        },
        raw: '',
      }

      const formatted = OutputFormatter.formatErrorSummary(report)

      expect(formatted).toContain('[RED]')
      expect(formatted).toContain('5 errors')
      expect(formatted).toContain('2 warnings')
      expect(formatted).toContain('3 files')
    })

    it('should handle reports with no errors', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'typescript',
        status: 'success',
        summary: {
          totalErrors: 0,
          totalWarnings: 0,
          filesAffected: 0,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const formatted = OutputFormatter.formatErrorSummary(report)

      expect(formatted).toBe('')
    })

    it('should format warnings-only summary', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'prettier',
        status: 'warning',
        summary: {
          totalErrors: 0,
          totalWarnings: 3,
          filesAffected: 2,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const formatted = OutputFormatter.formatErrorSummary(report)

      expect(formatted).toContain('[YELLOW]')
      expect(formatted).toContain('3 warnings')
      expect(formatted).toContain('2 files')
    })
  })

  describe('formatSuccessSummary', () => {
    it('should format success summary with green color', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'eslint',
        status: 'success',
        summary: {
          totalErrors: 0,
          totalWarnings: 0,
          filesAffected: 0,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const formatted = OutputFormatter.formatSuccessSummary(report)

      expect(formatted).toContain('[GREEN]')
      expect(formatted).toContain('✓')
      expect(formatted).toContain('ESLint')
      expect(formatted).toContain('No issues found')
    })

    it('should handle different tools correctly', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const tools: Array<'eslint' | 'typescript' | 'prettier'> = [
        'eslint',
        'typescript',
        'prettier',
      ]

      for (const tool of tools) {
        const report: ErrorReport = {
          timestamp: '2025-09-09T10:30:00.000Z',
          tool,
          status: 'success',
          summary: {
            totalErrors: 0,
            totalWarnings: 0,
            filesAffected: 0,
          },
          details: {
            files: [],
          },
          raw: '',
        }

        const formatted = OutputFormatter.formatSuccessSummary(report)
        const expectedName =
          tool === 'eslint' ? 'ESLint' : tool === 'typescript' ? 'TypeScript' : 'Prettier'

        expect(formatted).toContain(expectedName)
      }
    })
  })

  describe('formatFileList', () => {
    it('should format file list with proper indentation', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const files = ['src/index.ts', 'src/utils/logger.ts', 'src/services/api.ts']

      const formatted = OutputFormatter.formatFileList(files)

      expect(formatted).toContain('src/index.ts')
      expect(formatted).toContain('src/utils/logger.ts')
      expect(formatted).toContain('src/services/api.ts')
      expect(formatted).toMatch(/^\s+•/m) // Bullet points with indentation
    })

    it('should handle empty file list', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const files: string[] = []
      const formatted = OutputFormatter.formatFileList(files)

      expect(formatted).toBe('')
    })

    it('should truncate long file lists', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const files = Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`)
      const formatted = OutputFormatter.formatFileList(files, 10)

      expect(formatted).toContain('src/file0.ts')
      expect(formatted).toContain('src/file9.ts')
      expect(formatted).toContain('...and 5 more files')
      expect(formatted).not.toContain('src/file10.ts')
    })
  })

  describe('colorize', () => {
    it('should apply red color for errors', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const text = 'Error message'
      const colored = OutputFormatter.colorize(text, 'red')

      expect(colored).toBe('[RED]Error message[/RED]')
    })

    it('should apply yellow color for warnings', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const text = 'Warning message'
      const colored = OutputFormatter.colorize(text, 'yellow')

      expect(colored).toBe('[YELLOW]Warning message[/YELLOW]')
    })

    it('should apply green color for success', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const text = 'Success message'
      const colored = OutputFormatter.colorize(text, 'green')

      expect(colored).toBe('[GREEN]Success message[/GREEN]')
    })

    it('should handle empty strings', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const colored = OutputFormatter.colorize('', 'red')
      expect(colored).toBe('[RED][/RED]')
    })
  })

  describe('Console Summary Templates', () => {
    it('should format ESLint error summary', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'eslint',
        status: 'error',
        summary: {
          totalErrors: 10,
          totalWarnings: 5,
          filesAffected: 4,
        },
        details: {
          files: [
            {
              path: 'src/app.ts',
              errors: Array(5).fill({
                line: 1,
                column: 1,
                message: 'Test error',
                severity: 'error',
              }),
            },
          ],
        },
        raw: '',
      }

      const summary = OutputFormatter.getConsoleSummary(report)

      expect(summary).toContain('ESLint Check Failed')
      expect(summary).toContain('10 errors')
      expect(summary).toContain('5 warnings')
      expect(summary).toContain('4 files affected')
    })

    it('should format TypeScript error summary', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'typescript',
        status: 'error',
        summary: {
          totalErrors: 3,
          totalWarnings: 0,
          filesAffected: 2,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const summary = OutputFormatter.getConsoleSummary(report)

      expect(summary).toContain('TypeScript Compilation Failed')
      expect(summary).toContain('3 errors')
      expect(summary).toContain('2 files affected')
    })

    it('should format Prettier error summary', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'prettier',
        status: 'error',
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          filesAffected: 1,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const summary = OutputFormatter.getConsoleSummary(report)

      expect(summary).toContain('Prettier Check Failed')
      expect(summary).toContain('1 error')
      expect(summary).toContain('1 file affected')
    })
  })

  describe('Silent Mode Support', () => {
    it('should return empty string in silent mode', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'eslint',
        status: 'error',
        summary: {
          totalErrors: 5,
          totalWarnings: 2,
          filesAffected: 3,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const summary = OutputFormatter.getConsoleSummary(report, { silent: true })

      expect(summary).toBe('')
    })

    it('should respect silent mode for all formatting methods', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2025-09-09T10:30:00.000Z',
        tool: 'typescript',
        status: 'success',
        summary: {
          totalErrors: 0,
          totalWarnings: 0,
          filesAffected: 0,
        },
        details: {
          files: [],
        },
        raw: '',
      }

      const errorSummary = OutputFormatter.formatErrorSummary(report, { silent: true })
      const successSummary = OutputFormatter.formatSuccessSummary(report, { silent: true })
      const fileList = OutputFormatter.formatFileList(['test.ts'], undefined, { silent: true })

      expect(errorSummary).toBe('')
      expect(successSummary).toBe('')
      expect(fileList).toBe('')
    })
  })

  describe('Color Configuration', () => {
    it('should skip colors when colored option is false', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const text = 'Test message'
      const colored = OutputFormatter.colorize(text, 'red', { colored: false })

      expect(colored).toBe('Test message')
      expect(colored).not.toContain('[RED]')
    })

    it('should apply colors when colored option is true', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const text = 'Test message'
      const colored = OutputFormatter.colorize(text, 'green', { colored: true })

      expect(colored).toBe('[GREEN]Test message[/GREEN]')
    })
  })

  describe('formatMinimalConsole', () => {
    it('should format minimal console output for single file with errors', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2023-01-01T00:00:00.000Z',
        tool: 'eslint',
        status: 'error',
        summary: {
          totalErrors: 2,
          totalWarnings: 1,
          filesAffected: 1,
        },
        details: {
          files: [
            {
              path: '/Users/test/file.ts',
              errors: [
                {
                  line: 64,
                  column: 23,
                  message: 'Unexpected any. Specify a different type',
                  severity: 'warning',
                  ruleId: '@typescript-eslint/no-explicit-any',
                },
                {
                  line: 70,
                  column: 23,
                  message: 'Unexpected any. Specify a different type',
                  severity: 'warning',
                  ruleId: '@typescript-eslint/no-explicit-any',
                },
              ],
            },
          ],
        },
        raw: 'raw output',
      }

      const formatted = OutputFormatter.formatMinimalConsole(report, { colored: false })

      expect(formatted).toContain('/Users/test/file.ts')
      expect(formatted).toContain('64:23     warning   Unexpected any. Specify a different type')
      expect(formatted).toContain('70:23     warning   Unexpected any. Specify a different type')
      expect(formatted).toContain('✖ 3 problems (2 errors, 1 warning)')
    })

    it('should format minimal console output for multiple files', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2023-01-01T00:00:00.000Z',
        tool: 'typescript',
        status: 'error',
        summary: {
          totalErrors: 1,
          totalWarnings: 1,
          filesAffected: 2,
        },
        details: {
          files: [
            {
              path: '/Users/test/file1.ts',
              errors: [
                {
                  line: 10,
                  column: 5,
                  message: 'Type error message',
                  severity: 'error',
                  ruleId: 'TS2339',
                },
              ],
            },
            {
              path: '/Users/test/file2.ts',
              errors: [
                {
                  line: 20,
                  column: 10,
                  message: 'Warning message',
                  severity: 'warning',
                  ruleId: 'TS2345',
                },
              ],
            },
          ],
        },
        raw: 'tsc output',
      }

      const formatted = OutputFormatter.formatMinimalConsole(report, { colored: false })

      expect(formatted).toContain('/Users/test/file1.ts')
      expect(formatted).toContain('/Users/test/file2.ts')
      expect(formatted).toContain('10:5      error     Type error message')
      expect(formatted).toContain('20:10     warning   Warning message')
      expect(formatted).toContain('✖ 2 problems (1 error, 1 warning)')
    })

    it('should format success report in minimal style', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2023-01-01T00:00:00.000Z',
        tool: 'prettier',
        status: 'success',
        summary: {
          totalErrors: 0,
          totalWarnings: 0,
          filesAffected: 0,
        },
        details: {
          files: [],
        },
        raw: 'no issues',
      }

      const formatted = OutputFormatter.formatMinimalConsole(report)

      expect(formatted).toBe('[GREEN]✓ Prettier: No issues found[/GREEN]')
    })

    it('should handle colored output correctly', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2023-01-01T00:00:00.000Z',
        tool: 'eslint',
        status: 'error',
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          filesAffected: 1,
        },
        details: {
          files: [
            {
              path: '/Users/test/file.ts',
              errors: [
                {
                  line: 1,
                  column: 1,
                  message: 'Error message',
                  severity: 'error',
                  ruleId: 'no-unused-vars',
                },
              ],
            },
          ],
        },
        raw: 'eslint output',
      }

      const formatted = OutputFormatter.formatMinimalConsole(report, { colored: true })

      expect(formatted).toContain('[RED]✖[/RED]')
      expect(formatted).toContain('[RED]error   [/RED]')
    })

    it('should return empty string in silent mode', async () => {
      const { OutputFormatter } = await import('./OutputFormatter')

      const report: ErrorReport = {
        timestamp: '2023-01-01T00:00:00.000Z',
        tool: 'eslint',
        status: 'error',
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          filesAffected: 1,
        },
        details: {
          files: [
            {
              path: '/Users/test/file.ts',
              errors: [
                {
                  line: 1,
                  column: 1,
                  message: 'Error message',
                  severity: 'error',
                },
              ],
            },
          ],
        },
        raw: 'eslint output',
      }

      const formatted = OutputFormatter.formatMinimalConsole(report, { silent: true })

      expect(formatted).toBe('')
    })
  })
})
