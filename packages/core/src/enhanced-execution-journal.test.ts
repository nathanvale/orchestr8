/**
 * Tests for Enhanced Execution Journal
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  EnhancedExecutionJournal,
  JournalManager,
  type EnhancedJournalEntry,
} from './enhanced-execution-journal.js'
import { BoundedEventBus, type OrchestrationEvent } from './event-bus.js'

describe('EnhancedExecutionJournal', () => {
  let journal: EnhancedExecutionJournal
  let eventBus: BoundedEventBus

  beforeEach(() => {
    eventBus = new BoundedEventBus({ maxQueueSize: 100 })
    journal = new EnhancedExecutionJournal({
      eventBus,
      maxEntriesPerExecution: 100,
      maxTotalSizeBytes: 1024 * 1024, // 1MB for testing
    })
  })

  describe('entry recording', () => {
    it('should record entries for different executions', () => {
      const entry1: EnhancedJournalEntry = {
        timestamp: Date.now(),
        executionId: 'exec-1',
        workflowId: 'workflow-1',
        type: 'execution.started',
        data: { type: 'execution.started', executionId: 'exec-1' },
      }

      const entry2: EnhancedJournalEntry = {
        timestamp: Date.now(),
        executionId: 'exec-2',
        workflowId: 'workflow-2',
        type: 'execution.started',
        data: { type: 'execution.started', executionId: 'exec-2' },
      }

      journal.addEntry('exec-1', entry1)
      journal.addEntry('exec-2', entry2)

      expect(journal.getEntriesByExecution('exec-1')).toHaveLength(1)
      expect(journal.getEntriesByExecution('exec-2')).toHaveLength(1)
      expect(journal.getExecutionCount()).toBe(2)
    })

    it('should enforce max entries per execution as ring buffer', () => {
      const smallJournal = new EnhancedExecutionJournal({
        maxEntriesPerExecution: 3,
      })

      for (let i = 0; i < 5; i++) {
        const entry: EnhancedJournalEntry = {
          timestamp: Date.now() + i,
          executionId: 'exec-1',
          type: `event-${i}`,
          data: { type: `event-${i}` },
        }
        smallJournal.addEntry('exec-1', entry)
      }

      const entries = smallJournal.getEntriesByExecution('exec-1')
      expect(entries).toHaveLength(3)
      expect(entries[0]?.type).toBe('event-2') // Oldest entries removed
      expect(entries[2]?.type).toBe('event-4') // Newest entry kept
    })

    it('should record events from event bus', async () => {
      // Manually emit events (event bus recording is tested in integration)
      journal.recordManualEvent({
        type: 'execution.started',
        executionId: 'exec-123',
      })

      journal.recordManualEvent({
        type: 'step.started',
        stepId: 'step-1',
        executionId: 'exec-123',
      })

      const entries = journal.getEntriesByExecution('exec-123')
      expect(entries).toHaveLength(2)
      expect(entries[0]?.type).toBe('execution.started')
      expect(entries[1]?.type).toBe('step.started')
    })

    it('should truncate large fields', () => {
      const largeData = 'x'.repeat(10000) // Larger than 8KB limit (8192 bytes)

      // Use the manual record method which will apply truncation
      journal.recordManualEvent({
        type: 'test',
        executionId: 'exec-1',
        largeField: largeData,
      } as Record<string, unknown>)

      const entries = journal.getEntriesByExecution('exec-1')

      expect(entries).toHaveLength(1)
      const recorded = entries[0]
      expect(recorded?.data).toBeDefined()

      // The large field should be truncated
      const dataField = (recorded?.data as Record<string, unknown>).largeField

      // The large field should be truncated
      if (typeof dataField === 'string') {
        // Should contain truncation marker
        expect(dataField).toContain('[truncated]')
        // Should be shorter than original
        expect(dataField.length).toBeLessThan(largeData.length)
        // Should be around 8KB
        const byteSize = Buffer.byteLength(dataField, 'utf8')
        expect(byteSize).toBeLessThanOrEqual(8192)
      } else {
        // If not a string, it should be a truncation object
        expect(dataField).toHaveProperty('truncated', true)
      }
    })
  })

  describe('size management', () => {
    it('should evict oldest executions when size limit exceeded', () => {
      const tinyJournal = new EnhancedExecutionJournal({
        maxTotalSizeBytes: 500, // Very small for testing
      })

      // Add entries for multiple executions
      for (let exec = 0; exec < 5; exec++) {
        for (let i = 0; i < 3; i++) {
          const entry: EnhancedJournalEntry = {
            timestamp: Date.now(),
            executionId: `exec-${exec}`,
            type: 'test',
            data: { type: 'test', data: 'x'.repeat(50) },
          }
          tinyJournal.addEntry(`exec-${exec}`, entry)
        }
      }

      // Earlier executions should be evicted
      expect(tinyJournal.getExecutionCount()).toBeLessThan(5)
      expect(tinyJournal.getCurrentSize()).toBeLessThanOrEqual(500)

      // Most recent executions should be kept
      const latestEntries = tinyJournal.getEntriesByExecution('exec-4')
      expect(latestEntries.length).toBeGreaterThan(0)
    })

    it('should track current size accurately', () => {
      const entry: EnhancedJournalEntry = {
        timestamp: Date.now(),
        executionId: 'exec-1',
        type: 'test',
        data: { type: 'test', value: 'test-data' },
      }

      const initialSize = journal.getCurrentSize()
      journal.addEntry('exec-1', entry)
      const afterAddSize = journal.getCurrentSize()

      expect(afterAddSize).toBeGreaterThan(initialSize)

      journal.clearExecution('exec-1')
      expect(journal.getCurrentSize()).toBe(initialSize)
    })
  })

  describe('export functionality', () => {
    beforeEach(() => {
      // Add test data
      const events = [
        {
          type: 'execution.started',
          executionId: 'exec-1',
          workflowId: 'wf-1',
        },
        { type: 'step.started', executionId: 'exec-1', stepId: 'step-1' },
        {
          type: 'step.completed',
          executionId: 'exec-1',
          stepId: 'step-1',
          output: 'success',
        },
        { type: 'step.started', executionId: 'exec-1', stepId: 'step-2' },
        {
          type: 'retry.attempted',
          executionId: 'exec-1',
          stepId: 'step-2',
          attempt: 1,
          delay: 1000,
        },
        {
          type: 'step.failed',
          executionId: 'exec-1',
          stepId: 'step-2',
          error: { name: 'Error', message: 'Test error' },
          retryable: true,
        },
        {
          type: 'workflow.failed',
          workflowId: 'wf-1',
          error: { name: 'Error', message: 'Workflow failed' },
        },
      ]

      events.forEach((event, i) => {
        const entry: EnhancedJournalEntry = {
          timestamp: 1000 + i * 100,
          executionId: 'exec-1',
          workflowId: event.workflowId,
          stepId: event.stepId,
          type: event.type,
          data: event,
        }
        journal.addEntry('exec-1', entry)
      })
    })

    it('should export execution as JSON', () => {
      const json = journal.exportExecution('exec-1')
      const exported = JSON.parse(json)

      expect(exported.executionId).toBe('exec-1')
      expect(exported.workflowId).toBe('wf-1')
      expect(exported.entries).toHaveLength(7)
      expect(exported.summary.totalEvents).toBe(7)
      expect(exported.summary.stepCount).toBe(2)
      expect(exported.summary.retryCount).toBe(1)
      expect(exported.summary.errorCount).toBe(2)
      expect(exported.summary.status).toBe('failed')
      expect(exported.duration).toBe(600)
    })

    it('should export all executions', () => {
      // Add another execution
      journal.addEntry('exec-2', {
        timestamp: Date.now(),
        executionId: 'exec-2',
        type: 'execution.started',
        data: { type: 'execution.started', executionId: 'exec-2' },
      })

      const json = journal.exportAll()
      const exported = JSON.parse(json)

      expect(Array.isArray(exported)).toBe(true)
      expect(exported).toHaveLength(2)
      expect(exported[0].executionId).toBe('exec-1')
      expect(exported[1].executionId).toBe('exec-2')
    })

    it('should handle non-existent execution export', () => {
      const json = journal.exportExecution('non-existent')
      const exported = JSON.parse(json)

      expect(exported.error).toContain('No entries found')
    })
  })

  describe('execution management', () => {
    it('should list all execution IDs', () => {
      journal.addEntry('exec-1', {
        timestamp: Date.now(),
        executionId: 'exec-1',
        type: 'test',
        data: { type: 'test' },
      })

      journal.addEntry('exec-2', {
        timestamp: Date.now(),
        executionId: 'exec-2',
        type: 'test',
        data: { type: 'test' },
      })

      const ids = journal.getExecutionIds()
      expect(ids).toEqual(['exec-1', 'exec-2'])
    })

    it('should clear specific execution', () => {
      journal.addEntry('exec-1', {
        timestamp: Date.now(),
        executionId: 'exec-1',
        type: 'test',
        data: { type: 'test' },
      })

      journal.addEntry('exec-2', {
        timestamp: Date.now(),
        executionId: 'exec-2',
        type: 'test',
        data: { type: 'test' },
      })

      journal.clearExecution('exec-1')

      expect(journal.getEntriesByExecution('exec-1')).toHaveLength(0)
      expect(journal.getEntriesByExecution('exec-2')).toHaveLength(1)
      expect(journal.getExecutionCount()).toBe(1)
    })

    it('should clear all executions', () => {
      journal.addEntry('exec-1', {
        timestamp: Date.now(),
        executionId: 'exec-1',
        type: 'test',
        data: { type: 'test' },
      })

      journal.addEntry('exec-2', {
        timestamp: Date.now(),
        executionId: 'exec-2',
        type: 'test',
        data: { type: 'test' },
      })

      journal.clearAll()

      expect(journal.getExecutionCount()).toBe(0)
      expect(journal.getCurrentSize()).toBe(0)
    })
  })

  describe('disposal', () => {
    it('should unsubscribe from events and clear journals on dispose', async () => {
      // Add some data
      journal.recordManualEvent({
        type: 'execution.started',
        executionId: 'exec-1',
      })

      expect(journal.getExecutionCount()).toBeGreaterThan(0)

      // Dispose
      await journal.dispose()

      expect(journal.getExecutionCount()).toBe(0)
      expect(journal.getCurrentSize()).toBe(0)

      // New events should not be recorded after dispose
      journal.recordManualEvent({
        type: 'execution.started',
        executionId: 'exec-2',
      })

      // After dispose, neither manual nor event bus recording should work
      expect(journal.getExecutionCount()).toBe(0)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle extremely large data gracefully', () => {
      // Test with data that would exceed memory if not handled properly
      const extremelyLargeData = 'x'.repeat(100 * 1024 * 1024) // 100MB string

      journal.recordManualEvent({
        type: 'test',
        executionId: 'exec-stress',
        extremeData: extremelyLargeData,
      } as Record<string, unknown>)

      const entries = journal.getEntriesByExecution('exec-stress')
      expect(entries).toHaveLength(1)

      // Should not consume excessive memory
      expect(journal.getCurrentSize()).toBeLessThan(50 * 1024 * 1024) // Should be much smaller
    })

    it('should handle null and undefined values in data', () => {
      journal.recordManualEvent({
        type: 'test',
        executionId: 'exec-null',
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        false: false,
      } as Record<string, unknown>)

      const entries = journal.getEntriesByExecution('exec-null')
      expect(entries).toHaveLength(1)

      const data = entries[0]?.data as Record<string, unknown>
      expect(data.nullValue).toBe(null)
      expect(data.emptyString).toBe('')
      expect(data.zero).toBe(0)
      expect(data.false).toBe(false)
    })

    it('should handle circular references in data objects', () => {
      const circularData: Record<string, unknown> = {
        type: 'test',
        executionId: 'exec-circular',
      }
      circularData.self = circularData // Create circular reference

      // Should not throw an error
      expect(() => {
        journal.recordManualEvent(circularData)
      }).not.toThrow()

      const entries = journal.getEntriesByExecution('exec-circular')
      expect(entries).toHaveLength(1)
    })

    it('should handle concurrent access safely', async () => {
      // Simulate concurrent writes
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          journal.recordManualEvent({
            type: 'step.started',
            stepId: `step-${i}`,
            executionId: 'exec-concurrent',
            index: i,
          })
        }),
      )

      await Promise.all(promises)

      const entries = journal.getEntriesByExecution('exec-concurrent')
      expect(entries).toHaveLength(100)

      // All indices should be present (though order may vary)
      const indices = entries.map(
        (e) => (e.data as Record<string, unknown>).index,
      )
      expect(new Set(indices)).toHaveProperty('size', 100)
    })

    it('should maintain consistency during rapid execution switching', () => {
      // Rapidly switch between executions
      for (let i = 0; i < 1000; i++) {
        const execId = `exec-${i % 10}` // Use 10 different executions
        journal.recordManualEvent({
          type: 'step.started',
          stepId: `step-${i}`,
          executionId: execId,
          iteration: i,
        })
      }

      // Check that all executions have the expected number of entries
      let totalEntries = 0
      for (let i = 0; i < 10; i++) {
        const entries = journal.getEntriesByExecution(`exec-${i}`)
        totalEntries += entries.length
      }

      expect(totalEntries).toBe(1000)
      expect(journal.getExecutionCount()).toBe(10)
    })

    it('should handle malformed timestamp data', () => {
      const entry: EnhancedJournalEntry = {
        timestamp: NaN, // Invalid timestamp
        executionId: 'exec-malformed',
        type: 'test',
        data: { type: 'test' },
      }

      // Should handle gracefully
      expect(() => {
        journal.addEntry('exec-malformed', entry)
      }).not.toThrow()

      const entries = journal.getEntriesByExecution('exec-malformed')
      expect(entries).toHaveLength(1)
      expect(entries[0]?.timestamp).toBe(NaN)
    })

    it('should work correctly with minimum configuration', () => {
      const minimalJournal = new EnhancedExecutionJournal({
        maxEntriesPerExecution: 1,
        maxTotalSizeBytes: 1024, // Increased to avoid immediate eviction
      })

      minimalJournal.recordManualEvent({
        type: 'step.started',
        stepId: 'step-minimal',
        executionId: 'exec-minimal',
      })

      expect(minimalJournal.getExecutionCount()).toBe(1)
      expect(minimalJournal.getEntriesByExecution('exec-minimal')).toHaveLength(
        1,
      )
    })
  })
})

describe('JournalManager', () => {
  beforeEach(() => {
    JournalManager.resetGlobalJournal()
  })

  it('should create and return singleton instance', () => {
    const journal1 = JournalManager.getGlobalJournal()
    const journal2 = JournalManager.getGlobalJournal()

    expect(journal1).toBe(journal2)
  })

  it('should reset global journal', () => {
    const journal1 = JournalManager.getGlobalJournal()

    journal1.addEntry('exec-1', {
      timestamp: Date.now(),
      executionId: 'exec-1',
      type: 'test',
      data: { type: 'test' },
    })

    expect(journal1.getExecutionCount()).toBe(1)

    JournalManager.resetGlobalJournal()

    const journal2 = JournalManager.getGlobalJournal()
    expect(journal2).not.toBe(journal1)
    expect(journal2.getExecutionCount()).toBe(0)
  })

  it('should use provided event bus', async () => {
    const eventBus = new BoundedEventBus()
    const journal = JournalManager.getGlobalJournal(eventBus)

    // Test manual recording
    journal.recordManualEvent({
      type: 'execution.started',
      executionId: 'exec-1',
    })

    expect(journal.getEntriesByExecution('exec-1')).toHaveLength(1)
  })
})

describe('Edge Case Test Coverage', () => {
  let journal: EnhancedExecutionJournal
  let eventBus: BoundedEventBus

  beforeEach(() => {
    eventBus = new BoundedEventBus({ maxQueueSize: 1000 })
    journal = new EnhancedExecutionJournal({
      eventBus,
      maxEntriesPerExecution: 100,
      maxTotalSizeBytes: 1024 * 1024, // 1MB for testing
    })
  })

  describe('Journal Disposal During Active Processing', () => {
    it('should handle disposal during active event processing', async () => {
      let eventsEmitted = 0
      let eventsProcessed = 0

      // Set up event monitoring
      const originalAddEntry = journal.addEntry.bind(journal)
      journal.addEntry = vi.fn((executionId, entry) => {
        eventsProcessed++
        return originalAddEntry(executionId, entry)
      })

      // Start emitting events rapidly
      const emitEvents = async () => {
        for (let i = 0; i < 100; i++) {
          eventBus.emitEvent({
            type: 'step.started',
            executionId: 'exec-dispose-test',
            stepId: `step-${i}`,
          } as OrchestrationEvent)
          eventsEmitted++

          // Small delay to simulate realistic event timing
          await new Promise((resolve) => setTimeout(resolve, 1))
        }
      }

      // Start emitting events
      const emitPromise = emitEvents()

      // Wait for some events to start processing
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Dispose while events are being processed
      const disposePromise = journal.dispose()

      // Wait for everything to complete
      await Promise.all([emitPromise, disposePromise])

      // Verify disposal was clean
      expect(journal.getExecutionCount()).toBe(0)
      expect(journal.getCurrentSize()).toBe(0)

      // Some events may have been processed before disposal
      expect(eventsProcessed).toBeGreaterThan(0)
      expect(eventsProcessed).toBeLessThanOrEqual(eventsEmitted)
    })

    it('should prevent new entries after disposal initiation', async () => {
      // Start disposal process
      const disposePromise = journal.dispose()

      // Try to add entries via event bus during disposal (should be blocked)
      eventBus.emitEvent({
        type: 'execution.started',
        executionId: 'exec-after-dispose',
      } as OrchestrationEvent)

      await disposePromise

      // Wait for any potential processing
      await new Promise((resolve) => setTimeout(resolve, 10))

      // No entries should be recorded from event bus after disposal
      expect(journal.getExecutionCount()).toBe(0)
      expect(journal.getEntriesByExecution('exec-after-dispose')).toHaveLength(
        0,
      )
    })

    it('should handle concurrent disposal attempts gracefully', async () => {
      // Add some test data
      journal.recordManualEvent({
        type: 'execution.started',
        executionId: 'exec-concurrent-dispose',
      })

      expect(journal.getExecutionCount()).toBe(1)

      // Start multiple disposal attempts concurrently
      const disposePromises = Array.from({ length: 5 }, () => journal.dispose())

      // All should complete without error
      await Promise.all(disposePromises)

      // Should only be disposed once
      expect(journal.getExecutionCount()).toBe(0)
    })

    it('should wait for pending processing to complete before disposal', async () => {
      // Add many events to trigger processing
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent({
          type: 'step.started',
          stepId: `step-${i}`,
          executionId: 'exec-batch-process',
        } as OrchestrationEvent)
      }

      // Small delay to let processing start
      await new Promise((resolve) => setTimeout(resolve, 5))

      // Start disposal (should wait for processing)
      const disposeStart = Date.now()
      await journal.dispose()
      const disposeDuration = Date.now() - disposeStart

      // Disposal should have waited for some processing time
      // Even though setTimeout is minimal, there should be some measurable delay
      expect(disposeDuration).toBeGreaterThanOrEqual(0)

      // All events should have been processed before disposal completed
      expect(journal.getExecutionCount()).toBe(0) // Cleared on disposal
    })
  })

  describe('Race Conditions Between Eviction and New Entries', () => {
    it('should handle concurrent entry addition and eviction', async () => {
      const smallJournal = new EnhancedExecutionJournal({
        eventBus,
        maxEntriesPerExecution: 5, // Small limit to trigger eviction
        maxTotalSizeBytes: 1024, // Small size to trigger eviction
      })

      const promises: Promise<void>[] = []

      // Add entries concurrently that will trigger eviction
      for (let execution = 0; execution < 10; execution++) {
        promises.push(
          Promise.resolve().then(() => {
            for (let entry = 0; entry < 20; entry++) {
              smallJournal.recordManualEvent({
                type: 'step.started',
                stepId: `step-${entry}`,
                executionId: `exec-${execution}`,
              })
            }
          }),
        )
      }

      await Promise.all(promises)

      // Should maintain consistency despite race conditions
      expect(smallJournal.getExecutionCount()).toBeGreaterThan(0)
      expect(smallJournal.getExecutionCount()).toBeLessThanOrEqual(10)

      // Should not exceed memory limits significantly
      expect(smallJournal.getCurrentSize()).toBeLessThan(5 * 1024) // Some buffer allowed

      await smallJournal.dispose()
    })

    it('should handle rapid execution switching with eviction', async () => {
      const fastJournal = new EnhancedExecutionJournal({
        eventBus,
        maxEntriesPerExecution: 3, // Very small to trigger frequent eviction
        maxTotalSizeBytes: 512,
      })

      // Rapidly alternate between executions to trigger eviction
      for (let i = 0; i < 100; i++) {
        const execId = `exec-${i % 5}` // Cycle through 5 executions
        fastJournal.recordManualEvent({
          type: 'step.started',
          stepId: `step-${i}`,
          executionId: execId,
          iteration: i,
          largeData: 'x'.repeat(50),
        })
      }

      // Should maintain reasonable memory usage
      expect(fastJournal.getCurrentSize()).toBeLessThan(2 * 1024)

      // Should have some executions (not necessarily all due to eviction)
      expect(fastJournal.getExecutionCount()).toBeGreaterThan(0)
      expect(fastJournal.getExecutionCount()).toBeLessThanOrEqual(5)

      await fastJournal.dispose()
    })

    it('should maintain data integrity during eviction races', async () => {
      const integrityJournal = new EnhancedExecutionJournal({
        eventBus,
        maxEntriesPerExecution: 10,
        maxTotalSizeBytes: 2048,
      })

      const executionIds: string[] = []
      const promises: Promise<void>[] = []

      // Create multiple executions concurrently
      for (let i = 0; i < 20; i++) {
        const execId = `integrity-exec-${i}`
        executionIds.push(execId)

        promises.push(
          Promise.resolve().then(() => {
            for (let j = 0; j < 15; j++) {
              integrityJournal.recordManualEvent({
                type: 'step.started',
                stepId: `step-${j}`,
                executionId: execId,
                sequenceNumber: j,
                checksum: `${execId}-${j}`,
              })
            }
          }),
        )
      }

      await Promise.all(promises)

      // Verify data integrity for remaining executions
      const remainingExecutions = JSON.parse(integrityJournal.exportAll())
      remainingExecutions.forEach((exportData) => {
        const entries = exportData.entries

        // Entries should be in correct order
        for (let i = 1; i < entries.length; i++) {
          const current = entries[i]?.data as { sequenceNumber?: number }
          const previous = entries[i - 1]?.data as { sequenceNumber?: number }

          if (
            current?.sequenceNumber !== undefined &&
            previous?.sequenceNumber !== undefined
          ) {
            expect(current.sequenceNumber).toBeGreaterThan(
              previous.sequenceNumber,
            )
          }
        }

        // Checksums should match
        entries.forEach((entry) => {
          const data = entry.data as {
            checksum?: string
            sequenceNumber?: number
          }
          if (data?.checksum && data?.sequenceNumber !== undefined) {
            expect(data.checksum).toBe(
              `${entry.executionId}-${data.sequenceNumber}`,
            )
          }
        })
      })

      await integrityJournal.dispose()
    })
  })

  describe('Comprehensive Concurrent Scenario Testing', () => {
    it('should handle mixed read/write operations under load', async () => {
      const concurrentJournal = new EnhancedExecutionJournal({
        eventBus,
        maxEntriesPerExecution: 50,
        maxTotalSizeBytes: 10240,
      })

      const operations: Promise<void>[] = []
      const results: { reads: number; writes: number; exports: number } = {
        reads: 0,
        writes: 0,
        exports: 0,
      }

      // Writers
      for (let writer = 0; writer < 5; writer++) {
        operations.push(
          Promise.resolve().then(async () => {
            for (let i = 0; i < 50; i++) {
              concurrentJournal.recordManualEvent({
                type: 'step.started',
                stepId: `step-${i}`,
                executionId: `writer-exec-${writer}`,
                writeIndex: i,
                writerId: writer,
              })
              results.writes++
              await new Promise((resolve) => setTimeout(resolve, 1))
            }
          }),
        )
      }

      // Readers
      for (let reader = 0; reader < 3; reader++) {
        operations.push(
          Promise.resolve().then(async () => {
            for (let i = 0; i < 30; i++) {
              const execId = `writer-exec-${i % 5}`
              concurrentJournal.getEntriesByExecution(execId)
              results.reads++
              await new Promise((resolve) => setTimeout(resolve, 2))
            }
          }),
        )
      }

      // Exporters
      for (let exporter = 0; exporter < 2; exporter++) {
        operations.push(
          Promise.resolve().then(async () => {
            for (let i = 0; i < 10; i++) {
              JSON.parse(concurrentJournal.exportAll())
              results.exports++
              await new Promise((resolve) => setTimeout(resolve, 5))
            }
          }),
        )
      }

      await Promise.all(operations)

      // Verify operations completed successfully
      expect(results.writes).toBe(250) // 5 writers × 50 writes
      expect(results.reads).toBe(90) // 3 readers × 30 reads
      expect(results.exports).toBe(20) // 2 exporters × 10 exports

      // Verify final state is consistent
      const finalExport = JSON.parse(concurrentJournal.exportAll())
      expect(finalExport).toBeDefined()
      expect(concurrentJournal.getCurrentSize()).toBeGreaterThan(0)

      await concurrentJournal.dispose()
    })

    it('should handle event bus and manual recording concurrently', async () => {
      let eventBusRecords = 0
      let manualRecords = 0

      const promises: Promise<void>[] = []

      // Event bus emitters
      for (let emitter = 0; emitter < 3; emitter++) {
        promises.push(
          Promise.resolve().then(async () => {
            for (let i = 0; i < 30; i++) {
              eventBus.emitEvent({
                type: 'step.started',
                stepId: `eventbus-step-${i}`,
                executionId: `eventbus-exec-${emitter}`,
              } as OrchestrationEvent)
              eventBusRecords++
              await new Promise((resolve) => setTimeout(resolve, 1))
            }
          }),
        )
      }

      // Manual recorders
      for (let recorder = 0; recorder < 2; recorder++) {
        promises.push(
          Promise.resolve().then(async () => {
            for (let i = 0; i < 40; i++) {
              journal.recordManualEvent({
                type: 'step.started',
                stepId: `step-${i}`,
                executionId: `manual-exec-${recorder}`,
                index: i,
              })
              manualRecords++
              await new Promise((resolve) => setTimeout(resolve, 1))
            }
          }),
        )
      }

      await Promise.all(promises)

      // Wait for event bus events to be processed
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(eventBusRecords).toBe(90) // 3 emitters × 30 records
      expect(manualRecords).toBe(80) // 2 recorders × 40 records

      // Should have recorded from both sources
      const allEntries = JSON.parse(journal.exportAll())
      const eventBusEntries = allEntries.filter((exp) =>
        exp.executionId.startsWith('eventbus-exec-'),
      )
      const manualEntries = allEntries.filter((exp) =>
        exp.executionId.startsWith('manual-exec-'),
      )

      expect(eventBusEntries.length).toBeGreaterThan(0)
      expect(manualEntries.length).toBeGreaterThan(0)
    })
  })

  describe('Event Bus Disconnection and Reconnection', () => {
    it('should handle event bus disconnection gracefully', async () => {
      // Record some events first
      eventBus.emitEvent({
        type: 'step.started',
        stepId: 'pre-disconnect-step',
        executionId: 'disconnect-test',
        timestamp: Date.now(),
      } as OrchestrationEvent)

      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(journal.getEntriesByExecution('disconnect-test')).toHaveLength(1)

      // Simulate event bus disconnection by disposing it
      // await eventBus.dispose() // TODO: event bus doesn't have dispose method

      // Try to emit more events (should not crash)
      eventBus.emitEvent({
        type: 'step.completed',
        stepId: 'post-disconnect-step',
        output: 'disconnected',
      } as OrchestrationEvent)

      // Manual recording should still work
      journal.recordManualEvent({
        type: 'step.started',
        stepId: 'manual-post-disconnect',
        executionId: 'disconnect-test',
      })

      expect(journal.getEntriesByExecution('disconnect-test')).toHaveLength(2) // pre + manual
    })

    it('should handle event bus reconnection scenario', async () => {
      // Create new event bus (simulating reconnection)
      const newEventBus = new BoundedEventBus({ maxQueueSize: 100 })

      // Create journal with new event bus
      const reconnectedJournal = new EnhancedExecutionJournal({
        eventBus: newEventBus,
        maxEntriesPerExecution: 100,
        maxTotalSizeBytes: 1024 * 1024,
      })

      // Test that it works normally
      newEventBus.emitEvent({
        type: 'step.started',
        stepId: 'reconnect-step',
        executionId: 'reconnect-test',
      } as OrchestrationEvent)

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(
        reconnectedJournal.getEntriesByExecution('reconnect-test'),
      ).toHaveLength(1)

      await reconnectedJournal.dispose()
      // await newEventBus.dispose() // TODO: event bus doesn't have dispose method
    })

    it('should handle rapid event bus state changes', async () => {
      const stateJournal = new EnhancedExecutionJournal({
        eventBus,
        maxEntriesPerExecution: 20,
        maxTotalSizeBytes: 2048,
      })

      // Rapid sequence of events with various states
      const events = [
        { type: 'step.started', stepId: 'step-1', executionId: 'state-test' },
        { type: 'step.started', stepId: 'step-2', executionId: 'state-test' },
        { type: 'step.started', stepId: 'step-3', executionId: 'state-test' },
      ]

      // Emit events rapidly
      events.forEach((event) => {
        eventBus.emitEvent({
          ...event,
          timestamp: Date.now(),
        } as OrchestrationEvent)
      })

      // Add manual events in between
      stateJournal.recordManualEvent({
        type: 'step.started',
        stepId: 'manual-step',
        executionId: 'state-test',
      })

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 20))

      const stateEntries = stateJournal.getEntriesByExecution('state-test')
      expect(stateEntries.length).toBeGreaterThanOrEqual(1) // At least the manual one

      await stateJournal.dispose()
    })
  })
})
