#!/bin/bash

# Test Categorization Script
# Counts and categorizes test files by type

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📊 Test Suite Categorization${NC}"
echo "============================="

# Ensure metrics directory exists
mkdir -p .claude/metrics

# Find different test types
echo -e "\n${BLUE}Analyzing test files...${NC}"

# Unit tests (.test.ts but not integration or e2e)
UNIT_TESTS=$(find . -name "*.test.ts" -not -name "*.integration.test.ts" -not -name "*.e2e.test.ts" -not -path "*/node_modules/*" | sort)
UNIT_COUNT=$(echo "$UNIT_TESTS" | grep -v '^$' | wc -l)

# Integration tests
INTEGRATION_TESTS=$(find . -name "*.integration.test.ts" -not -path "*/node_modules/*" | sort)
INTEGRATION_COUNT=$(echo "$INTEGRATION_TESTS" | grep -v '^$' | wc -l)

# E2E tests
E2E_TESTS=$(find . -name "*.e2e.test.ts" -not -path "*/node_modules/*" | sort)
E2E_COUNT=$(echo "$E2E_TESTS" | grep -v '^$' | wc -l)

# All test files
ALL_TESTS=$(find . -name "*.test.ts" -not -path "*/node_modules/*" | sort)
TOTAL_COUNT=$(echo "$ALL_TESTS" | grep -v '^$' | wc -l)

# Identify naming patterns
UNIT_TEST_PATTERN=$(echo "$UNIT_TESTS" | grep "\.unit\.test\.ts$" | wc -l)
SIMPLE_TEST_PATTERN=$(echo "$UNIT_TESTS" | grep -v "\.unit\.test\.ts$" | wc -l)

echo -e "${GREEN}Test File Summary:${NC}"
echo "Total test files: $TOTAL_COUNT"
echo "Unit tests: $UNIT_COUNT"
echo "  - .unit.test.ts pattern: $UNIT_TEST_PATTERN"
echo "  - .test.ts pattern: $SIMPLE_TEST_PATTERN"
echo "Integration tests: $INTEGRATION_COUNT"
echo "E2E tests: $E2E_COUNT"

# Generate JSON report
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
JSON_OUTPUT=".claude/metrics/test-inventory-$(date +%Y%m%d-%H%M%S).json"

cat > "$JSON_OUTPUT" << EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "total_files": $TOTAL_COUNT,
    "unit_tests": $UNIT_COUNT,
    "integration_tests": $INTEGRATION_COUNT,
    "e2e_tests": $E2E_COUNT,
    "unit_test_patterns": {
      "unit_pattern": $UNIT_TEST_PATTERN,
      "simple_pattern": $SIMPLE_TEST_PATTERN
    }
  },
  "files": {
    "unit_tests": [
$(echo "$UNIT_TESTS" | grep -v '^$' | sed 's/.*/"&"/' | sed '$!s/$/,/')
    ],
    "integration_tests": [
$(echo "$INTEGRATION_TESTS" | grep -v '^$' | sed 's/.*/"&"/' | sed '$!s/$/,/')
    ],
    "e2e_tests": [
$(echo "$E2E_TESTS" | grep -v '^$' | sed 's/.*/"&"/' | sed '$!s/$/,/')
    ]
  },
  "naming_analysis": {
    "inconsistent_patterns": $(if [ $UNIT_TEST_PATTERN -gt 0 ] && [ $SIMPLE_TEST_PATTERN -gt 0 ]; then echo "true"; else echo "false"; fi),
    "files_to_rename": [
$(echo "$UNIT_TESTS" | grep "\.unit\.test\.ts$" | sed 's/.*/"&"/' | sed '$!s/$/,/')
    ]
  }
}
EOF

echo -e "\n${GREEN}📋 Report generated: $JSON_OUTPUT${NC}"

# Show naming inconsistencies if they exist
if [ $UNIT_TEST_PATTERN -gt 0 ] && [ $SIMPLE_TEST_PATTERN -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  Naming Inconsistencies Detected:${NC}"
    echo "Found both .unit.test.ts and .test.ts patterns"
    echo "Files using .unit.test.ts pattern:"
    echo "$UNIT_TESTS" | grep "\.unit\.test\.ts$" | head -5
    if [ $UNIT_TEST_PATTERN -gt 5 ]; then
        echo "... and $(($UNIT_TEST_PATTERN - 5)) more"
    fi
fi

echo -e "\n${GREEN}✅ Test categorization complete${NC}"