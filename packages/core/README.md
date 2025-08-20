# @orchestr8/core

Core orchestration engine for building reliable, composable LLM/agent workflows.

- Deterministic, dependency-driven execution with parallelism and fail-fast
- First-class resilience (retry/timeout/circuit breaker) via pluggable adapter
- Safe expressions for conditions and input mapping (JMESPath + ${...})
- Structured logging and rich, typed error semantics

Exports:

- OrchestrationEngine: executes a Workflow
- Expression utilities: evaluateCondition, resolveMapping, clearExpressionCache
- Types re-exported from schema/logger for convenience

Related packages:

- @orchestr8/schema – shared workflow/agent/resilience types
- @orchestr8/logger – structured logger interfaces and helpers
- @orchestr8/resilience – adapters implementing resilience policies (optional)

## Installation

```sh
pnpm add @orchestr8/core @orchestr8/schema @orchestr8/logger
```

If you plan to use a resilience implementation, install it as well (or provide your own adapter):

```sh
pnpm add @orchestr8/resilience
```

## Quick start

Minimal example that registers two agents, configures the engine, and executes a workflow with a dependency and input mapping.

```ts
import { OrchestrationEngine } from '@orchestr8/core'
import type {
  Agent,
  AgentRegistry,
  ResilienceAdapter,
  Workflow,
} from '@orchestr8/schema'

// In-memory AgentRegistry
class MemoryAgentRegistry implements AgentRegistry {
  private agents = new Map<string, Agent>()
  async getAgent(id: string): Promise<Agent> {
    const a = this.agents.get(id)
    if (!a) throw new Error(`Agent not found: ${id}`)
    return a
  }
  register(id: string, agent: Agent) {
    this.agents.set(id, agent)
  }
}

// No-op resilience adapter
const noResilience: ResilienceAdapter = {
  async applyPolicy(fn) {
    return fn()
  },
}

// Register demo agents
const registry = new MemoryAgentRegistry()
registry.register('greeter', {
  async execute(input) {
    return { message: `Hello, ${input?.name ?? 'world'}!` }
  },
})
registry.register('length', {
  async execute(input) {
    const text = String(input?.text ?? '')
    return { length: text.length }
  },
})

const workflow: Workflow = {
  id: 'wf-hello',
  name: 'Hello world',
  version: '1.0.0',
  steps: [
    {
      id: 'say-hello',
      type: 'agent',
      agentId: 'greeter',
      input: { name: "${variables.userName ?? 'Alice'}" },
    },
    {
      id: 'measure',
      type: 'agent',
      agentId: 'length',
      dependsOn: ['say-hello'],
      input: { text: '${steps.say-hello.output.message}' },
    },
  ],
}

const engine = new OrchestrationEngine({
  agentRegistry: registry,
  resilienceAdapter: noResilience,
  maxConcurrency: 5,
})

const result = await engine.execute(workflow, { userName: 'Nora' })
console.log(result.status) // 'completed'
console.log(result.steps['measure'].output) // { length: 13 }
```

More advanced examples are in docs:

- docs/workflows.md – dependencies, levels, cancellation, fallbacks
- docs/expressions.md – mapping and conditions
- docs/configuration.md – engine options and tuning

## Usage scenarios

- Parallel fan-out with fail-fast within a level
- Conditional execution via if/unless (JMESPath)
- Fallback recovery with aliasing of outputs
- Continue-on-error to collect partial results
- Retry without policy using onError: 'retry' default behavior

See the guides in the docs folder for complete scenarios.

## API reference (high level)

Exports from `@orchestr8/core`:

- OrchestrationEngine
  - new OrchestrationEngine(options: OrchestrationOptions)
  - Methods:

  ```ts
    execute(
      workflow: Workflow,
      variables?: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<WorkflowResult>
  ```

- evaluateCondition(expression: string, context: ExecutionContext, strict?: boolean, limits?): boolean
- resolveMapping(input: unknown, context: ExecutionContext, limits?): unknown
- clearExpressionCache(): void
- Types re-exported from @orchestr8/schema and @orchestr8/logger

For full details, see docs/api.md and docs/configuration.md.

## Configuration options

Constructor accepts `OrchestrationOptions`:

- agentRegistry: AgentRegistry (required)
- resilienceAdapter: ResilienceAdapter (required)
- logger?: Logger – defaults to a no-op logger
- defaultCompositionOrder?: CompositionOrder – default 'retry-cb-timeout'
- maxConcurrency?: number – default 10
- maxResultBytesPerStep?: number – default 512KB
- maxExpansionDepth?: number – default 10 (expressions)
- maxExpansionSize?: number – default 64KB (expressions)
- strictConditions?: boolean – default true

Details and examples in docs/configuration.md.

## Error handling

All errors are normalized to `ExecutionError` with a `code` you can switch on:

- VALIDATION – workflow/expressions invalid
- TIMEOUT – expression or adapter timeout
- CIRCUIT_BREAKER_OPEN – adapter mapped error
- RETRYABLE – retries exhausted
- CANCELLED – explicit or fail-fast cancellation
- UNKNOWN – anything else

Engine policies:

- onError: 'fail' (default), 'continue', 'fallback', 'retry'

See docs/errors.md for mappings and recipes.

## Links

- docs/overview.md – conceptual overview
- docs/api.md – detailed API
- docs/workflows.md – execution semantics
- docs/expressions.md – mapping/conditions and limits
- docs/configuration.md – options and defaults
- docs/errors.md – error types and handling
- docs/logging.md – structured log events
- docs/examples.md – runnable examples with instructions
