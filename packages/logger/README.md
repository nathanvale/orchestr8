# @orchestr8/logger

Production-ready structured logging for the @orchestr8 orchestration platform. Provides correlation IDs, sensitive data redaction, multiple adapters, and seamless integration with popular logging frameworks.

## Features

- 🔗 **Correlation IDs** - Automatic generation and propagation for request tracing
- 🔒 **Data Redaction** - Smart detection and redaction of sensitive information
- 🎨 **Multiple Adapters** - Console, Memory, Noop, and Pino support
- 📊 **Structured Logging** - JSON output with rich contextual fields
- 🎯 **Type Safety** - Full TypeScript support with strict typing
- ⚡ **Performance** - Minimal overhead with automatic adapter selection
- 🛠️ **Environment Config** - Environment variable configuration support

## Installation

```bash
pnpm add @orchestr8/logger
```

For Pino support (optional):

```bash
pnpm add @orchestr8/logger pino
```

## Quick Start

```typescript
import { createLogger } from '@orchestr8/logger'

// Create logger with automatic adapter selection
const logger = await createLogger({
  name: 'my-service',
  level: 'info',
  pretty: true,
})

// Basic logging
logger.info('Service started', { port: 3000 })
logger.warn('High memory usage', { memoryMB: 512 })
logger.error('Database connection failed', {
  error: 'Connection timeout',
  retryable: true,
})

// Child loggers with context
const requestLogger = logger.child({
  requestId: 'req-123',
  userId: 'user-456',
})

requestLogger.info('Processing request', { endpoint: '/api/users' })
requestLogger.debug('Query executed', { duration: 45 })
```

## Configuration

### LoggerOptions

```typescript
interface LoggerOptions {
  name?: string // Logger name/component identifier
  level?: LogLevel // 'trace' | 'debug' | 'info' | 'warn' | 'error'
  pretty?: boolean // Pretty print for development (default: false)
  redactKeys?: string[] // Additional keys to redact
  maxFieldSize?: number // Max size for field values (default: 10000)
  defaultFields?: LogFields // Default context for all entries
  stream?: NodeJS.WritableStream // Custom output stream
}
```

**Example: Development configuration**

```typescript
const logger = await createLogger({
  name: 'api-server',
  level: 'debug',
  pretty: true, // Colorized output
  defaultFields: {
    service: 'user-api',
    version: '1.0.0',
  },
})
```

**Example: Production configuration**

```typescript
const logger = await createLogger({
  name: 'api-server',
  level: 'info',
  pretty: false, // JSON output
  redactKeys: ['customSecret', 'internalToken'],
  maxFieldSize: 5000, // Truncate large fields
})
```

### Environment Variables

The logger automatically reads configuration from environment variables:

```bash
# Log level (trace, debug, info, warn, error)
LOG_LEVEL=info

# Pretty printing (true/false)
LOG_PRETTY=true

# Additional redaction keys (comma-separated)
LOG_REDACT=customKey,secretField

# Maximum field size in bytes
LOG_MAX_FIELD_SIZE=10000

# Force specific adapter (console, noop)
LOG_ADAPTER=console
```

## Adapters

### Automatic Selection

The logger automatically selects the best available adapter:

1. If `LOG_LEVEL=none` or `LOG_LEVEL=silent` → **NoopLogger**
2. If `LOG_ADAPTER=console` → **ConsoleLogger**
3. If Pino is available → **PinoAdapter**
4. Default → **ConsoleLogger**

### Console Adapter

Direct console output with color support for development:

```typescript
import { createConsoleLogger } from '@orchestr8/logger'

const logger = createConsoleLogger({
  pretty: true,
  level: 'debug',
})

// Outputs colorized logs to stderr
logger.info('Server started', { port: 3000 })
// 2025-08-23T10:15:30.123Z INFO  [my-service] Server started port=3000
```

### Memory Adapter (Testing)

Stores logs in memory for testing and verification:

```typescript
import { createMemoryLogger } from '@orchestr8/logger'

const logger = createMemoryLogger()

logger.info('Test message', { data: 'test' })
logger.warn('Warning message')

// Retrieve entries for testing
const entries = logger.getEntries()
expect(entries).toHaveLength(2)
expect(entries[0].level).toBe('info')

// Filter by level
const warnings = logger.getEntriesByLevel('warn')
expect(warnings).toHaveLength(1)

// Clear entries
logger.clear()
```

### Noop Adapter

Discards all log output for production silence:

```typescript
import { createNoopLogger } from '@orchestr8/logger'

const logger = createNoopLogger()

// All methods are no-ops
logger.info('This will not output anything')
```

### Pino Adapter

High-performance logging with Pino integration:

```typescript
import { createPinoLogger } from '@orchestr8/logger'

// Requires: pnpm add pino
const logger = await createPinoLogger({
  level: 'info',
  pretty: false, // JSON output for production
  redactKeys: ['password', 'apiKey'],
})

logger.info('High-performance logging', {
  requestId: 'req-123',
  duration: 45,
})
```

