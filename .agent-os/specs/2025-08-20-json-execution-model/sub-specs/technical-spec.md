# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-20-json-execution-model/spec.md

> Created: 2025-08-20
> Version: 1.0.0
> MVP Target: Week 3 Implementation

## MVP Technical Requirements

### Schema Organization

- All Zod schemas must be centralized in the `@orchestr8/schema` package
- Schemas should be composable and reusable across different contexts
- Each schema must include detailed error messages and validation rules
- Support for nested object validation and array structures

### JSON Schema Generation

- Use `zod-to-json-schema` library for automatic JSON Schema generation
- Generated schemas must include descriptions from Zod schema metadata
- Support for OpenAPI 3.0 compatible schemas
- Schemas should be generated at build time and included in package distribution

### Runtime Validation

- All JSON inputs must be validated using `schema.parse()` or `schema.safeParse()`
- Validation should occur at system boundaries (API endpoints, CLI input, agent invocations)
- Support for partial validation during development/testing
- Performance optimization for frequently validated schemas

### Error Formatting

- Implement custom error formatter that transforms Zod errors into user-friendly messages
- Error messages must include:
  - JSON path to the error location
  - Human-readable description of the issue
  - Expected type/format information
  - Example of valid input (where applicable)
- Support for multiple error aggregation

### MVP Performance Requirements

- Schema compilation must be cached for repeated validations
- Validation must complete within 100ms for workflows up to 50 steps
- Memory usage should not exceed 50MB for validation operations
- Initial schema compilation can take up to 500ms (cached thereafter)

## Approach Options

**Option A: Inline Schema Definitions**

- Pros: Simple, all schemas in one place, easy to maintain
- Cons: Large file size, potential for circular dependencies

**Option B: Modular Schema Files** (Selected)

- Pros: Better organization, easier testing, supports lazy loading
- Cons: More files to manage, need careful export management

**Rationale:** Modular approach provides better maintainability and allows for incremental loading of schemas, which is important for CLI tools and browser environments.

## External Dependencies

- **zod** (already in use) - Runtime schema validation
  - Justification: Already integrated, excellent TypeScript support, comprehensive validation features

- **zod-to-json-schema** - JSON Schema generation from Zod
  - Justification: Official Zod ecosystem package, well-maintained, supports all Zod features
  - Version: ^3.23.0

- **ajv** (deferred to post-MVP) - JSON Schema validation for external consumers
  - Justification: Not required for MVP, can be added later for advanced validation
  - Target: Phase 2

## Implementation Details

### File Structure

```
packages/schema/src/
├── index.ts           # Main exports
├── workflow/
│   ├── workflow.ts    # Core workflow schemas
│   ├── step.ts        # Step type schemas
│   └── policies.ts    # Resilience policy schemas
├── agent/
│   ├── agent.ts       # Agent definition schemas
│   └── invocation.ts  # Agent invocation schemas
├── validation/
│   ├── validator.ts   # Validation utilities
│   └── formatter.ts   # Error formatting
└── generation/
    ├── json-schema.ts # JSON Schema generation
    └── schemas/       # Generated JSON Schema files
```

### Schema Composition Pattern

```typescript
// Base schemas that can be extended
const BaseStepSchema = z.object({
  id: z.string(),
  type: z.enum(['agent', 'sequential', 'parallel']),
  name: z.string().optional(),
})

// Composed schemas with additional fields
const AgentStepSchema = BaseStepSchema.extend({
  type: z.literal('agent'),
  agent: AgentInvocationSchema,
  input: StepInputSchema,
})
```

### Error Formatting Example

```typescript
class SchemaErrorFormatter {
  format(error: ZodError): FormattedError[] {
    return error.errors.map((err) => ({
      path: err.path.join('.'),
      message: this.getHumanMessage(err),
      expected: this.getExpectedType(err),
      received: err.received,
      example: this.getExample(err.path),
    }))
  }
}
```

## Future Technical Enhancements (Post-MVP)

### Phase 1: Performance Optimization (Month 2)

- **Streaming Validation**: Support for JSON payloads >1MB using streaming parsers
- **Worker Thread Validation**: Offload CPU-intensive validation to worker threads
- **Schema Precompilation**: AOT compilation of frequently used schemas
- **Validation Caching**: Redis-based caching for validation results

### Phase 2: Advanced Features (Month 3)

- **Schema Composition**: Support for $ref and schema inheritance
- **Custom Validators**: Plugin system for domain-specific validation rules
- **Schema Evolution**: Automatic migration between schema versions
- **Conditional Schemas**: Dynamic schema selection based on context

### Phase 3: Developer Tools (Month 4)

- **Schema Language Server**: LSP implementation for IDE support
- **Type Generation**: Generate TypeScript types from Zod schemas
- **Schema Testing Framework**: Property-based testing for schemas
- **Documentation Generator**: Markdown/HTML docs from schemas

### Phase 4: Enterprise Features (Month 5+)

- **Schema Registry**: Centralized schema management service
- **Validation Metrics**: Prometheus metrics for validation performance
- **Schema Governance**: Approval workflows for schema changes
- **Multi-tenant Support**: Isolated schemas per tenant
