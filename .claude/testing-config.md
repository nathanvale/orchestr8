---
framework: vitest
test_command: pnpm test
created: 2025-09-15T04:18:33Z
---

# Testing Configuration

## Framework
- Type: Vitest
- Version: 3.2.4
- Config File: vitest.config.ts

## Test Structure
- Test Directory: tests/, packages/*/tests/, packages/*/spec/
- Test Files: 65 files found
- Naming Pattern: *.test.ts, *.integration.test.ts, *.unit.test.ts, *.e2e.test.ts, *.slow.test.ts

## Commands
- Run All Tests: `pnpm test`
- Run Specific Test: `pnpm test {file_pattern}`
- Run with Debugging: `pnpm test --reporter=verbose`
- Run Integration Tests: `TEST_MODE=integration pnpm test`
- Run E2E Tests: `TEST_MODE=e2e pnpm test`
- Run Unit Tests Only: `pnpm test` (default excludes integration/e2e/slow)

## Environment
- Required ENV vars: TEST_MODE (optional: integration|e2e|all)
- Test Database: N/A
- Test Servers: N/A

## Test Runner Agent Configuration
- Use verbose output for debugging
- Run tests sequentially (no parallel)
- Capture full stack traces
- No mocking - use real implementations
- Wait for each test to complete

## Test Classification (ADHD-Optimized)
- `.unit.test.ts` - Fast unit tests (default mode)
- `.test.ts` - General tests (default mode)
- `.integration.test.ts` - Integration tests (excluded by default)
- `.e2e.test.ts` - End-to-end tests (excluded by default)
- `.slow.test.ts` - Slow tests (excluded by default)

## Wallaby Integration
- Wallaby MCP tools available for `.unit.test.ts` and `.test.ts` files
- HALT protocol enforced when Wallaby inactive
- Real-time debugging with runtime values
- Coverage analysis available

## Coverage Configuration
- Provider: v8
- Threshold: 70% (branches, functions, lines, statements)
- Reports: text-summary (local), comprehensive (CI)
- Directory: ./test-results/coverage