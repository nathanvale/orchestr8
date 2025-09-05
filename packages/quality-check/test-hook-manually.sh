#!/bin/bash

# Test your hook manually with correct Claude payload format

echo "Testing quality-check hook with sample Claude payload..."
echo ""

# Test 1: Write operation
echo "Test 1: Write operation on TypeScript file"
echo '{"tool_name":"Write","tool_input":{"file_path":"test.ts","content":"console.log(\"test\")"}}' | node ./bin/claude-hook
echo "Exit code: $?"
echo ""

# Test 2: Edit operation
echo "Test 2: Edit operation" 
echo '{"tool_name":"Edit","tool_input":{"file_path":"test.ts","old_string":"console.log","new_string":"logger.info"}}' | node ./bin/claude-hook
echo "Exit code: $?"
echo ""

# Test 3: Non-JS file (should skip)
echo "Test 3: Non-JS file (should skip)"
echo '{"tool_name":"Write","tool_input":{"file_path":"README.md","content":"# Test"}}' | node ./bin/claude-hook
echo "Exit code: $?"
echo ""

# Test 4: Invalid JSON (should handle gracefully)
echo "Test 4: Invalid JSON"
echo 'invalid json' | node ./bin/claude-hook
echo "Exit code: $?"
echo ""

# Test 5: Test with real file that has issues
echo "Test 5: Real file with issues"
cat << 'EOF' > test-quality-issues.ts
// This file has multiple issues
const x: any = "test"  // TypeScript 'any' type
console.log(x);  // Console.log and semicolon
   function   badFormatting( ){  // Formatting issues
return   true
}
EOF

echo '{"tool_name":"Write","tool_input":{"file_path":"./test-quality-issues.ts","content":"see file"}}' | node ./bin/claude-hook
echo "Exit code: $?"

# Cleanup
rm -f test-quality-issues.ts

echo ""
echo "✅ Manual hook testing complete!"
echo ""
echo "Expected behavior:"
echo "- Test 1: Should show quality issues (console.log)"
echo "- Test 2: Should process the edit"  
echo "- Test 3: Should skip (not a JS/TS file)"
echo "- Test 4: Should handle gracefully"
echo "- Test 5: Should show multiple quality issues"