# @bun-template/server

A lightweight HTTP server built with Bun, providing REST API endpoints with
structured logging and metrics collection.

## Features

- 🚀 Fast HTTP server powered by Bun.serve()
- 📊 Built-in metrics collection and reporting
- 🔍 Structured logging with correlation IDs
- 🎯 CORS-enabled for development
- 🧪 Comprehensive test coverage

## Architecture

### Server Lifecycle Management

The server uses explicit lifecycle management to avoid side effects:

```typescript
import { startServer } from './index'

// Start server on a specific port
const server = startServer(3333)

// Server instance provides:
// - server.port: The actual port being used
// - server.hostname: The hostname
// - server.stop(): Clean shutdown method
```

When running directly, the server auto-starts on the configured port. When
imported for testing, it requires explicit startup to avoid side effects.

## API Endpoints

- `GET /` - Server info and available endpoints
- `GET /api/health` - Health check with uptime
- `GET /api/logs` - Recent log entries (last 20)
- `GET /api/metrics` - Server metrics and statistics
- `POST /api/echo` - Echo request body
- `POST /api/calculate` - Perform calculations on number arrays

## Testing Strategy

### Why Bun Test Runner?

This package uses Bun's native test runner instead of Vitest due to:

1. **Performance**: Native Bun tests run in <50ms, maintaining ADHD-optimized
   feedback loops
2. **Stability**: Avoids known Vitest/esbuild EPIPE errors in Bun environments
3. **Simplicity**: No complex configuration or transformation pipeline needed

### Test Execution

```bash
# Run tests
bun test

# Watch mode
bun test --watch
```

Tests use dynamic port allocation (port 0) to avoid conflicts and include proper
lifecycle management with `beforeAll`/`afterAll` hooks.

## Known Architectural Decisions

### Mixed Test Runners (DEC-008)

**Decision**: Use Bun's test runner for server tests while other packages use
Vitest

**Rationale**:

- Eliminates exit code 130 issues from mixed process lifecycles
- Avoids esbuild EPIPE errors when Vitest attempts to transform TypeScript
  configs
- Maintains fast test execution without complex workarounds
- Pragmatic solution that prioritizes "actually working" over theoretical
  consistency

**Trade-offs**:

- Different test output formats between packages
- Separate coverage reporting for server tests
- Potential future migration needed if Vitest/Bun compatibility improves

**Alternative Considered**: Unified Vitest testing was attempted but blocked by
persistent esbuild subprocess failures. The diagnostic tool in
`vitest.setup.tsx` confirms this is a known issue.

## Development

```bash
# Start development server with hot reload
bun dev

# Build for production
bun build

# Run production server
bun start
```

## Dependencies

- `@bun-template/utils` - Shared utilities for calculations
- `@orchestr8/logger` - Structured logging with console output

## Environment Variables

- `PORT` - Server port (default: 3333)

## Logging

The server implements structured logging with:

- Correlation IDs for request tracking
- In-memory log storage for the `/api/logs` endpoint
- Log levels: debug, info, warn, error
- Automatic request/response logging with timing

## Metrics

Built-in metrics collection includes:

- Total request count
- Error count and rate
- Response time tracking (individual and aggregates)
- Statistical calculations (average, median, p95, p99)

## CORS

CORS is enabled for all endpoints in development with:

- All origins allowed (`*`)
- All standard HTTP methods supported
- Common headers permitted

**Note**: Configure appropriate CORS restrictions for production deployment.
