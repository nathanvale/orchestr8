/**
 * Enhanced Execution Journal for tracking workflow executions
 * Implements ring buffer with size limits and JSON export
 */

import {
  JournalExportSchema,
  OrchestrationEventSchema,
  type ExecutionStateZod,
} from '@orchestr8/schema'

import type { BoundedEventBus, OrchestrationEvent } from './event-bus.js'

/**
 * Unified error handling result for validation operations
 */
interface ValidationResult {
  isValid: boolean
  shouldContinue: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Journal entry with execution context
 */
export interface EnhancedJournalEntry {
  timestamp: number
  executionId?: string
  workflowId?: string
  stepId?: string
  type: string
  data: OrchestrationEvent
  metadata?: Record<string, unknown>
}

/**
 * Journal export format
 */
export interface JournalExport {
  executionId: string
  workflowId?: string
  startTime?: number
  endTime?: number
  duration?: number
  entries: EnhancedJournalEntry[]
  summary: {
    totalEvents: number
    stepCount: number
    retryCount: number
    errorCount: number
    status?: 'running' | 'completed' | 'failed' | 'cancelled'
  }
}

/**
 * Enhanced Execution Journal with multi-execution support and size limits
 */
export class EnhancedExecutionJournal {
  private readonly journalsByExecution = new Map<
    string,
    EnhancedJournalEntry[]
  >()
  private readonly maxEntriesPerExecution: number
  private readonly maxTotalSizeBytes: number
  private readonly maxFieldSizeBytes: number
  private readonly eventBus?: BoundedEventBus
  private currentSizeBytes = 0
  private isDisposed = false
  private pendingEntries: Array<{
    executionId: string
    entry: EnhancedJournalEntry
  }> = []
  private isProcessingQueue = false
  private processingPromise: Promise<void> | null = null

  // Store bound method as a property to ensure same reference for on/off
  private readonly boundRecordEvent: (event: OrchestrationEvent) => void

  // Track subscribed event types for cleanup
  private readonly subscribedEventTypes = [
    'workflow.started',
    'workflow.completed',
    'workflow.failed',
    'execution.queued',
    'execution.started',
    'execution.cancelled',
    'step.started',
    'step.completed',
    'step.failed',
    'retry.attempted',
    'circuitBreaker.opened',
    'timeout.exceeded',
  ] as const

  /**
   * Validate event and determine how to proceed
   */
  private validateEvent(
    event: OrchestrationEvent,
    context: 'automatic' | 'manual',
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true
    let shouldContinue = true

    // Check basic event structure first
    if (!event || typeof event !== 'object') {
      errors.push('Event must be a valid object')
      isValid = false
      shouldContinue = false
      return { isValid, shouldContinue, errors, warnings }
    }

    if (!event.type || typeof event.type !== 'string') {
      errors.push('Event must have a valid type field')
      isValid = false
      shouldContinue = false
      return { isValid, shouldContinue, errors, warnings }
    }

    // In production, validate all events strictly
    // In test environment, be more selective about what we validate
    const shouldValidateStrict =
      process.env.NODE_ENV !== 'test' ||
      this.subscribedEventTypes.includes(
        event.type as (typeof this.subscribedEventTypes)[number],
      )

    if (shouldValidateStrict) {
      try {
        OrchestrationEventSchema.parse(event)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        if (process.env.NODE_ENV === 'test') {
          // In test mode, log as warning but allow to continue
          warnings.push(`Event validation failed (${context}): ${errorMessage}`)
          isValid = false
          shouldContinue = true
        } else {
          // In production mode, treat as error but implement graceful degradation
          errors.push(`Event validation failed (${context}): ${errorMessage}`)
          isValid = false
          shouldContinue = this.shouldContinueOnValidationError(context)
        }
      }
    }

    return { isValid, shouldContinue, errors, warnings }
  }

