---
description: Rules to execute a task and its sub-tasks using Agent OS
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Task Execution Rules

## Overview

Execute a specific parent task and all its sub-tasks following strict TDD workflow with mandatory verification gates.

<pre_flight_check>
EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

<step number="1" name="task_understanding">

### Step 1: Task Understanding

Load and analyze the complete task scope from tasks.md.

<algorithm>
  1. READ: tasks.md file
  2. LOCATE: Parent task with number = [parent_task_number]
  3. EXTRACT:
     - parent_task.description
     - parent_task.subtasks[] (all sub-tasks under parent)
     - parent_task.dependencies[] (if any)
     - parent_task.acceptance_criteria (if specified)
  4. COUNT: total_subtasks = length(parent_task.subtasks)
  5. VERIFY: All subtasks have clear descriptions
</algorithm>

<required_output>
  MUST STATE:
  - "Parent task [#]: [description]"
  - "Found [N] subtasks to execute"
  - "First subtask: [description]"
  - "Last subtask: [description]"
</required_output>

</step>

<step number="2" name="technical_spec_review">

### Step 2: Technical Specification Review

Extract task-relevant technical implementation details.

<algorithm>
  1. SEARCH: technical-spec.md for keywords from parent_task.description
  2. FIND sections containing:
     - Feature name from task
     - Component names mentioned in task
     - API endpoints if task involves APIs
     - Database schemas if task involves data
  3. EXTRACT:
     - implementation_approach (if found)
     - performance_requirements (if found)
     - integration_points (if found)
  4. IF no matches found:
     SET: technical_requirements = "None specified"
</algorithm>

<verification_gate>
  MUST OUTPUT one of:
  □ "Found implementation approach: [specific approach]"
  □ "Found performance requirement: [specific requirement]"
  □ "Found integration requirement: [specific requirement]"
  □ "No task-specific technical requirements found"
  
  IF none provided:
    ERROR: "Step 2 incomplete - missing technical spec review"
    ACTION: HALT and re-execute Step 2
</verification_gate>

</step>

<step number="3" subagent="context-fetcher" name="best_practices_review">

### Step 3: Best Practices Review

Retrieve and verify understanding of applicable best practices.

<subagent_invocation>
  1. DETERMINE from parent_task:
     - technology_stack = [extracted from task description]
     - feature_type = [extracted from task description]
  
  2. INVOKE: context-fetcher with EXACT request:
     "Load best practices for:
      - Technology: [technology_stack]
      - Feature type: [feature_type]
      - Section: Testing patterns
      - Section: Wallaby.js rules
      From: @.agent-os/standards/best-practices.md"
  
  3. WAIT: For subagent response
  4. EXTRACT: Key guidelines from response
</subagent_invocation>

<verification_gate>
  MUST CORRECTLY STATE ALL:
  □ Test naming: "should_[expectedBehavior]_when_[condition]"
  □ Wallaby rule: "Wallaby for .unit.test.ts files ONLY, Vitest for all others"
  □ One additional guideline: [state specific guideline found]
  
  IF Wallaby rule incorrect:
    ERROR: "Failed Wallaby verification"
    ACTION: Re-read wallaby-rules.xml Section 1
    RETRY: Step 3 with correct understanding
  
  IF any item missing:
    ERROR: "Step 3 incomplete - missing [specific item]"
    ACTION: HALT until all items verified
</verification_gate>

</step>

<step number="4" subagent="context-fetcher" name="code_style_review">

### Step 4: Code Style Review

Retrieve and apply language-specific style rules.

<analysis_algorithm>
  1. ANALYZE parent_task and subtasks to determine:
     - languages[] = [TypeScript, JavaScript, etc.]
     - file_types[] = [.ts, .test.ts, .unit.test.ts, etc.]
     - patterns[] = [component, service, utility, etc.]
  
  2. INVOKE: context-fetcher with EXACT request:
     "Load code style rules for:
      - Languages: [languages.join(', ')]
      - File extensions: [file_types.join(', ')]
      - Pattern types: [patterns.join(', ')]
      From: @.agent-os/standards/code-style.md"
  
  3. WAIT: For subagent response
  4. EXTRACT: Applicable style rules
</analysis_algorithm>

<verification_gate>
  MUST PROVIDE ALL:
  □ Primary languages: [list identified languages]
  □ File types to create/modify: [list file extensions]
  □ Specific style rule: [quote one applicable rule]
  
  IF any missing:
    ERROR: "Step 4 incomplete - missing [specific item]"
    ACTION: HALT and complete identification
</verification_gate>

</step>

<pre_execution_gate enforcement="MANDATORY">

### EXECUTION GATE - MANDATORY CHECKPOINT

<verification_checklist>
  VERIFY ALL items checked:
  □ Step 1: Task scope understood (parent + all subtasks identified)
  □ Step 2: Technical spec reviewed (approach stated or "none found")
  □ Step 3: Test pattern verified ("should_X_when_Y" confirmed)
  □ Step 3: Wallaby rule correct ("*.unit.test.ts ONLY" confirmed)
  □ Step 4: Languages and file types identified
  □ Step 4: Style rule quoted
