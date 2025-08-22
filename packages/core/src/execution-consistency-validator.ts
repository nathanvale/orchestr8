/**
 * Execution Consistency Validator
 *
 * Ensures data consistency across orchestration platform components
 * by validating that journal entries, execution states, and other data
 * structures remain synchronized and coherent.
 */

import {
  ExecutionStateSchema,
  EnhancedJournalEntrySchema,
  OrchestrationEventSchema,
  type ExecutionStateZod,
  type EnhancedJournalEntryZod,
} from '@orchestr8/schema'

/**
 * Consistency validation result
 */
export interface ConsistencyValidationResult {
  isConsistent: boolean
  errors: string[]
  warnings: string[]
  details: {
    journalEntryCount: number
    executionStateValid: boolean
    timestampConsistency: boolean
    stepProgressConsistency: boolean
  }
}

/**
 * Execution consistency validator for orchestration platform
 */
export class ExecutionConsistencyValidator {
  /**
   * Validate consistency between execution state and journal entries
   */
  validateExecutionConsistency(
    executionState: ExecutionStateZod,
    journalEntries: EnhancedJournalEntryZod[],
  ): ConsistencyValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate execution state schema
    let executionStateValid = true
    try {
      ExecutionStateSchema.parse(executionState)
    } catch (error) {
      executionStateValid = false
      errors.push(
        `Invalid execution state schema: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Validate journal entries schemas
    for (const [index, entry] of journalEntries.entries()) {
      try {
        EnhancedJournalEntrySchema.parse(entry)
        OrchestrationEventSchema.parse(entry.data)
      } catch (error) {
        warnings.push(
          `Journal entry ${index} validation failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Filter journal entries for this execution
    const relevantEntries = journalEntries.filter(
      (entry) => entry.executionId === executionState.executionId,
    )

    if (relevantEntries.length === 0) {
      warnings.push(
        `No journal entries found for execution ${executionState.executionId}`,
      )
    }

    // Validate timestamp consistency
    const timestampConsistency = this.validateTimestampConsistency(
      executionState,
      relevantEntries,
      errors,
      warnings,
    )

    // Validate step progress consistency
    const stepProgressConsistency = this.validateStepProgressConsistency(
      executionState,
      relevantEntries,
      errors,
      warnings,
    )

    // Validate execution status consistency
    this.validateExecutionStatusConsistency(
      executionState,
      relevantEntries,
      errors,
      warnings,
    )

    return {
      isConsistent: errors.length === 0,
      errors,
      warnings,
      details: {
        journalEntryCount: relevantEntries.length,
        executionStateValid,
        timestampConsistency,
        stepProgressConsistency,
      },
    }
  }

  /**
   * Validate timestamp consistency between state and journal
   */
  private validateTimestampConsistency(
    executionState: ExecutionStateZod,
    journalEntries: EnhancedJournalEntryZod[],
    errors: string[],
    warnings: string[],
  ): boolean {
    let isConsistent = true

    // Find execution start and end events
    const startEvent = journalEntries.find(
      (entry) =>
        entry.type === 'execution.started' || entry.type === 'workflow.started',
    )
    const endEvent = journalEntries.find(
      (entry) =>
        entry.type === 'execution.completed' ||
        entry.type === 'execution.failed' ||
        entry.type === 'execution.cancelled' ||
        entry.type === 'workflow.completed' ||
        entry.type === 'workflow.failed',
    )

    // Check start time consistency
    if (startEvent && executionState.startTime) {
      const stateStartTime = new Date(executionState.startTime).getTime()
      const journalStartTime = startEvent.timestamp

      // Allow 1 second tolerance for timestamp differences
      const timeDiff = Math.abs(stateStartTime - journalStartTime)
      if (timeDiff > 1000) {
        isConsistent = false
        errors.push(
          `Start time mismatch: state=${executionState.startTime}, journal=${new Date(journalStartTime).toISOString()}, diff=${timeDiff}ms`,
        )
      }
    }

    // Check end time consistency
    if (endEvent && executionState.endTime) {
      const stateEndTime = new Date(executionState.endTime).getTime()
      const journalEndTime = endEvent.timestamp

      const timeDiff = Math.abs(stateEndTime - journalEndTime)
      if (timeDiff > 1000) {
        isConsistent = false
        errors.push(
          `End time mismatch: state=${executionState.endTime}, journal=${new Date(journalEndTime).toISOString()}, diff=${timeDiff}ms`,
        )
      }
    }

    // Check duration consistency
    if (executionState.duration && startEvent && endEvent) {
      const journalDuration = endEvent.timestamp - startEvent.timestamp
      const durationDiff = Math.abs(executionState.duration - journalDuration)

      if (durationDiff > 1000) {
        warnings.push(
          `Duration mismatch: state=${executionState.duration}ms, journal=${journalDuration}ms, diff=${durationDiff}ms`,
        )
      }
    }

    return isConsistent
  }

  /**
   * Validate step progress consistency
   */
  private validateStepProgressConsistency(
    executionState: ExecutionStateZod,
    journalEntries: EnhancedJournalEntryZod[],
    errors: string[],
    warnings: string[],
  ): boolean {
    let isConsistent = true

    // Get step events from journal
    const stepEvents = journalEntries.filter((entry) => entry.stepId)
    const journalCompletedSteps = new Set<string>()
    const journalFailedSteps = new Set<string>()

    for (const event of stepEvents) {
      if (event.type === 'step.completed' && event.stepId) {
        journalCompletedSteps.add(event.stepId)
        // Remove from failed if it was previously failed
        journalFailedSteps.delete(event.stepId)
      } else if (event.type === 'step.failed' && event.stepId) {
        journalFailedSteps.add(event.stepId)
      }
    }

    // Check completed steps consistency
    const stateCompletedSteps = new Set(executionState.completedSteps)
    for (const stepId of journalCompletedSteps) {
      if (!stateCompletedSteps.has(stepId)) {
        isConsistent = false
        errors.push(
          `Step ${stepId} is completed in journal but not in execution state`,
        )
      }
    }

    for (const stepId of stateCompletedSteps) {
      if (!journalCompletedSteps.has(stepId)) {
        isConsistent = false
        warnings.push(
          `Step ${stepId} is completed in execution state but not in journal`,
        )
      }
    }

    // Check failed steps consistency
    const stateFailedSteps = new Set(executionState.failedSteps)
    for (const stepId of journalFailedSteps) {
      if (!stateFailedSteps.has(stepId)) {
        isConsistent = false
        warnings.push(
          `Step ${stepId} is failed in journal but not in execution state`,
        )
      }
    }

    for (const stepId of stateFailedSteps) {
      if (!journalFailedSteps.has(stepId)) {
        isConsistent = false
        warnings.push(
          `Step ${stepId} is failed in execution state but not in journal`,
        )
      }
    }

    return isConsistent
  }

  /**
   * Validate execution status consistency
   */
  private validateExecutionStatusConsistency(
    executionState: ExecutionStateZod,
    journalEntries: EnhancedJournalEntryZod[],
    errors: string[],
    warnings: string[],
  ): void {
    // Find latest status event
    const statusEvents = journalEntries
      .filter(
        (entry) =>
          entry.type.includes('execution.') || entry.type.includes('workflow.'),
      )
      .sort((a, b) => b.timestamp - a.timestamp)

    const latestStatusEvent = statusEvents[0]
    if (!latestStatusEvent) {
      warnings.push('No status events found in journal')
      return
    }

    // Check status consistency
    let expectedStatus: ExecutionStateZod['status'] = 'running'

    if (latestStatusEvent.type.includes('completed')) {
      expectedStatus = 'completed'
    } else if (latestStatusEvent.type.includes('failed')) {
      expectedStatus = 'failed'
    } else if (latestStatusEvent.type.includes('cancelled')) {
      expectedStatus = 'cancelled'
    } else if (latestStatusEvent.type.includes('started')) {
      expectedStatus = 'running'
    }

    if (executionState.status !== expectedStatus) {
      warnings.push(
        `Status mismatch: state=${executionState.status}, expected from journal=${expectedStatus}`,
      )
    }
  }

  /**
   * Validate journal entry against schema and return corrected version
   */
  validateAndCorrectJournalEntry(entry: EnhancedJournalEntryZod): {
    entry: EnhancedJournalEntryZod
    corrected: boolean
    errors: string[]
  } {
    const errors: string[] = []
    let corrected = false
    let correctedEntry = { ...entry }

    try {
      EnhancedJournalEntrySchema.parse(entry)
    } catch (error) {
      errors.push(
        `Journal entry validation failed: ${error instanceof Error ? error.message : String(error)}`,
      )

      // Attempt basic corrections
      if (typeof entry.timestamp !== 'number') {
        correctedEntry.timestamp = Date.now()
        corrected = true
      }

      if (typeof entry.type !== 'string') {
        correctedEntry.type = 'unknown'
        corrected = true
      }
    }

    // Validate event data
    try {
      OrchestrationEventSchema.parse(entry.data)
    } catch (error) {
      errors.push(
        `Event data validation failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      entry: correctedEntry,
      corrected,
      errors,
    }
  }

  /**
   * Create a summary of consistency issues
   */
  createConsistencySummary(results: ConsistencyValidationResult[]): {
    totalExecutions: number
    consistentExecutions: number
    totalErrors: number
    totalWarnings: number
    commonIssues: string[]
  } {
    const totalExecutions = results.length
    const consistentExecutions = results.filter((r) => r.isConsistent).length
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)

    // Find common issues
    const allErrors = results.flatMap((r) => r.errors)
    const allWarnings = results.flatMap((r) => r.warnings)
    const errorCounts = new Map<string, number>()
    const warningCounts = new Map<string, number>()

    for (const error of allErrors) {
      const key = error.split(':')[0] || error // Get the issue type
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1)
    }

    for (const warning of allWarnings) {
      const key = warning.split(':')[0] || warning // Get the issue type
      warningCounts.set(key, (warningCounts.get(key) || 0) + 1)
    }

    const commonIssues = [
      ...Array.from(errorCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([issue, count]) => `Error: ${issue} (${count} occurrences)`),
      ...Array.from(warningCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([issue, count]) => `Warning: ${issue} (${count} occurrences)`),
    ]

    return {
      totalExecutions,
      consistentExecutions,
      totalErrors,
      totalWarnings,
      commonIssues,
    }
  }
}
