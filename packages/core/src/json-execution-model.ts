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
import { createExecutionError, ExecutionErrorCode } from '@orchestr8/schema'

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
    const workflow = JSON.parse(json) as Workflow
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
      ? `exec-${this.generateDeterministicId(workflow.id, Date.now())}`
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
   * Serialize execution state to JSON
   */
  serializeExecutionState(state: ExecutionState): string {
    const json = JSON.stringify(state, null, 2)
    this.validatePayloadSize(json, 'execution-state')
    return json
  }

  /**
   * Deserialize execution state from JSON
   */
  deserializeExecutionState(json: string): ExecutionState {
    this.validatePayloadSize(json, 'execution-state')
    try {
      return JSON.parse(json) as ExecutionState
    } catch (error) {
      throw createExecutionError(
        ExecutionErrorCode.VALIDATION,
        `Failed to deserialize execution state: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
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
   * Update step execution state in execution state
   */
  updateStepExecutionState(
    state: ExecutionState,
    stepId: string,
    status: 'completed' | 'failed' | 'cancelled' | 'skipped',
    result?: StepResult,
  ): ExecutionState {
    // Create a step result if not provided
    const stepResult: StepResult = result ?? {
      stepId,
      status,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    }

    // Update step results
    state.stepResults[stepId] = stepResult

    // Update step lists based on status
    switch (status) {
      case 'completed':
        if (!state.completedSteps.includes(stepId)) {
          state.completedSteps.push(stepId)
        }
        break
      case 'failed':
        if (!state.failedSteps.includes(stepId)) {
          state.failedSteps.push(stepId)
        }
        if (stepResult.error) {
          state.errors = state.errors ?? []
          state.errors.push(stepResult.error)
        }
        break
      case 'skipped':
        if (!state.skippedSteps.includes(stepId)) {
          state.skippedSteps.push(stepId)
        }
        break
      case 'cancelled':
        if (!state.cancelledSteps.includes(stepId)) {
          state.cancelledSteps.push(stepId)
        }
        break
    }

    if (this.enableJournal) {
      // Calculate duration from start and end times
      const duration =
        new Date(stepResult.endTime).getTime() -
        new Date(stepResult.startTime).getTime()
      this.addJournalEntry(state.executionId, `step.${status}`, {
        stepId,
        duration,
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
    // Map internal execution states to final workflow result states
    const status: 'completed' | 'failed' | 'cancelled' =
      state.status === 'completed'
        ? 'completed'
        : state.status === 'failed'
          ? 'failed'
          : state.status === 'cancelled'
            ? 'cancelled'
            : 'completed' // Default for pending/validating/running states

    return {
      executionId: state.executionId,
      status,
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
  generateDeterministicId(seed: string, timestamp: number): string {
    // Generate hex hash for deterministic ID
    const hash = crypto
      .createHash('sha256')
      .update(`${seed}-${timestamp}`)
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
      // Remove oldest entries (keep last 75%)
      const keepCount = Math.floor(this.journal.length * 0.75)
      this.journal.splice(0, this.journal.length - keepCount)

      // Add truncation marker
      this.journal.unshift({
        timestamp: new Date().toISOString(),
        executionId,
        event: 'journal.truncated',
        data: { removedEntries: this.journal.length - keepCount },
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
    const size = JSON.stringify(payload).length
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
