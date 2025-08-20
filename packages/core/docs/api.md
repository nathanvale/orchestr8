# API

## Exports from `@orchestr8/core`

- OrchestrationEngine
  - constructor(options: OrchestrationOptions)
  - method:

    ```ts
    execute(
      workflow: Workflow,
      variables?: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<WorkflowResult>
    ```

- evaluateCondition(expression: string, context: ExecutionContext, strictMode?: boolean, limits?: SecurityLimits): boolean
- resolveMapping(input: unknown, context: ExecutionContext, limits?: SecurityLimits): unknown
- clearExpressionCache(): void
- Types re-exported from `@orchestr8/schema` and `@orchestr8/logger`:
  - Agent, AgentRegistry, ResiliencePolicy, ResilienceAdapter, CompositionOrder
  - Logger, LogLevel, LogEntry
  - ExecutionError, ExecutionErrorCode
  - Workflow, WorkflowResult, StepResult, ExecutionContext

## OrchestrationEngine

Creates an execution engine instance.

```ts
new OrchestrationEngine(options: OrchestrationOptions)
```

### OrchestrationOptions

- agentRegistry: AgentRegistry
- resilienceAdapter: ResilienceAdapter
- logger?: Logger (defaults to NoopLogger)
- defaultCompositionOrder?: CompositionOrder (default: 'retry-cb-timeout')
- maxConcurrency?: number (default: 10)
- maxResultBytesPerStep?: number (default: 512 KB)
- maxExpansionDepth?: number (default: 10)
- maxExpansionSize?: number (default: 64 KB)
- strictConditions?: boolean (default: true)

### execute

Runs a workflow and returns a `WorkflowResult`.

```ts
execute(
  workflow: Workflow,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<WorkflowResult>
```

Behavior:

- Builds an execution graph from `workflow.steps`.
- Executes in levels, honoring `dependsOn` and `maxConcurrency`.
- Applies resilience via the provided adapter.
- Honors `onError` policies: 'fail' | 'continue' | 'retry' | 'fallback'.
- Aliases fallback output back to the original failed step when fallback succeeds.
- Uses structured logs for lifecycle events: workflow.start, level.start, step.start, step.success, step.error, step.fallback, workflow.end.

Return value fields:

- status: 'completed' | 'failed' | 'cancelled'
- steps: Record<stepId, StepResult>
- errors?: ExecutionError[] (unrecoverable failures)
- timing metadata: startTime, endTime, duration
- variables: final variables bag

Notes:

- Results larger than `maxResultBytesPerStep` are truncated (metadata indicates truncation and sizes).
- Cancelled workflows mark current-level pending steps as cancelled and future steps as skipped.
