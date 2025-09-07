---
description: Rules to initiate execution of a set of tasks using Agent OS
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---
	
# Task Execution Rules

## Overview

Execute tasks for a given spec following three MANDATORY sequential phases.

### ⛔ PROCESS ENFORCEMENT RULES ⛔

```
RULE 1: You CANNOT proceed to Phase 2 until ALL Phase 1 steps are COMPLETE
RULE 2: You CANNOT proceed to Phase 3 until ALL Phase 2 tasks are COMPLETE
RULE 3: You CANNOT end this command until Phase 3 is COMPLETE
RULE 4: You MUST use TodoWrite to track ALL task progress
RULE 5: Skipping ANY step requires EXPLICIT user override

VIOLATION CONSEQUENCE: Task execution will FAIL and require full restart
```

### Phase Structure:

1. **Pre-execution setup** (Steps 1-3) - Setup and validation
2. **Task execution loop** (Step 4) - Implementation work
3. **Post-execution tasks** (Step 5) - Finalization

### 🔴 VALIDATION CHECKPOINT 🔴

Before reading further, confirm you understand:

- [ ] I will complete ALL steps in sequence
- [ ] I will NOT skip ahead to implementation
- [ ] I will use TodoWrite for progress tracking
- [ ] I understand violations cause failure

### Sequential Execution Rule

```
ENFORCEMENT: Phases MUST be completed sequentially:
- Phase 1 (Setup): Complete ALL steps → FULL STOP → Validate
- Phase 2 (Implementation): Execute tasks → FULL STOP → Validate
- Phase 3 (Post-execution): Finalize → FULL STOP → Complete

VIOLATION PROTOCOL: If you skip a phase boundary validation:
1. IMMEDIATELY output: "CHECKPOINT VIOLATION DETECTED"
2. STOP all current work
3. Return to last validated checkpoint
4. Re-execute from that point
```

<pre_flight_check> EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

## Phase 1: Pre-Execution Setup

<step number="1" name="task_assignment" validation="required">

### Step 1: Task Assignment

Identify which tasks to execute from the spec.

#### 🛑 STEP 1 GATE CHECK 🛑

```
BEFORE PROCEEDING:
1. You MUST use TodoWrite to create task tracking list
2. You MUST get explicit user confirmation
3. You MUST NOT start any implementation work

IF YOU SKIP THIS: Execution will fail
```

<task_selection> <explicit> IF user provides specific_tasks array: USE: Exact
task numbers provided </explicit> <implicit> IF no specific tasks provided: 1.
READ: spec's tasks.md file 2. FIND: First parent task where status != "✓
Completed" 3. SELECT: That task and all its subtasks </implicit>
</task_selection>

<instructions>
  1. USE TodoWrite: Create todo list with ALL identified tasks
  2. DETERMINE: Task selection method (explicit vs implicit)
  3. IDENTIFY: Target task(s) to execute
  4. OUTPUT: "I will execute: [numbered list of tasks]"
  5. ASK: "Do you want me to proceed with these tasks?"
  6. WAIT: For user confirmation (yes/no)
  7. VALIDATE: User said "yes" before continuing
</instructions>

<validation_checklist> ☐ TodoWrite used to create task list ☐ Tasks clearly
identified and listed ☐ User confirmation explicitly received ☐ No
implementation work started </validation_checklist>

</step>

<step number="2" name="context_analysis">

### Step 2: Context Analysis

Gather minimal necessary context for task understanding.

#### 🛑 STEP 2 GATE CHECK 🛑

```
IMPLEMENTATION NOTE: If subagent doesn't exist:
- READ files directly using Read tool
- DO NOT skip this step
- DO NOT proceed without context
```

<instructions>
  1. LOAD CONTEXT (use Read tool if no subagent):
     
     REQUEST 1: "Load the spec tasks.md file from [SPEC_PATH]/tasks.md"
     
     REQUEST 2 (if not in context): "Get product pitch from @.agent-os/product/mission-lite.md"
     
     REQUEST 3 (if not in context): "Get spec summary from [SPEC_PATH]/spec-lite.md"
     
     REQUEST 4 (if not in context): "Get technical approach from [SPEC_PATH]/sub-specs/technical-spec.md"
  
  2. WAIT: For subagent to return all requested information
  3. VERIFY: Essential context loaded successfully
</instructions>

<context_requirements> <mandatory> - tasks.md (MUST exist and be loaded)
</mandatory> <optional> - mission-lite.md (load if exists) - spec-lite.md (load
if exists) - technical-spec.md (load if exists) </optional>
</context_requirements>

</step>

<step number="3" name="git_branch_management">

