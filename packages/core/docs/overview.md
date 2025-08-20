# Overview

`@orchestr8/core` provides a deterministic, dependency-driven orchestration engine for agent/LLM workflows. It executes a Workflow (from `@orchestr8/schema`) while enforcing resilience, safe expression evaluation, and structured logging.

Key ideas:

- Graph execution
  - Steps form a DAG via `dependsOn`.
  - Execution proceeds in levels (topological order); steps in the same level run in parallel up to `maxConcurrency`.
  - Organizational steps of type `sequential` or `parallel` are recognized but skipped in the MVP; execution order is determined solely by `dependsOn`.

- Fail-fast and cancellation
  - Inside a level, if a step fails and its `onError` is `fail` (default), the engine cancels sibling steps in that level and skips future levels.
  - External cancellation is supported via `AbortSignal` argument to `execute`.

- Resilience
  - Policies: `retry`, `timeout`, `circuitBreaker`.
  - A pluggable `ResilienceAdapter` applies policies around agent execution.
  - `onError: 'retry'` enables a sensible default retry policy even if none is provided.

- Conditions and mappings
  - Step conditions: `if`/`unless` use JMESPath over `{ steps, variables, env }`.
  - Input mapping: string templates with `${...}` resolve values from steps/variables/env with `??` defaults.
  - Safe by default: size/depth/timeouts enforced; environment access is opt-in via `workflow.allowedEnvVars`.

- Results and errors
  - Each step yields a `StepResult` with status: `completed` | `failed` | `skipped` | `cancelled`.
  - Workflow returns `WorkflowResult` with aggregate `steps` and `errors`.
  - Errors are normalized to `ExecutionError` with a stable `code`.
