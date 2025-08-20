# Expressions

The engine supports two expression mechanisms:

1. Conditions (JMESPath) for `if`/`unless` on steps
2. Input mapping with `${...}` placeholders

Both operate over a constrained context and enforce security limits.

## Conditions (JMESPath)

- Context shape: `{ steps, variables, env }`
- `steps` contains prior `StepResult`s by ID
- `variables` is provided to `engine.execute(workflow, variables)`
- `env` is derived from `workflow.allowedEnvVars` (whitelist-only)
- Strict mode: when `strictConditions` is true, invalid expressions raise a `VALIDATION` error; engine then skips the step as `invalid-condition`.

Example:

```ts
{
  id: 'only-on-success',
  type: 'agent',
  agentId: 'next',
  dependsOn: ['prev'],
  if: "steps.prev.status == 'completed'",
}
```

Timeouts: evaluation is time-bounded (default 500ms). Exceeding this yields a `TIMEOUT` error.

## Input mapping (${...})

- Strings can contain `${...}` placeholders that resolve values.
- The resolver supports default values via `??`.
- Arrays/objects are traversed recursively; non-strings are returned as-is.

Sources and precedence inside `${...}`:

- `steps.stepId.output` or deeper paths like `steps.stepId.output.user.name`
- `steps.stepId.status`, `steps.stepId.stepId`, etc.
- `variables.some.path`
- `env.VAR_NAME` but only if `VAR_NAME` is explicitly listed in `workflow.allowedEnvVars`

Default values with quoting and escaping:

```ts
// Fallback to a string
"${variables.region ?? 'us-east-1'}"

// Fallback to a quoted value with escapes
"${variables.msg ?? "\"hello\""}"
```

Security limits:

- maxDepth: object traversal depth (default 10)
- maxSize: serialized size in bytes of resolved value (default 64KB)
- Prototype pollution keys are blocked: `__proto__`, `constructor`, `prototype`

Errors:

- Size/depth violations raise `VALIDATION` errors
- JSON serialization failure (e.g., circular refs) also raises `VALIDATION`
