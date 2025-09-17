import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryMonitor } from './memory-monitor.js'
import { MemoryProfiler } from '../../packages/quality-check/src/utils/memory-profiler.js'

describe('Memory Monitoring Hooks', () => {
  let monitor: MemoryMonitor
  let originalMemoryUsage: typeof process.memoryUsage

  beforeEach(() => {
    monitor = new MemoryMonitor({
      maxMemoryMB: 500,
      warningThresholdPercent: 80,
      enableTracking: true,
      enableWarnings: true,
      enableTrendReporting: true,
    })

    // Mock process.memoryUsage for controlled testing
    originalMemoryUsage = process.memoryUsage
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original memory usage
    process.memoryUsage = originalMemoryUsage
    monitor.cleanup()
  })

  describe('Memory Tracking', () => {
    it('should track memory before and after each test', () => {
      const mockUsage = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(mockUsage) as any

      // Simulate test lifecycle
      monitor.beforeTest('test-1')
      expect(monitor.getTestSnapshot('test-1', 'before')).toBeDefined()

      monitor.afterTest('test-1')
      expect(monitor.getTestSnapshot('test-1', 'after')).toBeDefined()

      // Should have both snapshots
      const testData = monitor.getTestData('test-1')
      expect(testData).toBeDefined()
      expect(testData!.before).toBeDefined()
      expect(testData!.after).toBeDefined()
      expect(testData!.delta).toBeDefined()
    })

    it('should calculate memory delta for each test', () => {
      const beforeUsage = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      const afterUsage = {
        rss: 120 * 1024 * 1024,
        heapTotal: 90 * 1024 * 1024,
        heapUsed: 75 * 1024 * 1024,
        external: 12 * 1024 * 1024,
        arrayBuffers: 6 * 1024 * 1024,
      }

      process.memoryUsage = vi
        .fn()
        .mockReturnValueOnce(beforeUsage)
        .mockReturnValueOnce(afterUsage) as any

      monitor.beforeTest('test-delta')
      monitor.afterTest('test-delta')

      const testData = monitor.getTestData('test-delta')
      expect(testData!.delta.heapUsed).toBe(15) // 15MB increase
      expect(testData!.delta.rss).toBe(20) // 20MB increase
    })

    it('should track multiple tests independently', () => {
      const usage1 = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }
      const usage2 = {
        rss: 150 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 90 * 1024 * 1024,
        external: 15 * 1024 * 1024,
        arrayBuffers: 8 * 1024 * 1024,
      }

      process.memoryUsage = vi
        .fn()
        .mockReturnValueOnce(usage1)
        .mockReturnValueOnce(usage1)
        .mockReturnValueOnce(usage2)
        .mockReturnValueOnce(usage2) as any

      monitor.beforeTest('test-1')
      monitor.afterTest('test-1')
      monitor.beforeTest('test-2')
      monitor.afterTest('test-2')

      const test1Data = monitor.getTestData('test-1')
      const test2Data = monitor.getTestData('test-2')

      expect(test1Data).toBeDefined()
      expect(test2Data).toBeDefined()
      expect(test1Data).not.toBe(test2Data)
    })
  })

  describe('Memory Limits', () => {
    it('should enforce per-test memory limit of 500MB', () => {
      const exceedingUsage = {
        rss: 600 * 1024 * 1024, // 600MB exceeds 500MB limit
        heapTotal: 550 * 1024 * 1024,
        heapUsed: 520 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(exceedingUsage) as any

      monitor.beforeTest('test-exceeding')

      expect(() => monitor.checkMemoryLimit('test-exceeding')).toThrow(
        'Memory limit exceeded: 520MB used (limit: 500MB)',
      )
    })

    it('should allow tests within memory limit', () => {
      const withinLimitUsage = {
        rss: 400 * 1024 * 1024,
        heapTotal: 350 * 1024 * 1024,
        heapUsed: 300 * 1024 * 1024,
        external: 20 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(withinLimitUsage) as any

      monitor.beforeTest('test-within-limit')

      expect(() => monitor.checkMemoryLimit('test-within-limit')).not.toThrow()
    })

    it('should support custom memory limits per test', () => {
      const usage = {
        rss: 250 * 1024 * 1024,
        heapTotal: 220 * 1024 * 1024,
        heapUsed: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(usage) as any

      monitor.beforeTest('test-custom-limit', { maxMemoryMB: 150 })

      // Should exceed custom 150MB limit
      expect(() => monitor.checkMemoryLimit('test-custom-limit')).toThrow(
        'Memory limit exceeded: 200MB used (limit: 150MB)',
      )
    })
  })

  describe('Memory Warnings', () => {
    it('should warn at 80% memory threshold', () => {
      // Create a monitor with debug mode enabled for warning tests
      const debugMonitor = new MemoryMonitor({
        maxMemoryMB: 500,
        warningThresholdPercent: 80,
        enableTracking: true,
        enableWarnings: true,
        debugMode: true,
      })

      const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const warningUsage = {
        rss: 450 * 1024 * 1024,
        heapTotal: 420 * 1024 * 1024,
        heapUsed: 410 * 1024 * 1024, // 410MB is 82% of 500MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(warningUsage) as any

      debugMonitor.beforeTest('test-warning')
      debugMonitor.checkMemoryWarning('test-warning')

      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('Memory usage warning: 410MB (82% of 500MB limit)'),
      )

      warningSpy.mockRestore()
      debugMonitor.cleanup()
    })

    it('should not warn below threshold', () => {
      const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const safeUsage = {
        rss: 350 * 1024 * 1024,
        heapTotal: 320 * 1024 * 1024,
        heapUsed: 300 * 1024 * 1024, // 300MB is 60% of 500MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(safeUsage) as any

      monitor.beforeTest('test-no-warning')
      monitor.checkMemoryWarning('test-no-warning')

      expect(warningSpy).not.toHaveBeenCalled()

      warningSpy.mockRestore()
    })

    it('should support custom warning thresholds', () => {
      const customMonitor = new MemoryMonitor({
        maxMemoryMB: 500,
        warningThresholdPercent: 50, // Lower threshold
        enableWarnings: true,
        debugMode: true, // Enable debug mode for warning tests
      })

      const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const usage = {
        rss: 300 * 1024 * 1024,
        heapTotal: 280 * 1024 * 1024,
        heapUsed: 260 * 1024 * 1024, // 260MB is 52% of 500MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(usage) as any

      customMonitor.beforeTest('test-custom-warning')
      customMonitor.checkMemoryWarning('test-custom-warning')

      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('Memory usage warning: 260MB (52% of 500MB limit)'),
      )

      warningSpy.mockRestore()
      customMonitor.cleanup()
    })

    describe('Non-Debug Mode Behavior', () => {
      it('should not warn when debug mode is disabled', () => {
        const nonDebugMonitor = new MemoryMonitor({
          maxMemoryMB: 500,
          warningThresholdPercent: 80,
          enableTracking: true,
          enableWarnings: true,
          debugMode: false, // Explicitly disable debug mode
        })

        const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const warningUsage = {
          rss: 450 * 1024 * 1024,
          heapTotal: 420 * 1024 * 1024,
          heapUsed: 410 * 1024 * 1024, // 410MB is 82% of 500MB
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        }

        process.memoryUsage = vi.fn().mockReturnValue(warningUsage) as any

        nonDebugMonitor.beforeTest('test-no-debug-warning')
        nonDebugMonitor.checkMemoryWarning('test-no-debug-warning')

        // Should not warn when debug mode is disabled
        expect(warningSpy).not.toHaveBeenCalled()

        warningSpy.mockRestore()
        nonDebugMonitor.cleanup()
      })

      it('should not export report when debug mode is disabled', async () => {
        const nonDebugMonitor = new MemoryMonitor({
          maxMemoryMB: 500,
          enableTrendReporting: true,
          debugMode: false, // Explicitly disable debug mode
        })

        const mockWriteFile = vi.fn()
        vi.doMock('fs/promises', () => ({
          writeFile: mockWriteFile,
        }))

        const usage = {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        }

        process.memoryUsage = vi.fn().mockReturnValue(usage) as any

        nonDebugMonitor.beforeTest('export-test-no-debug')
        nonDebugMonitor.afterTest('export-test-no-debug')

        await nonDebugMonitor.exportTrendReport('./no-debug-report.json')

        // Should not export when debug mode is disabled
        expect(mockWriteFile).not.toHaveBeenCalled()

        nonDebugMonitor.cleanup()
      })
    })
  })

  describe('Memory Trend Reporting', () => {
    it('should generate memory trend report for all tests', () => {
      const usages = [
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
          rss: 150 * 1024 * 1024,
          heapTotal: 90 * 1024 * 1024,
          heapUsed: 85 * 1024 * 1024,
          external: 12 * 1024 * 1024,
          arrayBuffers: 6 * 1024 * 1024,
        },
        {
          rss: 140 * 1024 * 1024,
          heapTotal: 88 * 1024 * 1024,
          heapUsed: 80 * 1024 * 1024,
          external: 11 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
      ]

      let callIndex = 0
      process.memoryUsage = vi
        .fn()
        .mockImplementation(() => usages[callIndex++ % usages.length]) as any

      monitor.beforeTest('test-1')
      monitor.afterTest('test-1')
      monitor.beforeTest('test-2')
      monitor.afterTest('test-2')

      const report = monitor.generateTrendReport()

      expect(report).toBeDefined()
      expect(report.totalTests).toBe(2)
      expect(report.averageMemoryUsage).toBeDefined()
      expect(report.peakMemoryUsage).toBeDefined()
      expect(report.memoryGrowthTrend).toBeDefined()
      expect(report.testsExceedingWarning).toBeInstanceOf(Array)
      expect(report.testsExceedingLimit).toBeInstanceOf(Array)
    })

    it('should identify memory leak patterns in trends', () => {
      // Simulate continuous growth pattern
      const growingUsages = [
        {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: 60 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 120 * 1024 * 1024,
          heapTotal: 90 * 1024 * 1024,
          heapUsed: 80 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 140 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          heapUsed: 100 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 160 * 1024 * 1024,
          heapTotal: 110 * 1024 * 1024,
          heapUsed: 120 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 180 * 1024 * 1024,
          heapTotal: 120 * 1024 * 1024,
          heapUsed: 140 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
        {
          rss: 200 * 1024 * 1024,
          heapTotal: 130 * 1024 * 1024,
          heapUsed: 160 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        },
      ]

      let callIndex = 0
      process.memoryUsage = vi.fn().mockImplementation(() => growingUsages[callIndex++]) as any

      // Run multiple tests
      for (let i = 0; i < 3; i++) {
        monitor.beforeTest(`leak-test-${i}`)
        monitor.afterTest(`leak-test-${i}`)
      }

      const report = monitor.generateTrendReport()

      expect(report.potentialLeak).toBe(true)
      expect(report.leakReason).toContain('Continuous memory growth detected')
      expect(report.memoryGrowthRate).toBeGreaterThan(0)
    })

    it('should export trend report to file', async () => {
      // Create a monitor with debug mode enabled for export tests
      const exportMonitor = new MemoryMonitor({
        maxMemoryMB: 500,
        warningThresholdPercent: 80,
        enableTracking: true,
        enableTrendReporting: true,
        debugMode: true, // Enable debug mode for export functionality
      })

      const mockWriteFile = vi.fn()
      vi.doMock('fs/promises', () => ({
        writeFile: mockWriteFile,
      }))

      const usage = {
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 60 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
      }

      process.memoryUsage = vi.fn().mockReturnValue(usage) as any

      exportMonitor.beforeTest('export-test')
      exportMonitor.afterTest('export-test')

      await exportMonitor.exportTrendReport('./memory-trend-report.json')

      expect(mockWriteFile).toHaveBeenCalledWith(
        './memory-trend-report.json',
        expect.stringContaining('"totalTests": 1'),
      )

      exportMonitor.cleanup()
    })
  })

  describe('Integration with MemoryProfiler', () => {
    it('should use MemoryProfiler for detailed snapshots', () => {
      const profiler = monitor.getProfiler()

      expect(profiler).toBeInstanceOf(MemoryProfiler)

      monitor.beforeTest('profiler-test')
      monitor.afterTest('profiler-test')

      const history = profiler.getHistory()
      expect(history.length).toBeGreaterThanOrEqual(2)
    })

    it('should detect leaks using MemoryProfiler', () => {
      // Simulate leak pattern
      const leakUsages = Array(5)
        .fill(null)
        .map((_, i) => ({
          rss: (100 + i * 20) * 1024 * 1024,
          heapTotal: (80 + i * 15) * 1024 * 1024,
          heapUsed: (60 + i * 20) * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
        }))

      let callIndex = 0
      process.memoryUsage = vi.fn().mockImplementation(() => leakUsages[callIndex++]) as any

      for (let i = 0; i < 5; i++) {
        if (callIndex < leakUsages.length) {
          monitor.beforeTest(`leak-${i}`)
        }
        if (callIndex < leakUsages.length) {
          monitor.afterTest(`leak-${i}`)
        }
      }

      const leakDetection = monitor.detectMemoryLeaks()
      expect(leakDetection.potentialLeak).toBe(true)
    })
  })

  describe('Cleanup and Disposal', () => {
    it('should cleanup resources on dispose', () => {
      monitor.beforeTest('cleanup-test')
      monitor.afterTest('cleanup-test')

      expect(monitor.getTestCount()).toBe(1)

      monitor.cleanup()

      expect(monitor.getTestCount()).toBe(0)
      expect(monitor.getProfiler().getHistory()).toHaveLength(0)
    })

    it('should handle cleanup errors gracefully', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Force an error during cleanup
      monitor.getProfiler().reset = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup error')
      })

      expect(() => monitor.cleanup()).not.toThrow()
      expect(errorSpy).toHaveBeenCalledWith(
        'Error during memory monitor cleanup:',
        expect.any(Error),
      )

      errorSpy.mockRestore()
    })
  })
})
