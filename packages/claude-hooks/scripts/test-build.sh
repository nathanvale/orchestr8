#!/bin/bash
set -e

# Get the package root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_ROOT"

# Verify dist exists (should be built by Turborepo dependency)
if [ ! -d "dist" ]; then
  echo "Error: dist directory does not exist!"
  echo "Turborepo should have built it via dependency chain."
  echo "Please ensure 'build' task has completed before running test:build."
  exit 1
fi

# List what's in dist for debugging
echo "Contents of dist/bin:"
ls -la dist/bin/ || echo "dist/bin does not exist"

echo "dist directory exists, running tests..."

# Run the tests
pnpm exec vitest run --config vitest.config.build.ts