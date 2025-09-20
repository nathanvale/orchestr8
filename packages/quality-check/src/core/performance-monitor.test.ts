import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PerformanceMonitor } from './performance-monitor'
import * as fs from 'node:fs/promises'

vi.mock('node:fs/promises')

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
    vi.clearAllMocks()
  })

  describe('Session Management', () => {
    it('should_start_new_session_when_startSession_called', () => {
      monitor.startSession()
      const report = monitor.generateReport()

      expect(report.metrics).toHaveLength(0)
      expect(report.summary.totalDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Metric Recording', () => {
    it('should_record_metric_when_recordMetric_called', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })

      const report = monitor.generateReport()
      expect(report.metrics).toHaveLength(1)
      expect(report.metrics[0].engine).toBe('typescript')
      expect(report.metrics[0].duration).toBe(100)
    })

    it('should_track_multiple_metrics_when_recorded', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })

      monitor.recordMetric({
        engine: 'eslint',
        operation: 'lint',
        duration: 50,
        success: true,
      })

      monitor.recordMetric({
        engine: 'prettier',
        operation: 'format',
        duration: 30,
        success: false,
      })

      const report = monitor.generateReport()
      expect(report.metrics).toHaveLength(3)
      expect(report.summary.successRate).toBe((2 / 3) * 100)
    })
  })

  describe('Operation Tracking', () => {
    it('should_track_operation_automatically_when_trackOperation_called', async () => {
      monitor.startSession()

      const result = await monitor.trackOperation('typescript', 'compile', async () => {
        await Promise.resolve() // Removed setTimeout to eliminate timing dependency
        return 'success'
      })

      expect(result).toBe('success')

      const report = monitor.generateReport()
      expect(report.metrics).toHaveLength(1)
      expect(report.metrics[0].engine).toBe('typescript')
      expect(report.metrics[0].operation).toBe('compile')
      expect(report.metrics[0].success).toBe(true)
      expect(report.metrics[0].duration).toBeGreaterThan(0)
    })

    it('should_record_failure_when_operation_throws', async () => {
      monitor.startSession()

      await expect(
        monitor.trackOperation('eslint', 'lint', async () => {
          throw new Error('Lint failed')
        }),
      ).rejects.toThrow('Lint failed')

      const report = monitor.generateReport()
      expect(report.metrics).toHaveLength(1)
      expect(report.metrics[0].success).toBe(false)
    })
  })

  describe('Report Generation', () => {
    it('should_generate_empty_report_when_no_metrics', () => {
      monitor.startSession()
      const report = monitor.generateReport()

      expect(report.summary.totalDuration).toBeGreaterThanOrEqual(0)
      expect(report.summary.avgDuration).toBe(0)
      expect(report.summary.medianDuration).toBe(0)
      expect(report.summary.successRate).toBe(0)
      expect(report.metrics).toHaveLength(0)
      expect(report.byEngine).toEqual({})
    })

    it('should_calculate_statistics_when_metrics_exist', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 200,
        success: true,
      })
      monitor.recordMetric({ engine: 'eslint', operation: 'lint', duration: 50, success: true })
      monitor.recordMetric({ engine: 'eslint', operation: 'lint', duration: 150, success: false })

      const report = monitor.generateReport()

      expect(report.summary.avgDuration).toBe(125)
      expect(report.summary.medianDuration).toBe(125)
      expect(report.summary.minDuration).toBe(50)
      expect(report.summary.maxDuration).toBe(200)
      expect(report.summary.successRate).toBe(75)

      expect(report.byEngine.typescript.count).toBe(2)
      expect(report.byEngine.typescript.avgDuration).toBe(150)
      expect(report.byEngine.typescript.successRate).toBe(100)

      expect(report.byEngine.eslint.count).toBe(2)
      expect(report.byEngine.eslint.avgDuration).toBe(100)
      expect(report.byEngine.eslint.successRate).toBe(50)
    })

    it('should_calculate_cache_hit_rate_when_cache_metrics_exist', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
        cacheHit: true,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 200,
        success: true,
        cacheHit: false,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 150,
        success: true,
        cacheHit: true,
      })

      const report = monitor.generateReport()

      expect(report.summary.cacheHitRate).toBe((2 / 3) * 100)
    })
  })

  describe('Recommendations', () => {
    it('should_recommend_optimization_when_median_exceeds_300ms', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 400,
        success: true,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 500,
        success: true,
      })

      const report = monitor.generateReport()

      expect(report.recommendations).toBeDefined()
      expect(report.recommendations?.some((r) => r.includes('exceeds 300ms'))).toBe(true)
    })

    it('should_recommend_cache_improvement_when_hit_rate_low', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
        cacheHit: false,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
        cacheHit: false,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
        cacheHit: true,
      })

      const report = monitor.generateReport()

      expect(report.recommendations).toBeDefined()
      expect(report.recommendations?.some((r) => r.includes('Low cache hit rate'))).toBe(true)
    })

    it('should_identify_outliers_when_present', () => {
      monitor.startSession()

      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'compile',
        duration: 1000,
        success: true,
      })

      const report = monitor.generateReport()

      expect(report.recommendations).toBeDefined()
      expect(report.recommendations?.some((r) => r.includes('outliers'))).toBe(true)
    })
  })

  describe('File Operations', () => {
    it('should_save_report_to_file_when_saveReport_called', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile)
      const mockMkdir = vi.mocked(fs.mkdir)

      monitor.startSession()
      monitor.recordMetric({
        engine: 'typescript',
        operation: 'check',
        duration: 100,
        success: true,
      })

      const report = monitor.generateReport()
      const savedPath = await monitor.saveReport(report, 'test-report.json')

      expect(mockMkdir).toHaveBeenCalled()

      // Check that writeFile was called with correct arguments
      expect(mockWriteFile).toHaveBeenCalled()
      const [filePath, content] = mockWriteFile.mock.calls[0]
      expect(filePath).toContain('test-report.json')
      // The content is a JSON string, check it contains the engine data
      expect(typeof content).toBe('string')
      const parsed = JSON.parse(content)
      expect(parsed.metrics[0].engine).toBe('typescript')

      expect(savedPath).toContain('test-report.json')
    })

    it('should_load_historical_reports_when_requested', async () => {
      const mockReaddir = vi.mocked(fs.readdir)
      const mockReadFile = vi.mocked(fs.readFile)
      const mockMkdir = vi.mocked(fs.mkdir)

      mockReaddir.mockResolvedValue([
        'perf-report-1.json',
        'perf-report-2.json',
        'other-file.txt',
      ] as any)

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          summary: { medianDuration: 100 },
          metrics: [],
          byEngine: {},
        }),
      )

      const reports = await monitor.loadHistoricalReports(5)

      expect(mockMkdir).toHaveBeenCalled()
      expect(mockReaddir).toHaveBeenCalled()
      expect(mockReadFile).toHaveBeenCalledTimes(2)
      expect(reports).toHaveLength(2)
    })
  })

  describe('Trend Analysis', () => {
    it('should_analyze_trends_when_sufficient_data', async () => {
      const mockReaddir = vi.mocked(fs.readdir)
      const mockReadFile = vi.mocked(fs.readFile)
      vi.mocked(fs.mkdir)

      mockReaddir.mockResolvedValue([
        'perf-report-1.json',
        'perf-report-2.json',
        'perf-report-3.json',
      ] as any)

      const reports = [
        { summary: { medianDuration: 250, cacheHitRate: 60 }, metrics: [], byEngine: {} },
        { summary: { medianDuration: 280, cacheHitRate: 55 }, metrics: [], byEngine: {} },
        { summary: { medianDuration: 300, cacheHitRate: 50 }, metrics: [], byEngine: {} },
      ]

      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(reports[0]))
        .mockResolvedValueOnce(JSON.stringify(reports[1]))
        .mockResolvedValueOnce(JSON.stringify(reports[2]))

      const trends = await monitor.analyzeTrends()

      expect(trends.trend).toBe('improving')
      expect(trends.details).toBeDefined()
      expect(trends.details.length).toBeGreaterThan(0)
    })

    it('should_report_insufficient_data_when_too_few_reports', async () => {
      const mockReaddir = vi.mocked(fs.readdir)
      const mockReadFile = vi.mocked(fs.readFile)
      vi.mocked(fs.mkdir)

      mockReaddir.mockResolvedValue(['perf-report-1.json'] as any)
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          summary: { medianDuration: 100 },
          metrics: [],
          byEngine: {},
        }),
      )

      const trends = await monitor.analyzeTrends()

      expect(trends.trend).toBe('stable')
      expect(trends.details[0]).toContain('Insufficient')
    })
  })
})
