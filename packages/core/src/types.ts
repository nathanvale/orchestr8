export interface ExecutionContext {
  correlationId: string
  executionId: string
}

export interface ExecutionResult {
  success: boolean
  error?: Error
}
