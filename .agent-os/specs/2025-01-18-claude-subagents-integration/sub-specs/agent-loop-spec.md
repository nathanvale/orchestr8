# Agent Loop Specification

This document defines comprehensive agent loop handling for Claude subagents integration.

> Created: 2025-01-19
> Version: 1.0.0

## Overview

The agent loop is the core execution pattern that manages multi-turn interactions between Claude and orchestr8 tools. This specification ensures safe, efficient, and deterministic execution with proper safeguards.

## Loop Architecture

### Core Components

```typescript
interface AgentLoopCore {
  // Execution control
  maxIterations: number // Hard limit: 15
  timeout: number // Default: 30000ms
  abortSignal: AbortSignal // User cancellation

  // State management
  messages: Message[] // Conversation history
  context: ExecutionContext // Shared state
  correlationId: string // Tracking ID

  // Progress tracking
  iterations: number // Current iteration
  startTime: number // Loop start timestamp
  toolCalls: number // Total tool invocations
}
```

## Safeguards and Limits

### Iteration Limits

```typescript
export const LOOP_LIMITS = {
  DEFAULT_MAX_ITERATIONS: 10,
  ABSOLUTE_MAX_ITERATIONS: 15,
  WARNING_THRESHOLD: 8, // Warn at 80% usage

  // Per-agent type limits
  EXECUTOR_MAX: 12, // Workflow execution
  DESIGNER_MAX: 8, // Design tasks
  MONITOR_MAX: 15, // Long monitoring
  COORDINATOR_MAX: 10, // Multi-agent coordination
}

function enforceIterationLimit(requested: number, agentType: string): number {
  const typeLimit =
    LOOP_LIMITS[`${agentType.toUpperCase()}_MAX`] ??
    LOOP_LIMITS.DEFAULT_MAX_ITERATIONS
  return Math.min(requested, typeLimit, LOOP_LIMITS.ABSOLUTE_MAX_ITERATIONS)
}
```

### Timeout Management

```typescript
export class TimeoutManager {
  private startTime: number
  private timeout: number
  private checkpoints: Map<string, number> = new Map()

  constructor(timeout: number = 30000) {
    this.startTime = Date.now()
    this.timeout = timeout
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime)
  }

  getRemainingTime(): number {
    const elapsed = Date.now() - this.startTime
    return Math.max(0, this.timeout - elapsed)
  }

  shouldAbort(): boolean {
    return this.getRemainingTime() === 0
  }

  extendTimeout(additional: number): void {
    // Allow one-time extension for critical operations
    if (!this.extended) {
      this.timeout += additional
      this.extended = true
    }
  }
}
```

## Continuation Handling

### pause_turn Support

```typescript
export async function handlePauseTurn(
  response: AnthropicResponse,
  messages: Message[],
  client: Anthropic,
): Promise<ContinuationResult> {
  // Preserve assistant's paused state
  messages.push({
    role: 'assistant',
    content: response.content,
  })

  // Check if user input needed
  if (response.pause_metadata?.needs_user_input) {
    return {
      type: 'user_input_required',
      prompt: response.pause_metadata.prompt,
      context: response.pause_metadata.context,
    }
  }

  // Auto-continue for multi-step operations
  if (response.pause_metadata?.auto_continue) {
    const continuation = await client.messages.create({
      model: response.model,
      messages,
      tools: response.pause_metadata.remaining_tools,
      max_tokens: 4096,
    })

    return {
      type: 'continued',
      response: continuation,
    }
  }

  return {
    type: 'manual_continue_required',
  }
}
```

### State Preservation

```typescript
export class LoopStateManager {
  private states: Map<string, LoopState> = new Map()

  saveState(correlationId: string, state: LoopState): void {
    this.states.set(correlationId, {
      ...state,
      savedAt: Date.now()
    })
  }

  restoreState(correlationId: string): LoopState | null {
    const state = this.states.get(correlationId)

    // Check if state is still valid (5 minute TTL)
    if (state && Date.now() - state.savedAt < 300000) {
      return state
    }

    this.states.delete(correlationId)
    return null
  }

  interface LoopState {
    messages: Message[]
    iterations: number
    context: ExecutionContext
    toolCallHistory: ToolCall[]
    savedAt?: number
  }
}
```

## Tool Execution Patterns

### Parallel Tool Execution

```typescript
export async function executeToolsInParallel(
  tools: ToolCall[],
  options: ParallelOptions = {},
): Promise<ToolResult[]> {
  const { maxConcurrency = 5, timeout = 5000 } = options

  // Group tools by dependency
  const groups = groupByDependency(tools)
  const results: ToolResult[] = []

  for (const group of groups) {
    // Execute independent tools in parallel
    const chunks = chunk(group, maxConcurrency)

    for (const chunk of chunks) {
      const promises = chunk.map((tool) =>
        Promise.race([executeToolWithRetry(tool), rejectAfterTimeout(timeout)]),
      )

      const chunkResults = await Promise.allSettled(promises)
      results.push(...processResults(chunkResults))
    }
  }

  return results
}

function groupByDependency(tools: ToolCall[]): ToolCall[][] {
  // Analyze tool dependencies and group accordingly
  const groups: ToolCall[][] = []
  const processed = new Set<string>()

  for (const tool of tools) {
    if (processed.has(tool.id)) continue

    const group = [tool]

    // Find tools that depend on this one
    for (const other of tools) {
      if (other.dependsOn?.includes(tool.id)) {
        group.push(other)
        processed.add(other.id)
      }
    }

    processed.add(tool.id)
    groups.push(group)
  }

  return groups
}
```

