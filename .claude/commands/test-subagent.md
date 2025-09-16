# Test Subagent Instruction

## Purpose

Test any subagent by calling it directly and verifying responses

## Testing Protocol

<test_execution> FOR each test case:

1. CALL: Target subagent with test input
2. CAPTURE: Response
3. VERIFY: Response matches expected behavior
4. LOG: Pass/Fail with details </test_execution>

## Test Context Fetcher Specifically

<context_fetcher_tests> TEST_SUITE() { echo "🧪 TESTING CONTEXT-FETCHER
SUBAGENT" echo "===================================="

# Test 1: Load fresh content

USE: @agent:context-fetcher REQUEST: "Load code-style.md" EXPECT: File content
returned

# Test 2: Verify caching

USE: @agent:context-fetcher  
 REQUEST: "Load code-style.md" EXPECT: "Already in context" or "Using cached"

# Test 3: Semantic search

USE: @agent:context-fetcher REQUEST: "Find all authentication-related content"
EXPECT: Multiple file matches

# Test 4: Session tracking

USE: @agent:context-fetcher REQUEST: "Show current session registry" EXPECT:
List of loaded files with timestamps

# Test 5: Performance check

MEASURE: Time to load 10 different files EXPECT: Cache hits faster than fresh
loads } </context_fetcher_tests>

## Usage

Run in Claude Code:

1. `/test-subagent context-fetcher`
2. Watch the test execution
3. Review pass/fail results
