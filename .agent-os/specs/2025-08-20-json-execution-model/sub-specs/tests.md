# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-20-json-execution-model/spec.md

> Created: 2025-08-20
> Version: 1.0.0
> MVP Target: 80% coverage for core validation

## MVP Test Coverage (Week 3 Focus)

### Unit Tests

**WorkflowSchemaValidator**

- Validates correct workflow structures
- Rejects invalid workflow structures with clear errors
- Handles nested step validation
- Validates expression patterns correctly
- Validates resilience policies
- Validates concurrency settings

**AgentSchemaValidator**

- Validates agent definition structure
- Validates agent ID format (@scope/name)
- Validates version constraints
- Validates configuration objects

**SchemaErrorFormatter**

- Formats single validation errors correctly
- Aggregates multiple errors with proper paths
- Provides helpful examples for common errors
- Handles deeply nested error paths
- Generates human-readable messages

**JSONSchemaGenerator**

- Generates valid JSON Schema from Zod schemas
- Includes descriptions and examples
- Handles recursive schema definitions
- Generates OpenAPI-compatible schemas
- Preserves all validation constraints

### Integration Tests

**Schema Validation Pipeline**

- End-to-end workflow validation
- Complex nested workflow structures
- Workflow with all step types (agent, sequential, parallel)
- Expression resolution and validation
- Circular dependency detection

**API Validation Integration**

- POST /workflows/validate endpoint
- POST /workflows/execute with validation
- Schema retrieval endpoints
- Error response formatting
- Schema version negotiation

**CLI Validation Integration**

- Workflow file validation before execution
- Agent definition validation
- Error display formatting
- Schema generation commands

### MVP Performance Tests

**Basic Performance Validation**

- Workflow validation (<100ms for 50 steps)
- Schema compilation caching verification
- Memory usage stays under 50MB

## Future Test Enhancements (Post-MVP)

### Phase 1: Advanced Testing (Month 2)

**Property-Based Tests**

- Any valid Zod input produces valid JSON Schema
- Round-trip validation (Zod -> JSON Schema -> validate)
- Error paths always valid JSON paths
- Generated examples always validate

**Load Testing**

- Concurrent validation of 100+ workflows
- Stress testing with malformed inputs
- Memory leak detection

### Phase 2: Contract Testing (Month 3)

**API Contract Tests**

- Consumer-driven contracts with Pact
- Schema compatibility testing
- Version migration testing

### Phase 3: Chaos Engineering (Month 4)

**Resilience Testing**

- Random input generation with fuzzing
- Mutation testing for validators
- Failure injection for error paths

## Mocking Requirements

- **File System:** Mock file reads for CLI testing
- **HTTP Responses:** Mock schema endpoint responses
- **Zod Schemas:** Spy on parse/safeParse calls for validation tracking

## Test Data

### Valid Workflow Examples

```typescript
const validWorkflow = {
  version: '1.0.0',
  metadata: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Workflow',
  },
  steps: [
    {
      id: 'step1',
      type: 'agent',
      agent: {
        id: '@orchestr8/test-agent',
        version: '1.0.0',
      },
      input: {
        mapping: {
          data: '${variables.input}',
        },
      },
    },
  ],
}
```

### Invalid Workflow Examples

```typescript
const invalidWorkflow = {
  version: 'invalid-version', // Should be x.y.z
  metadata: {
    id: 'not-a-uuid',
    name: '', // Empty name
  },
  steps: [
    {
      id: 'step 1', // Space in ID
      type: 'unknown', // Invalid type
      agent: {
        id: 'missing-scope', // Invalid format
      },
    },
  ],
}
```

### Expected Error Messages

```typescript
const expectedErrors = [
  {
    path: 'version',
    message: 'Must be valid semver format (x.y.z)',
    expected: 'x.y.z',
    received: 'invalid-version',
  },
  {
    path: 'metadata.id',
    message: 'Workflow ID must be a valid UUID',
    expected: 'UUID',
    received: 'not-a-uuid',
  },
]
```

## MVP Coverage Requirements

- Minimum 80% code coverage for schema package
- 90% coverage for error formatting utilities
- 85% coverage for JSON Schema generation
- Critical error paths must be tested

## Future Coverage Goals (Post-MVP)

- 95% overall code coverage
- 100% coverage for error formatting
- 100% coverage for schema generation
- 100% coverage for all error paths
- Mutation testing score >80%
