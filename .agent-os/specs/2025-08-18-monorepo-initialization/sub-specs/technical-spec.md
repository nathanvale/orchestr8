# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-18-monorepo-initialization/spec.md

> Created: 2025-08-18
> Version: 1.0.0

## Technical Requirements

### Monorepo Structure

- Use Turborepo 2.5+ for monorepo management
- Configure pnpm 10.10.0 workspaces with workspace protocol
- Pure ES modules throughout (`"type": "module"` in all package.json)
- Follow mnemosyne repository structure as gold standard reference

### Package Architecture

The 6 core packages with their dependencies:

- **@orchestr8/core** - Orchestration engine (depends on resilience, schema)
- **@orchestr8/resilience** - Retry, timeout, circuit breaker patterns (no deps)
- **@orchestr8/schema** - Workflow AST and Zod validation (no deps)
- **@orchestr8/agent-base** - Base agent classes (depends on core)
- **@orchestr8/testing** - Test harness and utilities (depends on agent-base)
- **@orchestr8/cli** - Developer command-line tool (depends on core)

### TypeScript Configuration

- TypeScript 5.8+ with strict mode enabled
- Project references for inter-package type checking
- Composite builds for incremental compilation
- Path mappings for clean imports

### Testing Infrastructure

- Vitest 3.2+ as test runner
- Wallaby.js configuration following mnemosyne patterns
- Coverage with v8 provider
- MSW 2.10+ for API mocking in testing package
- Test files colocated with source using `.test.ts` pattern

### Build Configuration

- Turborepo pipelines for dev, build, test, lint
- Cached builds with proper inputs/outputs
- TypeScript compilation with tsc
- ESLint 9.30+ with perfectionist plugin
- Prettier 3.6+ for formatting

## Approach Options

**Option A:** Copy exact structure from mnemosyne

- Pros: Proven working configuration, Wallaby.js guaranteed to work
- Cons: May include unnecessary complexity for MVP

**Option B:** Minimal structure inspired by mnemosyne (Selected)

- Pros: Clean start with only needed features, easier to understand
- Cons: Need to ensure Wallaby.js compatibility

**Rationale:** Start minimal but follow mnemosyne's patterns for critical configurations like Wallaby.js, Vitest, and Turborepo setup.

## External Dependencies

### Root Dependencies

- **turbo** - Monorepo build orchestration
- **prettier** - Code formatting
- **eslint** - Linting with TypeScript support
- **@vitest/ui** - Test UI for development
- **typescript** - TypeScript compiler

### Package Dependencies

- **zod** (schema package) - Runtime validation
- **commander** (cli package) - CLI framework
- **msw** (testing package) - API mocking

**Justification:** Minimal dependencies for MVP, all are industry standard and well-maintained.

## Reference Template

The `/Users/nathanvale/code/mnemosyne` repository serves as the gold standard for:

- Turborepo pipeline configuration
- Wallaby.js setup across packages
- Vitest configuration with proper coverage
- TypeScript project references
- ESLint and Prettier integration
- Package structure and naming conventions

Key files to reference from mnemosyne:

- `turbo.json` - Pipeline configuration
- `wallaby.js` - Wallaby.js monorepo setup
- `vitest.config.ts` - Vitest base configuration
- `tsconfig.json` - TypeScript project references
- `.eslintrc.json` - ESLint configuration
- Package structure in `packages/` directory
