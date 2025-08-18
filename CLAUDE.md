# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash

pnpm check # **Most important** - Quality check (format, lint, type-check, test)

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

### 🚫 TypeScript `any` Type - ABSOLUTELY FORBIDDEN

**CRITICAL: The use of `any` type is STRICTLY PROHIBITED under ALL circumstances**

This codebase maintains a **ZERO TOLERANCE** policy for TypeScript `any` types:

- **NO EXCEPTIONS**: Never use `any`, not even temporarily
- **NO WORKAROUNDS**: Don't use `as any`, `<any>`, or `unknown` as a bypass
- **NO JUSTIFICATIONS**: There is always a better type-safe solution
- **ENFORCED BY**: ESLint rule `@typescript-eslint/no-explicit-any: 'error'`
- **ALTERNATIVES REQUIRED**: Use proper types, generics, or `unknown` with type guards

**Why this matters:**
- Type safety is non-negotiable for enterprise-grade reliability
- `any` defeats the entire purpose of using TypeScript
- Runtime errors from `any` usage are unacceptable in production

**If you encounter a scenario where `any` seems necessary:**
1. STOP - There's always a type-safe alternative
2. Use proper generic types or interfaces
3. Use `unknown` with proper type guards if type is truly unknown
4. Define specific types for third-party libraries if needed

**Enforcement:**
- ESLint will error on any `any` usage
- CI/CD pipeline will fail on `any` detection
- Code reviews will reject PRs containing `any`

### Testing Strategy

### 🧪 Testing Workflow - MANDATORY WALLABY.JS FIRST

**Protocol (NEVER deviate):**

- **ALWAYS** try Wallaby first: `mcp__wallaby__wallaby_failingTests`
- **5-second timeout** - If no response, Wallaby is OFF
- **Alert immediately**: "Wallaby.js is not running. Please start it in VS Code"
- **NEVER skip to Vitest** - Always give user chance to start Wallaby
- **Framework**: Vitest with v8 coverage
- **Wallaby.js**: Configured for inline test feedback (wallaby.cjs)
- **MSW**: Mock Service Worker for API mocking in tests
- **Test Environment**: Always runs with `NODE_ENV=test`

### Code Style

- **TypeScript `any` FORBIDDEN**: Zero tolerance - no `any` types ever
- **ESLint**: With perfectionist plugin for import/export sorting
- **Prettier**: For consistent formatting
- **Import Order**: Enforced alphabetically within groups (type, builtin,
  external, internal)

### 📚 Extended Documentation

- **Complete commands**: @docs/commands-reference.md
- **Testing workflows**: @docs/testing-guide.md
- **Build troubleshooting**: @docs/turborepo-guide.md
- **ES modules guide**: @docs/esm-extensions-guide.md

### 🎯 Prompt Engineering & Agent Development

- **Enterprise Prompt Guide**: @docs/enterprise-prompt-engineering-guide.md - XML-structured patterns for agents
- **Quick Reference**: @docs/xml-prompt-quick-reference.md - Rapid lookup for XML patterns
- **Agent Examples**: @.claude/agents/ - Production-ready agent configurations

**Key Pattern**: Use XML-structured prompts for enterprise-grade reliability:

```xml
<ai_meta><parsing_rules>...</parsing_rules></ai_meta>
<constraints><forbidden_tools>...</forbidden_tools></constraints>
<process_flow><step>...</step></process_flow>
```

## 🏗️ Architecture (Core Context)

> **Cache Directive**: Architectural decisions - stable content
> Cache Control: `{"type": "ephemeral", "ttl": "1h"}`

### ⚠️ ES Modules Architecture (CRITICAL)

**🔴 This is a PURE ES modules monorepo** - all packages use `"type": "module"`

**Non-negotiable rules:**

- **Root enforces**: `"type": "module"` in all package.json files
- **Import syntax**: ONLY `import`/`export` - NO `require()` or `module.exports`
- **File extensions**: `.mjs` for configs, `.ts`/`.tsx` for source
- **Module resolution**: `"moduleResolution": "bundler"` strategy
- **Troubleshooting**: See @docs/development-guide.md for ES modules patterns

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

- **NO `any` TYPES**: Absolute prohibition - TypeScript `any` is never acceptable
- **Memory Safety**: 10MB journal limit, 1000 event queue limit, auto-truncation
- **Local Only**: Binds to 127.0.0.1:8088 (no external access in MVP)
- **Test Coverage Target**: >80% for core packages
- **Performance**: <100ms orchestration overhead (p95)

- ALWAYS follow best practive of using .js extensions for all TypeScript imports
- /clear