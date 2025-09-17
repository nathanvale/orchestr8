#!/bin/bash

# Quiet test runner script
# Provides minimal output - only shows failures and summary

# Set environment for maximum noise reduction
export VITEST_SILENT=true
export NODE_ENV=test
export CI=true
export CLAUDE_HOOK_SILENT=true
export TURBO_OUTPUT_LOGS=errors-only

# Run tests with minimal reporter
pnpm vitest run --reporter=dot 2>&1 | \
  grep -E "^(✓|✗|×| Test Files|Tests|FAIL|ERROR|Duration)" | \
  head -15

# Get exit code from vitest
exit ${PIPESTATUS[0]}