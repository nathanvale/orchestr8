# Logging

The engine uses a `Logger` interface (from `@orchestr8/logger`). If none is supplied, a `NoopLogger` is used. Provide a logger that supports `child()` to add contextual fields.

## Event names and contexts

- workflow.start
  - fields: executionId, workflowId, workflowVersion, workflowName, stepCount, variables, startTime
- level.start
  - fields: levelIndex, stepCount, stepIds
- step.start
  - fields: stepId, agentId, dependencies, onError, startTime
- step.success
  - fields: stepId, duration, endTime, truncated, outputSize
- step.error
  - fields: stepId, error, errorCode, duration, endTime, cancelled
- step.fallback
  - fields: originalStepId, fallbackStepId, originalError
- step.fallback_failed
  - fields: originalStepId, fallbackStepId, originalError, fallbackError
- level.fail-fast
  - fields: levelIndex, failedSteps[]
- workflow.end
  - fields: status, stepCount, duration, endTime, errorCount

## Recommendations

- Use JSON logs and route them to your observability stack (e.g., ELK, Datadog).
- Correlate by `executionId` and include `workflowId`/`stepId` for traces.
- Consider sampling to reduce volume for large batch flows.
