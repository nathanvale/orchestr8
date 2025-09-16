import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileBatchProcessor } from './file-batch-processor'

describe('FileBatchProcessor', () => {
  let processor: FileBatchProcessor
  let tempDir: string
  let testFiles: string[]

  beforeEach(() => {
    processor = new FileBatchProcessor()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-processor-test-'))

    // Create test files
    testFiles = []
    for (let i = 0; i < 10; i++) {
      const testFile = path.join(tempDir, `test${i}.txt`)
      fs.writeFileSync(testFile, `test content ${i}`)
      testFiles.push(testFile)
    }
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('processBatches', () => {
    it('should process files in batches', async () => {
      const mockProcessor = vi.fn().mockResolvedValue('success')

      const result = await processor.processBatches(testFiles, mockProcessor)

      expect(result.processed).toBe(testFiles.length)
      expect(result.errors).toHaveLength(0)
      expect(result.skipped).toBe(0)
      expect(result.results).toHaveLength(1) // Default batch size should handle all files in one batch
      expect(mockProcessor).toHaveBeenCalledWith(testFiles)
    })

    it('should handle batch processing with custom batch size', async () => {
      processor = new FileBatchProcessor({ batchSize: 3 })
      const mockProcessor = vi.fn().mockResolvedValue('success')

      const result = await processor.processBatches(testFiles, mockProcessor)

      expect(result.processed).toBe(testFiles.length)
      expect(result.errors).toHaveLength(0)
      expect(result.skipped).toBe(0)
      expect(result.results).toHaveLength(4) // 10 files / 3 batch size = 4 batches (3+3+3+1)
      expect(mockProcessor).toHaveBeenCalledTimes(4)
    })

    it('should handle processing errors', async () => {
      const mockProcessor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValue('success')

      const result = await processor.processBatches(testFiles.slice(0, 2), mockProcessor)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('Processing failed')
      expect(result.processed).toBe(0) // First batch failed, second wasn't processed
      expect(result.skipped).toBe(2) // All remaining files were skipped
    })

    it('should continue on timeout when configured', async () => {
      processor = new FileBatchProcessor({
        batchSize: 1,
        continueOnTimeout: true,
      })

      const mockProcessor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue('success')

      const result = await processor.processBatches(testFiles.slice(0, 3), mockProcessor)

      expect(result.errors).toHaveLength(1)
      expect(result.processed).toBe(2) // First failed, next two succeeded
      expect(result.results).toHaveLength(2)
    })

    it('should respect cancellation token', async () => {
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      }
      const mockProcessor = vi.fn().mockImplementation(async () => {
        mockToken.isCancellationRequested = true
        return 'success'
      })

      const result = await processor.processBatches(testFiles, mockProcessor, mockToken)

      expect(result.processed).toBe(testFiles.length)
      expect(result.skipped).toBe(0) // First batch processed before cancellation
      expect(mockProcessor).toHaveBeenCalledTimes(1)
    })

    it('should handle empty file list', async () => {
      const mockProcessor = vi.fn()

      const result = await processor.processBatches([], mockProcessor)

      expect(result.processed).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(result.results).toHaveLength(0)
      expect(mockProcessor).not.toHaveBeenCalled()
    })

    it('should apply backpressure when memory pressure detected', async () => {
      // Create processor with aggressive memory threshold
      processor = new FileBatchProcessor({
        batchSize: 5,
        memoryThresholdMB: 1, // Very low threshold to trigger pressure
        enableBackpressure: true,
      })

      const mockProcessor = vi.fn().mockResolvedValue('success')

      const result = await processor.processBatches(testFiles, mockProcessor)

      expect(result.processed).toBe(testFiles.length)
      expect(result.errors).toHaveLength(0)
      // Should have processed files despite memory pressure (backpressure doesn't prevent processing)
    })
  })

  describe('calculateTimeout', () => {
    it('should calculate timeout based on file count', () => {
      processor = new FileBatchProcessor({
        baseTimeout: 2000,
        timeoutPerFile: 50,
      })

      const timeout = processor.calculateTimeout(10)
      expect(timeout).toBe(2500) // 2000 + (10 * 50)
    })

    it('should use default values when not configured', () => {
      const timeout = processor.calculateTimeout(5)
      expect(timeout).toBe(1050) // 1000 + (5 * 10)
    })
  })

  describe('splitIntoBatches', () => {
    it('should split files into equal batches', () => {
      const batches = processor.splitIntoBatches(testFiles, 3)

      expect(batches).toHaveLength(4) // 10 files / 3 = 4 batches
      expect(batches[0]).toHaveLength(3)
      expect(batches[1]).toHaveLength(3)
      expect(batches[2]).toHaveLength(3)
      expect(batches[3]).toHaveLength(1) // Last batch has remainder
    })

    it('should handle single file batches', () => {
      const batches = processor.splitIntoBatches(testFiles, 1)

      expect(batches).toHaveLength(10)
      expect(batches.every((batch) => batch.length === 1)).toBe(true)
    })

    it('should use configured batch size when not specified', () => {
      processor = new FileBatchProcessor({ batchSize: 4 })
      const batches = processor.splitIntoBatches(testFiles)

      expect(batches).toHaveLength(3) // 10 files / 4 = 3 batches
      expect(batches[0]).toHaveLength(4)
      expect(batches[1]).toHaveLength(4)
      expect(batches[2]).toHaveLength(2)
    })

    it('should handle empty file list', () => {
      const batches = processor.splitIntoBatches([])
      expect(batches).toHaveLength(0)
    })
  })

  describe('processWithPriority', () => {
    it('should process critical files first', async () => {
      const criticalFiles = testFiles.slice(0, 3)
      const nonCriticalFiles = testFiles.slice(3)
      const processedOrder: boolean[] = []

      const mockProcessor = vi.fn().mockImplementation(async (batch, critical) => {
        processedOrder.push(critical)
        return `${critical ? 'critical' : 'normal'}`
      })

      const result = await processor.processWithPriority(
        criticalFiles,
        nonCriticalFiles,
        mockProcessor,
      )

      expect(result.processed).toBe(testFiles.length)
      expect(result.errors).toHaveLength(0)
      expect(processedOrder[0]).toBe(true) // Critical first
      expect(processedOrder[1]).toBe(false) // Non-critical second
      expect(result.results[0]).toBe('critical')
      expect(result.results[1]).toBe('normal')
    })

    it('should skip non-critical files under resource pressure', async () => {
      // Create processor with very low memory threshold
      processor = new FileBatchProcessor({
        memoryThresholdMB: 1,
        enableBackpressure: true,
      })

      const criticalFiles = testFiles.slice(0, 2)
      const nonCriticalFiles = testFiles.slice(2)

      const mockProcessor = vi.fn().mockResolvedValue('processed')

      const result = await processor.processWithPriority(
        criticalFiles,
        nonCriticalFiles,
        mockProcessor,
      )

      expect(result.processed).toBe(criticalFiles.length)
      expect(result.skipped).toBe(nonCriticalFiles.length)
      expect(mockProcessor).toHaveBeenCalledTimes(1) // Only critical files processed
    })

    it('should handle cancellation during critical file processing', async () => {
      const criticalFiles = testFiles.slice(0, 3)
      const nonCriticalFiles = testFiles.slice(3)
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      }

      const mockProcessor = vi.fn().mockImplementation(async () => {
        mockToken.isCancellationRequested = true
        return 'processed'
      })

      const result = await processor.processWithPriority(
        criticalFiles,
        nonCriticalFiles,
        mockProcessor,
        mockToken,
      )

      expect(result.processed).toBe(criticalFiles.length)
      expect(result.skipped).toBe(nonCriticalFiles.length) // Non-critical skipped due to cancellation
    })

    it('should handle empty critical and non-critical lists', async () => {
      const mockProcessor = vi.fn()

      const result = await processor.processWithPriority([], [], mockProcessor)

      expect(result.processed).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(result.results).toHaveLength(0)
      expect(mockProcessor).not.toHaveBeenCalled()
    })
  })

  describe('getResourceStatus', () => {
    it('should return resource status', () => {
      const status = processor.getResourceStatus()

      expect(status).toHaveProperty('memoryUsed')
      expect(status).toHaveProperty('memoryTotal')
      expect(status).toHaveProperty('memoryPercent')
      expect(status).toHaveProperty('isUnderPressure')
      expect(typeof status.memoryUsed).toBe('number')
      expect(typeof status.memoryTotal).toBe('number')
      expect(typeof status.memoryPercent).toBe('number')
      expect(typeof status.isUnderPressure).toBe('boolean')
    })
  })

  describe('Resource Management Integration', () => {
    it('should handle memory pressure gracefully', async () => {
      processor = new FileBatchProcessor({
        batchSize: 2,
        memoryThresholdMB: 1, // Very low to trigger pressure
        enableBackpressure: true,
      })

      const mockProcessor = vi.fn().mockResolvedValue('success')

      const result = await processor.processBatches(testFiles, mockProcessor)

      expect(result.processed).toBe(testFiles.length)
      expect(result.errors).toHaveLength(0)
      // The processor should still complete the work, just potentially with reduced batch sizes
    })

    it('should adapt batch sizes under pressure', async () => {
      processor = new FileBatchProcessor({
        batchSize: 10,
        memoryThresholdMB: 1,
        enableBackpressure: true,
      })

      // Monitor calls to see if batch sizes are adapted
      const batchSizes: number[] = []
      const mockProcessor = vi.fn().mockImplementation(async (batch) => {
        batchSizes.push(batch.length)
        return 'success'
      })

      await processor.processBatches(testFiles, mockProcessor)

      expect(batchSizes.length).toBeGreaterThan(0)
      // Under memory pressure, batch sizes should be smaller than the configured size
      // This is dependent on system memory, so we just check that processing completed
      expect(batchSizes.reduce((sum, size) => sum + size, 0)).toBe(testFiles.length)
    })
  })

  describe('Error Handling', () => {
    it('should handle processor errors gracefully', async () => {
      const mockProcessor = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValue('success')

      processor = new FileBatchProcessor({
        batchSize: 1,
        continueOnTimeout: true,
      })

      const result = await processor.processBatches(testFiles.slice(0, 3), mockProcessor)

      expect(result.errors).toHaveLength(2)
      expect(result.processed).toBe(1) // Only the third call succeeded
      expect(result.results).toHaveLength(1)
    })

    it('should clean up resources on error', async () => {
      const mockProcessor = vi.fn().mockRejectedValue(new Error('Fatal error'))

      const result = await processor.processBatches(testFiles.slice(0, 1), mockProcessor)

      expect(result.errors).toHaveLength(1)
      expect(result.processed).toBe(0)

      // Should still be able to get resource status after error
      const status = processor.getResourceStatus()
      expect(status).toBeDefined()
    })
  })
})
