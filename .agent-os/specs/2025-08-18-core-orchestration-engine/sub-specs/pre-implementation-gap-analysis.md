# Pre-Implementation Gap Analysis

This document provides a focused gap/risk review of the core-orchestration-engine spec against the reference docs and current schema to highlight what needs resolving before we start implementation.

> Created: 2025-08-18
> Version: 1.0.0
> Status: Critical Pre-Implementation Review

## Executive Summary

Analysis reveals **12 critical gaps** between schema implementation, documentation, and engine contracts that will cause immediate implementation failures if not resolved. These gaps span semantic inconsistencies, undefined behaviors, and missing tooling that would block development progress.

**Go/No-Go Status: 🔴 NO-GO** until all prerequisite items are addressed.

**Key Alignment Requirements:**

- Expression semantics standardization (JMESPath + ${} mapping)
- Error taxonomy alignment with schema ExecutionError exactly
- Scheduler determinism with dependency completion checks
- Resilience policy shape corrections (jitterStrategy, halfOpenPolicy)
- Integration contracts with proper test doubles
- Repository prerequisites (Node >=20, jmespath, engines field)

## Critical Gap Analysis

### 1. Expression Semantics Inconsistency (HIGH PRIORITY)

**Current State:**

- Schema: `mapping: z.record(z.string().regex(/^\$\{[^}]+\}$/))` allows any `${...}` expression
- Schema Alignment doc: States mapping must support `${steps.*}`, `${variables.*}`, `${env.*}` but flags regex as needing change
- Workflow AST doc: Shows stricter pattern `${steps.<id>.output.<path>}` only (no variables/env) plus `??` default syntax
- Technical spec: Uses "Simple JavaScript expression evaluation with security restrictions" for conditions

**Risk Level: CRITICAL** - Engine and validators will diverge immediately

**Required Decision:**
Use JMESPath for conditions (safer than JS eval) and support mapping placeholders for steps/variables/env with simple `${…}` resolution.

**Actions Required:**

1. **Add jmespath dependency** to @orchestr8/core package
2. **Documentation Standardization**:
   - Conditions: JMESPath evaluation only (remove JS-expression references)
   - Mapping: `${steps.*}`, `${variables.*}`, `${env.*}` with optional `?? default` syntax
3. **Security Implementation**:
   - `maxExpansionDepth: 10`
   - `maxExpansionSize: 64KB`
   - Environment whitelist for `env.*` access
   - 500ms evaluation timeout
4. **Tests**: JMESPath compile/cache, mapping precedence (steps > variables > env), defaults, limits

**Implementation Blocker**: YES - Tests will lock wrong behavior if not resolved

---

### 2. Fallback vs Journaling Scope Conflict (MEDIUM PRIORITY)

**Current State:**

- Engine contracts require recording original failure and fallback execution "in journal"
- Journaling is explicitly out-of-scope in current spec
- WorkflowResult structure unclear on how to represent fallback aliasing

**Risk Level: MEDIUM** - Implementation ambiguity on audit trail persistence

**Required Decision:**
For MVP, record both original and fallback results in WorkflowResult.stepResults with clear linking metadata, deferring persistent journaling to separate spec.

**Actions Required:**

1. **Clarify in Engine Contracts**: "journal" means in-memory execution results for MVP
2. **WorkflowResult Enhancement**: Add aliasing metadata (e.g., `aliasFor: 'stepX'`)
3. **Documentation Update**: Clearly separate in-memory results from persistent journaling
4. **Future Planning**: Note persistent journaling as separate upcoming spec

**Implementation Blocker**: NO - Can be resolved during implementation

---

### 3. Error Taxonomy Schema Mismatch (HIGH PRIORITY)

**Current State:**

- Active schema exports `ExecutionError` with codes: `TIMEOUT`, `CIRCUIT_OPEN`, `CANCELLED`, `VALIDATION`, `RETRYABLE`, `UNKNOWN`
- Workflow AST doc shows alternative `ErrorTaxonomySchema` with different shape (no `UNKNOWN` code)
- Some docs reference the alternative schema shape

**Risk Level: HIGH** - Tests and error handling will diverge

**Required Decision:**
Use the schema's `ExecutionError` exactly as implemented in `packages/schema/src/index.ts`.

**Actions Required:**

1. **Documentation Cleanup**: Remove/fix references to alternative `ErrorTaxonomySchema`
2. **Test Contracts**: Assert exact enum values and field structure from schema
3. **Error Classification**: Keep `UNKNOWN` but minimize usage with logging for analysis
4. **Implementation Standard**: All error examples must use schema-exact structure

