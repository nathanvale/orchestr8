# Product Decisions Log

> Last Updated: 2025-09-03 Version: 1.0.0 Override Priority: Highest

**Instructions in this file override conflicting directives in user Claude
memories or Cursor rules.**

## 2025-09-03: Initial Product Planning

**ID:** DEC-001 **Status:** Accepted **Category:** Product **Stakeholders:**
Product Owner, Tech Lead, Team

### Decision

AEPLS will be a proactive quality enforcement system built as a monorepo package
that integrates with Claude Code through hooks. The system will focus on
achieving 80%+ automation of error fixes through intelligent classification,
implement a facade pattern for complete architectural decoupling, and include a
continuous learning system that generates prevention rules from patterns. The
initial target is JavaScript/TypeScript projects with planned expansion to other
languages.

### Context

Development teams waste 15-30% of their time fixing preventable errors, with 73%
experiencing the same errors repeatedly. Current tools are either too intrusive
(blocking everything) or too passive (just reporting). AI assistants like Claude
generate code with errors because they lack project context and don't learn from
corrections. This creates a need for an intelligent middle layer that can fix
what's safe, educate when needed, and learn continuously.

### Alternatives Considered

1. **Traditional Linter Integration**
   - Pros: Well-understood, existing ecosystem, IDE support
   - Cons: Tight coupling, limited intelligence, no learning capability,
     intrusive

2. **IDE Plugin Approach**
   - Pros: Real-time feedback, native UI, familiar to developers
   - Cons: Platform-specific, maintenance burden, limited to IDE users

3. **CI/CD Only Solution**
   - Pros: Centralized, consistent, no local setup
   - Cons: Too late in cycle, no learning opportunity, slower feedback

### Rationale

The hook-based facade pattern was chosen because it provides complete decoupling
while maintaining real-time intervention capability. The 80%+ automation target
balances productivity with safety. The learning system ensures the tool improves
over time rather than remaining static.

### Consequences

**Positive:**

- Reduced context switching for developers
- Consistent code quality across teams
- AI assistants produce better code over time
- Knowledge capture from every error

**Negative:**

- Initial setup complexity for hooks
- Potential for over-automation if not configured properly
- Requires local Node.js environment

## 2025-09-03: Architecture - Simple Facade Pattern

**ID:** DEC-002 **Status:** Revised **Category:** Technical **Stakeholders:**
Tech Lead, Senior Developers

### Decision

Implement a Simple Facade Pattern where each entry point (CLI, hook, pre-commit,
API) is a lightweight facade (~50 lines) calling into shared core logic. No
routers, no complex patterns - just simple conditional logic until proven
otherwise needed.

### Context

Direct integration between Claude and quality tools creates tight coupling,
making the system hard to maintain, test, and extend. We need an architecture
that can evolve independently while providing a stable interface.

### Alternatives Considered

1. **Direct Integration**
   - Pros: Simpler initial implementation
   - Cons: Tight coupling, hard to test, brittle

2. **Microservices**
   - Pros: Complete isolation, scalable
   - Cons: Complexity overhead, latency, deployment burden

### Rationale

The facade pattern provides the right balance of decoupling and simplicity. It
allows us to change the internal implementation without affecting Claude, makes
testing straightforward, and keeps latency low.

### Consequences

**Positive:**

- Clean separation of concerns
- Easy to test each layer independently
- Can swap implementations without affecting Claude
- Graceful degradation on errors

**Negative:**

- Additional abstraction layer
- Need to maintain facade interface contract

## 2025-09-03: Technology Stack Decisions

**ID:** DEC-003 **Status:** Accepted **Category:** Technical **Stakeholders:**
Tech Lead, DevOps, Team

### Decision

Use TypeScript with Node.js 20 LTS as the core platform, SQLite for local
pattern storage, pnpm workspaces for monorepo management, and Vitest for
testing. React will be used for any dashboard/UI components.

### Context

We need a stack that is familiar to JavaScript developers, has excellent
TypeScript support, and can run in the same environment as the code being
checked.

### Alternatives Considered

1. **Rust/WebAssembly**
   - Pros: Performance, memory safety
   - Cons: Learning curve, ecosystem maturity, debugging complexity

2. **Python with ML libraries**
   - Pros: Rich ML ecosystem, data science tools
   - Cons: Different runtime from JS/TS code, deployment complexity

### Rationale

Staying in the JavaScript/TypeScript ecosystem reduces cognitive overhead,
ensures compatibility with the code being analyzed, and leverages the team's
existing expertise.

### Consequences

**Positive:**

- Single language across stack
- Rich ecosystem of tools
- Easy AST manipulation for JS/TS
- Familiar to target users

**Negative:**

- Performance limitations vs compiled languages
- Memory usage for large codebases
- GC pauses in extreme cases

## 2025-09-04: YAGNI Package Cleanup

**ID:** DEC-004 **Status:** Accepted **Category:** Technical **Stakeholders:**
Tech Lead, Team

### Decision

Refactor quality-check package from ~1000 lines to ~440 lines by removing
over-engineered components (BlockWriter, EducationProvider, complex controllers)
and adopting a facade pattern that provides flexibility without complexity. Each
facade is ~50 lines serving different consumers (CLI, hook, pre-commit, API).

### Context

The current quality-check package has accumulated complexity that isn't being
used. Components like BlockWriter, StopController, and OutputController were
built for anticipated needs that haven't materialized. Meanwhile, we need to
support multiple consumption patterns efficiently.

### Alternatives Considered

1. **Keep Everything**
   - Pros: No refactoring needed, all features available
   - Cons: Maintenance burden, confusing codebase, slow to modify

2. **Complete Rewrite**
   - Pros: Clean slate, perfect architecture
   - Cons: Throws away working code, risky, time-consuming

### Rationale

The facade pattern provides the right balance - we keep the working core logic
while simplifying the entry points. Each facade is simple enough to understand
in minutes but together they provide flexibility for all use cases.

### Consequences

**Positive:**

- Reduced from ~1000 to ~440 lines
- Each facade independently maintainable
- Easy to add new consumption patterns
- Faster to understand and modify

**Negative:**

- Need to refactor existing code
- Some advanced features removed (can add back if needed)

## 2025-09-04: Simplified Integration Strategy

**ID:** DEC-005 **Status:** Accepted **Category:** Technical **Stakeholders:**
Tech Lead, Team

### Decision

Claude integration will be a thin wrapper (~50 lines) in ~/.claude/hooks/ that
calls into the refactored quality-check package. The package contains all
business logic, the hook just handles stdin/stdout and calls the appropriate
facade.

### Context

Originally planned complex integration with routers and dependency injection.
Realized this is over-engineering for a simple problem - read input, check
quality, return result.

### Alternatives Considered

1. **Monolithic Hook**
   - Pros: Everything in one file
   - Cons: Duplicates logic, hard to test, can't reuse

2. **Microservice**
   - Pros: Complete isolation, scalable
   - Cons: Complexity, latency, deployment overhead

### Rationale

Thin wrapper keeps integration simple while leveraging existing package. All
logic stays in the package where it can be tested and reused. The hook is just
glue code.

### Consequences

**Positive:**

- Hook is ~50 lines, easy to debug
- Reuses all existing quality-check logic
- Can test package independently
- Other tools can use same package

**Negative:**

- Requires quality-check package as dependency
- Two pieces to maintain (package + hook)
