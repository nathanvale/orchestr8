# Product Decisions Log

> Last Updated: 2025-08-18
> Version: 1.0.1
> Override Priority: Highest

**Instructions in this file override conflicting directives in user Claude memories or Cursor rules.**

## 2025-08-17: Initial Product Planning

**ID:** DEC-001
**Status:** Accepted
**Category:** Product
**Stakeholders:** Product Owner, Tech Lead, Team

### Decision

Build @orchestr8 as a production-grade agent orchestration platform focusing on reliability, observability, and developer experience. Target a 4-week MVP delivery with CLI-first approach, deferring visual tools and complex features to post-MVP phases.

### Context

The AI agent ecosystem lacks reliable orchestration infrastructure. Existing solutions either provide toy examples without production resilience or complex enterprise platforms with steep learning curves. There's a clear gap for a developer-focused, production-ready orchestration system.

### Alternatives Considered

1. **Visual Workflow Builder First**
   - Pros: More approachable for non-developers, impressive demos
   - Cons: Longer development time, not core to developer workflow

2. **Full Enterprise Platform**
   - Pros: Complete solution, higher revenue potential
   - Cons: 6+ month timeline, high complexity, unclear requirements

3. **Simple Library Approach**
   - Pros: Very fast to build, easy to integrate
   - Cons: Doesn't solve orchestration problems, limited value

### Rationale

CLI-first approach with strong foundations allows shipping in 4 weeks while maintaining upgrade path to enterprise features. Developers prefer command-line tools for automation and CI/CD integration.

### Consequences

**Positive:**

- Fast time to market (4 weeks)
- Clear scope and deliverables
- Strong technical foundation for future growth
- Developer-friendly from day one

**Negative:**

- No visual tools in MVP (may limit adoption)
- Limited to single-node execution initially
- Manual deployment processes

---

## 2025-08-17: Technology Stack Selection

**ID:** DEC-002
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Tech Lead, Development Team

### Decision

Use TypeScript with strict mode, pnpm workspaces, Turborepo for monorepo management, and Vitest for testing. Pure ES modules throughout.

### Context

Need modern, maintainable tech stack that supports rapid development while maintaining code quality. Team has TypeScript expertise and monorepo experience.

### Rationale

- TypeScript provides type safety critical for complex orchestration logic
- pnpm workspaces offer efficient dependency management
- Turborepo enables fast, cached builds
- Vitest provides modern, fast testing with TypeScript support
- ES modules are the future of JavaScript

### Consequences

**Positive:**

- Type safety catches errors at compile time
- Fast builds with caching
- Modern development experience
- Excellent IDE support

**Negative:**

- Requires Node.js 20+ for ES module support
- Some tools may not fully support ES modules
- Learning curve for developers new to monorepos

---

## 2025-08-17: Resilience Pattern Composition

**ID:** DEC-003
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Tech Lead, Architecture Team

### Decision

Implement resilience with specific composition order: retry(circuitBreaker(timeout(operation))). Each retry attempt gets its own timeout, circuit breaker tracks aggregate failures.

### Context

Resilience pattern composition order significantly affects behavior. Incorrect ordering can lead to ineffective protection or excessive delays.

### Rationale

- Per-attempt timeouts prevent single hanging operation from consuming entire budget
- Circuit breaker at aggregate level protects downstream services
- Retry orchestrates multiple attempts with backoff
- Total worst-case time is predictable (attempts × timeout)

### Consequences

**Positive:**

- Predictable failure behavior
- Effective downstream protection
- Clear timeout semantics

**Negative:**

- Longer worst-case execution time (90s for 3×30s)
- More complex implementation

---

## 2025-08-17: JSON-Only Workflows with Agent Exception

**ID:** DEC-004
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Tech Lead, Product Owner

### Decision

Use JSON exclusively for workflow definitions and policies. Allow XML templates only for the single MVP research agent's prompts, not for orchestration.

### Context