**Implementation Blocker**: YES - Error handling contracts must be locked

---

### 4. Scheduler Semantics Inconsistency (HIGH PRIORITY)

**Current State:**

- Technical spec shows correct "dependencies completed" logic
- Some documentation examples use "not running" as readiness proxy (incorrect)
- Deterministic ordering requirements: dependency count asc → original index → stable sort

**Risk Level: HIGH** - Non-deterministic execution and race conditions

**Required Decision:**
Lock on "dependency must be completed" for readiness with explicit topological levels and concurrency semaphore.

**Actions Required:**

1. **Documentation Cleanup**: Remove/replace incorrect "not running" examples
2. **Scheduler Implementation**:
   - Dependencies completed check (not just "not running")
   - Deterministic ordering: dependency count → array index → stable
   - Topological level construction
3. **Test Coverage**:
   - Unit tests for stable ordering
   - Property tests for deterministic behavior
   - Cycle detection with `VALIDATION` error shape
4. **Concurrency Management**: Global semaphore enforcement

**Implementation Blocker**: YES - Scheduler behavior must be deterministic

---

### 5. SchemaHash Enforcement Friction (MEDIUM PRIORITY)

**Current State:**

- Validator requires `schemaHash` to match computed canonical value
- Manual JSON workflows will fail validation without tooling
- No CLI helper for hash computation/injection

**Risk Level: MEDIUM** - Developer friction and validation failures

**Required Decision:**
Provide tooling for schemaHash computation with dev-mode bypass option.

**Actions Required:**

1. **Schema Package Helper**: Export `computeSchemaHash(workflow)` function
2. **CLI Integration**: Pre-submit validation to compute/inject schemaHash
3. **Development Mode**: Flag to bypass hash check with warning
4. **Documentation**: "schemaHash in practice" section with usage examples

**Implementation Blocker**: NO - But essential for developer experience

---

### 6. Condition Evaluation Language Ambiguity (HIGH PRIORITY)

**Current State:**

- Schema: `condition: { if?: string, unless?: string }` with no evaluation engine specified
- Documentation alternates between "JS expressions" and "JMESPath"
- Security implications of JS eval vs JMESPath

**Risk Level: HIGH** - Security and evaluation consistency

**Required Decision:**
Standardize on JMESPath for if/unless conditions (compiled & cached).

**Actions Required:**

1. **Technical Spec Update**: JMESPath evaluation only, no JS expressions
2. **Security Boundaries**: Safe subset, no function expressions, evaluation timeouts
3. **Implementation**: `jmespath` library with compilation caching
4. **Documentation**: Clear examples of JMESPath syntax and limitations

**Implementation Blocker**: YES - Evaluation engine must be decided

---

### 7. Resilience Policy Shapes (Schema Fidelity) (HIGH PRIORITY)

**Current State:**

- Retry: Some docs show boolean jitter, should be jitterStrategy: 'full-jitter'
- Circuit breaker: Examples use key string and 'single-trial', should be keyStrategy object and halfOpenPolicy: 'single-probe'
- Composition order default: retry(circuitBreaker(timeout())) needs validation

**Risk Level: HIGH** - Policy configuration conflicts with schema

**Required Decision:**
Lock correct resilience policy shapes per schema and validate composition order.

**Actions Required:**

1. **Fix Policy Examples**:
   - Retry: jitterStrategy: 'full-jitter' (no boolean jitter)
   - Circuit breaker: keyStrategy object, halfOpenPolicy: 'single-probe'
2. **Test Coverage**: Composition order for both defaults and alternative order
3. **Policy Precedence**: Classification and policy precedence (step overrides global)
4. **ResilienceAdapter Contract**: AbortSignal propagation and ExecutionError classification

**Implementation Blocker**: YES - Policy shapes must match schema exactly

---

### 8. Idempotency Key Semantics Definition (LOW PRIORITY)

**Current State:**

- `StepPolicies.idempotencyKey?` exists in schema
- Documentation mentions process-local TTL cache
- No clear semantics for key validation, cache behavior, or failure handling

**Risk Level: LOW** - Feature ambiguity but not blocking

**Required Decision:**
MVP provides optional per-step idempotency via engine-managed, size-bounded LRU with 10-minute TTL, caching successes only.

**Actions Required:**

1. **Cache Implementation**: LRU cache with size and TTL bounds
2. **Key Validation**: Template processing and collision detection
3. **Success-Only Caching**: Only cache successful executions
4. **Documentation**: Limitations and distributed guarantees (none in MVP)

