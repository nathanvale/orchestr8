# Examples

This guide shows how to run the end-to-end examples that ship with the monorepo.

They use tsx to run TypeScript directly and rely on workspace packages.

## Quick start

Path: scripts/examples/core-quick-start.ts

What it shows:

- Registering agents in a simple in-memory registry
- Input mapping with `${variables.*}` and `${steps.*.output.*}`
- Dependency-driven execution across two steps

Run:

```sh
pnpm run example:core:quick-start
```

Expected: status `completed` with outputs for `say-hello` and `measure`.

## Fallback + retry

Path: scripts/examples/core-fallback-retry.ts

What it shows:

- On-error retry with a minimal adapter (default policy if none supplied)
- Fallback behavior and aliasing of outputs to the original step

Run:

```sh
pnpm run example:core:fallback-retry
```

Expected: `maybe-flaky` completes after retries; `consumer` completes;
`backup-step` runs (demonstration of fallback mechanics).

## Conditions + env allowlist

Path: scripts/examples/core-conditions-env.ts

What it shows:

- Conditional execution with JMESPath `if`/`unless`
- Environment variable access via `workflow.allowedEnvVars`

Run:

```sh
pnpm run example:core:conditions-env
```

Tips:

- Toggle `variables.flag` to switch the `maybe-run` behavior.
- Add/remove `MY_REGION` in `allowedEnvVars` to see env gating in action.
