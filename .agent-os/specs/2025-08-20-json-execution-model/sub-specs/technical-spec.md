# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-20-json-execution-model/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Technical Requirements

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

### Performance Considerations
- Schema compilation should be cached for repeated validations
- Large JSON payloads (>1MB) should use streaming validation where possible
- Validation should complete within 100ms for typical workflow definitions

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

- **ajv** (optional) - JSON Schema validation for external consumers
  - Justification: Industry standard JSON Schema validator, useful for testing generated schemas
  - Version: ^8.12.0

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
});

// Composed schemas with additional fields
const AgentStepSchema = BaseStepSchema.extend({
  type: z.literal('agent'),
  agent: AgentInvocationSchema,
  input: StepInputSchema,
});
```

### Error Formatting Example
```typescript
class SchemaErrorFormatter {
  format(error: ZodError): FormattedError[] {
    return error.errors.map(err => ({
      path: err.path.join('.'),
      message: this.getHumanMessage(err),
      expected: this.getExpectedType(err),
      received: err.received,
      example: this.getExample(err.path),
    }));
  }
}
```