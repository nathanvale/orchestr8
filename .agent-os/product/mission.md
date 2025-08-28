# Product Mission

> Last Updated: 2025-08-28 Version: 2.0.0

## Pitch

ADHD-optimized Bun + TypeScript monorepo with three focused packages (utils,
app, server)—instant feedback, minimal complexity, production-ready from day
one.

## Users

### Primary Customers

- **ADHD Developers**: Developers who need fast feedback loops and minimal
  cognitive overhead
- **Small Teams**: Teams who want a simple, working monorepo without complexity
- **Learning Developers**: Those learning monorepo patterns who need clear
  examples

### User Personas

**ADHD Developer** (Any age)

- **Role:** Any development role
- **Context:** Needs instant feedback and clear structure to maintain focus
- **Pain Points:** Complex setups, slow feedback, too many decisions
- **Goals:** Get coding fast, see results immediately, minimal configuration

## The Problem

### Overcomplicated Monorepo Templates

Most monorepo templates are overwhelming with dozens of packages, complex
dependency graphs, and enterprise features that small teams don't need. The
"promotion" pattern adds unnecessary complexity.

**Our Solution:** Start with a working monorepo of just 3 packages that does one
thing well.

### Slow Feedback Loops Break Focus

Developers with ADHD lose focus when builds take >100ms or tests take seconds to
start. Traditional Node.js tools are too slow.

**Our Solution:** Bun-powered instant feedback with <50ms hot reload and
immediate test runs.

### Too Many Decisions

Setting up a monorepo requires hundreds of decisions about structure, tooling,
and configuration. This paralysis prevents starting.

**Our Solution:** Opinionated, working setup with utils, app (Vitest), and
server (Bun) packages pre-configured.

## Differentiators

### Simplicity First

Just three packages that work together. No promotion scripts, no complex
migrations, no decision fatigue.

### ADHD-Optimized

Every design decision prioritizes instant feedback and reduced cognitive load.
If it takes more than 50ms, we fix it.

### Actually Works

Not a "starter" that needs setup - it's a working monorepo with a server serving
an API, tests using MSW, and shared utilities.

## Key Features

### Core Structure

- **packages/utils:** Shared utilities used by both app and server
- **apps/app:** Vitest testing app with MSW for API mocking
- **apps/server:** Bun server providing simple API service

### Developer Experience

- **Instant Feedback:** <50ms for all operations
- **Single Command:** `bun dev` starts everything
- **Clear Structure:** Obvious where code belongs
- **Working Examples:** See patterns in action, not documentation

### Production Ready

- **TypeScript:** Strict types across all packages
- **Testing:** Vitest + MSW configured and working
- **Linting:** ESLint pre-configured for monorepo
- **CI/CD:** GitHub Actions ready to go

## Non-Goals

- **Not trying to scale to 100 packages:** This is for small teams
- **Not a promotion/migration tool:** Start as monorepo, stay as monorepo
- **Not enterprise-focused:** Simplicity over compliance features
