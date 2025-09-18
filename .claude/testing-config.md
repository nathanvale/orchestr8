---
framework: vitest
test_command: npm test
created: 2025-01-18T10:45:00Z
---

# Testing Configuration

## Framework
- Type: Vitest
- Version: 3.2.4
- Config File: vitest.config.ts

## Test Structure
- Test Directory: ./tests, ./packages/quality-check/tests, ./packages/quality-check/spec
- Test Files: 113 files found
- Naming Pattern: *.test.ts, *.spec.ts

## Commands
- Run All Tests: `npm test`
- Run Specific Test: `npm test -- {file_path}`
- Run with Debugging: `DEBUG=true npm test`
- Run with Watch Mode: `npm test -- --watch`
- Run with Pattern: `npm test -- --grep "{pattern}"`

## Environment
- Required ENV vars: NODE_OPTIONS='--max-old-space-size=4096'
- Test Database: N/A
- Test Servers: N/A

## Test Runner Agent Configuration
- Use verbose output for debugging
- Run tests sequentially (no parallel) when debugging
- Capture full stack traces
- No mocking - use real implementations
- Wait for each test to complete

## Memory Configuration
- NODE_OPTIONS includes --max-old-space-size=4096 for memory-intensive tests
- Coverage directory: ./test-results/coverage
- Test results directory: ./test-results

## Silent Mode Configuration
- CI: Automatically silent
- Local: Set VITEST_SILENT=true for reduced noise
- Debug: Set DEBUG=true or VERBOSE=true to override silent mode