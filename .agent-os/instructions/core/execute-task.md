---
description: Rules to execute a task and its sub-tasks using Agent OS
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Task Execution Rules

## Overview

Execute a specific task along with its sub-tasks systematically following a TDD
development workflow.

<pre_flight_check> EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

🚨 **CRITICAL INTERRUPT RULE - ACTIVE THROUGHOUT ALL STEPS** 🚨

IF you see "🚫 BLOCKING" or error code 2 at ANY point: → STOP IMMEDIATELY →
INVOKE quality-check-fixer subagent  
→ DO NOT attempt manual fixes

This rule OVERRIDES all other instructions below

<step number="1" name="task_understanding">

### Step 1: Task Understanding

Read and analyze the given parent task and all its sub-tasks from tasks.md to
gain complete understanding of what needs to be built.

<task_analysis> <read_from_tasks_md> - Parent task description - All sub-task
descriptions - Task dependencies - Expected outcomes </read_from_tasks_md>
</task_analysis>

<instructions>
  ACTION: Read the specific parent task and all its sub-tasks
  ANALYZE: Full scope of implementation required
  UNDERSTAND: Dependencies and expected deliverables
  NOTE: Test requirements for each sub-task
</instructions>

</step>

<step number="2" name="technical_spec_review">

### Step 2: Technical Specification Review

Search and extract relevant sections from technical-spec.md to understand the
technical implementation approach for this task.

<selective_reading> <search_technical_spec> FIND sections in technical-spec.md
related to: - Current task functionality - Implementation approach for this
feature - Integration requirements - Performance criteria
</search_technical_spec> </selective_reading>

<instructions>
  ACTION: Search technical-spec.md for task-relevant sections
  EXTRACT: Only implementation details for current task
  SKIP: Unrelated technical specifications
  FOCUS: Technical approach for this specific feature
</instructions>

</step>

<step number="3" subagent="context-fetcher" name="best_practices_review">

### Step 3: Best Practices Review

Use the context-fetcher subagent to retrieve relevant sections from
@.agent-os/standards/best-practices.md that apply to the current task's
technology stack and feature type.

<selective_reading> <search_best_practices> FIND sections relevant to: - Task's
technology stack - Feature type being implemented - Testing approaches needed -
Code organization patterns </search_best_practices> </selective_reading>

<instructions>
  ACTION: Use context-fetcher subagent
  REQUEST: "Find best practices sections relevant to:
            - Task's technology stack: [CURRENT_TECH]
            - Feature type: [CURRENT_FEATURE_TYPE]
            - Testing approaches needed
            - Code organization patterns"
  PROCESS: Returned best practices
  APPLY: Relevant patterns to implementation
</instructions>

</step>

<step number="4" subagent="context-fetcher" name="code_style_review">

### Step 4: Code Style Review

Use the context-fetcher subagent to retrieve relevant code style rules from
@.agent-os/standards/code-style.md for the languages and file types being used
in this task.

<selective_reading> <search_code_style> FIND style rules for: - Languages used
in this task - File types being modified - Component patterns being
implemented - Testing style guidelines </search_code_style> </selective_reading>

<instructions>
  ACTION: Use context-fetcher subagent
  REQUEST: "Find code style rules for:
            - Languages: [LANGUAGES_IN_TASK]
            - File types: [FILE_TYPES_BEING_MODIFIED]
            - Component patterns: [PATTERNS_BEING_IMPLEMENTED]
            - Testing style guidelines"
  PROCESS: Returned style rules
  APPLY: Relevant formatting and patterns
</instructions>

</step>

<step number="5" name="task_execution" subagent="quality-check-fixer">

### Step 5: Task and Sub-task Execution

🚨 **GLOBAL INTERRUPT RULE - ALWAYS ACTIVE** 🚨

Pattern: "🚫 BLOCKING" appears OR error code 2 returned Action: IMMEDIATELY
invoke quality-check-fixer subagent Priority: OVERRIDES ALL OTHER INSTRUCTIONS

This rule is ALWAYS ACTIVE during ANY file operation below

Execute the parent task and all sub-tasks in order using test-driven development
(TDD) approach.

<typical_task_structure> <first_subtask>Write tests for
[feature]</first_subtask> <middle_subtasks>Implementation
steps</middle_subtasks> <final_subtask>Verify all tests pass</final_subtask>
</typical_task_structure>

<execution_order> <subtask_1_tests> IF sub-task 1 is "Write tests for
[feature]": - Write all tests for the parent feature - Include unit tests,
integration tests, edge cases - Run tests to ensure they fail appropriately -
Mark sub-task 1 complete </subtask_1_tests>

