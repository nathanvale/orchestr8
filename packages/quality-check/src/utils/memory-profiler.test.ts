import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryProfiler } from './memory-profiler'

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'memoryUsage')
    profiler = new MemoryProfiler()
  })

  describe('snapshot()', () => {
    it('should capture memory usage at a specific point', () => {
      const mockUsage = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      vi.mocked(process.memoryUsage).mockReturnValue(mockUsage)

      const snapshot = profiler.snapshot('test-point')

      expect(snapshot.label).toBe('test-point')
      expect(snapshot.timestamp).toBeInstanceOf(Date)
      expect(snapshot.memory).toEqual({
        rss: 100,
        heapTotal: 80,
        heapUsed: 60,
        external: 10,
        arrayBuffers: 5,
        totalAllocated: 115, // rss + external + arrayBuffers
      })
    })

    it('should track multiple snapshots', () => {
      profiler.snapshot('point-1')
      profiler.snapshot('point-2')
      profiler.snapshot('point-3')

      const history = profiler.getHistory()
      expect(history).toHaveLength(3)
      expect(history[0].label).toBe('point-1')
      expect(history[1].label).toBe('point-2')
      expect(history[2].label).toBe('point-3')
    })
  })

  describe('getDelta()', () => {
    it('should calculate memory delta between two snapshots', () => {
      const mockUsage1 = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      const mockUsage2 = {
        rss: 120 * 1024 * 1024,
        heapTotal: 90 * 1024 * 1024,
        heapUsed: 75 * 1024 * 1024,
        external: 12 * 1024 * 1024,
        arrayBuffers: 6 * 1024 * 1024,
      }

      vi.mocked(process.memoryUsage).mockReturnValueOnce(mockUsage1).mockReturnValueOnce(mockUsage2)

      profiler.snapshot('before')
      profiler.snapshot('after')

      const delta = profiler.getDelta('before', 'after')

      expect(delta).toEqual({
        rss: 20,
        heapTotal: 10,
        heapUsed: 15,
        external: 2,
        arrayBuffers: 1,
        totalAllocated: 23, // (120+12+6) - (100+10+5)
      })
    })

    it('should throw if snapshot labels not found', () => {
      profiler.snapshot('exists')

      expect(() => profiler.getDelta('missing1', 'missing2')).toThrow(
        'Snapshot with label "missing1" not found',
      )

      expect(() => profiler.getDelta('exists', 'missing2')).toThrow(
        'Snapshot with label "missing2" not found',
      )
    })
  })

  describe('getReport()', () => {
    it('should generate a comprehensive memory report', () => {
      const mockUsages = [
        {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 150 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          heapUsed: 90 * 1024 * 1024,
          external: 15 * 1024 * 1024,
          arrayBuffers: 8 * 1024 * 1024,
        },
        {
          rss: 130 * 1024 * 1024,
          heapTotal: 95 * 1024 * 1024,
          heapUsed: 80 * 1024 * 1024,
          external: 12 * 1024 * 1024,
          arrayBuffers: 7 * 1024 * 1024,
        },
      ]

      mockUsages.forEach((usage, i) => {
        vi.mocked(process.memoryUsage).mockReturnValueOnce(usage)
        profiler.snapshot(`point-${i}`)
      })

      const report = profiler.getReport()

      expect(report.snapshots).toHaveLength(3)
      expect(report.summary.peakHeapUsed).toBe(90)
      expect(report.summary.peakRss).toBe(150)
      expect(report.summary.averageHeapUsed).toBe(76.67)
      expect(report.summary.totalSnapshots).toBe(3)

      // Check timeline data
      expect(report.timeline).toHaveLength(3)
      expect(report.timeline[0].heapUsed).toBe(60)
      expect(report.timeline[1].heapUsed).toBe(90)
      expect(report.timeline[2].heapUsed).toBe(80)
    })

    it('should include growth analysis in report', () => {
      const mockUsages = [
        {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 200 * 1024 * 1024,
          heapTotal: 160 * 1024 * 1024,
          heapUsed: 120 * 1024 * 1024,
          external: 20 * 1024 * 1024,
          arrayBuffers: 10 * 1024 * 1024,
        },
      ]

      mockUsages.forEach((usage, i) => {
        vi.mocked(process.memoryUsage).mockReturnValueOnce(usage)
        profiler.snapshot(`point-${i}`)
      })

      const report = profiler.getReport()

      expect(report.growth).toEqual({
        heapGrowth: 60, // 120 - 60
        rssGrowth: 100, // 200 - 100
        percentGrowth: 100, // 100% increase
      })
    })
  })

  describe('reset()', () => {
    it('should clear all snapshots', () => {
      profiler.snapshot('point-1')
      profiler.snapshot('point-2')

      expect(profiler.getHistory()).toHaveLength(2)

      profiler.reset()

      expect(profiler.getHistory()).toHaveLength(0)
    })
  })

  describe('detectLeaks()', () => {
    it('should detect potential memory leaks from continuous growth', () => {
      const mockUsages = [
        {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 120 * 1024 * 1024,
          heapTotal: 85 * 1024 * 1024,
          heapUsed: 70 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 140 * 1024 * 1024,
          heapTotal: 90 * 1024 * 1024,
          heapUsed: 80 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 160 * 1024 * 1024,
          heapTotal: 95 * 1024 * 1024,
          heapUsed: 90 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 180 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          heapUsed: 100 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
      ]

      mockUsages.forEach((usage, i) => {
        vi.mocked(process.memoryUsage).mockReturnValueOnce(usage)
        profiler.snapshot(`point-${i}`)
      })

      const leaks = profiler.detectLeaks()

      expect(leaks.potentialLeak).toBe(true)
      expect(leaks.reason).toContain('Continuous heap growth detected')
      expect(leaks.growthRate).toBeGreaterThan(0)
    })

    it('should not detect leaks for stable memory usage', () => {
      const mockUsages = [
        {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 102 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 62 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 98 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 58 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 101 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 61 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
      ]

      mockUsages.forEach((usage, i) => {
        vi.mocked(process.memoryUsage).mockReturnValueOnce(usage)
        profiler.snapshot(`point-${i}`)
      })

      const leaks = profiler.detectLeaks()

      expect(leaks.potentialLeak).toBe(false)
      expect(leaks.reason).toContain('Memory usage is stable')
    })
  })

  describe('formatReport()', () => {
    it('should format report as readable string', () => {
      const mockUsage = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      vi.mocked(process.memoryUsage).mockReturnValue(mockUsage)
      profiler.snapshot('test')

      const formatted = profiler.formatReport()

      expect(formatted).toContain('Memory Profile Report')
      expect(formatted).toContain('Peak Heap Used: 60.00 MB')
      expect(formatted).toContain('Peak RSS: 100.00 MB')
      expect(formatted).toContain('test')
    })
  })
})