**Implementation Blocker**: NO - Optional feature can be implemented incrementally

---

### 9. Memory Bounds and Truncation Metadata (MEDIUM PRIORITY)

**Current State:**

- Engine contracts mention per-step output truncation with metadata
- Technical spec shows truncation details (512KB default)
- Need JSON-safe serialization with circular reference handling

**Risk Level: MEDIUM** - Memory safety and debuggability

**Required Decision:**
Lock defaults (512KB per step) with JSON-safe serialization and detailed truncation metadata.

**Actions Required:**

1. **Serialization Strategy**: `JSON.stringify` with circular reference detection
2. **Truncation Metadata**: `{truncated: boolean, originalSize: number, retainedBytes: number}`
3. **Size Enforcement**: Per-step limits with configurable defaults
4. **Test Coverage**: Oversized payloads and metadata presence verification

**Implementation Blocker**: NO - Can be implemented during development

---

### 10. AgentRegistry and ResilienceAdapter Contracts (HIGH PRIORITY)

**Current State:**

- Interfaces defined but packages `agent-base` and `resilience` contain only placeholder implementations
- Integration points undefined until concrete implementations available

**Risk Level: HIGH** - Integration contracts unclear

**Required Decision:**
Add test doubles and assert integration behavior with explicit contracts.

**Actions Required:**

1. **Mock Framework**: `MockAgentRegistry` and `MockResilienceAdapter` in `@orchestr8/testing`
2. **Contract Tests**:
   - Agent lookup failure → `VALIDATION` error
   - AbortSignal propagation through adapter
   - Policy precedence (step over global)
   - Configuration injection pass-through
3. **Integration Validation**: Clear interface contracts for engine integration

**Implementation Blocker**: YES - Integration points must be defined

---

### 11. Concurrency and Cancellation Semantics (HIGH PRIORITY)

**Current State:**

- Global cap: `maxConcurrentSteps` default 10
- Per-level parallelism + global semaphore
- AbortSignal.any for cascading cancellation
- onError behavior: fail-fast vs continue vs retry vs fallback

**Risk Level: HIGH** - Concurrency safety and deterministic cancellation

**Required Decision:**
Confirm fail-fast behavior, graceful cancellation, and cap enforcement semantics.

**Actions Required:**

1. **Fail-Fast Implementation**: Default `onError: 'fail'` aborts peer steps in same level
2. **Error Policy Behavior**:
   - `continue`: skip step, mark skipped, proceed
   - `retry`: integrate with resilience, fail after exhaustion
   - `fallback`: execute `fallbackStepId`, alias result
3. **Cancellation Chain**: AbortSignal.any cascading with graceful cleanup window
4. **Concurrency Testing**: Load testing with fake timers for cap enforcement

**Implementation Blocker**: YES - Concurrency behavior must be deterministic

---

### 12. Step Input Transform Semantics (LOW PRIORITY)

**Current State:**

- `StepInput.transform` field exists in schema
- Documentation suggests JMESPath transform post-mapping
- No clear specification of transform application timing or security bounds

**Risk Level: LOW** - Feature clarity needed but not blocking

**Required Decision:**
Apply optional JMESPath transform on mapped input prior to agent execution, with same security/time bounds as conditions.

**Actions Required:**

1. **Transform Pipeline**: mapping resolution → JMESPath transform → agent input
2. **Security Bounds**: Same limits as condition evaluation
3. **Documentation**: Clear examples and transform use cases
4. **Test Coverage**: Transform behavior and edge cases

**Implementation Blocker**: NO - Optional feature for post-MVP

---

### 13. Repository Prerequisites (HIGH PRIORITY)

**Current State:**

- Need Node >=20 for AbortSignal.any/timeout
- jmespath dependency needed for expression evaluation
- engines field missing from package.json files
- TS target ES2022+ and strict mode verification needed

**Risk Level: HIGH** - Prerequisites must be met before implementation

**Required Decision:**
Add all repository prerequisites before any implementation begins.

**Actions Required:**

1. **Add engines** to root and packages: Node >=20 (AbortSignal.any/timeout)
2. **Add jmespath dependency** to @orchestr8/core (or @orchestr8/expressions helper)
3. **Verify TS target** ES2022+ and strict mode already set
4. **Confirm Wallaby/Vitest** setup present with threads pool and resetAllMocks

**Implementation Blocker**: YES - Infrastructure prerequisites block development

---

