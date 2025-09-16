---
description: Rules to initiate execution of a set of tasks using Agent OS with full optimization and git integration
globs:
alwaysApply: false
version: 2.1
encoding: UTF-8
---

# Task Execution Rules with Optimization and Git Integration

## Overview

Execute tasks for a given spec following three distinct phases with intelligent context optimization and automatic git commits:

1. Pre-execution setup with optimization + git session (Steps 1-3)
2. Optimized task execution loop with auto-commits (Step 4)
3. Post-execution with git finalization (Step 5)

**IMPORTANT**: All three phases MUST be completed. Context and git optimization enable continuous execution of all tasks.

<pre_flight_check>
EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

## Phase 1: Pre-Execution Setup

<step number="1" name="task_assignment">

### Step 1: Task Assignment with Optimization Awareness

Identify tasks to execute, leveraging optimization for batch processing.

<task_selection>
  <optimization_check>
    CHECK: Will optimization be available?
    IF .agent-os/cache/execution-manifest.json will be created:
      DEFAULT: Select ALL uncompleted tasks for batch execution
      REASON: Registry prevents context overflow, enabling continuous execution
    ELSE:
      DEFAULT: Select only next uncompleted task
      REASON: Avoid context window overflow without optimization
  </optimization_check>
  
  <explicit>
    User can override with specific task selection
  </explicit>
</task_selection>

<instructions>
  ACTION: Analyze tasks.md for uncompleted tasks
  COUNT: Total uncompleted parent tasks found
  
  IF optimization will be available:
    SELECT: All uncompleted tasks
    CONFIRM: "Will execute all [N] tasks with optimization (estimated [X]% token savings)"
  ELSE:
    SELECT: Next uncompleted task only
    CONFIRM: "Will execute single task (no optimization)"
</instructions>

</step>

<step number="2" subagent="task-optimizer,context-fetcher" name="context_analysis_and_optimization">

### Step 2: Context Analysis & Optimization

Create optimization manifest for ALL tasks, then pre-load common contexts.

<instructions>
  ACTION: Use task-optimizer subagent:
    - REQUEST: "Analyze [SPEC_FOLDER]/tasks.md and create optimization manifest for all tasks"
    - RECEIVE:
      - Manifest at .agent-os/cache/execution-manifest.json
      - Helper functions for optimized execution
      - Token savings estimate
  
  VERIFY manifest contains:
    - context_registry for tracking loaded files
    - pre_load_contexts list (files used by >30% of tasks)
    - on_demand_contexts list (files used by <30% of tasks)
    - token_calculations showing expected savings
  
  THEN: Pre-load common contexts using helper functions:

    # Get list of contexts to pre-load
    common_files = GET_COMMON_CONTEXTS()
    
    FOR each file in common_files:
      IF SHOULD_PRELOAD(file):
        USE: @agent:context-fetcher
        REQUEST: "Load [file] into context"
        UPDATE_REGISTRY(file, "loaded")
        LOG: "Pre-loaded [file] for use across multiple tasks"
    
    # Also load core context files
    IF "mission-lite.md" not in registry:
      USE: @agent:context-fetcher
      REQUEST: "Load mission-lite.md"
      UPDATE_REGISTRY("mission-lite.md", "loaded")
    
    IF "spec-lite.md" not in registry:
      USE: @agent:context-fetcher
      REQUEST: "Load spec-lite.md"
      UPDATE_REGISTRY("spec-lite.md", "loaded")
</instructions>

<optimization_status>
  REPORT: "Optimization ready:"

- Pre-loaded [N] common contexts
- Registry tracking active
- Expected token savings: [X]%
- Ready for continuous execution
</optimization_status>

</step>

<step number="3" subagent="git-workflow" name="git_session_initialization">

### Step 3: Git Session Initialization (NEW - ENHANCED)

Initialize git session ONCE for entire spec execution with branch creation and session caching.

<git_session_setup>
  ACTION: Extract feature name from spec folder
  COMPUTE:
    spec_folder = [CURRENT_SPEC_FOLDER]  # e.g., "2025-01-16-test-optimization"
    feature_name = spec_folder.replace(/^\d{4}-\d{2}-\d{2}-/, '')  # "test-optimization"
  
  CREATE: Git session cache at .agent-os/cache/git-session.json

 ```json
  {
    "branch_name": "[feature_name]",
    "initial_branch": "[current_branch]",
    "created_at": "[timestamp]",
    "spec_folder": "[spec_folder]",
    "commits": [],
    "commit_count": 0,
    "subtask_commits": []
  }
 ```
  
  ACTION: Use git-workflow subagent
  REQUEST: {
    "action": "session_init",
    "branch_name": "[feature_name]",
    "create_branch_if_needed": true,
    "session_file": ".agent-os/cache/git-session.json"
  }
  
  RECEIVE:
    - Branch created/switched: [feature_name]
    - Session initialized and cached
    - Ready for auto-commits during task execution
  
  REPORT: "Git session initialized:"
    - Feature branch: [feature_name]
    - Session cached for all tasks
    - Auto-commit enabled for subtasks
