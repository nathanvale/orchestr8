/**
 * JSON Execution Model implementation
 *
 * Provides deterministic JSON-based workflow execution with proper
 * serialization, validation, and execution semantics as defined in
 * the execution-semantics.md specification.
 */

import type {
  ExecutionError,
  ResiliencePolicy,
  StepResult,
  Workflow,
  WorkflowResult,
} from '@orchestr8/schema'

import crypto, { randomUUID } from 'crypto'

import { NoopLogger } from '@orchestr8/logger'
import {
  createExecutionError,
  ExecutionErrorCode,
  ExecutionStateSchema,
  type EnhancedJournalEntryZod,
  type OrchestrationEventZod,
} from '@orchestr8/schema'

import type { Logger } from './types.js'

/**
 * JSON-serializable execution state
 */
export interface ExecutionState {
  executionId: string
  workflowId: string
  status:
    | 'pending'
    | 'validating'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  currentLevel?: number
  completedSteps: string[]
  failedSteps: string[]
  skippedSteps: string[]
  cancelledSteps: string[]
  stepResults: Record<string, StepResult>
  variables: Record<string, unknown>
  errors?: ExecutionError[]
  metadata?: Record<string, unknown>
}

/**
 * JSON-serializable step execution state
 */
export interface StepExecutionState {
  stepId: string
  status:
    | 'pending'
    | 'validating'
    | 'executing'
    | 'success'
    | 'failed'
    | 'timeout'
    | 'cancelled'
    | 'skipped'
    | 'retrying'
  startTime?: string
  endTime?: string
  duration?: number
  attempt?: number
  maxAttempts?: number
  lastError?: ExecutionError
  input?: unknown
  output?: unknown
  metadata?: Record<string, unknown>
}

/**
 * Execution journal entry
 */
export interface ExecutionJournalEntry {
  timestamp: string
  executionId: string
  stepId?: string
  event: string
  data?: unknown
  error?: ExecutionError
}

/**
 * JSON Execution Model configuration
 */
export interface JsonExecutionConfig {
  maxPayloadSize?: number
  maxJournalSize?: number
  enableJournal?: boolean
  strictValidation?: boolean
  deterministicIds?: boolean
  logger?: Logger
}

/**
 * JSON Execution Model implementation
 */
export class JsonExecutionModel {
  private readonly maxPayloadSize: number
  private readonly maxJournalSize: number
  private readonly enableJournal: boolean
  private readonly strictValidation: boolean
  private readonly deterministicIds: boolean
  private readonly logger: Logger
  private readonly journal: ExecutionJournalEntry[] = []

  constructor(config?: JsonExecutionConfig) {
    this.maxPayloadSize = config?.maxPayloadSize ?? 1024 * 1024 // 1MB for sync
    this.maxJournalSize = config?.maxJournalSize ?? 10 * 1024 * 1024 // 10MB
    this.enableJournal = config?.enableJournal ?? true
    this.strictValidation = config?.strictValidation ?? true
    this.deterministicIds = config?.deterministicIds ?? false
    this.logger = config?.logger ?? new NoopLogger()
  }

  /**
   * Serialize workflow to JSON
   */
  serializeWorkflow(workflow: Workflow): string {
    const json = JSON.stringify(workflow, null, 2)
    this.validatePayloadSize(json, 'workflow')
    return json
  }

  /**
   * Deserialize workflow from JSON
   */
  deserializeWorkflow(json: string): Workflow {
    this.validatePayloadSize(json, 'workflow')

    let workflow: Workflow
    try {
      workflow = JSON.parse(json) as Workflow
    } catch (error) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Invalid JSON in workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }

