# ADHD-Optimized Testing Instructions

## Core Testing Philosophy

@.claude/instructions/test-core-philosophy.xml

## Wallaby-First Enforcement (🚨CRITICAL)

@.claude/instructions/wallaby-first-enforcement.xml

## Wallaby Setup Guide

@.claude/config/wallaby-setup.xml

## Code Style Enforcement (CRITICAL)

@.claude/instructions/code-style-enforcement!!!!.xml

## TypeScript Patterns

@.claude/templates/typescript-patterns.xml

## Test Naming Conventions (CRITICAL)

@.claude/instructions/test-naming.xml

## Performance Requirements

@.claude/instructions/test-performance.xml

## ADHD Optimizations

@.claude/instructions/test-adhd-optimizations.xml

## Test Structure Templates

@.claude/templates/test-structure.xml

## Mocking Patterns

@.claude/templates/mock-patterns.xml

## Wallaby Configuration

@.claude/config/wallaby.xml

## Slash Commands

@.claude/config/slash-commands.xml

## Continuous Improvement

@.claude/monitoring/continuous-improvement.xml

## Validation Checklists

@.claude/monitoring/validation-checklists.xml

## Error Handling & Troubleshooting

@.claude/monitoring/error-handling.xml

---

## Quick Reference

### Test Commands

- `pnpm test` - Run fast unit tests only
- `pnpm test:unit` - Unit tests explicitly
- `pnpm test:integration` - Integration tests
- `pnpm test:focus` - Changed files only
- `pnpm test:debug` - Debug mode
- `pnpm test:find-slow` - Find slow tests
- `pnpm test:failed` - Re-run failures

### File Suffixes

- `.unit.test.ts` - Fast unit tests (< 100ms)
- `.integration.test.ts` - Integration tests (< 1000ms)
- `.e2e.test.ts` - End-to-end tests
- `.slow.test.ts` - Necessarily slow tests

### Performance Indicators

- ⚡ Lightning fast (0-100ms)
- ✓ Acceptable (100-500ms)
- 🐢 Too slow - MUST REFACTOR (500ms+)

### Test Naming Pattern

`should_[expectedBehavior]_when_[condition]`

Example: `should_return_user_data_when_valid_id_provided`

---

_This configuration uses modular XML imports for maintainability and
performance.  
Run `/memory` to see all loaded instructions._
