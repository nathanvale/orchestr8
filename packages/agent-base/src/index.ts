import { z } from 'zod'

export interface AgentContext {
  correlationId: string
  executionId: string
  stepId: string
  attempt: number
  metadata?: Record<string, unknown>
}

export interface AgentResult<T = unknown> {
  success: boolean
  output?: T
  error?: Error
  metadata?: Record<string, unknown>
}

export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  abstract readonly id: string
  abstract readonly version: string
  abstract readonly inputSchema: z.ZodSchema<TInput>
  abstract readonly outputSchema: z.ZodSchema<TOutput>

  abstract execute(
    input: TInput,
    context: AgentContext,
    signal?: AbortSignal,
  ): Promise<AgentResult<TOutput>>

  validate(input: unknown): TInput {
    return this.inputSchema.parse(input)
  }

  validateOutput(output: unknown): TOutput {
    return this.outputSchema.parse(output)
  }
}
