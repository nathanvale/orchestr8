# Configuration

Engine options accepted by `new OrchestrationEngine(options)`.

## OrchestrationOptions

- agentRegistry: AgentRegistry (required)
- resilienceAdapter: ResilienceAdapter (required)
- logger?: Logger
  - Defaults to a no-op logger (`NoopLogger`)
  - Provide an implementation compatible with `@orchestr8/logger`
- defaultCompositionOrder?: CompositionOrder
  - Order of composing retry/circuit breaker/timeout when the adapter supports it
  - Default: `retry-cb-timeout`
- maxConcurrency?: number
  - Global parallelism cap per level (default: 10)
- maxResultBytesPerStep?: number
  - Max serialized size per step output in bytes; large outputs are truncated (default: 512 KB)
- maxExpansionDepth?: number
  - Max object traversal depth during expression resolution (default: 10)
- maxExpansionSize?: number
  - Max serialized size of resolved expression values (default: 64 KB)
- strictConditions?: boolean
  - When true, invalid `if`/`unless` conditions become validation errors and cause the step to be skipped (default: true)

## Notes

- Truncation is size-based and returns metadata: `truncated`, `originalSize`, `retainedBytes`.
- If your adapter supports `applyNormalizedPolicy`, the engine will normalize the policy and apply the `defaultCompositionOrder`.
- If you set `onError: 'retry'` without a policy, the engine supplies a default retry policy: 3 attempts, exponential backoff, full jitter, 1s initial delay, 10s max delay.