<middle_subtasks_implementation> FOR each implementation sub-task (2 through
n-1):

🔴 REMEMBER: "🚫 BLOCKING" = STOP & USE quality-check-fixer IMMEDIATELY 🔴

- Implement the specific functionality
- Make relevant tests pass
- Update any adjacent/related tests if needed
- Refactor while keeping tests green

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ⚡
INTERRUPT HANDLER (Active at ALL times during execution):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ WHEN "🚫
BLOCKING" appears OR error code 2 is returned:

1. STOP current task immediately
2. TodoWrite: Save current sub-task as "paused_for_quality_fix"
3. TodoWrite: Create task "Fixing quality check errors for [current sub-task]"
4. INVOKE quality-check-fixer subagent with: "Fix the quality check errors from
   this XML block: [Insert entire <quality-check-result> XML block including all
   nested elements] Systematically resolve each error using Read/Edit/MultiEdit
   tools Return status: ALL_RESOLVED, PARTIAL_RESOLUTION, or FAILED"
5. TodoWrite: Mark "Fixing quality check errors" complete
6. If ALL_RESOLVED:
   - TodoWrite: Resume saved sub-task from "paused_for_quality_fix"
   - Output the results from the quality-checker-fixer to the user
   - Continue with implementation
7. If PARTIAL_RESOLUTION or FAILED: - Document blocking issues with ⚠️ -
   TodoWrite: Mark current sub-task as blocked
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Mark sub-task complete </middle_subtasks_implementation>

<final_subtask_verification> IF final sub-task is "Verify all tests pass":

🔴 REMINDER: "🚫 BLOCKING" still triggers quality-check-fixer IMMEDIATELY 🔴

- Run entire test suite
- Fix any remaining failures
- Ensure no regressions
- Mark final sub-task complete </final_subtask_verification> </execution_order>

<test_management> <new_tests> - Written in first sub-task - Cover all aspects of
parent feature - Include edge cases and error handling </new_tests>
<test_updates> - Made during implementation sub-tasks - Update expectations for
changed behavior - Maintain backward compatibility </test_updates>
</test_management>

<instructions>
  ⚠️ CRITICAL: "🚫 BLOCKING" = IMMEDIATE quality-check-fixer invocation ⚠️
  ACTION: Execute sub-tasks in their defined order
  RECOGNIZE: First sub-task typically writes all tests
  IMPLEMENT: Middle sub-tasks build functionality
  VERIFY: Final sub-task ensures all tests pass
  UPDATE: Mark each sub-task complete as finished
  INTERRUPT: ANY "🚫 BLOCKING" overrides current action
</instructions>

</step>

<step number="6" subagent="test-runner" name="task_test_verification">

### Step 6: Task-Specific Test Verification

Use the test-runner subagent to run and verify only the tests specific to this
parent task (not the full test suite) to ensure the feature is working
correctly.

<focused_test_execution> <run_only> - All new tests written for this parent
task - All tests updated during this task - Tests directly related to this
feature </run_only> <skip> - Full test suite (done later in execute-tasks.md) -
Unrelated test files </skip> </focused_test_execution>

<final_verification> IF any test failures: - Debug and fix the specific issue -
Re-run only the failed tests ELSE: - Confirm all task tests passing - Ready to
proceed </final_verification>

<instructions>
  ACTION: Use test-runner subagent
  REQUEST: "Run tests for [this parent task's test files]"
  WAIT: For test-runner analysis
  PROCESS: Returned failure information
  VERIFY: 100% pass rate for task-specific tests
  CONFIRM: This feature's tests are complete
</instructions>

</step>

<step number="7" name="task_status_updates">

### Step 7: Mark this task and sub-tasks complete

IMPORTANT: In the tasks.md file, mark this task and its sub-tasks complete by
updating each task checkbox to [x].

<update_format> <completed>- [x] Task description</completed> <incomplete>- [ ]
Task description</incomplete> <blocked> - [ ] Task description ⚠️ Blocking
issue: [DESCRIPTION] </blocked> </update_format>

<blocking_criteria> <attempts>maximum 3 different approaches</attempts>
<action>document blocking issue</action> <emoji>⚠️</emoji> </blocking_criteria>

<instructions>
  ACTION: Update tasks.md after each task completion
  MARK: [x] for completed items immediately
  DOCUMENT: Blocking issues with ⚠️ emoji
  LIMIT: 3 attempts before marking as blocked
</instructions>

</step>

</process_flow>

<post_flight_check> EXECUTE: @.agent-os/instructions/meta/post-flight.md
</post_flight_check>
