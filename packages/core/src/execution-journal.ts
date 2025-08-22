/**
 * Execution journal for tracking workflow and step events
 */

import type { BoundedEventBus, OrchestrationEvent } from './event-bus.js'

/**
 * Journal entry for an event
 */
export interface JournalEntry {
  timestamp: number
  type: string
  data: OrchestrationEvent
}

/**
 * ExecutionJournal subscribes to events and maintains a journal
 */
export class ExecutionJournal {
  private readonly entries: JournalEntry[] = []
  private readonly maxEntries: number
  private readonly eventBus: BoundedEventBus

  // Store bound method as a property to ensure same reference for on/off
  private readonly boundRecordEvent: (event: OrchestrationEvent) => void

  constructor(eventBus: BoundedEventBus, maxEntries = 10000) {
    this.eventBus = eventBus
    this.maxEntries = maxEntries

    // Create bound method once and store it
    this.boundRecordEvent = this.recordEvent.bind(this)

    // Subscribe to all relevant event types (exact matches only, no wildcards in MVP)
    // Workflow events
    this.eventBus.on('workflow.started', this.boundRecordEvent)
    this.eventBus.on('workflow.completed', this.boundRecordEvent)
    this.eventBus.on('workflow.failed', this.boundRecordEvent)

    // Execution events
    this.eventBus.on('execution.queued', this.boundRecordEvent)
    this.eventBus.on('execution.started', this.boundRecordEvent)
    this.eventBus.on('execution.cancelled', this.boundRecordEvent)

    // Step events
    this.eventBus.on('step.started', this.boundRecordEvent)
    this.eventBus.on('step.completed', this.boundRecordEvent)
    this.eventBus.on('step.failed', this.boundRecordEvent)

    // Resilience events
    this.eventBus.on('retry.attempted', this.boundRecordEvent)
    this.eventBus.on('circuitBreaker.opened', this.boundRecordEvent)
    this.eventBus.on('timeout.exceeded', this.boundRecordEvent)
  }

  /**
   * Record an event to the journal with backpressure safety
   */
  private recordEvent(event: OrchestrationEvent): void {
    // Use setTimeout to ensure backpressure safety - don't block the event bus
    setTimeout(() => {
      // Enforce max entries limit (drop oldest if needed)
      if (this.entries.length >= this.maxEntries) {
        this.entries.shift() // Remove oldest entry
      }

      this.entries.push({
        timestamp: Date.now(),
        type: event.type,
        data: event,
      })
    })
  }

  /**
   * Get all journal entries
   */
  getEntries(): ReadonlyArray<JournalEntry> {
    return this.entries
  }

  /**
   * Get entries filtered by event type
   */
  getEntriesByType(eventType: string): ReadonlyArray<JournalEntry> {
    return this.entries.filter((entry) => entry.type === eventType)
  }

  /**
   * Get entries for a specific execution
   */
  getEntriesByExecution(executionId: string): ReadonlyArray<JournalEntry> {
    return this.entries.filter((entry) => {
      const event = entry.data
      if ('executionId' in event) {
        return (event as { executionId: string }).executionId === executionId
      }
      return false
    })
  }

  /**
   * Get entries for a specific workflow
   */
  getEntriesByWorkflow(workflowId: string): ReadonlyArray<JournalEntry> {
    return this.entries.filter((entry) => {
      const event = entry.data
      if ('workflowId' in event) {
        return (event as { workflowId: string }).workflowId === workflowId
      }
      return false
    })
  }

  /**
   * Get entries for a specific step
   */
  getEntriesByStep(stepId: string): ReadonlyArray<JournalEntry> {
    return this.entries.filter((entry) => {
      const event = entry.data
      if ('stepId' in event) {
        return (event as { stepId: string }).stepId === stepId
      }
      return false
    })
  }

  /**
   * Clear all journal entries
   */
  clear(): void {
    this.entries.length = 0
  }

  /**
   * Get the current size of the journal
   */
  size(): number {
    return this.entries.length
  }

  /**
   * Unsubscribe from all events
   */
  dispose(): void {
    // Unsubscribe from all event types using the same bound method reference
    this.eventBus.off('workflow.started', this.boundRecordEvent)
    this.eventBus.off('workflow.completed', this.boundRecordEvent)
    this.eventBus.off('workflow.failed', this.boundRecordEvent)
    this.eventBus.off('execution.queued', this.boundRecordEvent)
    this.eventBus.off('execution.started', this.boundRecordEvent)
    this.eventBus.off('execution.cancelled', this.boundRecordEvent)
    this.eventBus.off('step.started', this.boundRecordEvent)
    this.eventBus.off('step.completed', this.boundRecordEvent)
    this.eventBus.off('step.failed', this.boundRecordEvent)
    this.eventBus.off('retry.attempted', this.boundRecordEvent)
    this.eventBus.off('circuitBreaker.opened', this.boundRecordEvent)
    this.eventBus.off('timeout.exceeded', this.boundRecordEvent)

    // Clear the entries array to free memory
    this.entries.length = 0
  }
}