## Correlation IDs

### Automatic Generation

```typescript
import { generateCorrelationId, extractCorrelationId } from '@orchestr8/logger'

// Generate with default prefix (o8-)
const id = generateCorrelationId() // "o8-uuid-here"

// Generate with custom prefix
const customId = generateCorrelationId('api') // "api-uuid-here"

// Extract from various sources
const fromObject = extractCorrelationId({ correlationId: 'existing-id' })
const fromString = extractCorrelationId('direct-id')
const fallback = extractCorrelationId(null) // Generates new ID
```

### Context Propagation

```typescript
import { CorrelationContext } from '@orchestr8/logger'

// Run code with correlation context
CorrelationContext.run('trace-123', () => {
  const logger = createLoggerSync()

  // Correlation ID available throughout execution
  const currentId = CorrelationContext.get() // "trace-123"

  logger.info('Processing request', {
    correlationId: currentId,
  })

  // Nested async operations maintain context
  processAsync()
})

async function processAsync() {
  // Context is preserved across async boundaries
  const id = CorrelationContext.getOrGenerate() // "trace-123"
  console.log(`Processing with correlation ID: ${id}`)
}
```

## Data Redaction

### Default Redaction

Automatically redacts common sensitive fields:

```typescript
// Default redacted keys:
;[
  'authorization',
  'apiKey',
  'token',
  'password',
  'secret',
  'headers.authorization',
  'api_key',
  'access_token',
  'refresh_token',
  'private_key',
  'client_secret',
]
```

### Custom Redaction

```typescript
const logger = await createLogger({
  redactKeys: ['customSecret', 'internalData'],
})

logger.info('User data', {
  username: 'john',
  password: 'secret123', // [REDACTED]
  customSecret: 'sensitive', // [REDACTED]
  publicData: 'visible',
})
```

### Advanced Redaction

```typescript
import { redactString, deepRedact } from '@orchestr8/logger'

// Redact patterns in strings
const sanitized = redactString('Bearer abc123-secret-token')
// "Bearer [REDACTED]"

// Deep redaction with custom keys
const redacted = deepRedact(
  {
    user: { name: 'John', password: 'secret' },
    config: { apiKey: 'key123', public: 'data' },
  },
  new Set(['password', 'apiKey']),
)
// { user: { name: 'John', password: '[REDACTED]' }, config: { apiKey: '[REDACTED]', public: 'data' } }
```

### Pattern-Based Redaction

Automatically detects and redacts common secret patterns:

```typescript
const data = {
  bearerToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  awsKey: 'AKIAIOSFODNN7EXAMPLE',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
}

logger.info('Configuration loaded', data)
// All sensitive patterns are automatically redacted
```

## Orchestration Integration

### Structured Fields

The logger provides specialized field interfaces for orchestration contexts:

```typescript
import type { OrchestrationLogFields, MCPLogFields } from '@orchestr8/logger'

// Orchestration-specific logging
const orchestrationLogger = logger.child({
  executionId: 'exec-123',
  workflowId: 'user-onboarding',
  stepId: 'validate-email',
})

orchestrationLogger.info('Step completed', {
  durationMs: 150,
  attempt: 1,
  maxAttempts: 3,
  retryable: false,
} as OrchestrationLogFields)

// MCP-specific logging
const mcpLogger = logger.child({
  tool: 'database-query',
  method: 'SELECT',
})

mcpLogger.debug('Query executed', {
  durationMs: 45,
  cached: true,
  progress: 1.0,
} as MCPLogFields)
```

### Integration Example

```typescript
import { createLogger } from '@orchestr8/logger'
import { OrchestrationEngine } from '@orchestr8/core'

const logger = await createLogger({
  name: 'workflow-engine',
  level: 'info',
  defaultFields: {
    service: 'orchestr8',
    version: '1.0.0',
  },
})

const engine = new OrchestrationEngine({
  agentRegistry,
  resilienceAdapter,
  logger, // Structured logging throughout execution
})

// Logs will include correlation IDs and workflow context
const result = await engine.execute(workflow, variables)
```

## Performance

The logger is optimized for production use:

- **Overhead**: <0.5ms per log entry
- **Memory**: Bounded field sizes prevent memory bloat
- **CPU**: O(1) level checks and lazy field processing
- **I/O**: Configurable output streams and async writes

### Benchmarks

```bash
# Run performance tests
pnpm test:performance

# Memory usage analysis
NODE_ENV=production pnpm analyze:memory
```

### Field Truncation

Automatically truncates large fields to prevent log bloat:

```typescript
const logger = await createLogger({
  maxFieldSize: 1000, // 1KB limit per field
})

logger.info('Large data', {
  largeField: 'x'.repeat(2000), // Truncated to 1000 chars
  metadata: {
    size: 2000,
    truncated: true,
  },
})
```

