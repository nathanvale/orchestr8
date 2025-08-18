# Structured Logging for Core Orchestration Engine

> Created: 2025-08-18  
> Status: Proposed  
> Scope: @orchestr8/core (engine runtime logging)

## Purpose

Provide consistent, low-overhead structured logging for the orchestration engine to aid debugging, operations, and observability. Logs must be JSON, correlate across workflow and steps, avoid leaking sensitive data, and remain optional (no-op by default).

## Non-goals

- Execution journaling or persistence. That remains out-of-scope and will be covered separately.
- Metrics/Tracing (OTEL). May be added later; this spec focuses purely on logs.

## Design

### Logger interface (core-owned)

Define a minimal logger interface in `@orchestr8/core` and accept it via `OrchestrationOptions`. Default to a no-op implementation so logging is entirely opt-in.

Interface shape:

- child(bindings: Record<string, unknown>): Logger
- trace/debug/info/warn/error(msg: string, fields?: Record<string, unknown>): void

Injection:

- `options.logger?: Logger`
- `this.logger = options.logger ?? noopLogger`

Correlations:

- Use `executionId` as correlation id across all log lines.
- Create child loggers for workflow (`{ executionId, workflow: { id, version, name } }`) and for steps (`{ stepId, agentId, type }`).

### Pino integration (consumer-owned)

Core avoids a hard dependency on Pino. Applications pass a Pino instance adapted to the `Logger` interface. Example adapter provided in docs or testing package.

Recommended Pino config (consumer side):

- JSON logs by default; pretty-print in dev.
- Redact: `authorization`, `apiKey`, `token`, `password`, `secret`, `headers.authorization`.
- Level from env: `LOG_LEVEL` (default `info`).

## Event taxonomy

Workflow lifecycle:

- info workflow.start { executionId, stepCount, maxConcurrency }
- info workflow.end { status, durationMs, errorCount }
- warn workflow.cancelled { reason: 'abort-signal' }

Graph & scheduling:

- debug graph.built { roots, levels, nodeCount }
- warn graph.validation-error { code: 'VALIDATION', details }

Level execution:

- debug level.start { index, size }
- info level.fail-fast { index, failedStepIds }

Step execution:

- info step.start { stepId, agentId, dependsOn }
- info step.success { durationMs, truncated, retainedBytes }
- warn step.skipped { reason: 'condition' | 'fail-fast' }
- warn step.cancelled { reason: 'peer-failure' | 'abort' }
- error step.error { code, message, attempt?, retryable?, stack? }
- info step.fallback.alias { originalStepId, fallbackStepId }

Expressions/Mapping:

- warn condition.error { expression, code: 'VALIDATION' }
- debug mapping.truncated { key, size, retainedBytes }

Resilience:

- debug resilience.apply { policies }
- info retry.attempt { attempt, maxAttempts, delayMs }

## Fields and redaction

Required fields on every log line:

- timestamp (logger-provided)
- level
- msg
- executionId
- where applicable: workflow.id/version/name, stepId, agentId, durationMs, code

Redaction policy:

- Never log full outputs when truncated; only emit metadata (truncated, originalSize, retainedBytes).
- Default redacted keys: `authorization`, `apiKey`, `token`, `password`, `secret`, `headers.authorization`.
- Allow consumer to extend via configuration.

## Configuration

- LOG_LEVEL: `trace|debug|info|warn|error` (default `info`)
- LOG_PRETTY: `true|false` (default `false`)
- LOG_REDACT: comma-separated extra keys to redact

These envs are consumed by the application logger (Pino). Core only uses the injected `Logger`.

## Performance

- Keep logs sparse at `info`. Use `debug` for verbose internals.
- Format-free structured fields; avoid expensive stringification of large payloads.
- No blocking I/O in core; rely on logger implementation for performance.

## Testing

- Provide a memory logger in tests to capture entries.
- Validate presence of correlation fields (executionId, workflow.id, stepId).
- Ensure no sensitive fields leak in log lines.
- Verify expected events for success, failure, cancellation, and fallback aliasing.

## Acceptance criteria

- Core accepts `logger?: Logger` and defaults to no-op.
- Engine emits workflow.start/end and step.start/success/error logs with required fields.
- Redaction policy documented; consumers can enable Pino redaction.
- Unit tests cover typical paths and assert required fields present.
- No hard dependency on Pino in `@orchestr8/core`.
