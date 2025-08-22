/**
 * Resilience and execution policy schemas
 * Modular policy definitions for workflows and steps
 */

import { z } from 'zod'

/**
 * Retry policy schema with exponential backoff and jitter
 */
export const RetryPolicySchema = z
  .object({
    maxAttempts: z
      .number()
      .int()
      .min(1, 'Must have at least 1 attempt')
      .max(10, 'Maximum 10 retry attempts allowed')
      .default(3)
      .describe('Maximum number of retry attempts (initial + retries)'),
    baseDelayMs: z
      .number()
      .int()
      .min(100, 'Base delay must be at least 100ms')
      .default(1000)
      .describe('Base delay for exponential backoff in milliseconds'),
    maxDelayMs: z
      .number()
      .int()
      .default(30000)
      .describe('Maximum delay cap for exponential backoff'),
    jitterStrategy: z
      .enum(['full-jitter'])
      .default('full-jitter')
      .describe('Jitter strategy to prevent thundering herds'),
    retryableErrors: z
      .array(z.enum(['RetryableError', 'TimeoutError', 'NetworkError']))
      .default(['RetryableError', 'TimeoutError'])
      .describe('Error types that trigger retry attempts'),
  })
  .describe('Retry policy with exponential backoff and jitter')

/**
 * Circuit breaker policy schema for fault isolation
 */
export const CircuitBreakerPolicySchema = z
  .object({
    keyStrategy: z
      .object({
        agentId: z
          .boolean()
          .default(true)
          .describe('Include agent identifier in circuit breaker key'),
        includeTarget: z
          .boolean()
          .default(true)
          .describe('Include target (URL host/endpoint) in key for isolation'),
      })
      .optional()
      .describe('Circuit breaker key generation strategy'),
    failureThreshold: z
      .number()
      .int()
      .min(1, 'Failure threshold must be at least 1')
      .default(5)
      .describe('Consecutive failures before opening circuit'),
    resetTimeoutMs: z
      .number()
      .int()
      .min(1000, 'Reset timeout must be at least 1000ms')
      .default(60000)
      .describe('Open duration before half-open transition'),
    halfOpenPolicy: z
      .enum(['single-probe'])
      .default('single-probe')
      .describe('Half-open allows exactly 1 concurrent probe'),
    errorClassification: z
      .object({
        countTimeouts: z
          .boolean()
          .default(true)
          .describe('Count timeout errors as circuit breaker failures'),
        countNetworkErrors: z
          .boolean()
          .default(true)
          .describe('Count network errors as circuit breaker failures'),
        count5xxErrors: z
          .boolean()
          .default(true)
          .describe('Count HTTP 5xx responses as circuit breaker failures'),
        countRetryableErrors: z
          .boolean()
          .default(true)
          .describe(
            'Count explicit retryable errors as circuit breaker failures',
          ),
      })
      .optional()
      .describe('Error types that increment circuit breaker failure count'),
  })
  .describe('Circuit breaker policy for fault isolation')

/**
 * Timeout policy schema
 */
export const TimeoutPolicySchema = z
  .object({
    global: z
      .number()
      .int()
      .min(1000, 'Global timeout must be at least 1000ms')
      .default(300000)
      .describe('Global timeout in ms (default 5 min)'),
    perStep: z
      .number()
      .int()
      .min(1000, 'Per-step timeout must be at least 1000ms')
      .default(30000)
      .describe('Per-attempt timeout in ms'),
  })
  .describe('Timeout configuration for workflows and steps')

/**
 * Concurrency policy schema
 */
export const ConcurrencyPolicySchema = z
  .object({
    maxConcurrentSteps: z
      .number()
      .int()
      .min(1, 'Must allow at least 1 concurrent step')
      .max(10, 'Maximum 10 concurrent steps allowed')
      .default(10)
      .describe('Maximum parallel step execution limit'),
    abortOnSignal: z
      .boolean()
      .default(true)
      .describe('Enable cooperative cancellation via AbortSignal'),
    cleanupTimeoutMs: z
      .number()
      .int()
      .min(1000, 'Cleanup timeout must be at least 1000ms')
      .default(5000)
      .describe('Time allowed for cleanup after abort signal'),
  })
  .describe('Concurrency control and cancellation policies')

/**
 * Resilience budget schema
 */
export const ResilienceBudgetSchema = z
  .object({
    perExecutionMs: z
      .number()
      .int()
      .min(30000, 'Per-execution budget must be at least 30000ms')
      .default(90000)
      .describe('Maximum time per execution'),
    queueTimeoutMs: z
      .number()
      .int()
      .min(10000, 'Queue timeout must be at least 10000ms')
      .default(30000)
      .describe('Maximum wait time before execution starts'),
    totalSystemBudgetMs: z
      .number()
      .int()
      .min(60000, 'Total system budget must be at least 60000ms')
      .default(120000)
      .describe('Total system budget from request to response'),
  })
  .describe('Time budgets for execution and resilience')

/**
 * Cancellation policy schema
 */
export const CancellationPolicySchema = z
  .object({
    gracePeriod: z
      .number()
      .int()
      .min(0, 'Grace period cannot be negative')
      .default(5000)
      .describe('Grace period for cleanup in ms'),
    propagate: z
      .boolean()
      .default(true)
      .describe('Propagate cancellation to running agents'),
    abortSignal: z
      .boolean()
      .default(true)
      .describe('Enable AbortSignal propagation through resilience layers'),
  })
  .describe('Cancellation behavior configuration')

/**
 * Resilience configuration schema
 */
export const ResilienceConfigSchema = z
  .object({
    retry: RetryPolicySchema.optional(),
    circuitBreaker: CircuitBreakerPolicySchema.optional(),
    compositionOrder: z
      .enum(['retry-cb-timeout', 'timeout-cb-retry'])
      .default('retry-cb-timeout')
      .describe('Per-attempt composition order'),
  })
  .describe('Resilience pattern configuration')

/**
 * Global policies schema for workflows
 */
export const GlobalPoliciesSchema = z
  .object({
    timeout: TimeoutPolicySchema.optional(),
    resilience: ResilienceConfigSchema.optional(),
    concurrency: ConcurrencyPolicySchema.optional(),
    resilienceBudget: ResilienceBudgetSchema.optional(),
    cancellation: CancellationPolicySchema.optional(),
  })
  .describe('Global workflow policies and defaults')

// Type exports
export type RetryPolicy = z.infer<typeof RetryPolicySchema>
export type CircuitBreakerPolicy = z.infer<typeof CircuitBreakerPolicySchema>
export type TimeoutPolicy = z.infer<typeof TimeoutPolicySchema>
export type ConcurrencyPolicy = z.infer<typeof ConcurrencyPolicySchema>
export type ResilienceBudget = z.infer<typeof ResilienceBudgetSchema>
export type CancellationPolicy = z.infer<typeof CancellationPolicySchema>
export type ResilienceConfig = z.infer<typeof ResilienceConfigSchema>
export type GlobalPolicies = z.infer<typeof GlobalPoliciesSchema>
