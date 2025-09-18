# CLAUDE.md

> Think carefully and implement the most concise solution that changes as little
> code as possible.

## Project Overview

This is a monorepo template using pnpm, Changesets, and Turborepo with an
ADHD-optimized development workflow. It includes a sophisticated `quality-check`
package that implements a "fix-first" pipeline for code quality enforcement.

## Essential Commands

### Development

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Validate everything (lint + typecheck + build + test)
pnpm validate

# Clean build artifacts
pnpm clean
```

### Quality Check

```bash
# Check specific files
npx quality-check --file file1.ts
npx quality-check --file file2.ts

# Format specific files (auto-fix)
npx quality-check --file file1.ts --fix
npx quality-check --file file2.ts --fix

# Check staged files
npx quality-check --staged

# Check files changed since git ref
npx quality-check --since main
```

### PM Tooling (Project Management)

```bash
# Initialize PM system
/pm:init

# PRD Management
/pm:prd-new           # Create new PRD
/pm:prd-list          # List all PRDs
/pm:prd-parse         # Convert PRD to epic

# Epic Management
/pm:epic-list         # List all epics
/pm:epic-show         # Show epic details
/pm:epic-decompose    # Break epic into tasks
/pm:epic-start        # Start working on epic

# Task Management
/pm:in-progress       # Show in-progress tasks
/pm:blocked          # Show blocked tasks
/pm:standup          # Daily standup summary
```

## Architecture

### Monorepo Structure

```
packages/
├── quality-check/    # Code quality enforcement with fix-first pipeline
├── utils/           # Shared utilities
└── [your packages]  # Add your packages here
```

### Quality-Check Package

The quality-check package implements a sophisticated code quality pipeline:

1. **Fix-First Pipeline**: Automatically fixes issues before reporting failures
2. **Autopilot Classification**: Smart file type detection for appropriate
   processing
3. **Integrated Tools**: ESLint, Prettier, TypeScript all in one pipeline
4. **Environment-Aware**: Different configurations for CI, Wallaby, and local
   development

Key components:

- `src/pipeline/` - Core pipeline implementation
- `src/quality-checker/` - Main orchestration layer
- `src/config/` - Environment detection and configuration
- `src/formatters/` - ESLint and Prettier integration

## Testing Philosophy

- **Always use the test-runner agent** to execute tests
- **No mock services** - use real implementations
- **Do not move on to the next test until the current test is complete**
- **If test fails, check if test is structured correctly before refactoring
  codebase**
- **Verbose test output** for debugging
- **Test coverage**: Currently at 72% (target: 80%+)
- **Environment-aware timeouts**: Automatically adjusts for CI/Wallaby/local

## USE SUB-AGENTS FOR CONTEXT OPTIMIZATION

### 1. Always use the file-analyzer sub-agent when asked to read files

The file-analyzer agent is an expert in extracting and summarizing critical
information from files, particularly log files and verbose outputs.

### 2. Always use the code-analyzer sub-agent when asked to search code, analyze code, research bugs, or trace logic flow

The code-analyzer agent is an expert in code analysis, logic tracing, and
vulnerability detection.

### 3. Always use the test-runner sub-agent to run tests and analyze the test results

Using the test-runner agent ensures:

- Full test output is captured for debugging
- Main conversation stays clean and focused
- Context usage is optimized
- All issues are properly surfaced
- No approval dialogs interrupt the workflow

## Git Workflow

### Pre-commit Hook

The repository uses husky and lint-staged for pre-commit checks:

- Automatically runs quality-check on staged files
- Auto-fixes and re-stages formatted files
- Prevents commits with linting/formatting issues

To bypass if needed: `HUSKY=0 git commit -m "your message"`

### Commit Messages

Follow conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring

## ABSOLUTE RULES

- **NO PARTIAL IMPLEMENTATION** - Complete every feature fully
- **NO SIMPLIFICATION** - No placeholder code or "//This is simplified stuff for
  now, complete implementation would blablabla"
- **NO CODE DUPLICATION** - Check existing codebase to reuse functions and
  constants. Read files before writing new functions. Use common sense function
  name to find them easily
- **NO DEAD CODE** - Either use it or delete it completely
- **IMPLEMENT TEST FOR EVERY FUNCTION** - No exceptions
- **NO CHEATER TESTS** - Test must be accurate, reflect real usage and be
  designed to reveal flaws. No useless tests! Design tests to be verbose so we
  can use them for debugging
- **NO INCONSISTENT NAMING** - Read existing codebase naming patterns
- **NO OVER-ENGINEERING** - Don't add unnecessary abstractions, factory
  patterns, or middleware when simple functions would work. Don't think
  "enterprise" when you need "working"
- **NO MIXED CONCERNS** - Don't put validation logic inside API handlers,
  database queries inside UI components, etc. instead of proper separation
- **NO RESOURCE LEAKS** - Don't forget to close database connections, clear
  timeouts, remove event listeners, or clean up file handles

## Error Handling Philosophy

- **Fail fast** for critical configuration (missing text model)
- **Log and continue** for optional features (extraction model)
- **Graceful degradation** when external services unavailable
- **User-friendly messages** through resilience layer

## Performance Considerations

### Memory Management

- Memory limits configured per test type (unit: 500MB, integration: 750MB)
- Environment-aware memory monitoring
- CI gets +25% buffer for memory limits

### Test Timeouts

- Unit tests: 5s (10s in CI)
- Integration tests: 15s (22.5s in CI)
- Disposal tests: 20s (25s in CI)

## Known Issues & Workarounds

1. **TypeScript strict mode**: Some legacy code may need `@ts-ignore` during
   migration
2. **Wallaby integration**: Use `WALLABY_WORKER` env var for detection
3. **CI memory**: Set `NODE_OPTIONS='--max-old-space-size=4096'` for
   memory-intensive tests

## Tone and Behavior

- **Criticism is welcome** - Tell me when I am wrong or mistaken, or even when
  you think I might be
- **Point out better approaches** - Tell me if there is a better approach than
  the one I am taking
- **Mention relevant standards** - Tell me if there is a relevant standard or
  convention that I appear to be unaware of
- **Be skeptical**
- **Be concise** - Short summaries are OK, but don't give an extended breakdown
  unless working through plan details
- **No flattery** - Do not flatter, and do not give compliments unless I am
  specifically asking for your judgement
- **Occasional pleasantries are fine**
- **Ask questions** - Feel free to ask many questions. If you are in doubt of my
  intent, don't guess. Ask

## Important Reminders

- **Do what has been asked; nothing more, nothing less**
- **NEVER create files unless absolutely necessary**
- **ALWAYS prefer editing existing files to creating new ones**
- **NEVER proactively create documentation files unless explicitly requested**
