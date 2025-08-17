# @orchestr8

Agent orchestration system with CLI tooling, resilience patterns, and execution observability.

## Overview

@orchestr8 is a TypeScript-based agent orchestration platform that provides:

- **Core Orchestration Engine** - Sequential and parallel workflow execution
- **Resilience Patterns** - Retry, timeout, and circuit breaker
- **CLI Developer Tools** - Scaffold, create, run, and test agents
- **Execution Observability** - Journal capture and REST API monitoring

## Project Structure

```
packages/
├── core/           # Orchestration engine
├── resilience/     # Retry, timeout, circuit breaker patterns
├── agent-base/     # Base classes and contracts
├── testing/        # Test harness with MSW
├── schema/         # Workflow AST + Zod validation
└── cli/            # Developer CLI tool
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## Development

This is a Turborepo monorepo using:

- **pnpm** - Package management
- **TypeScript** - Strict mode throughout
- **Vitest** - Testing framework
- **Turbo** - Build orchestration
- **Zod** - Runtime validation

## Status

🚧 **MVP Development** - Week 1 of 4-week sprint

Current focus: Core orchestration engine and resilience patterns.
