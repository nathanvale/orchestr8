import { describe, expect, it, beforeEach } from 'vitest'
import { ResultAggregator } from './aggregator'
import type { CheckerResult } from '../types/issue-types'

describe('ResultAggregator', () => {
  let aggregator: ResultAggregator

  beforeEach(() => {
    aggregator = new ResultAggregator()
  })

  describe('aggregate', () => {
    it('should_aggregate_empty_results_successfully', () => {
      const results = new Map<string, CheckerResult>()

      const aggregated = aggregator.aggregate(results)

      expect(aggregated.success).toBe(true)
      expect(aggregated.issues).toHaveLength(0)
      expect(aggregated.duration).toBe(0)
    })

    it('should_aggregate_successful_results_from_multiple_engines', () => {
      const results = new Map<string, CheckerResult>([
        [
          'typescript',
          {
            success: true,
            issues: [],
            duration: 100,
          },
        ],
        [
          'eslint',
          {
            success: true,
            issues: [],
            duration: 50,
          },
        ],
      ])

      const aggregated = aggregator.aggregate(results)

      expect(aggregated.success).toBe(true)
      expect(aggregated.issues).toHaveLength(0)
      expect(aggregated.duration).toBe(150)
    })

    it('should_aggregate_issues_from_multiple_engines', () => {
      const results = new Map<string, CheckerResult>([
        [
          'typescript',
          {
            success: false,
            issues: [
              {
                engine: 'typescript',
                severity: 'error',
                file: 'test.ts',
                line: 1,
                col: 1,
                message: 'Type error',
              },
            ],
            duration: 100,
          },
        ],
        [
          'eslint',
          {
            success: false,
            issues: [
              {
                engine: 'eslint',
                severity: 'warning',
                file: 'test.ts',
                line: 2,
                col: 1,
                message: 'Linting warning',
                ruleId: 'no-console',
              },
            ],
            duration: 50,
          },
        ],
        [
          'prettier',
          {
            success: false,
            issues: [
              {
                engine: 'prettier',
                severity: 'warning',
                file: 'test.ts',
                line: 3,
                col: 1,
                message: 'Formatting issue',
              },
            ],
            duration: 25,
          },
        ],
      ])

      const aggregated = aggregator.aggregate(results)

      expect(aggregated.success).toBe(false)
      expect(aggregated.issues).toHaveLength(3)
      expect(aggregated.duration).toBe(175)
      expect(aggregated.issues[0].engine).toBe('typescript')
      expect(aggregated.issues[1].engine).toBe('eslint')
      expect(aggregated.issues[2].engine).toBe('prettier')
    })

    it('should_mark_as_failed_if_any_engine_fails', () => {
      const results = new Map<string, CheckerResult>([
        [
          'typescript',
          {
            success: true,
            issues: [],
            duration: 100,
          },
        ],
        [
          'eslint',
          {
            success: false,
            issues: [
              {
                engine: 'eslint',
                severity: 'error',
                file: 'test.ts',
                line: 1,
                col: 1,
                message: 'Error',
              },
            ],
            duration: 50,
          },
        ],
      ])

      const aggregated = aggregator.aggregate(results)

      expect(aggregated.success).toBe(false)
      expect(aggregated.issues).toHaveLength(1)
    })

    it('should_use_provided_duration_when_specified', () => {
      const results = new Map<string, CheckerResult>([
        [
          'typescript',
          {
            success: true,
            issues: [],
            duration: 100,
          },
        ],
      ])

      const aggregated = aggregator.aggregate(results, {
        duration: 200,
      })

      expect(aggregated.duration).toBe(200)
    })

    it('should_include_correlation_id_when_provided', () => {
      const results = new Map<string, CheckerResult>()
      const correlationId = 'test-correlation-id'

      const aggregated = aggregator.aggregate(results, {
        correlationId,
      })

      expect(aggregated.correlationId).toBe(correlationId)
    })

    it('should_track_metrics_when_requested', () => {
      const results = new Map<string, CheckerResult>([
        [
          'typescript',
          {
            success: false,
            issues: [
              {
                engine: 'typescript',
                severity: 'error',
                file: 'test.ts',
                line: 1,
                col: 1,
                message: 'Error',
              },
            ],
            duration: 100,
          },
        ],
        [
          'eslint',
          {
            success: false,
            issues: [
              {
                engine: 'eslint',
                severity: 'warning',
                file: 'test.ts',
                line: 2,
                col: 1,
                message: 'Warning',
              },
              {
                engine: 'eslint',
                severity: 'warning',
                file: 'test2.ts',
                line: 1,
                col: 1,
                message: 'Another warning',
              },
            ],
            duration: 50,
            fixable: true,
            fixedCount: 1,
          },
        ],
      ])

      const aggregated = aggregator.aggregate(results, {
        trackMetrics: true,
      })

      expect(aggregated.metrics).toBeDefined()
      expect(aggregated.metrics?.issueCount).toBe(3)
      expect(aggregated.metrics?.fileCount).toBe(2)
      expect(aggregated.metrics?.type).toBe('cold')
      expect(aggregated.metrics?.durationMs).toBe(150)
      // Check extended metrics if they exist
      const extended = (aggregated.metrics as any)?.extended
      if (extended) {
        expect(extended.errorCount).toBe(1)
        expect(extended.warningCount).toBe(2)
        expect(extended.engineCount).toBe(2)
        expect(extended.fixableCount).toBe(1)
        expect(extended.fixedCount).toBe(1)
      }
    })

    it('should_filter_issues_by_severity_when_requested', () => {
      const results = new Map<string, CheckerResult>([
        [
          'multi',
          {
            success: false,
            issues: [
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
                severity: 'warning',
                file: 'test.ts',
                line: 2,
                col: 1,
                message: 'Warning',
              },
              {
                engine: 'prettier',
                severity: 'info',
                file: 'test.ts',
                line: 3,
                col: 1,
                message: 'Info',
              },
            ],
            duration: 100,
          },
        ],
      ])

      const errors = aggregator.filterBySeverity(aggregator.aggregate(results).issues, ['error'])
      const warnings = aggregator.filterBySeverity(aggregator.aggregate(results).issues, [
        'warning',
      ])

      expect(errors).toHaveLength(1)
      expect(errors[0].severity).toBe('error')
      expect(warnings).toHaveLength(1)
      expect(warnings[0].severity).toBe('warning')
    })

    it('should_group_issues_by_file', () => {
      const results = new Map<string, CheckerResult>([
        [
          'multi',
          {
            success: false,
            issues: [
              {
                engine: 'typescript',
                severity: 'error',
                file: 'file1.ts',
                line: 1,
                col: 1,
                message: 'Error in file1',
              },
              {
                engine: 'eslint',
                severity: 'warning',
                file: 'file2.ts',
                line: 1,
                col: 1,
                message: 'Warning in file2',
              },
              {
                engine: 'prettier',
                severity: 'info',
                file: 'file1.ts',
                line: 2,
                col: 1,
                message: 'Info in file1',
              },
            ],
            duration: 100,
          },
        ],
      ])

      const aggregated = aggregator.aggregate(results)
      const grouped = aggregator.groupByFile(aggregated.issues)

      expect(grouped.size).toBe(2)
      expect(grouped.get('file1.ts')).toHaveLength(2)
      expect(grouped.get('file2.ts')).toHaveLength(1)
    })
  })
})
