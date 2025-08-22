/**
 * Event schemas for orchestration events
 *
 * These schemas validate the event structures used throughout the orchestration platform
 * to ensure consistency between the event bus, execution journal, and JSON execution model.
 */

import { z } from 'zod'

/**
 * Base error schema for event error objects
 */
const ErrorSchema = z.object({
  name: z.string(),
  message: z.string(),
  stack: z.string().optional(),
})

/**
 * Workflow lifecycle event schemas
 */
export const WorkflowStartedEventSchema = z.object({
  type: z.literal('workflow.started'),
  workflowId: z.string(),
  timestamp: z.number(),
})

export const WorkflowCompletedEventSchema = z.object({
  type: z.literal('workflow.completed'),
  workflowId: z.string(),
  duration: z.number(),
})

export const WorkflowFailedEventSchema = z.object({
  type: z.literal('workflow.failed'),
  workflowId: z.string(),
  error: ErrorSchema,
})

export const WorkflowEventSchema = z.discriminatedUnion('type', [
  WorkflowStartedEventSchema,
  WorkflowCompletedEventSchema,
  WorkflowFailedEventSchema,
])

/**
 * Execution lifecycle event schemas
 */
export const ExecutionQueuedEventSchema = z.object({
  type: z.literal('execution.queued'),
  executionId: z.string(),
  workflowId: z.string(),
})

export const ExecutionStartedEventSchema = z.object({
  type: z.literal('execution.started'),
  executionId: z.string(),
})

export const ExecutionCancelledEventSchema = z.object({
  type: z.literal('execution.cancelled'),
  executionId: z.string(),
  reason: z.string(),
})

export const ExecutionEventSchema = z.discriminatedUnion('type', [
  ExecutionQueuedEventSchema,
  ExecutionStartedEventSchema,
  ExecutionCancelledEventSchema,
])

/**
 * Step execution event schemas
 */
export const StepStartedEventSchema = z.object({
  type: z.literal('step.started'),
  stepId: z.string(),
  executionId: z.string(),
})

export const StepCompletedEventSchema = z.object({
  type: z.literal('step.completed'),
  stepId: z.string(),
  output: z.unknown(),
})

export const StepFailedEventSchema = z.object({
  type: z.literal('step.failed'),
  stepId: z.string(),
  error: ErrorSchema,
  retryable: z.boolean(),
})

export const StepEventSchema = z.discriminatedUnion('type', [
  StepStartedEventSchema,
  StepCompletedEventSchema,
  StepFailedEventSchema,
])

/**
 * Resilience pattern event schemas
 */
export const RetryAttemptedEventSchema = z.object({
  type: z.literal('retry.attempted'),
  stepId: z.string(),
  attempt: z.number(),
  delay: z.number(),
})

export const CircuitBreakerOpenedEventSchema = z.object({
  type: z.literal('circuitBreaker.opened'),
  key: z.string(),
  failures: z.number(),
})

export const TimeoutExceededEventSchema = z.object({
  type: z.literal('timeout.exceeded'),
  stepId: z.string(),
  duration: z.number(),
})

export const ResilienceEventSchema = z.discriminatedUnion('type', [
  RetryAttemptedEventSchema,
  CircuitBreakerOpenedEventSchema,
  TimeoutExceededEventSchema,
])

/**
 * All orchestration events schema (discriminated union)
 */
export const OrchestrationEventSchema = z.discriminatedUnion('type', [
  // Workflow events
  WorkflowStartedEventSchema,
  WorkflowCompletedEventSchema,
  WorkflowFailedEventSchema,
  // Execution events
  ExecutionQueuedEventSchema,
  ExecutionStartedEventSchema,
  ExecutionCancelledEventSchema,
  // Step events
  StepStartedEventSchema,
  StepCompletedEventSchema,
  StepFailedEventSchema,
  // Resilience events
  RetryAttemptedEventSchema,
  CircuitBreakerOpenedEventSchema,
  TimeoutExceededEventSchema,
])

/**
 * Enhanced journal entry schema
 */
export const EnhancedJournalEntrySchema = z.object({
  timestamp: z.number(),
  executionId: z.string().optional(),
  workflowId: z.string().optional(),
  stepId: z.string().optional(),
  type: z.string(),
  data: OrchestrationEventSchema,
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Journal export schema
 */
export const JournalExportSchema = z.object({
  executionId: z.string(),
  workflowId: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  duration: z.number().optional(),
  entries: z.array(EnhancedJournalEntrySchema),
  summary: z.object({
    totalEvents: z.number(),
    stepCount: z.number(),
    retryCount: z.number(),
    errorCount: z.number(),
    status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
  }),
})

/**
 * Step execution state schema (for JSON execution model)
 */
export const StepExecutionStateSchema = z.object({
  id: z.string(),
  status: z.enum([
    'pending',
    'running',
    'completed',
    'failed',
    'skipped',
    'cancelled',
  ]),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  duration: z.number().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  retryCount: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Execution state schema (for JSON execution model)
 */
export const ExecutionStateSchema = z.object({
  executionId: z.string(),
  workflowId: z.string(),
  status: z.enum([
    'pending',
    'validating',
    'running',
    'completed',
    'failed',
    'cancelled',
  ]),
  startTime: z.string(),
  endTime: z.string().optional(),
  duration: z.number().optional(),
  currentLevel: z.number().optional(),
  completedSteps: z.array(z.string()),
  failedSteps: z.array(z.string()),
  skippedSteps: z.array(z.string()),
  cancelledSteps: z.array(z.string()),
  stepResults: z.record(z.unknown()),
  variables: z.record(z.unknown()),
  errors: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Execution journal entry schema (for JSON execution model)
 */
export const ExecutionJournalEntrySchema = z.object({
  timestamp: z.string(),
  executionId: z.string(),
  workflowId: z.string().optional(),
  stepId: z.string().optional(),
  event: z.string(),
  data: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
})

// TypeScript types (inferred from Zod schemas)
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>
export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>
export type StepEvent = z.infer<typeof StepEventSchema>
export type ResilienceEvent = z.infer<typeof ResilienceEventSchema>
export type OrchestrationEvent = z.infer<typeof OrchestrationEventSchema>
export type EnhancedJournalEntry = z.infer<typeof EnhancedJournalEntrySchema>
export type JournalExport = z.infer<typeof JournalExportSchema>
export type StepExecutionState = z.infer<typeof StepExecutionStateSchema>
export type ExecutionState = z.infer<typeof ExecutionStateSchema>
export type ExecutionJournalEntry = z.infer<typeof ExecutionJournalEntrySchema>
