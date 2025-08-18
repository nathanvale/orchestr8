# Pino Logger Adapter for @orchestr8/core

This document shows how to integrate the @orchestr8/core orchestration engine with [Pino](https://github.com/pinojs/pino), a popular high-performance logging library.

## Installation

First, install Pino in your project:

```bash
npm install pino
# or
pnpm add pino
```

## Basic Pino Adapter Implementation

Create a Pino adapter that implements the `Logger` interface:

```typescript
import pino from 'pino'
import type { Logger, LogLevel } from '@orchestr8/core'

/**
 * Pino adapter that implements the @orchestr8/core Logger interface
 */
export class PinoAdapter implements Logger {
  private logger: pino.Logger

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino()
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.logger[level](data, message)
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.logger.trace(data, message)
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data, message)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data, message)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data, message)
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(data, message)
  }

  child(context: Record<string, unknown>): Logger {
    return new PinoAdapter(this.logger.child(context))
  }
}
```

## Usage with OrchestrationEngine

Use the Pino adapter with the orchestration engine:

```typescript
import pino from 'pino'
import { OrchestrationEngine } from '@orchestr8/core'
import { PinoAdapter } from './pino-adapter.js'
import { myAgentRegistry, myResilienceAdapter } from './setup.js'

// Create a Pino logger with custom configuration
const pinoLogger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
})

// Create the adapter
const logger = new PinoAdapter(pinoLogger)

// Create the orchestration engine with logging
const engine = new OrchestrationEngine({
  agentRegistry: myAgentRegistry,
  resilienceAdapter: myResilienceAdapter,
  logger, // Enable structured logging
})

// Execute workflows with full logging
const result = await engine.execute(myWorkflow, { inputVar: 'test' })
```

## Production Configuration

For production environments, configure Pino for performance and structured logging:

```typescript
import pino from 'pino'
import { PinoAdapter } from './pino-adapter.js'

// Production-optimized Pino configuration
const pinoLogger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['*.password', '*.secret', '*.token'],
    censor: '[REDACTED]',
  },
})

const logger = new PinoAdapter(pinoLogger)
```

## Log Structure

The orchestration engine will produce structured logs with the following patterns:

### Workflow Lifecycle Logs

```json
{
  "level": "info",
  "time": "2025-08-18T10:15:30.123Z",
  "msg": "workflow.start",
  "executionId": "uuid-here",
  "workflowId": "my-workflow",
  "workflowVersion": "1.0.0",
  "workflowName": "My Workflow",
  "stepCount": 3,
  "variables": { "key": "value" },
  "startTime": "2025-08-18T10:15:30.123Z"
}
```

### Step Lifecycle Logs

```json
{
  "level": "info",
  "time": "2025-08-18T10:15:30.150Z",
  "msg": "step.success",
  "executionId": "uuid-here",
  "workflowId": "my-workflow",
  "workflowVersion": "1.0.0",
  "stepId": "my-step",
  "agentId": "my-agent",
  "duration": 25,
  "endTime": "2025-08-18T10:15:30.150Z",
  "truncated": false
}
```

### Error Logs

```json
{
  "level": "error",
  "time": "2025-08-18T10:15:30.180Z",
  "msg": "step.error",
  "executionId": "uuid-here",
  "workflowId": "my-workflow",
  "workflowVersion": "1.0.0",
  "stepId": "failing-step",
  "agentId": "failing-agent",
  "error": "Agent execution failed",
  "errorCode": "UNKNOWN",
  "duration": 30,
  "endTime": "2025-08-18T10:15:30.180Z",
  "cancelled": false
}
```

## Advanced Features

### Custom Log Correlation

Add custom correlation IDs and trace information:

```typescript
export class TracingPinoAdapter extends PinoAdapter {
  constructor(logger?: pino.Logger, traceId?: string) {
    const baseLogger = logger ?? pino()
    const tracingLogger = traceId ? baseLogger.child({ traceId }) : baseLogger

    super(tracingLogger)
  }

  child(context: Record<string, unknown>): Logger {
    return new TracingPinoAdapter(this.logger.child(context))
  }
}
```

### Log Filtering

Filter orchestration logs by level or component:

```typescript
// Only log warnings and errors from orchestration
const productionLogger = pino({
  level: 'warn',
  hooks: {
    logMethod(inputArgs, method) {
      // Custom filtering logic
      if (inputArgs[1] && typeof inputArgs[1] === 'string') {
        const message = inputArgs[1]
        if (
          message.startsWith('step.debug') ||
          message.startsWith('level.start')
        ) {
          return // Skip debug logs
        }
      }
      return method.apply(this, inputArgs)
    },
  },
})
```

## Integration with Observability Platforms

### New Relic Integration

```typescript
import pino from 'pino'
import { PinoAdapter } from './pino-adapter.js'

const logger = new PinoAdapter(
  pino({
    formatters: {
      log: (object) => ({
        ...object,
        'service.name': 'orchestr8-workflows',
        'service.version': '1.0.0',
      }),
    },
  }),
)
```

### DataDog Integration

```typescript
import pino from 'pino'
import { PinoAdapter } from './pino-adapter.js'

const logger = new PinoAdapter(
  pino({
    mixin() {
      return {
        dd: {
          service: 'orchestr8-workflows',
          version: '1.0.0',
          env: process.env.NODE_ENV || 'development',
        },
      }
    },
  }),
)
```

## Testing with Memory Logging

For testing, you can still use the built-in MemoryLogger:

```typescript
import { MemoryLogger, OrchestrationEngine } from '@orchestr8/core'

// In tests
const logger = new MemoryLogger()
const engine = new OrchestrationEngine({
  agentRegistry: mockRegistry,
  resilienceAdapter: mockAdapter,
  logger,
})

await engine.execute(workflow)

// Verify logs
const entries = logger.getEntries()
expect(entries.find((e) => e.message === 'workflow.start')).toBeDefined()
```

## Performance Considerations

1. **Log Level**: Use appropriate log levels (info or higher) in production
2. **Async Logging**: Consider using `pino.destination()` for async file writes
3. **Log Rotation**: Use log rotation for file-based logging
4. **Redaction**: Always redact sensitive data in logs

## Summary

The Pino adapter provides a production-ready logging solution for @orchestr8/core with:

- ✅ Full structured logging support
- ✅ High performance async logging
- ✅ Rich ecosystem integration
- ✅ Production observability features
- ✅ Easy testing and debugging

For more advanced configurations, refer to the [Pino documentation](https://getpino.io/).