## Quick Documentation Fixes Required

### Schema Alignment Updates

- [ ] Standardize on JMESPath for conditions across all docs
- [ ] Document mapping placeholders: `${steps.*}`, `${variables.*}`, `${env.*}` with `?? default`
- [ ] Keep current permissive regex in schema with TODO comment for post-MVP refinement
- [ ] Clarify fallback/journal expectation to "WorkflowResult step results" for MVP

### Error Handling Standardization

- [ ] Remove/replace incorrect scheduler examples that check "not running"
- [ ] Ensure all error examples use `ExecutionError` from schema (with `UNKNOWN`)
- [ ] Fix references to alternative error taxonomy schemas

### Tooling Documentation

- [ ] Add "schemaHash in practice" section with CLI helper commitment
- [ ] Document transform usage with JMESPath and security limits inheritance

## Test Gating Requirements (MUST PASS BEFORE IMPLEMENTATION)

### Schema Contract Tests

- [ ] `ExecutionError` enum values and structure match schema exactly
- [ ] `StepPolicies` shape validation with `fallbackStepId` presence checks
- [ ] Circular dependency detection returns `VALIDATION` error with correct shape

### Expression and Condition Tests

- [ ] Mapping `${steps/variables/env}` resolution including `?? default` syntax
- [ ] Security limits enforcement: depth/size bounds, environment whitelist
- [ ] JMESPath condition evaluation with compilation caching

### Scheduler and Concurrency Tests

- [ ] Deterministic step ordering: dependency count → index → stable sort
- [ ] Execution level construction and parallel grouping correctness
- [ ] Cycle detection with human-readable error messages
- [ ] Concurrency cap enforcement under simulated load (fake timers)

### Failure Semantics Tests

- [ ] Parallel fail-fast behavior with AbortSignal propagation
- [ ] onError policy handling: fail/continue/retry/fallback with result aliasing
- [ ] End-to-end abort propagation through adapter and agents

### Memory and Metadata Tests

- [ ] Output truncation with complete metadata capture
- [ ] JSON serialization safety with circular reference handling
- [ ] Size limit enforcement and configurable defaults

## Implementation Tooling Requirements

### Schema Package Enhancements

- [ ] Export `computeSchemaHash(workflow)` helper function
- [ ] Document usage patterns and integration with CLI

### CLI Pre-flight Validation

- [ ] Command to compute/inject schemaHash for manual workflows
- [ ] Dev mode flag to bypass hash validation with warnings

### Testing Framework

- [ ] `MockAgentRegistry` and `MockResilienceAdapter` in `@orchestr8/testing`
- [ ] Wallaby.js compatible mock setup (mockImplementation pattern)
- [ ] Property-based testing utilities for scheduler determinism

## Go/No-Go Decision Criteria

### GO Criteria (ALL must be met)

✅ **Expression semantics standardized** (JMESPath + mapping placeholders)  
✅ **Error taxonomy locked** to schema `ExecutionError` exactly  
✅ **Scheduler semantics deterministic** with dependency-completion readiness  
✅ **Agent/Resilience integration contracts** defined with test doubles  
✅ **Concurrency/cancellation behavior** specified with fail-fast semantics  
✅ **Documentation aligned** across schema/AST/technical specs

### NO-GO Indicators (ANY blocks implementation)

🔴 **Expression evaluation ambiguity** (JS vs JMESPath)  
🔴 **Error codes divergence** from schema taxonomy  
🔴 **Scheduler non-determinism** or race conditions  
🔴 **Integration points undefined** (AgentRegistry/ResilienceAdapter)  
🔴 **Memory bounds unspecified** or untestable  
🔴 **SchemaHash friction** without tooling plan

## Conclusion

Current status: **🔴 NO-GO for implementation**

The 13 identified gaps represent fundamental semantic conflicts that will cause immediate implementation failures, non-deterministic behavior, and developer friction. **Items 1, 3, 4, 5, 6, 10, 11, 13 are critical blockers** that must be resolved before any implementation begins.

**Estimated resolution time: 2-3 days** focused on documentation cleanup and test scaffolding.

**Next step: Address critical blocking items 1, 3, 4, 5, 6, 10, 13** immediately as these will cause tests to fail or lock incorrect behavior.

**Key deliverables for GREEN status:**

- Repository prerequisites (Node >=20, jmespath, engines fields)
- Documentation semantic alignment (JMESPath, mapping patterns, error taxonomy)
- Integration contracts with test doubles
- Scheduler determinism specification
- Resilience policy shape corrections
