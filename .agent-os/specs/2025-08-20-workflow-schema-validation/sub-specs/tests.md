# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-08-20-workflow-schema-validation/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Test Coverage

### Unit Tests

**WorkflowSchemaValidator**

- Schema hash calculation with deterministic results
- Workflow validation with valid and invalid schemas
- Schema hash validation and compatibility checking
- Error message formatting for Zod validation failures
- Step validation with comprehensive field validation

**ExpressionValidator**

- Expression syntax validation for all supported patterns
- Path expression validation with security checks
- Default value parsing for all supported types (string, number, boolean, JSON)
- Security limit enforcement (depth, size, prototype pollution)
- Expression resolution with complete context scenarios

**Enhanced Validators (validators.ts)**

- Backward compatibility with existing validation APIs
- Integration of Zod validation with domain-specific checks
- Circular dependency detection with detailed error paths
- Step reference validation for missing and invalid references
- Workflow validation with complete end-to-end scenarios

### Integration Tests

**Zod Schema Validation**

- Complete workflow validation with all optional and required fields
- Policy validation (retry, circuit breaker, concurrency, timeout)
- Agent invocation validation with version constraints
- Expression security configuration validation
- Error taxonomy and resilience budget validation

**Expression Engine Integration**

- Multi-level expression resolution with nested object access
- Array access validation with bracket notation
- Environment variable access with security controls
- Step output reference validation with missing step scenarios
- Default value fallback with various data types

**Cross-Component Validation**

- Workflow with steps referencing other step outputs
- Complex dependency chains with validation
- Policy inheritance and override scenarios
- Schema versioning with hash validation
- Mixed validation scenarios (Zod + domain-specific)

### Mocking Requirements

**File System Operations:** Mock temporary file creation for date determination tests
**Crypto Module:** Mock for predictable hash generation in schema versioning tests
**Console/Logger:** Mock validation error output for clean test reporting

## Test Scenarios

### Positive Test Cases (24 tests)

1. Valid workflow with all required fields
2. Valid workflow with optional fields populated
3. Valid workflow with complex step dependencies
4. Valid policy configurations (retry, circuit breaker, etc.)
5. Valid expression syntax for all supported patterns
6. Valid expression resolution with complete context
7. Valid default value handling for all supported types
8. Valid schema hash calculation and validation
9. Valid step reference validation with existing dependencies
10. Valid circular dependency detection (no cycles)
11. Valid agent invocation with version constraints
12. Valid expression security configuration
13. Valid array and object access in expressions
14. Valid environment variable access with whitelist
15. Valid nested property traversal with depth limits
16. Valid backward compatibility with existing TypeScript types
17. Valid error taxonomy and resilience budget validation
18. Valid global policies and timeout configurations
19. Valid workflow metadata and context validation
20. Valid step condition validation (if/unless)
21. Valid expression validation with complex nested structures
22. Valid schema versioning with hash compatibility
23. Valid integration between Zod and domain validations
24. Valid comprehensive workflow with all features enabled

### Negative Test Cases (22 tests)

1. Invalid workflow structure (missing required fields)
2. Invalid step configuration (malformed agent ID)
3. Invalid expression syntax (malformed patterns)
4. Invalid expression security (prototype pollution attempts)
5. Invalid circular dependencies (detected cycles with error paths)
6. Invalid step references (missing dependency targets)
7. Invalid policy values (out of range timeouts, retry counts)
8. Invalid schema hash (version mismatch scenarios)
9. Invalid default value syntax (malformed JSON, nested expressions)
10. Invalid expression depth (exceeding security limits)
11. Invalid expression size (exceeding memory limits)
12. Invalid environment variable access (disabled or not whitelisted)
13. Invalid array access (out of bounds, malformed syntax)
14. Invalid agent version format (non-semver specifications)
15. Invalid secret reference format (incorrect URI schemes)
16. Invalid workflow version (non-semver format)
17. Invalid step ID format (special characters, invalid patterns)
18. Invalid policy combinations (conflicting configurations)
19. Invalid expression context (missing required data)
20. Invalid nested property access (null/undefined traversal)
21. Invalid schema structure (Zod parsing failures)
22. Invalid integration scenarios (mixed validation failures)

## Performance Tests

- Expression validation with large object contexts (memory usage)
- Schema validation with complex workflows (validation time)
- Hash calculation performance with large schema definitions
- Concurrent validation scenarios (thread safety)

## Test Organization

Tests are organized in `packages/schema/src/index.test.ts` with:

- Describe blocks for each major component
- Clear test naming without the word "test"
- Comprehensive error scenario coverage
- Performance benchmarking for critical paths
- Mock setup for external dependencies
