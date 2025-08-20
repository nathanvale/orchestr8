# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-20-workflow-schema-validation/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Technical Requirements

### Zod Schema Implementation

- Complete Zod schema definitions covering all workflow AST components from `docs/sub-specs/workflow-ast-schema.md`
- Schema validation with human-readable error messages and field-level validation
- Type-safe runtime validation with TypeScript inference support
- Default value handling and optional field support with proper validation rules
- Regex patterns for format validation (UUIDs, semver, agent IDs, secret references)

### Expression Validation Engine

- Security-aware validation for `${steps.*.output.*}`, `${variables.*}`, and `${env.*}` expressions
- Configurable security limits: max expansion depth (default: 10), max size (default: 64KB)
- Prototype pollution prevention through path validation and dangerous pattern detection
- Default value support using `??` operator with type parsing (strings, numbers, booleans, JSON)
- Array and object property access with bracket notation support (`[0]`, `['key']`)

### Schema Versioning System

- Deterministic hash calculation using canonical schema representation
- Schema hash validation with backward compatibility for legacy workflows
- Version compatibility checking and detailed error reporting for mismatches
- SHA-256 based hashing with sorted JSON keys for consistency

### Integration Requirements

- Seamless integration with existing TypeScript interfaces and backward compatibility
- Preservation of existing circular dependency detection and step reference validation
- Enhanced error reporting with Zod validation errors and custom domain validations
- Export structure maintaining development/production conditional exports

## Approach Options

**Option A: Replace Manual Validation Entirely**

- Pros: Clean codebase, single validation approach, better maintainability
- Cons: Risk of breaking existing functionality, large migration effort

**Option B: Gradual Migration with Dual Validation** (Selected)

- Pros: Backward compatibility, safe rollout, minimal risk of breaking changes
- Cons: Temporary code duplication, slightly more complex codebase

**Option C: Zod Wrapper Around Existing Validation**

- Pros: Minimal changes, maximum safety
- Cons: No benefits of Zod's type inference, limited improvement

**Rationale:** Option B provides the best balance of safety and improvement. It allows for comprehensive Zod validation while maintaining existing APIs and validation logic. The dual approach ensures that complex domain validations (circular dependencies, step references) are preserved while benefiting from Zod's type safety and error reporting.

## External Dependencies

- **Zod (z)** - Runtime schema validation library
- **Justification:** Industry-standard TypeScript schema validation with excellent error messages and type inference
- **Version:** Latest stable (already included in project dependencies)

- **Node.js crypto module** - For SHA-256 hash generation
- **Justification:** Built-in module for deterministic schema versioning, no external dependency
- **Usage:** Creating consistent schema hashes for version validation

## Implementation Architecture

### File Structure

```
packages/schema/src/
├── zod-schemas.ts           # Complete Zod schema definitions
├── expression-validator.ts  # Expression validation engine
├── validators.ts           # Enhanced validation logic
├── index.ts               # Updated exports
└── index.test.ts          # Comprehensive test coverage
```

### Key Components

1. **WorkflowSchemaValidator Class**: Central validation orchestrator with schema hash management
2. **ExpressionValidator Class**: Secure expression parsing and validation
3. **Enhanced validators.ts**: Integration layer maintaining backward compatibility
4. **Comprehensive exports**: All Zod schemas, types, and validation utilities

### Security Features

- Expression depth limiting to prevent stack overflow attacks
- Size limiting to prevent memory exhaustion
- Prototype pollution prevention through path validation
- Environment variable access control with whitelist support
- Safe property traversal with null/undefined handling

### Performance Considerations

- Zod schema compilation happens once at import time
- Expression validation uses efficient regex patterns
- Minimal memory footprint with streaming validation approach
- Hash calculation cached for schema version validation
