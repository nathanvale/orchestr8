#!/bin/bash

# Claude Code Quality Check Hook Wrapper
# This script is called by Claude Code's PostToolUse hook
# It receives JSON input from stdin and passes it to quality-check

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if we're in a Node.js project with quality-check installed
if [ -f "$SCRIPT_DIR/dist/index.js" ]; then
    # Use the local built version
    QUALITY_CHECK="$SCRIPT_DIR/dist/index.js"
elif command -v npx &> /dev/null; then
    # Use npx to run the package
    QUALITY_CHECK="npx @template/quality-check"
else
    # Silently exit if quality-check isn't available
    exit 0
fi

# Enable enforcement mode via environment variable
export QUALITY_CHECK_MODE=enforce

# Debug: Log what we receive (comment out in production)
# echo "Hook received input:" >> /tmp/quality-check-hook.log
# cat >> /tmp/quality-check-hook.log
# echo "" >> /tmp/quality-check-hook.log

# Pass stdin directly to quality-check
# The tool expects JSON in the format: {"tool":"Write","path":"file.ts","projectDir":"..."}
cat | node "$QUALITY_CHECK"