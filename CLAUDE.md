# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (uses pnpm)
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test          # Watch mode
pnpm test:ci       # Single run (CI mode)

# Run a single test file
cd packages/<package-name>
pnpm test src/specific.test.ts

# Linting and formatting
pnpm lint          # Lint all packages
pnpm format        # Format all files
pnpm format:check  # Check formatting without changes

# Type checking
pnpm type-check    # Check TypeScript types

# Clean builds
pnpm clean         # Clean build artifacts
pnpm fresh         # Full reinstall (clean + install)

# Development
pnpm dev           # Watch mode for all packages

# Validate package export conditions
pnpm validate:dual-consumption
```

## Architecture Overview

This is a **TypeScript monorepo** using pnpm workspaces and Turborepo for build orchestration. The architecture follows a modular package design for the @orchestr8 agent orchestration platform.

### Package Dependencies
```
schema (no deps)
    ↓
resilience → schema
    ↓
agent-base → schema
    ↓
core → resilience, schema, agent-base
    ↓
testing → core, agent-base, schema
    ↓
cli → all packages
```

### Key Architectural Decisions

1. **Pure ES Modules**: All packages use `"type": "module"` with ES module syntax
2. **Dual Package Consumption**: Packages export both development (TypeScript) and production (compiled) versions via conditional exports
3. **TypeScript Project References**: Using composite projects for fast incremental builds
4. **Strict TypeScript**: All packages use strict mode with `noUncheckedIndexedAccess`

### Testing Strategy

- **Framework**: Vitest with v8 coverage
- **Wallaby.js**: Configured for inline test feedback (wallaby.cjs)
- **MSW**: Mock Service Worker for API mocking in tests
- **Test Environment**: Always runs with `NODE_ENV=test`

### Code Style

- **ESLint**: With perfectionist plugin for import/export sorting
- **Prettier**: For consistent formatting
- **Import Order**: Enforced alphabetically within groups (type, builtin, external, internal)

## Agent OS Integration

This project uses Agent OS for structured development. Key files:

- **Product Documentation**: `.agent-os/product/` contains mission, roadmap, tech stack, and decisions
- **Development Standards**: References global standards in `~/.agent-os/standards/`
- **Specs**: Feature specifications in `.agent-os/specs/`

When implementing features:
1. Check `.agent-os/product/roadmap.md` for current priorities
2. Use `@~/.agent-os/instructions/create-spec.md` for new features
3. Use `@~/.agent-os/instructions/execute-tasks.md` for task execution

## Current Development Focus

**Phase 1 MVP (Week 1 of 4)**: Building core orchestration engine with resilience patterns
- Core orchestration with sequential/parallel execution
- Resilience patterns (retry, timeout, circuit breaker)
- Workflow AST with Zod validation
- In-process event bus
- Execution context with cancellation

## Package-Specific Notes

### @orchestr8/schema
- Workflow AST definitions with Zod validation
- Foundation package with no dependencies
- Exports should maintain development condition first

### @orchestr8/resilience
- Implements retry (with exponential backoff + jitter), timeout, and circuit breaker patterns
- Composition order: `retry(circuitBreaker(timeout(operation)))`

### @orchestr8/core
- Main orchestration engine
- Handles sequential and parallel workflow execution
- Memory-bounded execution journal (10MB limit per execution)

### @orchestr8/cli
- Developer command-line tool
- Commands: init, create, run, test, inspect
- Scaffolding and workflow execution

## Important Constraints

- **Memory Safety**: 10MB journal limit, 1000 event queue limit, auto-truncation
- **Local Only**: Binds to 127.0.0.1:8088 (no external access in MVP)
- **Test Coverage Target**: >80% for core packages
- **Performance**: <100ms orchestration overhead (p95)