  /**
   * Validate journal entry and determine how to proceed
   */
  private validateJournalEntry(
    entry: EnhancedJournalEntry,
    context: 'automatic' | 'manual',
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true
    let shouldContinue = true

    // Basic structure validation
    try {
      if (typeof entry.timestamp !== 'number') {
        errors.push('Entry timestamp must be a number')
        isValid = false
      }
      if (typeof entry.type !== 'string') {
        errors.push('Entry type must be a string')
        isValid = false
      }
      if (typeof entry.data !== 'object' || entry.data === null) {
        errors.push('Entry data must be an object')
        isValid = false
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      errors.push(`Entry structure validation failed: ${errorMessage}`)
      isValid = false
    }

    // If basic structure failed, don't continue
    if (!isValid) {
      shouldContinue = false
      return { isValid, shouldContinue, errors, warnings }
    }

    // Validate event data within entry
    const eventValidation = this.validateEvent(entry.data, context)
    errors.push(...eventValidation.errors)
    warnings.push(...eventValidation.warnings)

    if (!eventValidation.isValid) {
      isValid = false
      shouldContinue = eventValidation.shouldContinue
    }

    return { isValid, shouldContinue, errors, warnings }
  }

  /**
   * Handle validation results consistently
   */
  private handleValidationResult(
    result: ValidationResult,
    context: 'automatic' | 'manual',
    operationName: string,
    executionId?: string,
  ): boolean {
    // Log all errors and warnings
    if (result.errors.length > 0) {
      const errorMessage = `${operationName} validation failed (${context})${executionId ? ` for execution ${executionId}` : ''}: ${result.errors.join(', ')}`
      if (process.env.NODE_ENV === 'test') {
        console.warn(errorMessage)
      } else {
        console.error(errorMessage)
      }
    }

    if (result.warnings.length > 0) {
      const warningMessage = `${operationName} validation warnings (${context})${executionId ? ` for execution ${executionId}` : ''}: ${result.warnings.join(', ')}`
      console.warn(warningMessage)
    }

    return result.shouldContinue
  }

  /**
   * Determine if we should continue processing despite validation errors
   */
  private shouldContinueOnValidationError(
    context: 'automatic' | 'manual',
  ): boolean {
    // In production, implement graceful degradation
    if (process.env.NODE_ENV === 'production') {
      // For automatic recording (event bus), be more tolerant to avoid breaking the system
      // For manual recording, be stricter since it's explicit user action
      return context === 'automatic'
    }

    // In test and development, always continue to aid debugging
    return true
  }

  constructor(
    options: {
      eventBus?: BoundedEventBus
      maxEntriesPerExecution?: number
      maxTotalSizeBytes?: number
      maxFieldSizeBytes?: number
    } = {},
  ) {
    this.eventBus = options.eventBus
    this.maxEntriesPerExecution = options.maxEntriesPerExecution ?? 10000
    this.maxTotalSizeBytes = options.maxTotalSizeBytes ?? 10 * 1024 * 1024 // 10MB
    this.maxFieldSizeBytes = options.maxFieldSizeBytes ?? 8 * 1024 // 8KB

    // Create bound method once and store it
    this.boundRecordEvent = this.recordEvent.bind(this)

    // Subscribe to events if event bus provided
    if (this.eventBus) {
      this.subscribeToEvents()
    }
  }

  /**
   * Subscribe to all relevant event types
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return

    // Subscribe to all tracked event types
    for (const eventType of this.subscribedEventTypes) {
      this.eventBus.on(eventType, this.boundRecordEvent)
    }
  }

  /**
   * Record an event to the journal (automatic recording from event bus)
   * Uses unified error handling for consistent behavior
   */
  private recordEvent(event: OrchestrationEvent): void {
    // Skip if disposed
    if (this.isDisposed) return

    // Use unified validation
    const validationResult = this.validateEvent(event, 'automatic')
    const shouldContinue = this.handleValidationResult(
      validationResult,
      'automatic',
      'Event recording',
    )

    if (!shouldContinue) {
      return
    }

    // Extract execution context from event
    const executionId = this.extractExecutionId(event)
    if (!executionId) return // Skip events without execution context

    const workflowId = this.extractWorkflowId(event)
    const stepId = this.extractStepId(event)

    const entry: EnhancedJournalEntry = {
      timestamp: Date.now(),
      executionId,
      workflowId,
      stepId,
      type: event.type,
      data: this.truncateEventData(event),
    }

    // Queue entry for processing to avoid race conditions and backpressure
    if (this.eventBus) {
      this.pendingEntries.push({ executionId, entry })
      this.processPendingEntries()
    } else {
      // Direct call, add immediately
      this.addEntry(executionId, entry)
    }
  }

  /**
   * Process pending entries in queue with ordered processing
   */
  private processPendingEntries(): void {
    if (this.isProcessingQueue || this.isDisposed) return

    if (this.pendingEntries.length === 0) {
      return
    }

    this.isProcessingQueue = true

    // Use queueMicrotask for ordered processing instead of setTimeout
    this.processingPromise = new Promise<void>((resolve) => {
      globalThis.queueMicrotask(() => {
        // Early exit if disposed during queuing
        if (this.isDisposed) {
          this.isProcessingQueue = false
          this.processingPromise = null
          resolve()
          return
        }

        // Process all pending entries atomically
        const entries = this.pendingEntries.splice(0)
        let processedCount = 0

        for (const { executionId, entry } of entries) {
          if (!this.isDisposed) {
            this.addEntry(executionId, entry)
            processedCount++

            // Check memory limits every 10 entries during batch processing
            if (
              processedCount % 10 === 0 &&
              this.currentSizeBytes > this.maxTotalSizeBytes
            ) {
              // Force additional eviction if we're still over limit
              this.evictOldestExecutions(0)
            }
          }
        }

        this.isProcessingQueue = false
        this.processingPromise = null

        // Check if more entries arrived while processing
        if (this.pendingEntries.length > 0 && !this.isDisposed) {
          this.processPendingEntries()
        }

        resolve()
      })
    })
  }

  /**
   * Manually record an event (for testing or direct usage)
   * Uses unified error handling for consistent behavior
   */
  recordManualEvent(event: OrchestrationEvent): void {
    // Skip if disposed
    if (this.isDisposed) return

    // Use unified validation
    const validationResult = this.validateEvent(event, 'manual')
    const shouldContinue = this.handleValidationResult(
      validationResult,
      'manual',
      'Manual event recording',
    )

    if (!shouldContinue) {
      return
    }

    // Extract execution context from event
    const executionId = this.extractExecutionId(event)
    if (!executionId) return // Skip events without execution context

    const workflowId = this.extractWorkflowId(event)
    const stepId = this.extractStepId(event)

    const entry: EnhancedJournalEntry = {
      timestamp: Date.now(),
      executionId,
      workflowId,
      stepId,
      type: event.type,
      data: this.truncateEventData(event),
    }

    // Add directly without setImmediate for manual recording
    this.addEntry(executionId, entry)
  }

  /**
   * Add an entry to the journal for a specific execution
   * Uses unified error handling for consistent validation behavior
   */
  addEntry(executionId: string, entry: EnhancedJournalEntry): void {
    // Use unified validation - determine context based on whether we're in event bus mode
    const context = this.eventBus ? 'automatic' : 'manual'
    const validationResult = this.validateJournalEntry(entry, context)
    const shouldContinue = this.handleValidationResult(
      validationResult,
      context,
      'Journal entry addition',
      executionId,
    )

    if (!shouldContinue) {
      return
    }

    // Get or create journal for this execution
    let journal = this.journalsByExecution.get(executionId)
    if (!journal) {
      journal = []
      this.journalsByExecution.set(executionId, journal)
    }

    // Calculate entry size
    const entrySize = this.calculateSize(entry)

    // Check total size limit
    if (this.currentSizeBytes + entrySize > this.maxTotalSizeBytes) {
      // Remove oldest executions until we have space
      this.evictOldestExecutions(entrySize)
    }

    // Enforce max entries per execution (ring buffer)
    if (journal.length >= this.maxEntriesPerExecution) {
      const removedEntry = journal.shift()
      if (removedEntry) {
        this.currentSizeBytes -= this.calculateSize(removedEntry)
      }
    }

    // Add new entry
    journal.push(entry)
    this.currentSizeBytes += entrySize
  }

  /**
   * Evict oldest executions to make space
   */
  private evictOldestExecutions(requiredSpace: number): void {
    const executionIds = Array.from(this.journalsByExecution.keys())

    for (const executionId of executionIds) {
      if (this.currentSizeBytes + requiredSpace <= this.maxTotalSizeBytes) {
        break
      }

      const journal = this.journalsByExecution.get(executionId)
      if (journal) {
        // Calculate size of this journal
        const journalSize = journal.reduce(
          (sum, entry) => sum + this.calculateSize(entry),
          0,
        )

        // Remove entire execution
        this.journalsByExecution.delete(executionId)
        this.currentSizeBytes -= journalSize
      }
    }
  }

  /**
   * Calculate size of an entry in bytes
   */
  private calculateSize(entry: EnhancedJournalEntry): number {
    try {
      const json = JSON.stringify(entry)
      return Buffer.byteLength(json, 'utf8')
    } catch {
      return 1024 // Default size if serialization fails
    }
  }

  /**
   * Truncate event data to respect field size limits
   */
  private truncateEventData(event: OrchestrationEvent): OrchestrationEvent {
    const truncated: Record<string, unknown> = { ...event }

    // Truncate large fields
    for (const [key, value] of Object.entries(truncated)) {
      if (typeof value === 'string') {
        // Check byte size, not character length
        const byteSize = Buffer.byteLength(value, 'utf8')
        if (byteSize > this.maxFieldSizeBytes) {
          // Truncate to fit within limit
          const ratio = this.maxFieldSizeBytes / byteSize
          const truncateLength = Math.floor(value.length * ratio) - 12 // Leave room for '[truncated]'
          const finalLength = truncateLength > 0 ? truncateLength : 0
          truncated[key] = value.substring(0, finalLength) + '[truncated]'
        }
      } else if (typeof value === 'object' && value !== null) {
        try {
          const json = JSON.stringify(value)
          const byteSize = Buffer.byteLength(json, 'utf8')
          if (byteSize > this.maxFieldSizeBytes) {
            truncated[key] = {
              truncated: true,
              originalSize: byteSize,
              message: 'Object too large to store',
            }
          }
        } catch {
          truncated[key] = { truncated: true, error: 'Failed to serialize' }
        }
      }
    }

    return truncated as OrchestrationEvent
  }

  /**
   * Extract execution ID from event
   */
  private extractExecutionId(event: OrchestrationEvent): string | undefined {
    if ('executionId' in event && typeof event.executionId === 'string') {
      return event.executionId
    }
    return undefined
  }

  /**
   * Extract workflow ID from event
   */
  private extractWorkflowId(event: OrchestrationEvent): string | undefined {
    if ('workflowId' in event && typeof event.workflowId === 'string') {
      return event.workflowId
    }
    return undefined
  }

  /**
   * Extract step ID from event
   */
  private extractStepId(event: OrchestrationEvent): string | undefined {
    if ('stepId' in event && typeof event.stepId === 'string') {
      return event.stepId
    }
    return undefined
  }

  /**
   * Get journal entries for a specific execution
   */
  getEntriesByExecution(
    executionId: string,
  ): ReadonlyArray<EnhancedJournalEntry> {
    return this.journalsByExecution.get(executionId) ?? []
  }

  /**
   * Export journal for a specific execution as JSON
   */
  exportExecution(executionId: string): string {
    const entries = this.getEntriesByExecution(executionId)
    if (entries.length === 0) {
      return JSON.stringify(
        { error: `No entries found for execution ${executionId}` },
        null,
        2,
      )
    }

    const exportData = this.createExportData(executionId, entries)
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Export all journals as JSON
   */
  exportAll(): string {
    const exports: JournalExport[] = []

    for (const [executionId, entries] of this.journalsByExecution) {
      exports.push(this.createExportData(executionId, entries))
    }

    return JSON.stringify(exports, null, 2)
  }

  /**
   * Create export data for an execution
   */
  private createExportData(
    executionId: string,
    entries: ReadonlyArray<EnhancedJournalEntry>,
  ): JournalExport {
    // Find workflow ID from entries
    const workflowId = entries.find((e) => e.workflowId)?.workflowId

    // Find start and end times
    const startEntry = entries.find(
      (e) => e.type === 'execution.started' || e.type === 'workflow.started',
    )
    const endEntry = entries.find(
      (e) =>
        e.type === 'execution.completed' ||
        e.type === 'execution.failed' ||
        e.type === 'execution.cancelled' ||
        e.type === 'workflow.completed' ||
        e.type === 'workflow.failed',
    )

    const startTime = startEntry?.timestamp
    const endTime = endEntry?.timestamp
    const duration = startTime && endTime ? endTime - startTime : undefined

    // Count events by type
    const stepCount = new Set(
      entries.filter((e) => e.stepId).map((e) => e.stepId),
    ).size
    const retryCount = entries.filter(
      (e) => e.type === 'retry.attempted',
    ).length
    const errorCount = entries.filter(
      (e) =>
        e.type === 'step.failed' ||
        e.type === 'workflow.failed' ||
        e.type === 'execution.failed',
    ).length

    // Determine status
    let status: JournalExport['summary']['status'] = 'running'
    if (endEntry) {
      if (endEntry.type.includes('completed')) status = 'completed'
      else if (endEntry.type.includes('failed')) status = 'failed'
      else if (endEntry.type.includes('cancelled')) status = 'cancelled'
    }

    const exportData = {
      executionId,
      workflowId,
      startTime,
      endTime,
      duration,
      entries: entries.map((e) => ({ ...e })), // Create a copy
      summary: {
        totalEvents: entries.length,
        stepCount,
        retryCount,
        errorCount,
        status,
      },
    }

    // Validate the export data against schema before returning
    try {
      JournalExportSchema.parse(exportData)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const validationResult: ValidationResult = {
        isValid: false,
        shouldContinue: true, // Always return export data, even if invalid
        errors: [`Export data validation failed: ${errorMessage}`],
        warnings: [],
      }

      this.handleValidationResult(
        validationResult,
        'manual', // Export is typically manual operation
        'Journal export validation',
        executionId,
      )

      // Return data anyway but with validation warning in metadata
      const summaryWithWarning = {
        ...exportData.summary,
        validationWarning: 'Export data failed schema validation',
      }
      exportData.summary = summaryWithWarning
    }

    return exportData
  }

  /**
   * Create execution state data aligned with JSON execution model patterns
   */
  createExecutionState(executionId: string): {
    executionId: string
    workflowId?: string
    status:
      | 'pending'
      | 'validating'
      | 'running'
      | 'completed'
      | 'failed'
      | 'cancelled'
    startTime?: string
    endTime?: string
    duration?: number
    completedSteps: string[]
    failedSteps: string[]
    skippedSteps: string[]
    cancelledSteps: string[]
    stepResults: Record<string, unknown>
    variables: Record<string, unknown>
    errors?: unknown[]
    metadata?: Record<string, unknown>
  } | null {
    const entries = this.getEntriesByExecution(executionId)
    if (entries.length === 0) {
      return null
    }

    // Find workflow ID from entries
    const workflowId = entries.find((e) => e.workflowId)?.workflowId

    // Find start and end times
    const startEntry = entries.find(
      (e) => e.type === 'execution.started' || e.type === 'workflow.started',
    )
    const endEntry = entries.find(
      (e) =>
        e.type === 'execution.completed' ||
        e.type === 'execution.failed' ||
        e.type === 'execution.cancelled' ||
        e.type === 'workflow.completed' ||
        e.type === 'workflow.failed',
    )

    const startTime = startEntry
      ? new Date(startEntry.timestamp).toISOString()
      : undefined
    const endTime = endEntry
      ? new Date(endEntry.timestamp).toISOString()
      : undefined
    const duration =
      startEntry && endEntry
        ? endEntry.timestamp - startEntry.timestamp
        : undefined

    // Determine execution status
    let status:
      | 'pending'
      | 'validating'
      | 'running'
      | 'completed'
      | 'failed'
      | 'cancelled' = 'running'
    if (endEntry) {
      if (endEntry.type.includes('completed')) status = 'completed'
      else if (endEntry.type.includes('failed')) status = 'failed'
      else if (endEntry.type.includes('cancelled')) status = 'cancelled'
    } else if (startEntry) {
      status = 'running'
    } else {
      status = 'pending'
    }

    // Collect step information
    const stepEntries = entries.filter((e) => e.stepId)
    const allStepIds = Array.from(new Set(stepEntries.map((e) => e.stepId!)))

    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const skippedSteps: string[] = []
    const cancelledSteps: string[] = []
    const stepResults: Record<string, unknown> = {}
    const errors: unknown[] = []

    // Process step results
    for (const stepId of allStepIds) {
      const stepEvents = stepEntries.filter((e) => e.stepId === stepId)
      const completedEvent = stepEvents.find((e) => e.type === 'step.completed')
      const failedEvent = stepEvents.find((e) => e.type === 'step.failed')

      if (completedEvent) {
        completedSteps.push(stepId)
        if (completedEvent.data && 'output' in completedEvent.data) {
          stepResults[stepId] = completedEvent.data.output
        }
      } else if (failedEvent) {
        failedSteps.push(stepId)
        if (failedEvent.data && 'error' in failedEvent.data) {
          errors.push(failedEvent.data.error)
        }
      }
    }

    return {
      executionId,
      workflowId,
      status,
      startTime,
      endTime,
      duration,
      completedSteps,
      failedSteps,
      skippedSteps,
      cancelledSteps,
      stepResults,
      variables: {}, // Variables could be extracted from context in the future
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalEvents: entries.length,
        journalSize: this.calculateJournalSize(entries),
        generatedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Calculate total size of journal entries
   */
  private calculateJournalSize(
    entries: ReadonlyArray<EnhancedJournalEntry>,
  ): number {
    return entries.reduce((sum, entry) => sum + this.calculateSize(entry), 0)
  }

  /**
   * Validate consistency between journal data and execution state
   * Uses the ExecutionConsistencyValidator for comprehensive validation
   */
  async validateConsistency(
    executionState: Partial<ExecutionStateZod> & {
      executionId: string
      completedSteps: string[]
      failedSteps: string[]
      skippedSteps: string[]
      cancelledSteps: string[]
      stepResults: Record<string, unknown>
      variables: Record<string, unknown>
    },
  ): Promise<{
    isConsistent: boolean
    errors: string[]
    warnings: string[]
    details: {
      journalEntryCount: number
      executionStateValid: boolean
      timestampConsistency: boolean
      stepProgressConsistency: boolean
    }
  }> {
    // Import the validator dynamically to avoid circular dependency
    const { ExecutionConsistencyValidator } = await import(
      './execution-consistency-validator.js'
    )
    const validator = new ExecutionConsistencyValidator()

    const entries = this.getEntriesByExecution(executionState.executionId)

    // Convert to full ExecutionState with required fields
    const fullExecutionState: ExecutionStateZod = {
      executionId: executionState.executionId,
      workflowId: executionState.workflowId || 'unknown',
      status: executionState.status || 'pending',
      startTime: executionState.startTime || new Date().toISOString(),
      endTime: executionState.endTime,
      duration: executionState.duration,
      currentLevel: executionState.currentLevel,
      completedSteps: executionState.completedSteps,
      failedSteps: executionState.failedSteps,
      skippedSteps: executionState.skippedSteps,
      cancelledSteps: executionState.cancelledSteps,
      stepResults: executionState.stepResults,
      variables: executionState.variables,
      errors: executionState.errors,
      metadata: executionState.metadata,
    }

    return validator.validateExecutionConsistency(fullExecutionState, [
      ...entries,
    ])
  }

  /**
   * Get all execution IDs
   */
  getExecutionIds(): string[] {
    return Array.from(this.journalsByExecution.keys())
  }

  /**
   * Clear journal for a specific execution
   */
  clearExecution(executionId: string): void {
    const journal = this.journalsByExecution.get(executionId)
    if (journal) {
      const journalSize = journal.reduce(
        (sum, entry) => sum + this.calculateSize(entry),
        0,
      )
      this.journalsByExecution.delete(executionId)
      this.currentSizeBytes -= journalSize
    }
  }

  /**
   * Clear all journals
   */
  clearAll(): void {
    this.journalsByExecution.clear()
    this.currentSizeBytes = 0
  }

  /**
   * Get current size in bytes
   */
  getCurrentSize(): number {
    return this.currentSizeBytes
  }

  /**
   * Get number of executions being tracked
   */
  getExecutionCount(): number {
    return this.journalsByExecution.size
  }

  /**
   * Unsubscribe from all events and clear journals
   */
  async dispose(): Promise<void> {
    // Mark as disposed to prevent new entries
    this.isDisposed = true

    // Wait for any pending processing to complete
    if (this.processingPromise) {
      await this.processingPromise
    }

    // Clear pending entries
    this.pendingEntries = []

    // Unsubscribe from events
    this.unsubscribeFromEvents()

    // Clear all journals
    this.clearAll()
  }

  /**
   * Unsubscribe from all event types
   */
  private unsubscribeFromEvents(): void {
    if (!this.eventBus) return

    // Unsubscribe from all tracked event types
    for (const eventType of this.subscribedEventTypes) {
      this.eventBus.off(eventType, this.boundRecordEvent)
    }
  }
}

/**
 * Global journal instance management
 */
export class JournalManager {
  private static instance?: EnhancedExecutionJournal

  /**
   * Get or create the global journal instance
   */
  static getGlobalJournal(
    eventBus?: BoundedEventBus,
  ): EnhancedExecutionJournal {
    if (!JournalManager.instance) {
      JournalManager.instance = new EnhancedExecutionJournal({ eventBus })
    }
    return JournalManager.instance
  }

  /**
   * Reset the global journal instance
   */
  static resetGlobalJournal(): void {
    if (JournalManager.instance) {
      JournalManager.instance.dispose()
      JournalManager.instance = undefined
    }
  }
}
