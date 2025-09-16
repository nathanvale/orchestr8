---
framework: vitest
test_command: pnpm test
created: 2025-09-16T07:43:59Z
---

# Testing Configuration

## Framework

- Type: Vitest
- Version: 3.2.4
- Config File: ./vitest.config.ts

## Test Structure

- Test Directory: packages/_, apps/_, tests/, tooling/
- Test Files: 61 files found
- Naming Pattern: _.test.ts, _.test.tsx, _.spec.ts, _.spec.tsx

## Commands

- Run All Tests: `pnpm test`
- Run Specific Test: `pnpm test {test_file}`
- Run with Debugging: `pnpm test:debug`
- Run Unit Tests: `pnpm test:unit`
- Run Integration Tests: `pnpm test:integration`
- Run E2E Tests: `pnpm test:e2e`
- Run Failed Tests: `pnpm test:failed`
- Run Coverage: `pnpm test:coverage`
- Run in Watch Mode: `vitest watch`

## Environment

- Required ENV vars: NODE_ENV, TEST_MODE (optional)
- Test Database: Not applicable
- Test Servers: MSW for API mocking

## Test Runner Agent Configuration

- Use verbose output for debugging
- Run tests sequentially (no parallel)
- Capture full stack traces
- No mocking - use real implementations
- Wait for each test to complete