### Error Recovery

```typescript
export class LoopErrorHandler {
  private errorCounts: Map<string, number> = new Map()
  private readonly maxRetries = 2

  async handleToolError(
    error: Error,
    tool: ToolCall,
    iteration: number,
  ): Promise<ErrorRecoveryAction> {
    const errorKey = `${tool.name}:${error.name}`
    const count = (this.errorCounts.get(errorKey) ?? 0) + 1
    this.errorCounts.set(errorKey, count)

    // Classify error
    const classification = this.classifyError(error)

    switch (classification) {
      case 'retryable':
        if (count <= this.maxRetries) {
          return {
            action: 'retry',
            delay: this.calculateBackoff(count),
            modifiedInput: this.adjustInput(tool.input, error),
          }
        }
        break

      case 'input_validation':
        return {
          action: 'request_input',
          missingFields: this.extractMissingFields(error),
          guidance: this.generateGuidance(error),
        }

      case 'rate_limit':
        return {
          action: 'delay',
          delay: this.extractRateLimitDelay(error),
          queued: true,
        }

      case 'fatal':
        return {
          action: 'abort',
          reason: error.message,
          partialResults: this.gatherPartialResults(),
        }
    }

    return { action: 'skip', reason: 'Unrecoverable error' }
  }

  private classifyError(error: Error): ErrorClass {
    if (error.name === 'ValidationError') return 'input_validation'
    if (error.name === 'RateLimitError') return 'rate_limit'
    if (error.name === 'TimeoutError') return 'retryable'
    if (error.name === 'NetworkError') return 'retryable'
    if (error.code === 'ECONNRESET') return 'retryable'

    return 'fatal'
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const base = Math.pow(2, attempt - 1) * 1000
    const jitter = Math.random() * 1000
    return Math.min(base + jitter, 10000) // Cap at 10 seconds
  }
}
```

## Progress Monitoring

### Iteration Callbacks

```typescript
export interface ProgressCallbacks {
  onIteration?: (n: number, total: number) => void
  onToolCall?: (tool: string, input: any) => void
  onToolResult?: (tool: string, result: any) => void
  onWarning?: (message: string) => void
  onCheckpoint?: (name: string, data: any) => void
}

export class ProgressMonitor {
  constructor(private callbacks: ProgressCallbacks = {}) {}

  iteration(current: number, total: number): void {
    this.callbacks.onIteration?.(current, total)

    // Warn at 80% usage
    if (current / total >= 0.8) {
      this.callbacks.onWarning?.(
        `Approaching iteration limit: ${current}/${total}`,
      )
    }
  }

  toolCall(name: string, input: any): void {
    this.callbacks.onToolCall?.(name, input)
  }

  toolResult(name: string, result: any): void {
    this.callbacks.onToolResult?.(name, result)

    // Check for error results
    if (result.is_error) {
      this.callbacks.onWarning?.(`Tool error in ${name}: ${result.content}`)
    }
  }

  checkpoint(name: string, data: any = {}): void {
    this.callbacks.onCheckpoint?.(name, {
      ...data,
      timestamp: Date.now(),
    })
  }
}
```

## Complete Agent Loop Implementation