## Error Handling

### Safe Logging

The logger handles edge cases gracefully:

```typescript
const problematicData = {
  circular: {},
  largeString: 'x'.repeat(50000),
  secret: 'password123',
}
problematicData.circular.self = problematicData.circular

// Safely handles circular references, large fields, and redaction
logger.info('Complex data', problematicData)
// Output: { circular: '[Circular]', largeString: 'xxx...[TRUNCATED]', secret: '[REDACTED]' }
```

### Error Context

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack, // Truncated if too long
    retryable: true,
    attempt: 2,
    maxAttempts: 3,
  })
}
```

## Testing

### Test Utilities

```typescript
import { createMemoryLogger } from '@orchestr8/logger'
import { describe, it, expect } from 'vitest'

describe('Service tests', () => {
  it('should log service startup', () => {
    const logger = createMemoryLogger()

    const service = new MyService(logger)
    service.start()

    const entries = logger.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      level: 'info',
      message: 'Service started',
      fields: { port: 3000 },
    })
  })
})
```

### Mock Integration

```typescript
import { vi } from 'vitest'

// Mock the logger for unit tests
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => mockLogger),
}

// Verify logging behavior
expect(mockLogger.info).toHaveBeenCalledWith(
  'Expected message',
  expect.objectContaining({ key: 'value' }),
)
```

## Advanced Usage

### Custom Formatters

```typescript
import { BaseLogger } from '@orchestr8/logger'
import type {
  LogFields,
  LogLevel,
  Logger,
  LoggerOptions,
} from '@orchestr8/logger'

class CustomLogger extends BaseLogger {
  child(bindings: LogFields): Logger {
    return new CustomLogger(this.options, { ...this.bindings, ...bindings })
  }

  protected log(level: LogLevel, msg: string, fields?: LogFields): void {
    if (!this.shouldLog(level)) return

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      ...this.mergeFields(fields),
    }

    // Custom output format
    console.log(JSON.stringify(entry, null, 2))
  }
}
```

### Stream Configuration

```typescript
import fs from 'node:fs'
import { createConsoleLogger } from '@orchestr8/logger'

// Log to file
const fileStream = fs.createWriteStream('/var/log/app.log', { flags: 'a' })
const logger = createConsoleLogger({
  stream: fileStream,
  pretty: false, // JSON for file output
})

// Log rotation support
process.on('SIGUSR1', () => {
  fileStream.close()
  // Recreate stream for log rotation
})
```

### Dynamic Log Levels

```typescript
const logger = await createLogger({ level: 'info' })

// Change log level at runtime
if (process.env.NODE_ENV === 'debug') {
  // Create new logger with debug level
  const debugLogger = await createLogger({ level: 'debug' })
}
```

## Key Design Decisions

### Adapter Selection Strategy

1. **Environment Override**: `LOG_ADAPTER` forces specific adapter
2. **Silent Mode**: `LOG_LEVEL=none/silent` uses NoopLogger
3. **Auto-Detection**: Prefers Pino if available, falls back to Console
4. **Graceful Fallback**: Failed Pino initialization falls back to Console

### Redaction Strategy

- **Default Keys**: Common sensitive field patterns
- **Pattern Detection**: Automatic secret pattern recognition
- **Nested Path Support**: `headers.authorization` style paths
- **Case Insensitive**: Matches regardless of field name case
- **Performance**: O(1) key lookups with Set-based storage

### Field Truncation

- **Size Limits**: Configurable maximum field sizes
- **Metadata Preservation**: Truncated fields include original size
- **Circular Reference Handling**: Detected and labeled as `[Circular]`
- **JSON Safety**: Prevents JSON.stringify failures

### Context Propagation

- **Symbol-based Storage**: Avoids global namespace pollution
- **Async Context**: Maintains correlation across async boundaries
- **Memory Management**: Automatic cleanup of context storage
- **Nested Contexts**: Supports context inheritance

## Integration with @orchestr8/core

This package is designed for seamless integration with the orchestration engine:

```typescript
import { createLogger } from '@orchestr8/logger'
import { OrchestrationEngine } from '@orchestr8/core'

// Logger provides structured context throughout execution
const logger = await createLogger({
  name: 'orchestr8-engine',
  defaultFields: {
    service: 'workflow-processor',
    version: process.env.APP_VERSION,
  },
})

const engine = new OrchestrationEngine({
  agentRegistry,
  resilienceAdapter,
  logger, // Integrated logging
})

// Automatic correlation ID propagation
const result = await engine.execute(workflow, variables, {
  correlationId: 'trace-123',
})

// All logs will include:
// - correlationId: 'trace-123'
// - executionId: generated UUID
// - workflowId: from workflow definition
// - stepId: current step being executed
// - Timing and performance data
// - Error context with retry information
```

## Contributing

See the main [@orchestr8 repository](../../README.md) for development guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.