### Step 3: Git Branch Management

Ensure proper git branch isolation for the spec.

#### 🛑 STEP 3 GATE CHECK 🛑

```
IMPLEMENTATION NOTE: If subagent doesn't exist:
- USE Bash tool for git commands directly
- DO NOT skip this step
- MUST be on correct branch before Phase 2
```

<instructions>
  1. EXTRACT: Spec folder name from spec_srd_reference path
  2. DERIVE: Branch name by removing date prefix from folder name
     Example: "2025-03-15-password-reset" → "password-reset"
  
  3. EXECUTE GIT WORKFLOW (use Bash if no subagent):
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

## 🛑 MANDATORY PHASE 1 COMPLETION GATE 🛑

<phase_1_validation enforcement="BLOCKING">

### Phase 1 Exit Validation

**CRITICAL**: You MUST output the following validation BEFORE proceeding to
Phase 2.

<mandatory_output> You MUST output EXACTLY this format:

```
=== PHASE 1 COMPLETION VALIDATION ===

Step 1 - Task Assignment:
✅ TodoWrite used: [Yes/No - specify number of tasks created]
✅ Tasks identified: [List the specific tasks]
✅ User confirmation: [Yes/No - quote user's response]

Step 2 - Context Analysis:
✅ Files loaded: [List each file loaded]
✅ Context understood: [Yes/No]
✅ Technical requirements: [Briefly state key requirements]

Step 3 - Git Branch:
✅ Current branch: [State branch name]
✅ Branch correct: [Yes/No]
✅ Working tree: [Clean/Has changes]

TodoWrite Status:
✅ Task list active: [Yes/No - show current in_progress task]
✅ Total tasks: [Number]

ALL CHECKS PASSED: [Yes/No]
=== VALIDATION COMPLETE ===
```

</mandatory_output>

<enforcement_rules> IF output != mandatory_output format: ERROR: "Phase 1
validation incomplete" ACTION: DO NOT proceed to Phase 2 REQUIREMENT: Complete
validation output first

IF "ALL CHECKS PASSED" != "Yes": ERROR: "Phase 1 has incomplete items"  
 ACTION: Return to incomplete step REQUIREMENT: Complete ALL Phase 1 steps
before proceeding </enforcement_rules>

</phase_1_validation>

## Phase 2: Task Execution Loop

<step number="4" name="task_execution_loop">

### Step 4: Task Execution Loop

#### 🔴 CRITICAL MANDATORY LOOP 🔴

#### ⚠️ FAILURE TO EXECUTE THIS LOOP = COMPLETE RESTART ⚠️

#### YOU MUST EXECUTE THE FOLLOWING LOOP OR THE ENTIRE PROCESS FAILS

<pre_loop_commitment_gate enforcement="MANDATORY">

### LOOP COMMITMENT GATE - REQUIRED OUTPUT

You MUST output this EXACT commitment before proceeding:

```
=== LOOP COMMITMENT GATE ===
I ACKNOWLEDGE: I must execute EACH task using execute-task.md
TASK COUNT: [N] tasks to process
LOOP STRUCTURE: FOR i=0 to N-1: LOAD execute-task.md → EXECUTE → COMPLETE
CONFIRMED: I will NOT skip to implementation
CONFIRMED: I will follow the 7-step process in execute-task.md for EACH task
=== GATE CONFIRMED ===
```

IF you do not output this commitment:

- ERROR: "LOOP COMMITMENT MISSING"
- ACTION: HALT all execution
- REQUIREMENT: Output commitment before continuing

</pre_loop_commitment_gate>

#### 🔒 PHASE 2 ENTRY VALIDATION 🔒

<implementation_gate enforcement="MANDATORY">

**STOP**: Before ANY implementation code (Write, Edit, MultiEdit, Bash
modifications):

<required_validation> You MUST output this EXACT validation:

```
=== PHASE 2 ENTRY CHECKPOINT ===
[ ] Phase 1 Validation Output Complete
[ ] Todo List Shows Task In Progress
[ ] Context Files Accessible
[ ] Implementation Plan Clear
[ ] Loop Commitment Gate Completed

PROCEEDING TO IMPLEMENTATION: [Yes/No]
=== CHECKPOINT PASSED ===
```

ONLY after outputting the above with "PROCEEDING TO IMPLEMENTATION: Yes" may
you:

- Write any files
- Edit any code
- Run modifying commands
- Create directories
- Execute implementation tasks </required_validation>

<violation_detection> IF you start coding without the checkpoint output:

1. IMMEDIATELY STOP
2. Output: "CHECKPOINT VIOLATION - Rolling back to Phase 2 entry"
3. Delete/revert any changes made
4. Output the required validation
5. Only then proceed with implementation </violation_detection>

