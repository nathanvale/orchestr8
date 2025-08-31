# Product Mission

> Last Updated: 2025-08-29 Version: 4.0.0

## Pitch

Production-ready Node.js + pnpm monorepo template with Next.js, Turborepo, and
unified build system—eliminating cognitive dissonance through standardization,
flow acceleration, and ADHD-optimized developer experience.

**Built for focus and flow:** Single mental model, sub-5s feedback loops,
zero-config scaffolding, and "status at a glance" dashboards that restore
context instantly after interruptions.

## Users

### Primary Customers

- **Enterprise Teams**: Teams requiring stable, proven tooling with extensive
  ecosystem support
- **Next.js Developers**: Developers building modern web applications with React
- **Monorepo Teams**: Teams managing multiple packages with shared dependencies
- **ADHD & Neurodiverse Developers**: Engineers who need a frictionless,
  supportive workflow with minimal decision fatigue

### User Personas

**Enterprise Developer** (25–45 years old)

- **Role:** Senior Engineer, Tech Lead
- **Context:** Building scalable applications with proven patterns
- **Pain Points:** Tooling instability, ecosystem fragmentation, migration
  complexity
- **Goals:** Stable development environment, predictable builds, enterprise
  support

**ADHD-Friendly Developer** (20–40 years old)

- **Role:** Full Stack Engineer, Indie Hacker, Team Contributor
- **Context:** Easily distracted by tooling friction, thrives with instant
  feedback and clear workflows
- **Pain Points:** Overwhelm from configuration, slow or inconsistent feedback,
  tool fatigue
- **Goals:** Single mental model, real-time feedback, minimal configuration,
  defaults that “just work”

## The Problem

### Ecosystem Fragmentation

Teams struggle with incompatible tooling combinations, unstable new runtimes,
and constant migration between build systems. The JavaScript ecosystem changes
too rapidly.

**Our Solution:** Proven Node.js runtime with pnpm workspaces, stable for years
with extensive ecosystem support. ADHD developers can rely on it without
worrying about sudden tool churn.

### Inconsistent Package Builds

Each package in a monorepo often has different build configurations, making
maintenance and debugging difficult across teams.

**Our Solution:** Standardized tsup builds with consistent TypeScript
compilation across all packages, reducing cognitive overhead.

### Complex Next.js Integration

Setting up Next.js in a monorepo with proper package imports and type safety
requires extensive configuration and trial-and-error.

**Our Solution:** Pre-configured Next.js app with working internal package
imports and full TypeScript support, so you don’t waste time debugging wiring.

### ADHD Workflow Gaps

Traditional templates assume infinite focus and context-switch capacity.
Developers with ADHD often lose flow if feedback is delayed, tooling is noisy,
or setup requires too many micro-decisions.

**Our Solution:** Sub-5s test feedback, unified Vitest multi-project config,
single "dx:status" command for instant context recovery, zero-config package
scaffolding, and flow accelerators that eliminate blank-page paralysis.

## Differentiators

### Proven Stability

Built on Node.js and pnpm—stable tools with millions of production deployments,
not experimental runtimes.

### Standardized Builds

Every package uses the same tsup + TypeScript build pipeline, easy to understand
and maintain across teams.

### Next.js Ready

Includes a working Next.js application out of the box with App Router, React
Server Components, and internal package imports configured.

### ADHD-Optimized Developer Experience

- **Instant Context Recovery:** Single "dx:status" command shows everything
  (pending changesets, coverage, outdated deps)
- **Flow Accelerators:** Zero-config package scaffolding, project generators,
  onboarding scripts
- **Unified Mental Model:** Consistent tsup builds, single Vitest config, no
  runtime confusion
- **Visual Feedback:** Wallaby.js integration, colored validation output, health
  dashboards

## Key Features

### Core Structure

- **packages/utils:** Shared utilities with standardized tsup builds
- **apps/web:** Next.js application with App Router and React Server Components
- **apps/server:** Node.js API server (optional Express/Fastify)

### Developer Experience

- **pnpm Workspaces:** Fast, efficient dependency management with workspace
  protocol
- **Turborepo Orchestration:** Remote caching, >85% hit rates, pruned Docker
  builds
- **Unified Testing:** Vitest multi-project config with coverage ratcheting
- **Standardized Builds:** Shared tsup base configuration, consistent export
  maps
- **Flow State Tools:** Status commands, scaffolders, profiling hooks,
  onboarding scripts

### Production Ready

- **TypeScript:** Strict types with proper export maps
- **Testing:** Vitest with jsdom/happy-dom environment and coverage reporting
- **Next.js:** Production-optimized with ISR and edge runtime support
- **CI/CD:** GitHub Actions with pnpm caching and Vitest in pipelines
- **Security:** Linting, type checks, and dependency audit baked in

## Non-Goals

- **Not exploring experimental runtimes:** Stability over cutting-edge
  performance
- **Not a micro-frontend architecture:** Focus on traditional monorepo patterns
- **Not a full-stack framework:** Flexibility to choose your backend approach
- **Not config-heavy:** Defaults first, options later—prevent decision fatigue

---
