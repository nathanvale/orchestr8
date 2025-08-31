# Spec Requirements Document

> Spec: Claude Code AI Hooks System (MVP) Created: 2025-08-30 Status: Planning

## Overview

Implement a lean, fast AI-friendly Claude Code hooks system consisting of a
standalone npm package `@claude-hooks/snapcheck` that provides instant ESLint
and Prettier validation feedback with token-efficient JSON output for any
repository using Claude Code.

**MVP Focus:** ESLint + Prettier validation only, with explicit configuration
and <2s performance targets for optimal ADHD developer experience.

## User Stories

### AI-Optimized Development Workflow

As an **AI Agent** (Claude), I want to receive structured, token-efficient
validation feedback after code edits, so that I can provide precise, actionable
guidance without processing verbose tool output.

**Detailed Workflow:**

1. User asks Claude to edit a file using Write/Edit tool
2. Claude Code executes the tool change
3. PostToolUse hook triggers `snapcheck` validation
4. Package runs ESLint and Prettier checks on changed file only
5. Results are formatted into compact JSON schema optimized for AI consumption
6. If issues found, Claude receives structured feedback with:
   - Token-efficient issue summaries (`{f, l, c, r, s, m}` format)
   - ESLint errors and warnings with rule names
   - Prettier formatting suggestions
   - Auto-fix availability indicators
7. Claude can immediately address issues with precise understanding

### Universal Repository Integration

As a **Developer**, I want to add AI-friendly validation to any repository with
minimal setup, so that I can benefit from structured feedback across all my
projects without complex configuration.

**Detailed Workflow:**

1. Developer runs `npm install --save-dev @claude-hooks/snapcheck`
2. Developer runs `npx snapcheck init` to auto-generate `.claude/settings.json`
3. Package uses explicit user-provided commands for ESLint and Prettier
4. Hook system begins working immediately with Claude Code
5. Validation completes in <2s for instant feedback
6. System works consistently across monorepos, single packages, and different
   tech stacks

### ADHD-Optimized Development Experience

As an **ADHD Developer**, I want instant, focused validation feedback that
doesn't overwhelm me with information, so that I can maintain flow state and
quickly address only the most important issues.

**Detailed Workflow:**

1. Developer makes code changes through Claude Code
2. Validation happens in <2s with ADHD performance targets
3. Results show only actionable ESLint errors and Prettier formatting issues
4. Quick-fix suggestions are prominently displayed
5. No cognitive overhead from complex tool detection or configuration
6. Immediate feedback preserves flow state

### Future Enhancement Capabilities (Post-MVP)

As a **Team Lead**, I want to evolve the system with additional capabilities as
the team grows, so that I can expand validation coverage and add analytics
without disrupting the existing workflow.

**Future Roadmap:**

1. **Phase 2**: Add TypeScript validation with optional auto-detection
2. **Phase 3**: Introduce baseline tracking for delta-only reporting
3. **Phase 4**: Add Vitest integration for test-driven validation
4. **Phase 5**: Optional observability server for team analytics

## Spec Scope

1. **Core npm Package (`@claude-hooks/snapcheck`)** - Standalone package
   providing hook handlers, formatters, and CLI tools for any repository

2. **Universal Tool Integration** - Support for ESLint, Prettier, TypeScript,
   Vitest with auto-detection and standardized AI-friendly output formatting

3. **Claude Code API Integration** - Complete compliance with PostToolUse,
   PreToolUse, SessionStart hook protocols including proper JSON response
   handling

4. **Token-Optimized JSON Schema** - Compact, structured data format designed
   for efficient LLM consumption with >60% size reduction vs. raw tool output

5. **Repository Auto-Setup** - Single command initialization that detects tools,
   generates configuration, and provides immediate functionality

6. **ADHD Performance Optimization** - <5s validation feedback, baseline
   tracking, focus mode, and integration with existing dx:status workflow

7. **Optional Observability Server** - Lightweight analytics server for tracking
   validation trends, code quality metrics, and developer productivity insights

8. **Comprehensive Documentation** - Extensive code examples, integration
   guides, API reference, and troubleshooting documentation

## Out of Scope

- Direct integration with other IDE systems beyond Claude Code
- Built-in code formatting/fixing capabilities (focused on validation and
  reporting)
- Custom rule creation interfaces (uses existing tool configurations)
- Real-time collaboration features or multi-developer synchronization
- Integration with external project management or issue tracking systems

## Expected Deliverable

1. **Published npm package `@claude-hooks/snapcheck`** - Installable via
   npm/pnpm/yarn with comprehensive CLI and programmatic API

2. **Universal repository compatibility** - Works in monorepos, single packages,
   Next.js apps, Node.js services with zero configuration

3. **Claude Code integration** - Hooks properly integrate with Claude Code's
   API, providing structured feedback that improves AI assistance quality

4. **Performance benchmarks met** - Validation completes in <5s, JSON output
   is >60% smaller than raw tool output, baseline tracking works reliably

5. **Comprehensive documentation** - Installation guides, code examples, API
   reference, troubleshooting guides, and best practices documentation

6. **Optional observability server** - Deployable analytics server for teams
   wanting long-term insights into code quality and developer productivity

## Spec Documentation

- **Tasks:** @.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/tasks.md
- **Technical Specification:**
  @.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/sub-specs/technical-spec.md
- **API Specification:**
  @.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/sub-specs/api-spec.md
- **Tests Specification:**
  @.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/sub-specs/tests.md
- **Documentation Plan:**
  @.agent-os/specs/2025-08-30-claude-code-ai-hooks-system/sub-specs/documentation-plan.md
