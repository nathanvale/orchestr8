# Workflows and execution

A `Workflow` (from `@orchestr8/schema`) contains ordered steps. The engine builds a dependency graph and executes in levels.

## Step types

- agent: actual executable unit linked to an Agent via `agentId`
- sequential, parallel: organizational only in MVP; execution is still purely driven by `dependsOn`

## Scheduling

- Levels: roots (no dependencies) first, then subsequent levels where all dependencies are completed.
- Within a level: steps run in parallel up to `maxConcurrency`.
- Determinism: steps are sorted by (1) fewer dependencies first, then (2) original definition order.

## Cancellation and fail-fast

- If a step in a level fails with `onError: 'fail'` (default), the engine cancels siblings in that level and skips future levels.
- When the workflow is externally aborted, current level pending steps are marked `cancelled`, all future steps `skipped`.

## Dependency results

- If a dependency is not `completed` and there is no successful fallback alias, the dependent step is `skipped` with `skipReason: 'dependency-not-completed'`.

## Fallbacks

- Configure a step with `onError: 'fallback'` and `fallbackStepId`.
- After the level completes, the engine executes the fallback step (ensuring its own dependencies are completed).
- On success, the fallback result is aliased to the original step (`aliasFor` set to original step id) and the original step's output is populated so downstream steps can read it as if the original succeeded.
- If the fallback step already ran earlier and succeeded, the engine may reuse it; if input needs to inherit from the original, it may re-execute with proper input.

## Retrying

- `onError: 'retry'` requests a retry policy; if no policy is specified, the engine uses a default retry policy.
- If a `resilience` policy exists on the step or workflow, it is normalized and applied by the adapter.

## Results

Each step result:

- status: 'completed' | 'failed' | 'skipped' | 'cancelled'
- output?: unknown (truncated if beyond `maxResultBytesPerStep`)
- error?: ExecutionError
- aliasFor?: string (when a fallback stands in for the original)
- timing: startTime, endTime

Workflow result:

- status: 'completed' | 'failed' | 'cancelled'
- steps: Record<string, StepResult>
- errors?: ExecutionError[] (unrecoverable failures)
- variables: Record<string, unknown>
- timing: startTime, endTime, duration (ms)
