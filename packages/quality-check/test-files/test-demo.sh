#!/bin/bash

echo "=== Claude Hook Exit Code Demo ==="
echo ""

# Create a test file with just formatting issues (auto-fixable)
echo "Creating test-auto-fixable.ts with only formatting issues..."
cat > test-auto-fixable.ts << 'EOF'
// Only formatting issues - should be auto-fixed silently
const   x="test"
const y="another"
    const z = "bad indent"
EOF

# Create a test file with real errors (not auto-fixable)
echo "Creating test-with-errors.ts with TypeScript errors..."
cat > test-with-errors.ts << 'EOF'
// TypeScript error - cannot be auto-fixed
const user = unknownVariable
const num: number = "string"
EOF

# Test 1: Auto-fixable issues WITHOUT enforcement
echo ""
echo "TEST 1: Auto-fixable issues (WITHOUT enforcement)"
echo "------------------------------------------------"
echo '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"test-auto-fixable.ts"}}' | node dist/index.js --hook --fix 2>&1
echo "Exit code: $?"

# Test 2: Auto-fixable issues WITH enforcement
echo ""
echo "TEST 2: Auto-fixable issues (WITH enforcement)"
echo "------------------------------------------------"
echo '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"test-auto-fixable.ts"}}' | QUALITY_CHECK_MODE=enforce node dist/index.js --hook --fix 2>&1
echo "Exit code: $?"

# Test 3: Real errors WITHOUT enforcement  
echo ""
echo "TEST 3: TypeScript errors (WITHOUT enforcement)"
echo "------------------------------------------------"
echo '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"test-with-errors.ts"}}' | node dist/index.js --hook --fix 2>&1 | head -20
echo "Exit code: $?"

# Test 4: Real errors WITH enforcement
echo ""
echo "TEST 4: TypeScript errors (WITH enforcement) - Should exit 2!"
echo "------------------------------------------------"
echo '{"hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"test-with-errors.ts"}}' | QUALITY_CHECK_MODE=enforce node dist/index.js --hook --fix 2>&1 | head -20
echo "Exit code: $?"

# Test 5: Invalid payload (hook error) - Should exit 1!
echo ""
echo "TEST 5: Invalid hook payload - Should exit 1!"
echo "------------------------------------------------"
echo '{"invalid":"payload"}' | node dist/index.js --hook 2>&1
echo "Exit code: $?"

# Cleanup
rm -f test-auto-fixable.ts test-with-errors.ts

echo ""
echo "=== Demo Complete ==="
echo ""
echo "Summary:"
echo "- Exit 0: Success or auto-fixed (Test 1 & 2)"
echo "- Exit 1: Hook/system errors (Test 5)"
echo "- Exit 2: Quality issues needing fixes (Test 4 with enforcement)"