</git_session_setup>

</step>

## Phase 2: Task Execution Loop

<step number="4" name="task_execution_loop_with_git">

### Step 4: Optimized Task Execution Loop with Auto-Commits

Execute ALL selected tasks with continuous optimization and automatic git commits.

<execution_flow>

# Load task executor once

LOAD: @.agent-os/instructions/core/execute-task.md ONCE

# Verify optimization and git session are active

VERIFY: .agent-os/cache/execution-manifest.json exists
VERIFY: .agent-os/cache/git-session.json exists
VERIFY: Helper functions available from task-optimizer

# Get all tasks to execute

TASKS_TO_EXECUTE = all_tasks_selected_in_step_1
TOTAL_TASKS = count(TASKS_TO_EXECUTE)
RUNNING_TOKEN_SAVINGS = 0
TOTAL_COMMITS = 0

# Execute each parent task

FOR task_number, parent_task in enumerate(TASKS_TO_EXECUTE, 1):
  
  REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  REPORT: "Executing Task {task_number}/{TOTAL_TASKS}: {parent_task.name}"
  REPORT: "Running token savings: {RUNNING_TOKEN_SAVINGS}"
  REPORT: "Commits created: {TOTAL_COMMITS}"
  
# Execute task using execute-task.md

# execute-task.md will

# 1. Read the parent task and all subtasks

# 2. For EACH subtask

# - Call context-fetcher to check registry

# - Load only missing contexts

# - Implement subtask

# - AUTO-COMMIT changes via git-workflow (NEW!)

# - Mark subtask complete

# 3. Mark parent task complete

# 4. Return with metrics
  
  EXECUTE: execute-task.md with parent_task
  RECEIVE:
    - Task completion status
    - Tokens saved for this task
    - Updated registry state
    - Number of commits created (NEW!)
  
# Track cumulative metrics

  RUNNING_TOKEN_SAVINGS += task_tokens_saved
  TOTAL_COMMITS += task_commits_created
  
# Update progress

  UPDATE: tasks.md with parent task marked complete
  
# Continue without context concerns

  IF task_number < TOTAL_TASKS:
    LOG: "Task {task_number} complete with {task_commits_created} commits"
    LOG: "Context preserved via registry - no overflow risk"
  
END FOR

REPORT: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT: "ALL {TOTAL_TASKS} TASKS COMPLETED"
REPORT: "Total tokens saved: {RUNNING_TOKEN_SAVINGS}"
REPORT: "Total commits created: {TOTAL_COMMITS}"
REPORT: "Optimization efficiency: {(RUNNING_TOKEN_SAVINGS / estimated_baseline) * 100}%"
</execution_flow>

<git_commit_tracking>

# The git session cache now contains

# - All subtask commits with messages

# - Commit SHAs for tracking

# - Perfect granular history

</git_commit_tracking>

<continuous_execution_benefits>

- Registry tracks all loaded contexts across tasks
- Git session cached across all tasks (no branch re-detection)
- Each subtask gets atomic commit automatically
- No redundant loading between tasks
- Context window stays manageable
- Can execute 5, 10, even 20+ tasks continuously
- Token savings accumulate with each task
- Clean git history for code review
</continuous_execution_benefits>

</step>

## Phase 3: Post-Execution Tasks

<step number="5" name="post_execution_with_git_finalization">

### Step 5: Run Task Completion Steps with Git Finalization (ENHANCED)

**CRITICAL**: Execute after ALL tasks are implemented, including git push and PR.

<git_finalization>
  ACTION: Use git-workflow subagent for final operations
  REQUEST: {
    "action": "push_and_pr",
    "use_cached_session": true,
    "session_context": ".agent-os/cache/git-session.json",
    "pr_title": "feat: Implement [SPEC_NAME]",
    "batch_mode": false
  }
  
  RECEIVE:
    - All commits pushed to origin
    - PR created with summary
    - PR URL for review
  
  REPORT: "Git finalization complete:"
    - Branch: [feature_name]
    - Commits pushed: {TOTAL_COMMITS}
    - PR URL: [url]
</git_finalization>

<standard_post_execution>
  LOAD: @.agent-os/instructions/core/post-execution-tasks.md once
  ACTION: Execute remaining post-execution steps
  
  INCLUDE:
    - Running full test suite
    - Verifying all tasks completed
    - Updating roadmap (if applicable)
    - Creating recap document with optimization metrics
    - Generating completion summary
    - Playing notification sound
</standard_post_execution>

