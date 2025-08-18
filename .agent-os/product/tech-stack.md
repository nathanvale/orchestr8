# Technical Stack

> Last Updated: 2025-08-17
> Version: 1.0.0

## Core Technology

### Application Framework

- **Language:** TypeScript 5.8+
- **Runtime:** Node.js 22 LTS
- **Package Manager:** pnpm 10.10.0
- **Monorepo Tool:** Turborepo 2.5+

### Build & Development

- **Build Tool:** TypeScript Compiler (tsc)
- **Development:** tsx for TypeScript execution
- **Module System:** ES Modules (type: "module")
- **Workspace Protocol:** pnpm workspaces

## Testing Stack

### Test Framework

- **Runner:** Vitest 3.2+
- **Coverage:** v8 provider (native Node.js)
- **Mocking:** MSW 2.10+ for API mocking
- **Assertions:** Vitest built-in matchers

## Core Libraries

### CLI Development

- **Framework:** Commander.js 14.0+
- **Validation:** Zod 3.25+ for schema validation

### API Development

- **Framework:** Express 4.18+ (MVP)
- **WebSocket:** ws library for real-time updates
- **HTTP Client:** Native fetch API

### Observability

- **Tracing:** OpenTelemetry SDK
- **Logging:** Structured JSON logging
- **Metrics:** OpenTelemetry metrics API

## Infrastructure

### Application Hosting

- **Platform:** Local development (MVP)
- **Port:** 8088 ("8r8" mnemonic)
- **Binding:** 127.0.0.1 only (security)

### Database

- **Storage:** In-memory (MVP)
- **Persistence:** JSON files for configuration
- **Journal:** File-based execution logs

### Asset Storage

- **Configuration:** Local filesystem
- **Logs:** Local JSON files
- **Journal:** Memory-bounded with auto-truncation

## Code Quality

### Linting & Formatting

- **Linter:** ESLint 9.30+
- **Formatter:** Prettier 3.6+
- **Style:** ESLint perfectionist plugin
- **Type Checking:** TypeScript strict mode

### CI/CD

- **Pipeline:** GitHub Actions (planned)
- **Coverage:** Codecov v4 integration
- **Deployment:** npm publish (manual MVP)

## Package Architecture

### Core Packages

- **@orchestr8/core:** Orchestration engine
- **@orchestr8/resilience:** Retry, timeout, circuit breaker
- **@orchestr8/schema:** Workflow AST and validation
- **@orchestr8/agent-base:** Base agent classes
- **@orchestr8/testing:** Test harness and utilities
- **@orchestr8/cli:** Developer command-line tool

## Future Stack (Post-MVP)

### Dashboard (Phase 3)

- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Charts:** Recharts

### LLM Providers (Phase 5)

- **Claude:** Anthropic API
- **OpenAI:** GPT-4 API
- **Local:** Ollama integration
- **Abstraction:** Provider-agnostic interface

### Distribution (Phase 2)

- **Registry:** npm public packages
- **Versioning:** Semantic versioning
- **Publishing:** Automated via changesets
