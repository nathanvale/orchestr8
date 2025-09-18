---
created: 2025-09-18T07:32:12Z
last_updated: 2025-09-18T07:32:12Z
version: 1.0
author: Claude Code PM System
---

# Project Structure

## Directory Organization

```
bun-changesets-template/
├── .claude/               # Claude AI configuration and context
│   ├── agents/           # AI agent configurations
│   ├── commands/         # Custom commands for Claude
│   ├── context/          # Project context documentation
│   └── scripts/          # Utility scripts
├── .github/              # GitHub configuration
│   └── workflows/        # CI/CD pipelines
├── .husky/               # Git hooks configuration
├── apps/                 # Application packages (empty, template ready)
├── packages/             # Shared packages
│   ├── quality-check/    # ESLint, Prettier, TypeScript validation
│   ├── utils/            # Shared utility functions
│   └── voice-vault/      # TTS with intelligent caching
├── tests/                # Root-level tests
│   ├── *.integration.test.ts  # Integration tests
│   ├── *.smoke.test.ts        # Smoke tests
│   └── *.e2e.test.ts          # End-to-end tests
├── tooling/              # Build and development tooling
│   └── build/            # Build configuration
└── node_modules/         # Dependencies (pnpm managed)
```

## Key Files

### Root Configuration
- `package.json` - Root package configuration and scripts
- `pnpm-workspace.yaml` - Monorepo workspace configuration
- `turbo.json` - Turborepo build orchestration
- `tsconfig.json` - TypeScript root configuration
- `vitest.config.ts` - Test runner configuration
- `vitest.shared.js` - Shared test configuration
- `eslint.config.mjs` - ESLint configuration
- `prettier.config.mjs` - Prettier formatting rules
- `commitlint.config.js` - Commit message linting

### Documentation
- `README.md` - Project overview and quick start
- `STATUS.md` - Current project status
- `ENVIRONMENT_VARIABLES.md` - Environment configuration guide
- `.env.example` - Example environment variables

### Package Structure Pattern
Each package follows this structure:
```
packages/[package-name]/
├── src/              # Source code
│   ├── index.ts     # Main entry point
│   └── [modules]/   # Feature modules
├── dist/            # Built output (gitignored)
├── tests/           # Package-specific tests
├── README.md        # Package documentation
├── package.json     # Package configuration
└── tsconfig.json    # TypeScript config
```

## File Naming Conventions

### Source Files
- TypeScript files: `*.ts`, `*.tsx`
- React components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`
- Types: `*.types.ts`
- Constants: `*.constants.ts`

### Test Files
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`
- Smoke tests: `*.smoke.test.ts`
- Spec tests: `*.spec.ts`

### Configuration
- Config files: `*.config.{ts,js,mjs}`
- RC files: `.{tool}rc`
- Environment: `.env`, `.env.{environment}`

## Module Organization

### @template/utils
- Number utilities
- Path utilities
- Test utilities
- Common helpers

### @claude-hooks/quality-check
- ESLint validation
- Prettier formatting
- TypeScript checking
- Git integration
- CLI tools

### @claude-hooks/voice-vault
- TTS providers (OpenAI, ElevenLabs, System)
- Audio caching system
- Provider management
- Logging utilities

## Build Outputs
- TypeScript compilation: `dist/`
- Test coverage: `test-results/coverage/`
- Turborepo cache: `.turbo/`
- Vitest cache: `.vitest/`

## Special Directories
- `.git/` - Git repository data
- `.husky/` - Git hooks for quality control
- `.changeset/` - Version management
- `node_modules/` - pnpm managed dependencies
- `.pnpm/` - pnpm store (if local)