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

Execute the parent task and all sub-tasks using explicit step enumeration with
integrated quality check handling.

<task_initialization>
  ACTION: TodoWrite initialize task tracking with variables
  VARIABLES: current_step, blocking_status, error_content
  STATE: ready_for_execution
</task_initialization>

<typical_task_structure> <first_subtask>Write tests for
[feature]</first_subtask> <middle_subtasks>Implementation
steps</middle_subtasks> <final_subtask>Verify all tests pass</final_subtask>
</typical_task_structure>

<subtask_1_tests>
  ACTION: TodoWrite update current_step="write_tests"
  IMPLEMENT: Write all tests for the parent feature
  INCLUDE: Unit tests, integration tests, edge cases
  VERIFY: Tests fail appropriately (red state)
  COMPLETE: TodoWrite mark subtask_1 complete
</subtask_1_tests>

<implementation_step_2>
  ACTION: TodoWrite update current_step="implement_core_functionality"
  IMPLEMENT: Build core feature functionality
  QUALITY_MONITOR: Check output for "🚫 BLOCKING" pattern
  IF_BLOCKING_DETECTED: Execute quality_check_resolution_sequence
  VERIFY: Tests pass, no blocking errors
  COMPLETE: TodoWrite mark implementation_step_2 complete
</implementation_step_2>

<implementation_step_3>
  ACTION: TodoWrite update current_step="implement_additional_features"
  IMPLEMENT: Add supplementary functionality
  QUALITY_MONITOR: Check output for "🚫 BLOCKING" pattern
  IF_BLOCKING_DETECTED: Execute quality_check_resolution_sequence
  UPDATE: Adjust related tests as needed
  COMPLETE: TodoWrite mark implementation_step_3 complete
</implementation_step_3>

<implementation_step_n>
  ACTION: TodoWrite update current_step="implement_final_components"
  IMPLEMENT: Complete remaining functionality
  QUALITY_MONITOR: Check output for "🚫 BLOCKING" pattern
  IF_BLOCKING_DETECTED: Execute quality_check_resolution_sequence
  REFACTOR: Keep tests green while refactoring
  COMPLETE: TodoWrite mark implementation_step_n complete
</implementation_step_n>

<quality_check_resolution_sequence>
  TRIGGER: Output contains "🚫 BLOCKING" with XML quality-check-result
  
  STEP1: TodoWrite save current task state
        - Store current_step value
        - Mark current task as "blocked_by_quality_check"
        - Create task: "Waiting for quality check fixes"
  
  STEP2: Extract error content for subagent
        - Copy entire <quality-check-result> XML block
        - Note affected file paths
  
  STEP3: Invoke quality-check-fixer subagent
        REQUEST: "Fix these blocking quality check errors:
                 [Insert full XML quality-check-result block]
                 Affected files: [list of files with errors]
                 Return structured results when complete."
  
  STEP4: Process subagent results
        - Receive QUALITY_CHECK_FIX_RESULTS
        - Check Status field (ALL_RESOLVED | PARTIAL_RESOLUTION | FAILED)
  
  STEP5: Handle results based on status
        IF Status = ALL_RESOLVED:
          - TodoWrite update: "Quality checks resolved, resuming [current_step]"
          - Continue with saved current_step
        IF Status = PARTIAL_RESOLUTION:
          - Log unfixable errors for user attention
          - Attempt to continue if possible
        IF Status = FAILED:
          - Mark task as blocked
          - Request user intervention
  
  STEP6: Resume or escalate
        - If resolved: Continue implementation at current_step
        - If blocked: Document blocking issues with ⚠️
</quality_check_resolution_sequence>

<final_subtask_verification>
  ACTION: TodoWrite update current_step="final_verification"
  TEST: Run entire test suite
  QUALITY: Verify no blocking errors present
  FIX: Address any remaining failures
  ENSURE: No regressions occurred
  COMPLETE: TodoWrite mark final_subtask complete
</final_subtask_verification>

<test_management> <new_tests> - Written in first sub-task - Cover all aspects of
parent feature - Include edge cases and error handling </new_tests>
<test_updates> - Made during implementation sub-tasks - Update expectations for
changed behavior - Maintain backward compatibility </test_updates>
</test_management>

<instructions>
  ACTION: Execute sub-tasks using explicit steps
  RECOGNIZE: First sub-task typically writes all tests
  IMPLEMENT: Middle sub-tasks build functionality step-by-step
  MONITOR: Watch for "🚫 BLOCKING" quality check errors
  DELEGATE: Use quality-check-fixer subagent for blocking issues
  VERIFY: Final sub-task ensures all tests pass
  UPDATE: Mark each sub-task complete in TodoWrite
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
