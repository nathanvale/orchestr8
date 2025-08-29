# Tests Specification

This is the tests coverage details for the spec detailed in
@.agent-os/specs/2025-08-29-runtime-adapter-vitest-unification/spec.md

> Created: 2025-08-29 Version: 1.0.0

## Test Coverage

### Unit Tests

**Runtime Factory**

- Test runtime detection logic (Bun vs Node environment)
- Test factory returns correct adapter instance
- Test adapter interface compliance

**Bun Adapter**

- Test Bun.serve delegation
- Test server instance properties (port, hostname)
- Test stop() method functionality

**Node Adapter**

- Test http.createServer wrapper
- Test Request/Response conversion accuracy
- Test error handling for malformed requests
- Test body parsing for JSON and text content
- Test header transformation between Node.js and Web APIs

### Integration Tests

**Server Startup**

- Test server starts successfully with runtime adapter
- Test correct port binding and availability
- Test graceful shutdown via stop() method

**API Endpoint Testing**

- Test all existing endpoints work through adapter
- Test JSON response formatting matches original
- Test error responses maintain consistent structure
- Test health check endpoint accessibility

**Cross-Runtime Compatibility**

- Test identical behavior between Bun and Node adapters for current API surface
- Test request/response cycle matches between environments
- Test error scenarios produce equivalent outputs

### Mocking Requirements

**No External Service Mocks Needed**

- Runtime adapters are self-contained
- HTTP testing uses real local server instances
- No database or external API dependencies

**Test Environment Isolation**

- Each test gets fresh server instance
- Port allocation handled dynamically
- Server cleanup in afterEach/afterAll hooks