</implementation_gate>

### VISUAL LOOP STRUCTURE - MANDATORY TO FOLLOW

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ CRITICAL LOOP - DO NOT SKIP ⚠️                  │
├─────────────────────────────────────────────────────┤
│ FOR EACH task in assigned_tasks:                   │
│   1. LOAD execute-task.md                          │
│   2. EXECUTE ALL 7 STEPS from execute-task.md      │
│   3. COMPLETE task fully                           │
│   4. OUTPUT progress tracker                       │
│   5. NEXT task                                     │
└─────────────────────────────────────────────────────┘
```

<loop_validation_questions enforcement="MANDATORY">

Before starting EACH iteration, you MUST answer:

```
LOOP VALIDATION CHECKLIST:
□ Did I load execute-task.md? [Y/N]
□ Am I inside the WHILE loop? [Y/N]
□ Is current_index < length(assigned_tasks)? [Y/N]
□ Am I following the 7-step process from execute-task.md? [Y/N]

IF ANY = N: STOP AND RESTART STEP 4
```

</loop_validation_questions>

<execution_algorithm>

1. LOAD (once): @.agent-os/instructions/core/execute-task.md

2. SET: assigned_tasks = tasks from Step 1
3. SET: current_index = 0

4. WHILE current_index < length(assigned_tasks):

   <!-- MANDATORY PROGRESS OUTPUT -->

   OUTPUT:

   ```
   === LOOP PROGRESS ===
   Task [current_index + 1] of [length(assigned_tasks)]: STARTING
   Task Description: [current_task.description]
   - Loading execute-task.md...
   - Executing 7-step process...
   ```

   a. GET: current_task = assigned_tasks[current_index] b. EXECUTE: Instructions
   from execute-task.md with:
   - parent_task_number = current_task.number
   - subtasks = current_task.subtasks c. WAIT: Until current_task is fully
     complete d. UPDATE: tasks.md to mark current_task as "✓ Completed"

   <!-- MANDATORY COMPLETION OUTPUT -->

   OUTPUT:

   ```
   Task [current_index + 1] of [length(assigned_tasks)]: COMPLETE
   NEXT: Task [current_index + 2] of [length(assigned_tasks)]
   ===
   ```

   e. INCREMENT: current_index += 1 f. CHECK: If user requests stop, BREAK loop

5. VERIFY: All assigned tasks show "✓ Completed" in tasks.md

6. **MANDATORY**: PROCEED to Step 5 (Phase 3) </execution_algorithm>

<auto_detection_violation> IF (code_written OR file_edited OR command_executed)
AND NOT inside_loop: TRIGGER: "CRITICAL VIOLATION: Skipped execution loop"
OUTPUT: "⚠️ CRITICAL ERROR: Implementation started without loop ⚠️" ROLLBACK:
All changes RESTART: From Step 4 beginning with Loop Commitment Gate
</auto_detection_violation>

<step_4_exit_gate enforcement="MANDATORY">

At the end of Step 4, you MUST output:

```
=== STEP 4 LOOP COMPLETION ===
TASKS PROCESSED: [list each task and status]
LOOP ITERATIONS COMPLETED: [N]
EXECUTE-TASK.MD LOADED: [N] times
ALL TASKS COMPLETE: [Yes/No]
=== LOOP VERIFIED COMPLETE ===
```

IF this output is missing:

- ERROR: "Step 4 incomplete"
- ACTION: Cannot proceed to Step 5
- REQUIREMENT: Complete loop and output verification

</step_4_exit_gate>

<loop_termination> <normal_exit> CONDITION: current_index >=
length(assigned_tasks) ACTION: Proceed immediately to Step 5 </normal_exit>
<early_exit> CONDITION: User explicitly requests "stop" or "pause" ACTION: Save
progress and ask if user wants to continue later </early_exit> <error_exit>
CONDITION: Blocking error that cannot be resolved ACTION: Report error, save
progress, await user guidance </error_exit> </loop_termination>

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

**MANDATORY**: This phase MUST be executed. Never end without completing these
steps.

Please update my context, my executeTasksMD to implement this.<instructions>
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

<completion_checklist> □ All assigned tasks executed □ Tests run and passing □
Code committed and pushed □ Pull request created □ Tasks marked complete in
tasks.md □ Roadmap updated (if needed) □ Recap document created □ Summary
generated □ Notification played </completion_checklist>

</step>

</process_flow>

<post_flight_check> EXECUTE: @.agent-os/instructions/meta/post-flight.md
</post_flight_check>
