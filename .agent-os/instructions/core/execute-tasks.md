---
description: Rules to initiate execution of a set of tasks using Agent OS
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Task Execution Rules

## Overview

Execute tasks for a given spec following three MANDATORY sequential phases:

1. **Pre-execution setup** (Steps 1-3) - MUST complete before Phase 2
2. **Task execution loop** (Step 4) - MUST complete ALL tasks before Phase 3  
3. **Post-execution tasks** (Step 5) - MUST complete before ending

**CRITICAL**: You MUST complete ALL three phases. Never stop after Phase 2.

<pre_flight_check>
EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

## Phase 1: Pre-Execution Setup

<step number="1" name="task_assignment">

### Step 1: Task Assignment

Identify which tasks to execute from the spec.

<task_selection>
  <explicit>
    IF user provides specific_tasks array:
      USE: Exact task numbers provided
  </explicit>
  <implicit>
    IF no specific tasks provided:
      1. READ: spec's tasks.md file
      2. FIND: First parent task where status != "✓ Completed"
      3. SELECT: That task and all its subtasks
  </implicit>
</task_selection>

<instructions>
  1. DETERMINE: Task selection method (explicit vs implicit)
  2. IDENTIFY: Target task(s) to execute
  3. CONFIRM: "I will execute: [list of tasks]" with user
  4. WAIT: For user confirmation before proceeding
</instructions>

</step>

<step number="2" subagent="context-fetcher" name="context_analysis">

### Step 2: Context Analysis

Gather minimal necessary context for task understanding.

<instructions>
  1. INVOKE: context-fetcher subagent with these EXACT requests:
     
     REQUEST 1: "Load the spec tasks.md file from [SPEC_PATH]/tasks.md"
     
     REQUEST 2 (if not in context): "Get product pitch from @.agent-os/product/mission-lite.md"
     
     REQUEST 3 (if not in context): "Get spec summary from [SPEC_PATH]/spec-lite.md"
     
     REQUEST 4 (if not in context): "Get technical approach from [SPEC_PATH]/sub-specs/technical-spec.md"
  
  2. WAIT: For subagent to return all requested information
  3. VERIFY: Essential context loaded successfully
</instructions>

<context_requirements>
  <mandatory>
    - tasks.md (MUST exist and be loaded)
  </mandatory>
  <optional>
    - mission-lite.md (load if exists)
    - spec-lite.md (load if exists)
    - technical-spec.md (load if exists)
  </optional>
</context_requirements>

</step>

<step number="3" subagent="git-workflow" name="git_branch_management">

### Step 3: Git Branch Management

Ensure proper git branch isolation for the spec.

<instructions>
  1. EXTRACT: Spec folder name from spec_srd_reference path
  2. DERIVE: Branch name by removing date prefix from folder name
     Example: "2025-03-15-password-reset" → "password-reset"
  
  3. INVOKE: git-workflow subagent with EXACT request:
     "Manage git branch for spec implementation:
      - Target branch name: [DERIVED_BRANCH_NAME]
      - If branch exists: switch to it
      - If branch doesn't exist: create from main/master and switch
      - If uncommitted changes exist: stash them first
      - Confirm: branch is ready for work"
  
  4. WAIT: For confirmation that correct branch is active
  5. VERIFY: On correct branch before proceeding
</instructions>

</step>

## Phase 2: Task Execution Loop

<step number="4" name="task_execution_loop">

### Step 4: Task Execution Loop

**CRITICAL**: This is an iterative loop. You MUST execute ALL assigned tasks completely before moving to Phase 3.

<execution_algorithm>
  1. LOAD (once): @.agent-os/instructions/core/execute-task.md
  
  2. SET: assigned_tasks = tasks from Step 1
  3. SET: current_index = 0
  
  4. WHILE current_index < length(assigned_tasks):
     a. GET: current_task = assigned_tasks[current_index]
     b. EXECUTE: Instructions from execute-task.md with:
        - parent_task_number = current_task.number
        - subtasks = current_task.subtasks
     c. WAIT: Until current_task is fully complete
     d. UPDATE: tasks.md to mark current_task as "✓ Completed"
     e. INCREMENT: current_index += 1
     f. CHECK: If user requests stop, BREAK loop
  
  5. VERIFY: All assigned tasks show "✓ Completed" in tasks.md
  
  6. **MANDATORY**: PROCEED to Step 5 (Phase 3)
</execution_algorithm>

<loop_termination>
  <normal_exit>
    CONDITION: current_index >= length(assigned_tasks)
    ACTION: Proceed immediately to Step 5
  </normal_exit>
  <early_exit>
    CONDITION: User explicitly requests "stop" or "pause"
    ACTION: Save progress and ask if user wants to continue later
  </early_exit>
  <error_exit>
    CONDITION: Blocking error that cannot be resolved
    ACTION: Report error, save progress, await user guidance
  </error_exit>
</loop_termination>

<verification>
  AFTER loop completes:
  1. READ: tasks.md
  2. VERIFY: All assigned tasks marked "✓ Completed"
  3. IF not all complete: REPORT which tasks remain
  4. REGARDLESS: PROCEED to Step 5
</verification>

</step>

## Phase 3: Post-Execution Tasks

<step number="5" name="post_execution_tasks">

### Step 5: Run Task Completion Steps

**MANDATORY**: This phase MUST be executed. Never end without completing these steps.

<instructions>
  1. LOAD: @.agent-os/instructions/core/post-execution-tasks.md
  
  2. EXECUTE: Every step in post-execution-tasks.md process_flow sequentially:
     - Step 1: Run full test suite
     - Step 2: Execute git workflow (commit, push, PR)
     - Step 3: Verify all tasks marked complete
     - Step 4: Update roadmap if applicable
     - Step 5: Create recap document
     - Step 6: Generate completion summary
     - Step 7: Play notification sound
  
  3. WAIT: For each step to complete before proceeding to next
  
  4. VERIFY: All post-execution steps completed successfully
  
  5. REPORT: "Task execution complete. All phases finished successfully."
</instructions>

<completion_checklist>
  □ All assigned tasks executed
  □ Tests run and passing
  □ Code committed and pushed
  □ Pull request created
  □ Tasks marked complete in tasks.md
  □ Roadmap updated (if needed)
  □ Recap document created
  □ Summary generated
  □ Notification played
</completion_checklist>

</step>

</process_flow>

<post_flight_check>
EXECUTE: @.agent-os/instructions/meta/post-flight.md
</post_flight_check>
