# CLAUDE.md

This file provides essential guidance for working with the @orchestr8 TypeScript monorepo - a sophisticated agent orchestration platform.

## Essential Commands

**Quality Gate (MANDATORY before commits):**
- `pnpm check` - Complete validation (format, lint, type-check, test 486+ tests)

**Development Loop:**
- `pnpm format` - Fix formatting issues
- `pnpm test` - Run all tests (Wallaby preferred)
- `pnpm build` - Build all 7 packages with Turbo caching

**Package-Specific Work:**
- `cd packages/core && pnpm test` - Test specific package
- `cd packages/core && pnpm test src/event-bus.test.ts` - Single test file
- `pnpm dev` - Watch mode for all packages

**Examples (Ready to Use):**
- `pnpm example:pr-auto-fix` - GitHub PR automation
- `pnpm example:multi-llm` - Multi-LLM orchestration
- `pnpm example:core:quick-start` - Core package demo

## Critical Rules (Zero Tolerance)

- **TypeScript `any` FORBIDDEN**: Use proper types or `unknown` with type guards
- **ES Modules**: ALWAYS use `.js` extensions in TypeScript imports
- **Pre-commit**: `pnpm check` MUST pass before any commit
- **Testing**: Wallaby.js first, Vitest fallback (never skip Wallaby check)
- **File Creation**: Prefer editing existing files over creating new ones
- **Quality Standards**: 0 lint errors, all tests passing, strict TypeScript

## Development Workflow

**Quick Start Loop:**
1. **Setup**: `pnpm install && pnpm check` (must pass)
2. **Code**: Make changes in `packages/*/src/`
3. **Test**: Use Wallaby.js or `pnpm test` 
4. **Validate**: `pnpm format && pnpm check`
5. **Commit**: Only when `pnpm check` passes

## Architecture Context

**Package Hierarchy:**
```
schema (foundation) → logger → core → cli
                    ↘ resilience ↗
                    ↘ agent-base ↗
```

**Key Decisions:**
- **Pure ES Modules**: `"type": "module"` in all packages
- **Dual Package Consumption**: Development/production exports
- **Zero `any` Types**: Absolute prohibition enforced by ESLint
- **Memory-Bounded**: 10MB journal limit, 1000 event queue limit
- **Resilience**: `retry(circuitBreaker(timeout(operation)))` composition

**Current Status**: Phase 1 MVP ~80% complete (486+ tests passing)

## Testing Protocol

**Wallaby.js First (MANDATORY):**
1. Try `mcp__wallaby__wallaby_failingTests` (5-second timeout)
2. If no response: "Wallaby.js not running - start in VS Code"
3. **Never skip to Vitest** without giving user chance to start Wallaby

**Fallback Commands (When Wallaby Unavailable):**
- `pnpm test` - All 486+ tests
- `cd packages/core && pnpm test` - Package-specific
- `NODE_ENV=test pnpm test src/specific.test.ts` - Single file

**Environment**: `NODE_ENV=test` (auto-configured)

## Package Status

| Package | Status | Tests | Key Purpose |
|---------|--------|-------|-------------|
| `@orchestr8/schema` | ✅ Complete | 204 | Zod validation, JSON schemas |
| `@orchestr8/logger` | ✅ Complete | 126 | Structured logging, correlation IDs |
| `@orchestr8/resilience` | ✅ Complete | 155 | Retry, circuit breaker, timeout |
| `@orchestr8/core` | ✅ Complete | 100+ | Orchestration engine, event bus |
| `@orchestr8/cli` | 🚧 Scaffolded | 1 | Commands need implementation |
| `@orchestr8/agent-base` | 🚧 Basic | 1 | Agent foundation classes |
| `@orchestr8/testing` | 🚧 Utilities | 100+ | Test helpers and fixtures |

## Current Development State

**Phase 1 MVP Progress**: 80% Complete ✅

**Ready for Production:**
- Core orchestration with resilience patterns
- Event bus with bounded queues (1000 events max)
- JSON workflow validation with Zod (204 tests)
- Structured logging with correlation IDs (126 tests)
- Memory-bounded execution journal (10MB limit)

**To Complete Phase 1:**
- CLI command implementation (`packages/cli/src/commands/`)
- Built-in agents package (`packages/agents/`)
- JSON workflow examples (`examples/` directory)

**Next Priority**: Implement CLI commands (`init`, `create:agent`, `run`, `test`, `inspect`)

## Agent OS Integration

**Use structured development workflow:**
- `@~/.agent-os/instructions/create-spec.md` - Plan new features
- `@~/.agent-os/instructions/execute-tasks.md` - Implement tasks
- Check `.agent-os/product/roadmap.md` for current priorities

## Common Issues (Quick Fixes)

**ES Module Errors**: Ensure `.js` extensions in TypeScript imports
```typescript
import { EventBus } from './event-bus.js'  // ✅ Correct
import { EventBus } from './event-bus.ts'  // ❌ Wrong
```

**Build Failures**: `pnpm type-check` to verify TypeScript project references
**Test Issues**: Start Wallaby.js in VS Code, fallback to `pnpm test`
**Memory Warnings**: Automatic journal truncation at 10MB (expected behavior)

---

## Summary

**Architecture**: Enterprise TypeScript monorepo with 486+ tests, pure ES modules, zero `any` types  
**Status**: Phase 1 MVP nearly complete - solid foundation ready for CLI completion  
**Workflow**: `pnpm check` before commits, Wallaby.js first, specific over general