import { z } from 'zod'

export const WorkflowMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
})

export const AgentReferenceSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
})

export const StepSchema = z.object({
  id: z.string(),
  name: z.string(),
  agent: AgentReferenceSchema,
  input: z.record(z.unknown()),
  dependencies: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  retryPolicy: z
    .object({
      maxAttempts: z.number().default(3),
      backoffMultiplier: z.number().default(2),
    })
    .optional(),
})

export const ResiliencePolicySchema = z.object({
  retry: z
    .object({
      maxAttempts: z.number().default(3),
      initialDelayMs: z.number().default(1000),
      maxDelayMs: z.number().default(30000),
      backoffMultiplier: z.number().default(2),
    })
    .optional(),
  timeout: z
    .object({
      defaultMs: z.number().default(30000),
    })
    .optional(),
  circuitBreaker: z
    .object({
      failureThreshold: z.number().default(5),
      resetTimeMs: z.number().default(60000),
      halfOpenProbes: z.number().default(1),
    })
    .optional(),
})

export const WorkflowSchema = z.object({
  version: z.string(),
  metadata: WorkflowMetadataSchema,
  steps: z.array(StepSchema),
  policies: z
    .object({
      resilience: ResiliencePolicySchema.optional(),
      maxConcurrency: z.number().default(10),
    })
    .optional(),
})

export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>
export type AgentReference = z.infer<typeof AgentReferenceSchema>
export type Step = z.infer<typeof StepSchema>
export type ResiliencePolicy = z.infer<typeof ResiliencePolicySchema>
export type Workflow = z.infer<typeof WorkflowSchema>
