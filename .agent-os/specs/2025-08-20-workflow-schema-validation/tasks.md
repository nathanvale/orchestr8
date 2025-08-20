# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-08-20-workflow-schema-validation/spec.md

> Created: 2025-08-20
> Status: Completed (All tasks implemented)

## Tasks

- [x] 1. Create comprehensive Zod schema definitions
  - [x] 1.1 Analyze existing workflow AST schema specification
  - [x] 1.2 Create complete Zod schemas for all workflow components
  - [x] 1.3 Implement validation patterns for UUIDs, semver, agent IDs
  - [x] 1.4 Add schema versioning with deterministic hash calculation
  - [x] 1.5 Create WorkflowSchemaValidator class with error formatting
  - [x] 1.6 Verify all schema definitions match TypeScript interfaces

- [x] 2. Implement expression validation with security controls
  - [x] 2.1 Create ExpressionValidator class with security configuration
  - [x] 2.2 Implement expression syntax validation for ${...} patterns
  - [x] 2.3 Add expression resolution with context traversal
  - [x] 2.4 Implement security limits (depth, size, prototype pollution prevention)
  - [x] 2.5 Add default value support with ?? operator and type parsing
  - [x] 2.6 Verify expression validation prevents security vulnerabilities

- [x] 3. Enhance existing validation logic
  - [x] 3.1 Update validators.ts to integrate Zod validation
  - [x] 3.2 Preserve existing circular dependency detection
  - [x] 3.3 Maintain step reference validation logic
  - [x] 3.4 Ensure backward compatibility with existing APIs
  - [x] 3.5 Add comprehensive error reporting
  - [x] 3.6 Verify integration between Zod and domain validations

- [x] 4. Add comprehensive test coverage
  - [x] 4.1 Create test suite for all Zod schema validations
  - [x] 4.2 Add expression validation tests with security scenarios
  - [x] 4.3 Test integration between Zod and existing validation logic
  - [x] 4.4 Add edge case testing for error scenarios
  - [x] 4.5 Implement performance tests for large schema validation
  - [x] 4.6 Verify 100% test coverage for all validation paths

- [x] 5. Update exports and finalize integration
  - [x] 5.1 Update index.ts with all new Zod schemas and utilities
  - [x] 5.2 Ensure proper TypeScript type exports
  - [x] 5.3 Maintain development/production conditional exports
  - [x] 5.4 Run comprehensive quality checks (format, lint, type-check, test)
  - [x] 5.5 Verify backward compatibility with existing codebase
  - [x] 5.6 Complete documentation and verify all implementation requirements

  ## Production readiness triage (P0/P1/P2)

  ### P0 (blockers)
  - [ ] None identified

  ### P1 (high priority)
  - [x] Wire global policy fields to workflow root or remove unused schemas
    - [x] Decide representation at root (timeout, resilience, concurrency,
          cancellation, resilienceBudget)
    - [x] Implement schema changes and update tests to match spec

  - [x] Enforce allowedEnvVars whitelist in expression evaluation
    - [x] Use `allowedEnvVars` to permit only whitelisted `${env.*}` references
    - [x] Add unit tests for allowed/denied env vars

  - [x] Strengthen schema hash robustness
    - [x] Add a drift test that fails if `WorkflowSchema` changes without
          updating the canonical hash
    - [x] Optional: derive canonical representation from Zod introspection for
          hash calculation

  - [x] Enforce coverage thresholds in CI
    - [x] Add coverage thresholds (branches/functions/lines) to Vitest config
    - [x] Ensure CI fails when thresholds aren't met

  ### P2 (nice-to-haves)
  - [ ] Add `packages/schema/README.md` with usage examples
    - [ ] Validating workflows and steps
    - [ ] Expression mapping validation
    - [ ] Schema hash generation/validation

  - [ ] Add performance/limits tests
    - [ ] Large workflow validation timings and memory
    - [ ] Deep/nested expression resolution under security limits

  - [ ] API ergonomics helpers
    - [ ] Provide helper to validate step input mappings during workflow
          validation when inputs contain expressions

  - [ ] Publishing hardening (if publishing externally)
    - [ ] Prepare `package.json` (remove private, add `prepublishOnly`)
    - [ ] Consider `sideEffects: false` for better tree-shaking