    if (this.strictValidation) {
      this.validateWorkflow(workflow)
    }
    return workflow
  }

  /**
   * Create initial execution state
   */
  createExecutionState(
    workflow: Workflow,
    variables?: Record<string, unknown>,
  ): ExecutionState {
    const executionId = this.deterministicIds
      ? this.generateDeterministicId(workflow.id)
      : randomUUID()

    const state: ExecutionState = {
      executionId,
      workflowId: workflow.id,
      status: 'pending',
      startTime: new Date().toISOString(),
      currentLevel: 0,
      completedSteps: [],
      failedSteps: [],
      skippedSteps: [],
      cancelledSteps: [],
      stepResults: {},
      variables: variables ?? {},
    }

    if (this.enableJournal) {
      this.addJournalEntry(executionId, 'execution.created', {
        workflowId: workflow.id,
        variables,
      })
    }

    return state
  }

  /**
   * Update step execution state
   */
  updateStepExecutionState(
    state: ExecutionState,
    stepId: string,
    status: 'completed' | 'failed' | 'running' | 'cancelled',
    result?: StepResult,
  ): ExecutionState {
    const updatedState = { ...state }

    // Update step arrays based on status
    if (
      status === 'completed' &&
      !updatedState.completedSteps.includes(stepId)
    ) {
      updatedState.completedSteps = [...updatedState.completedSteps, stepId]
      // Remove from other arrays if present
      updatedState.failedSteps = updatedState.failedSteps.filter(
        (id) => id !== stepId,
      )
      updatedState.cancelledSteps = updatedState.cancelledSteps.filter(
        (id) => id !== stepId,
      )
    } else if (
      status === 'failed' &&
      !updatedState.failedSteps.includes(stepId)
    ) {
      updatedState.failedSteps = [...updatedState.failedSteps, stepId]
      // Remove from other arrays if present
      updatedState.completedSteps = updatedState.completedSteps.filter(
        (id) => id !== stepId,
      )
      updatedState.cancelledSteps = updatedState.cancelledSteps.filter(
        (id) => id !== stepId,
      )
    } else if (
      status === 'cancelled' &&
      !updatedState.cancelledSteps.includes(stepId)
    ) {
      updatedState.cancelledSteps = [...updatedState.cancelledSteps, stepId]
      // Remove from other arrays if present
      updatedState.completedSteps = updatedState.completedSteps.filter(
        (id) => id !== stepId,
      )
      updatedState.failedSteps = updatedState.failedSteps.filter(
        (id) => id !== stepId,
      )
    }

    // Store step result if provided
    if (result) {
      updatedState.stepResults = {
        ...updatedState.stepResults,
        [stepId]: result,
      }
    }

    return updatedState
  }

  /**
   * Serialize execution state to JSON
   * Now includes schema validation for data consistency
   */
  serializeExecutionState(state: ExecutionState): string {
    if (this.strictValidation) {
      try {
        ExecutionStateSchema.parse(state)
      } catch (error) {
        this.logger.warn(
          'Execution state validation failed during serialization',
          {
            executionId: state.executionId,
            error: error instanceof Error ? error.message : String(error),
          },
        )
        if (this.strictValidation) {
          throw createExecutionError(
            ExecutionErrorCode.VALIDATION,
            `Execution state validation failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    }

    const json = JSON.stringify(state, null, 2)
    this.validatePayloadSize(json, 'execution-state')
    return json
  }

  /**
   * Deserialize execution state from JSON
   * Now includes schema validation for data consistency
   */
  deserializeExecutionState(json: string): ExecutionState {
    this.validatePayloadSize(json, 'execution-state')

    let state: ExecutionState
    try {
      state = JSON.parse(json) as ExecutionState
    } catch (error) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Failed to parse execution state JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (this.strictValidation) {
      try {
        ExecutionStateSchema.parse(state)
      } catch (error) {
        this.logger.warn(
          'Execution state validation failed during deserialization',
          {
            error: error instanceof Error ? error.message : String(error),
          },
        )
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Execution state validation failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return state
  }

  /**
   * Create step execution state
   */
  createStepExecutionState(stepId: string): StepExecutionState {
    return {
      stepId,
      status: 'pending',
    }
  }

  /**
   * Update execution state after step completion
   */
  updateExecutionStateForStep(
    state: ExecutionState,
    stepState: StepExecutionState,
    result: StepResult,
  ): ExecutionState {
    // Update step results
    state.stepResults[stepState.stepId] = result

    // Update step lists based on status
    switch (result.status) {
      case 'completed':
        state.completedSteps.push(stepState.stepId)
        break
      case 'failed':
        state.failedSteps.push(stepState.stepId)
        if (result.error) {
          state.errors = state.errors ?? []
          state.errors.push(result.error)
        }
        break
      case 'skipped':
        state.skippedSteps.push(stepState.stepId)
        break
      case 'cancelled':
        state.cancelledSteps.push(stepState.stepId)
        break
    }

    if (this.enableJournal) {
      this.addJournalEntry(state.executionId, `step.${result.status}`, {
        stepId: stepState.stepId,
        duration: stepState.duration,
      })
    }

    return state
  }

  /**
   * Finalize execution state
   */
  finalizeExecutionState(state: ExecutionState): ExecutionState {
    state.endTime = new Date().toISOString()
    state.duration = Date.now() - new Date(state.startTime).getTime()

    // Determine final status
    if (state.cancelledSteps.length > 0) {
      state.status = 'cancelled'
    } else if (state.failedSteps.length > 0) {
      state.status = 'failed'
    } else {
      state.status = 'completed'
    }

    if (this.enableJournal) {
      this.addJournalEntry(state.executionId, 'execution.finalized', {
        status: state.status,
        duration: state.duration,
      })
    }

    return state
  }

  /**
   * Convert execution state to workflow result
   */
  toWorkflowResult(state: ExecutionState): WorkflowResult {
    // Map execution state status to workflow result status
    let resultStatus: 'completed' | 'failed' | 'cancelled'
    switch (state.status) {
      case 'completed':
        resultStatus = 'completed'
        break
      case 'failed':
        resultStatus = 'failed'
        break
      case 'cancelled':
        resultStatus = 'cancelled'
        break
      case 'pending':
      case 'validating':
      case 'running':
        // These are intermediate states, map to completed for now
        // In practice, this method should only be called for terminal states
        resultStatus = 'completed'
        break
      default:
        resultStatus = 'failed'
    }

    return {
      executionId: state.executionId,
      status: resultStatus,
      steps: state.stepResults,
      variables: state.variables,
      startTime: state.startTime,
      endTime: state.endTime ?? new Date().toISOString(),
      duration: state.duration ?? 0,
      errors: state.errors,
    }
  }

  /**
   * Get execution journal
   */
  getJournal(): ReadonlyArray<ExecutionJournalEntry> {
    return this.journal
  }

  /**
   * Export journal as JSON
   */
  exportJournal(): string {
    const json = JSON.stringify(this.journal, null, 2)
    if (json.length > this.maxJournalSize) {
      // Truncate journal to fit size limit - keep reducing until it fits
      let truncatedJournal = this.journal
      let truncatedJson = json

      while (
        truncatedJson.length > this.maxJournalSize &&
        truncatedJournal.length > 1
      ) {
        // Remove first half of entries
        truncatedJournal = truncatedJournal.slice(
          Math.floor(truncatedJournal.length / 2),
        )
        truncatedJson = JSON.stringify(truncatedJournal, null, 2)
      }

      return truncatedJson
    }
    return json
  }

  /**
   * Clear journal
   */
  clearJournal(): void {
    this.journal.length = 0
  }

  /**
   * Normalize resilience policy for JSON serialization
   */
  normalizeResiliencePolicy(policy: unknown): ResiliencePolicy | undefined {
    if (!policy || typeof policy !== 'object') return undefined

    const policyObj = policy as Record<string, unknown>
    const normalized: ResiliencePolicy = {}

    if (policyObj.retry && typeof policyObj.retry === 'object') {
      const retry = policyObj.retry as Record<string, unknown>
      normalized.retry = {
        maxAttempts: (retry.maxAttempts as number) ?? 3,
        backoffStrategy:
          (retry.backoffStrategy as 'fixed' | 'exponential') ?? 'exponential',
        jitterStrategy:
          (retry.jitterStrategy as 'none' | 'full-jitter') ?? 'full-jitter',
        initialDelay: (retry.initialDelay as number) ?? 1000,
        maxDelay: (retry.maxDelay as number) ?? 10000,
      }
    }

    if (policyObj.timeout && typeof policyObj.timeout === 'number') {
      normalized.timeout = policyObj.timeout
    }

    if (
      policyObj.circuitBreaker &&
      typeof policyObj.circuitBreaker === 'object'
    ) {
      const cb = policyObj.circuitBreaker as Record<string, unknown>
      normalized.circuitBreaker = {
        failureThreshold: (cb.failureThreshold as number) ?? 5,
        recoveryTime: (cb.recoveryTime as number) ?? 30000,
        sampleSize: (cb.sampleSize as number) ?? 10,
        halfOpenPolicy:
          (cb.halfOpenPolicy as 'single-probe' | 'gradual') ?? 'single-probe',
      }
    }

    return normalized
  }

  /**
   * Validate workflow structure
   */
  private validateWorkflow(workflow: Workflow): void {
    if (!workflow.id) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'Workflow must have an id',
      )
    }

    if (!workflow.version) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'Workflow must have a version',
      )
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        'Workflow must have at least one step',
      )
    }

    // Validate step IDs are unique
    const stepIds = new Set<string>()
    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        throw createExecutionError(
          ExecutionErrorCode.VALIDATION,
          `Duplicate step ID: ${step.id}`,
        )
      }
      stepIds.add(step.id)
    }

    // Validate dependencies exist
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            throw createExecutionError(
              ExecutionErrorCode.VALIDATION,
              `Step '${step.id}' depends on non-existent step '${dep}'`,
            )
          }
        }
      }
    }
  }

  /**
   * Validate payload size
   */
  private validatePayloadSize(payload: string, type: string): void {
    const size = Buffer.byteLength(payload, 'utf8')
    if (size > this.maxPayloadSize) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `${type} payload size ${size} exceeds maximum ${this.maxPayloadSize} bytes`,
      )
    }
  }

  /**
   * Generate deterministic ID
   */
  generateDeterministicId(seed: string, timestamp?: number): string {
    const actualTimestamp = timestamp ?? Date.now()
    // Simple deterministic ID generation using hex encoding
    const hash = crypto
      .createHash('sha256')
      .update(`${seed}-${actualTimestamp}`)
      .digest('hex')
      .substring(0, 16)
    return hash
  }

  /**
   * Add journal entry
   */
  private addJournalEntry(
    executionId: string,
    event: string,
    data?: unknown,
    stepId?: string,
    error?: ExecutionError,
  ): void {
    if (!this.enableJournal) return

    const entry: ExecutionJournalEntry = {
      timestamp: new Date().toISOString(),
      executionId,
      event,
    }

    if (stepId) entry.stepId = stepId
    if (data) entry.data = data
    if (error) entry.error = error

    this.journal.push(entry)

    // Check journal size and truncate if needed
    const journalJson = JSON.stringify(this.journal)
    if (journalJson.length > this.maxJournalSize) {
      // Capture original length before mutation
      const originalLength = this.journal.length

      // Remove oldest entries (keep last 75%)
      const keepCount = Math.floor(originalLength * 0.75)
      const removedCount = originalLength - keepCount

      this.journal.splice(0, removedCount)

      // Add truncation marker
      this.journal.unshift({
        timestamp: new Date().toISOString(),
        executionId,
        event: 'journal.truncated',
        data: { removedEntries: removedCount },
      })
    }
  }
}

/**
 * Create HTTP execution context with proper headers and limits
 */
export class HTTPExecutionContext {
  private readonly syncMaxSize = 1024 * 1024 // 1MB
  private readonly asyncMaxSize = 10 * 1024 * 1024 // 10MB
  private readonly journalMaxSize = 10 * 1024 * 1024 // 10MB

  generateETag(content: unknown): string {
    const hash = crypto.createHash('sha256')
    hash.update(JSON.stringify(content))
    return `"${hash.digest('hex').substring(0, 16)}"`
  }

  generateLocationHeader(executionId: string): string {
    return `/v1/executions/${executionId}`
  }

  calculateRetryAfter(attempt: number): string {
    // Exponential backoff: 5, 10, 20 seconds
    const delay = Math.min(5 * Math.pow(2, attempt), 60)
    return delay.toString()
  }

  validatePayload(payload: unknown, mode: 'sync' | 'async' | 'journal'): void {
    // Cache stringified value to avoid double stringification
    const stringifiedPayload = JSON.stringify(payload)
    const size = Buffer.byteLength(stringifiedPayload, 'utf8')
    const maxSize = this.getMaxSize(mode)

    if (size > maxSize) {
      throw new Error(
        `Payload size ${size} exceeds maximum ${maxSize} bytes for ${mode} mode`,
      )
    }
  }

  private getMaxSize(mode: 'sync' | 'async' | 'journal'): number {
    switch (mode) {
      case 'sync':
        return this.syncMaxSize
      case 'async':
        return this.asyncMaxSize
      case 'journal':
        return this.journalMaxSize
      default:
        return this.asyncMaxSize
    }
  }

  /**
   * Sync execution state with journal data to ensure consistency
   * This method validates that journal entries align with execution state
   */
  syncWithJournal(
    executionState: ExecutionState,
    journalEntries: Array<{
      timestamp: number
      executionId?: string
      stepId?: string
      type: string
      data: unknown
    }>,
  ): ExecutionState {
    const syncedState = { ...executionState }

    // Validate that execution ID matches
    const executionEvents = journalEntries.filter(
      (entry) => entry.executionId === executionState.executionId,
    )

    if (executionEvents.length === 0) {
      console.warn('No journal entries found for execution', {
        executionId: executionState.executionId,
      })
      return syncedState
    }

    // Find latest status from journal events
    const statusEvents = executionEvents.filter(
      (entry) =>
        entry.type.includes('execution.') || entry.type.includes('workflow.'),
    )

    const latestStatusEvent = statusEvents.sort(
      (a, b) => b.timestamp - a.timestamp,
    )[0]

    if (latestStatusEvent) {
      // Update status based on journal data
      if (latestStatusEvent.type.includes('completed')) {
        syncedState.status = 'completed'
        syncedState.endTime = new Date(
          latestStatusEvent.timestamp,
        ).toISOString()
      } else if (latestStatusEvent.type.includes('failed')) {
        syncedState.status = 'failed'
        syncedState.endTime = new Date(
          latestStatusEvent.timestamp,
        ).toISOString()
      } else if (latestStatusEvent.type.includes('cancelled')) {
        syncedState.status = 'cancelled'
        syncedState.endTime = new Date(
          latestStatusEvent.timestamp,
        ).toISOString()
      } else if (latestStatusEvent.type.includes('started')) {
        if (syncedState.status === 'pending') {
          syncedState.status = 'running'
        }
      }
    }

    // Update step results from journal
    const stepEvents = executionEvents.filter((entry) => entry.stepId)
    for (const stepEvent of stepEvents) {
      if (stepEvent.type === 'step.completed' && stepEvent.stepId) {
        if (!syncedState.completedSteps.includes(stepEvent.stepId)) {
          syncedState.completedSteps.push(stepEvent.stepId)
        }
        // Remove from failed if present
        const failedIndex = syncedState.failedSteps.indexOf(stepEvent.stepId)
        if (failedIndex > -1) {
          syncedState.failedSteps.splice(failedIndex, 1)
        }
      } else if (stepEvent.type === 'step.failed' && stepEvent.stepId) {
        if (!syncedState.failedSteps.includes(stepEvent.stepId)) {
          syncedState.failedSteps.push(stepEvent.stepId)
        }
      }
    }

    // Calculate duration if both start and end times exist
    if (syncedState.startTime && syncedState.endTime) {
      const startMs = new Date(syncedState.startTime).getTime()
      const endMs = new Date(syncedState.endTime).getTime()
      syncedState.duration = endMs - startMs
    }

    return syncedState
  }

  /**
   * Validate execution state consistency with journal data
   */
  async validateConsistency(
    executionState: ExecutionState,
    journalEntries: Array<{
      timestamp: number
      executionId?: string
      stepId?: string
      type: string
      data: unknown
    }>,
  ): Promise<{
    isConsistent: boolean
    errors: string[]
    warnings: string[]
  }> {
    // Import the validator dynamically to avoid circular dependency
    const { ExecutionConsistencyValidator } = await import(
      './execution-consistency-validator.js'
    )
    const validator = new ExecutionConsistencyValidator()

    // Convert journal entries to the expected format
    const enhancedEntries: EnhancedJournalEntryZod[] = journalEntries.map(
      (entry) => {
        const enhancedEntry: EnhancedJournalEntryZod = {
          timestamp: entry.timestamp,
          type: entry.type,
          data: entry.data as OrchestrationEventZod, // Type assertion for data field
        }

        // Only include optional fields if they have values
        if (entry.executionId) {
          enhancedEntry.executionId = entry.executionId
        }
        if (entry.stepId) {
          enhancedEntry.stepId = entry.stepId
        }
        // Note: workflowId and metadata are not available in the input journal entry type

        return enhancedEntry
      },
    )

    const result = validator.validateExecutionConsistency(
      executionState,
      enhancedEntries,
    )
    return {
      isConsistent: result.isConsistent,
      errors: result.errors,
      warnings: result.warnings,
    }
  }

  setExecutionHeaders(
    response: { setHeader: (name: string, value: string) => void },
    executionId: string,
    status: string,
    content?: unknown,
  ): void {
    response.setHeader('Location', this.generateLocationHeader(executionId))
    response.setHeader('Content-Type', 'application/json')

    if (content) {
      response.setHeader('ETag', this.generateETag(content))
      response.setHeader('Cache-Control', 'max-age=0, must-revalidate')
    }

    if (status === 'running') {
      response.setHeader('Retry-After', '5')
    }

    if (status === 'failed') {
      response.setHeader('Retry-After', '10')
    }
  }
}