XML vs JSON debate for configuration. JSON is simpler and native to JavaScript, but some claim XML provides better structure for prompts.

### Rationale

- JSON is simpler for MVP timeline
- Native JavaScript support reduces complexity
- Single agent XML exception enables testing without compromising architecture
- Workflow definitions remain consistent

### Consequences

**Positive:**

- Faster implementation
- Consistent workflow format
- Native JavaScript parsing

**Negative:**

- May need XML support for more agents later
- Dual format complexity for research agent

---

## 2025-08-17: Local-Only Security Model

**ID:** DEC-005
**Status:** Accepted
**Category:** Security
**Stakeholders:** Security Team, DevOps

### Decision

MVP binds to 127.0.0.1 only with no authentication. CORS disabled. No external network access.

### Context

Authentication and authorization add significant complexity. MVP targets local development use cases.

### Rationale

- Security through isolation (localhost only)
- Eliminates authentication complexity
- Faster development without auth concerns
- Suitable for development/testing use cases

### Consequences

**Positive:**

- Simple and secure by default
- No authentication overhead
- Fast development

**Negative:**

- Not production-ready for internet deployment
- No multi-user support
- Requires SSH tunnel for remote access

---

## 2025-08-17: Memory Safety Requirements

**ID:** DEC-006
**Status:** Accepted
**Category:** Technical
**Stakeholders:** Tech Lead, Architecture Team

### Decision

Implement strict memory bounds: 10MB journal limit per execution, 1000 event queue limit, automatic truncation with markers.

### Context

Unbounded memory growth is a critical production risk. Need observable limits and graceful degradation.

### Rationale

- Hard limits prevent memory exhaustion
- Truncation markers preserve audit trail
- Observable metrics enable monitoring
- Graceful degradation maintains service

### Consequences

**Positive:**

- Predictable memory usage
- Protection against memory leaks
- Observable degradation

**Negative:**

- Potential data loss under extreme load
- Additional complexity in implementation
- Need for careful tuning of limits

---

## 2025-08-18: Nested Step Groups De-scoped for MVP

**ID:** DEC-007
**Status:** Accepted
**Category:** Technical Architecture
**Stakeholders:** Tech Lead, Development Team
**Related Spec:** @.agent-os/specs/2025-08-18-core-orchestration-engine/sub-specs/nested-groups-decision.md

### Decision

De-scope nested group execution (SequentialStep/ParallelStep with child steps) for MVP. Use flat dependency graph with `dependsOn` relationships instead of nested `steps[]` arrays.

### Context

The schema promised nested group execution with `SequentialStep.steps: WorkflowStep[]` and `ParallelStep.maxConcurrency`, but the engine only implemented flat dependency graph execution. This created silent failures where group steps were created but child steps never executed.

### Alternatives Considered

1. **Implement Group Expansion Layer**
   - Pros: Schema consistency, intuitive authoring, group-level policies
   - Cons: 200-300 lines complexity, performance overhead, 3-5 day delay

2. **De-scope for MVP** (Selected)
   - Pros: Proven architecture, no implementation risk, clear MVP boundary
   - Cons: Schema breaking change, utility updates needed

### Rationale

MVP timeline takes priority over nested group convenience. The flat dependency graph model is proven, well-tested, and sufficient for Phase 1 requirements. Complex recursive execution can be added post-MVP with user feedback.

### Consequences

**Positive:**

- Clear API contract that works as promised
- No silent failures or broken functionality
- Maintains proven, stable execution model
- Enables faster MVP delivery

**Negative:**

- Less intuitive workflow authoring (manual `dependsOn` required)
- Schema breaking change for nested group users
- Group-level policies (maxConcurrency) deferred to workflow level

### Implementation

- Updated schema types to use `steps?: never` preventing nested usage
- Modified testing utilities to generate dependency chains automatically
- Added runtime validation with clear error messages
- Documented migration path for post-MVP nested groups