<optimization_and_git_report>
  GENERATE: Combined performance report
  
  OPTIMIZATION_METRICS:
    - Total tasks executed: [N]
    - Total subtasks completed: [M]
    - Token usage without optimization: [baseline]
    - Token usage with optimization: [actual]
    - Total tokens saved: [savings]
    - Efficiency percentage: [savings/baseline * 100]%
    - Registry hit rate: [cache_hits/total_requests]%
    - Most reused contexts: [top 5 files]
  
  GIT_METRICS:
    - Feature branch: [branch_name]
    - Total commits: {TOTAL_COMMITS}
    - Commits per task: [average]
    - Atomic commits for review: ✓
    - PR created: [url]
    - Git overhead: <[X] seconds total
  
  COMBINED_EFFICIENCY:
    - Development time saved: [Y]%
    - Token cost reduced: [Z]%
    - Review-ready commits: 100%
</optimization_and_git_report>

<cleanup>
  ACTION: Clean up session caches
  REMOVE: .agent-os/cache/git-session.json
  PRESERVE: .agent-os/cache/execution-manifest.json (for analysis)
  LOG: "Session cleanup complete"
</cleanup>

</step>

</process_flow>

<post_flight_check>
EXECUTE: @.agent-os/instructions/meta/post-flight.md
</post_flight_check>

<usage_example>

## Example: Complete Spec Execution with Git

User: "/execute-tasks for spec 2025-01-16-test-optimization"

Step 1: Task Assignment
  Found: 5 uncompleted parent tasks (20 total subtasks)
  Decision: Execute ALL 5 tasks (optimization available)

Step 2: Optimization
  task-optimizer: Created manifest with 40% expected savings
  Pre-loaded: testing-guidelines.md, javascript-style.md
  Registry: Initialized and tracking

Step 3: Git Session Init (NEW!)
  Feature name extracted: "test-optimization"
  Branch created: test-optimization
  Session cached at: .agent-os/cache/git-session.json

Step 4: Execution Loop with Auto-Commits
  
  Task 1/5: Setup API Structure (5 subtasks)
    execute-task.md processes each subtask:
    - Subtask 1.1: Loads best-practices.md (NEW)
      → Auto-commit: "feat: Task 1.1 - Create Express server"
    - Subtask 1.2: Loads javascript-style.md (CACHED - save 1,294)
      → Auto-commit: "style: Task 1.2 - Follow JavaScript code style"
    - Subtask 1.3: Uses cached best-practices.md (save 1,195)
      → Auto-commit: "feat: Task 1.3 - Implement error handling"
    - Subtask 1.4: Loads technical-spec.md (NEW)
      → Auto-commit: "feat: Task 1.4 - Setup project structure"
    - Subtask 1.5: Uses cached javascript-style.md (save 1,294)
      → Auto-commit: "style: Task 1.5 - Configure ESLint"
    Task 1 complete: 3,783 tokens saved, 5 commits created
  
  Task 2/5: User Registration (4 subtasks)
    execute-task.md processes each subtask:
    - All contexts already loaded
    - Each subtask uses cached contexts
    - 4 auto-commits created
    Task 2 complete: 5,200 tokens saved, 4 commits created
  
  [Tasks 3-5 continue similarly]
  
  TOTAL: 5 tasks, 20 subtasks completed
  SAVINGS: 18,500 tokens (42% reduction)
  COMMITS: 20 atomic commits (one per subtask)

Step 5: Post-execution with Git Finalization
  Git: Pushed 20 commits to origin/test-optimization
  PR: Created #42 with full implementation
  Tests: All passing
  Report: Generated with combined metrics
</usage_example>

<critical_success_factors>

## Key Points for Success

1. **Git session initialized ONCE** before any task execution
2. **Branch created ONCE** from spec folder name
3. **Session cached** in git-session.json for all tasks
4. **Task-optimizer runs ONCE** analyzing ALL tasks upfront
5. **Pre-loading happens ONCE** for common contexts
6. **Registry persists** across entire execution
7. **execute-task.md auto-commits** after EACH subtask
8. **Git workflow uses cached session** - no redundant branch detection
9. **Final push happens ONCE** after all tasks complete
10. **PR created automatically** with complete implementation
11. **Token savings accumulate** with each cache hit
12. **Git overhead minimal** - 1-2 seconds per subtask commit
</critical_success_factors>

<performance_comparison>

## Before vs After Git Integration

BEFORE (Manual Git):

- Developer executes tasks
- Manually stages changes
- Creates one large commit
- Loses granular history
- Time: Task execution + 5-10 minutes git work

AFTER (Auto Git):

- Git session initialized once (2 seconds)
- Each subtask auto-commits (1-2 seconds overhead)
- Atomic commits for easy review
- Perfect history preservation
- Time: Task execution + 30 seconds total git overhead
- Result: 20 reviewable commits instead of 1 blob
</performance_comparison>