```typescript
export async function runAgentLoop(
  client: Anthropic,
  config: AgentLoopConfig,
): Promise<AgentLoopResult> {
  // Initialize components
  const timeout = new TimeoutManager(config.timeout)
  const errorHandler = new LoopErrorHandler()
  const progress = new ProgressMonitor(config.callbacks)
  const stateManager = new LoopStateManager()

  // Restore or initialize state
  let state = config.correlationId
    ? stateManager.restoreState(config.correlationId)
    : null

  if (!state) {
    state = {
      messages: [{ role: 'user', content: config.initialPrompt }],
      iterations: 0,
      context: config.context ?? {},
      toolCallHistory: [],
    }
  }

  const maxIterations = enforceIterationLimit(
    config.maxIterations ?? 10,
    config.agentType ?? 'default',
  )

  try {
    while (state.iterations < maxIterations) {
      // Check safeguards
      if (timeout.shouldAbort()) {
        throw new Error('Agent loop timeout')
      }

      if (config.abortSignal?.aborted) {
        throw new Error('Agent loop aborted by user')
      }

      state.iterations++
      progress.iteration(state.iterations, maxIterations)

      // Determine tool choice strategy
      const toolChoice = determineToolChoice({
        iteration: state.iterations,
        messages: state.messages,
        requiresAction: config.requiresAction,
        queryType: config.queryType,
        workflowState: state.context.workflowState,
      })

      // Make API call
      const response = await client.messages.create({
        model: config.model ?? 'claude-opus-4-20250514',
        messages: state.messages,
        tools: config.tools,
        tool_choice: toolChoice,
        max_tokens: 4096,
        response_format: config.jsonMode ? { type: 'json_object' } : undefined,
      })

      // Handle pause_turn
      if (response.stop_reason === 'pause_turn') {
        const continuation = await handlePauseTurn(
          response,
          state.messages,
          client,
        )

        if (continuation.type === 'user_input_required') {
          // Save state and return for user input
          stateManager.saveState(config.correlationId, state)
          return {
            type: 'paused',
            reason: 'user_input_required',
            prompt: continuation.prompt,
            correlationId: config.correlationId,
          }
        }

        // Continue with next iteration
        continue
      }

      // Add response to history
      state.messages.push({
        role: 'assistant',
        content: response.content,
      })

      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        const toolCalls = extractToolCalls(response.content)
        state.toolCallHistory.push(...toolCalls)

        // Execute tools in parallel where possible
        const results = await executeToolsInParallel(toolCalls, {
          maxConcurrency: config.maxConcurrency ?? 5,
          timeout: timeout.getRemainingTime(),
        })

        // Handle any errors
        for (const [index, result] of results.entries()) {
          if (result.is_error) {
            const recovery = await errorHandler.handleToolError(
              new Error(result.content),
              toolCalls[index],
              state.iterations,
            )

            if (recovery.action === 'abort') {
              throw new Error(recovery.reason)
            }

            if (recovery.action === 'retry') {
              // Add retry to next iteration
              toolCalls.push({
                ...toolCalls[index],
                input: recovery.modifiedInput,
              })
            }
          }
        }

        // Group results in single message
        state.messages.push({
          role: 'user',
          content: results,
        })

        progress.checkpoint('tools_executed', {
          count: results.length,
          hasErrors: results.some((r) => r.is_error),
        })
      } else {
        // No more tool use, complete
        return {
          type: 'completed',
          response,
          iterations: state.iterations,
          duration: Date.now() - timeout.startTime,
          toolCallCount: state.toolCallHistory.length,
          messages: state.messages,
        }
      }
    }

    // Max iterations reached
    return {
      type: 'max_iterations',
      iterations: state.iterations,
      partialResults: extractPartialResults(state.messages),
      toolCallHistory: state.toolCallHistory,
    }
  } catch (error) {
    // Save state for potential recovery
    stateManager.saveState(config.correlationId, state)

    return {
      type: 'error',
      error: error.message,
      iterations: state.iterations,
      canRecover: errorHandler.canRecover(error),
      correlationId: config.correlationId,
    }
  }
}
```

## Testing Patterns

### Unit Tests

```typescript
describe('AgentLoop', () => {
  describe('Iteration Limits', () => {
    it('should enforce absolute maximum of 15 iterations', async () => {
      const result = await runAgentLoop(client, {
        maxIterations: 20, // Request more than allowed
        initialPrompt: 'test',
      })

      expect(result.iterations).toBeLessThanOrEqual(15)
    })

    it('should warn at 80% iteration usage', async () => {
      const warnings: string[] = []

      await runAgentLoop(client, {
        maxIterations: 10,
        callbacks: {
          onWarning: (msg) => warnings.push(msg),
        },
      })

      expect(warnings).toContain(
        expect.stringMatching(/Approaching iteration limit/),
      )
    })
  })

  describe('Timeout Handling', () => {
    it('should abort on timeout', async () => {
      const result = await runAgentLoop(client, {
        timeout: 100, // Very short timeout
        initialPrompt: 'long running task',
      })

      expect(result.type).toBe('error')
      expect(result.error).toContain('timeout')
    })

    it('should allow timeout extension for critical ops', async () => {
      // Test timeout extension logic
    })
  })

  describe('Continuation Handling', () => {
    it('should handle pause_turn correctly', async () => {
      // Mock pause_turn response
      client.messages.create.mockResolvedValueOnce({
        stop_reason: 'pause_turn',
        content: [],
        pause_metadata: {
          auto_continue: true,
        },
      })

      const result = await runAgentLoop(client, {
        initialPrompt: 'multi-step task',
      })

      expect(result.type).toBe('completed')
    })
  })
})
```

## Performance Considerations

### Memory Management

- Message history pruning after 50 messages
- Tool result compression for large outputs
- Periodic state cleanup for long-running loops

### Optimization Strategies

- Parallel tool execution where possible
- Early termination on deterministic outcomes
- Caching of repeated tool calls
- Progressive timeout reduction per iteration

## References

- [Claude Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Anthropic API Reference](https://docs.anthropic.com/en/api)
- [Agent Loop Patterns](https://docs.anthropic.com/en/docs/claude-code/docs/agents-and-tools)
