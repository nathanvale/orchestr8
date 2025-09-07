#!/bin/bash

# Run the claude-hook with debug to see working directory
PAYLOAD='{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/tmp/hook-test-debug/src/strict-null.ts",
    "content": "export const test = 1"
  }
}'

echo "Test directory contents:"
ls -la /tmp/hook-test-debug/

echo ""
echo "Running claude-hook with CWD debug..."

# Add debug to see CWD
echo "$PAYLOAD" | node -e "
console.log('Process CWD:', process.cwd());
" && echo "$PAYLOAD" | node /Users/nathanvale/code/bun-changesets-template/packages/quality-check/bin/claude-hook