</verification_checklist>

<gate_logic>
  IF checklist.all_checked == false:
    missing_items = checklist.filter(item => !item.checked)
    ERROR: "GATE FAILED - Missing: [missing_items]"
    ACTION: RETURN to step with missing verification
    FORBIDDEN: Do NOT proceed to Step 5
  
  ELSE:
    STATUS: "GATE PASSED - All verifications complete"
    ACTION: PROCEED to Step 5 implementation
</gate_logic>

</pre_execution_gate>

<step number="5" name="task_execution">

### Step 5: Task and Sub-task Execution

Execute all subtasks using strict TDD workflow.

<execution_algorithm>
  1. SET: subtasks = parent_task.subtasks
  2. SET: current_subtask_index = 0
  
  3. WHILE current_subtask_index < length(subtasks):
     
     current = subtasks[current_subtask_index]
     
     IF current.description.includes("Write tests") OR current.description.includes("write tests"):
        a. WRITE: All tests for the parent feature
        b. INCLUDE: Unit tests, integration tests, edge cases
        c. RUN: Tests to verify they fail correctly
        d. CONFIRM: Red phase of TDD complete
     
     ELSE IF current.description.includes("Implement") OR current.description.includes("implement"):
        a. CODE: Implement specific functionality
        b. RUN: Related tests frequently
        c. MAKE: Tests pass (green phase)
        d. REFACTOR: Code while keeping tests green
        e. UPDATE: Any affected adjacent tests
     
     ELSE IF current.description.includes("Verify") AND current.description.includes("tests"):
        a. RUN: All tests for this feature
        b. FIX: Any remaining failures
        c. VERIFY: No regressions introduced
        d. CONFIRM: All feature tests passing
     
     ELSE:
        a. EXECUTE: Task as described
        b. TEST: Functionality if applicable
        c. VERIFY: Meets acceptance criteria
     
     UPDATE: tasks.md - mark current subtask as "[x] Completed"
     INCREMENT: current_subtask_index += 1
  
  4. VERIFY: All subtasks marked complete in tasks.md
</execution_algorithm>

<tdd_enforcement>
  RULE: Tests MUST exist before implementation
  PATTERN: Red → Green → Refactor
  REQUIREMENT: Each subtask completion requires passing tests
</tdd_enforcement>

</step>

<step number="6" subagent="test-runner" name="task_test_verification">

### Step 6: Task-Specific Test Verification

Run focused tests for this feature only.

<test_identification>
  1. IDENTIFY: Test files created/modified in Step 5
     test_files[] = [list all test files for this feature]
  
  2. CATEGORIZE:
     - new_tests[] = tests created in this task
     - modified_tests[] = existing tests updated
     - related_tests[] = tests that cover this feature
</test_identification>

<subagent_invocation>
  1. INVOKE: test-runner with EXACT request:
     "Run focused tests for feature [parent_task.description]:
      - Test files: [test_files.join(', ')]
      - Skip unrelated tests
      - Report failures with full stack traces"
  
  2. WAIT: For test results
  
  3. IF failures_count > 0:
     a. ANALYZE: Each failure message
     b. FIX: Root cause of failure
     c. RE-INVOKE: test-runner for failed tests only
     d. REPEAT: Until failures_count == 0
  
  4. ELSE:
     CONFIRM: "All task-specific tests passing (100% success rate)"
</subagent_invocation>

<success_criteria>
  REQUIRED: 100% pass rate for all task-specific tests
  FORBIDDEN: Proceeding with any test failures
</success_criteria>

</step>

<step number="7" name="task_status_updates">

### Step 7: Final Status Update

Update tasks.md with final completion status.

<status_update_algorithm>
  1. READ: Current tasks.md content
  
  2. FOR each subtask in parent_task.subtasks:
     IF subtask.completed == true:
        UPDATE: "- [ ]" → "- [x]"
     ELSE IF subtask.blocked == true:
        UPDATE: "- [ ]" → "- [ ] ⚠️ Blocked: [reason]"
     ELSE:
        LEAVE: "- [ ]" unchanged
  
  3. IF all_subtasks_complete:
     UPDATE: parent_task status → "- [x]"
  ELSE:
     UPDATE: parent_task status → "- [ ] (Partial: [X]/[Y] complete)"
  
  4. WRITE: Updated content back to tasks.md
  
  5. REPORT: "Task [#] status: [completion_percentage]% complete"
</status_update_algorithm>

<blocking_rules>
  MAX_ATTEMPTS: 3
  IF attempts >= MAX_ATTEMPTS:
    MARK: "⚠️ Blocked after 3 attempts"
    DOCUMENT: Specific blocking reason
    PROCEED: To next subtask
</blocking_rules>

<final_output>
  MUST REPORT:
  - "Parent task [#]: [status]"
  - "Completed subtasks: [count]"
  - "Blocked subtasks: [count]" (if any)
  - "Ready for next parent task" OR "Manual intervention needed"
</final_output>

</step>

</process_flow>

<post_flight_check> EXECUTE: @.agent-os/instructions/meta/post-flight.md
</post_flight_check>
