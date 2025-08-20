# Error handling

All errors are normalized into `ExecutionError` with a `code` field. You can switch on codes to implement policy.

## Codes

- VALIDATION: invalid workflow shape, missing dependencies, bad expressions, exceeding limits
- TIMEOUT: expression evaluation timed out; adapter timeouts mapped here by the engine when compatible
- CIRCUIT_BREAKER_OPEN: adapter-mapped error when a circuit is open
- RETRYABLE: adapter-mapped error when retries are exhausted
- CANCELLED: explicit cancellation (fail-fast within level or external abort)
- UNKNOWN: default mapping for unrecognized errors

## Where errors surface

- StepResult.error: the primary error for a specific step
- WorkflowResult.errors: unrecoverable failures (e.g., steps that failed without a successful fallback and not marked continue)

## Fallback semantics

- With `onError: 'fallback'`, the original step is marked `failed`, then the fallback executes after the parallel level completes.
- On fallback success, its output is aliased back to the original step; downstream steps can read `steps.original.output`.

## Continue-on-error

- With `onError: 'continue'`, the step is marked `failed` but execution proceeds. The workflow can still end as `completed` if all failures are either continued or have successful fallbacks.

## Retry

- With `onError: 'retry'`, the engine applies a default retry policy when none is present, or uses the provided/normalized `resilience` policy via the adapter.

## Examples

```ts
const result = await engine.execute(workflow)
if (result.status === 'failed') {
  for (const err of result.errors ?? []) {
    switch (err.code) {
      case 'VALIDATION':
        /* fix workflow or expressions */ break
      case 'TIMEOUT':
        /* inspect err.context?.timeoutMs */ break
      case 'CIRCUIT_BREAKER_OPEN':
        /* backoff */ break
      case 'RETRYABLE':
        /* escalate */ break
      case 'CANCELLED':
        /* respect abort */ break
      default:
        /* log */ break
    }
  }
}
```
