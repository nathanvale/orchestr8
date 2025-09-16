---
description: Execute individual tasks with granular context optimization and automatic git commits at the subtask level
globs:
alwaysApply: false
version: 2.1
encoding: UTF-8
---

# Execute Task Instructions

## Overview

Execute a single parent task by implementing all its subtasks with intelligent context management and automatic git commits at the subtask level.

## Execution Protocol

<task_initialization>

## Initialize Task Execution

READ: tasks.md → Current parent task + all subtasks
IDENTIFY: Parent task number and description
COUNT: Total subtasks to complete
VERIFY: Optimization manifest exists at .agent-os/cache/execution-manifest.json
VERIFY: Git session exists at .agent-os/cache/git-session.json
</task_initialization>

<subtask_execution_loop>

## Execute Each Subtask with Context Optimization + Git

FOR each subtask in current_parent_task:
  
# Step 1: Context Check for THIS Subtask

  USE: @agent:context-fetcher
  REQUEST: "Check registry and load contexts needed for subtask [SUBTASK_NUMBER]: [SUBTASK_DESCRIPTION]"
  
# Context-fetcher will

# 1. Parse subtask description (e.g., "Follow JavaScript code style guidelines")

# 2. Map to required files (e.g., javascript-style.md)

# 3. Check manifest.context_registry for already-loaded files

# 4. Skip if loaded (report tokens saved)

# 5. Load if new (update registry)
  
  RECEIVE:
    - Context status (cached vs newly loaded)
    - Tokens saved (if cached)
    - Content ready for use
  
# Step 2: Implement Subtask

  IMPLEMENT: Subtask using provided context
  
# Step 3: Test if Required

  IF subtask_requires_testing:
    USE: @agent:test-runner-chooser
    PROVIDE: Subtask description and test requirements
    EXECUTE: Tests via delegated runner
    VERIFY: Tests pass
  
# Step 4: Update Progress

  UPDATE: tasks.md → Mark subtask complete (✅)
  
# Step 5: Auto-Commit Subtask Changes

  IF implementation_created_changes:
    USE: @agent:git-workflow
    PROVIDE: {
      "action": "subtask_commit",
      "use_cached_session": true,
      "commit_type": "granular",
      "subtask_info": {
        "parent_task": "[PARENT_NUMBER]",
        "subtask_number": "[SUBTASK_NUMBER]",
        "description": "[SUBTASK_DESCRIPTION]"
      },
      "batch_mode": true,
      "skip_branch_detection": true
    }

    # Git-workflow will create commits like:
    # "feat: Task 1.3 - Implement error handling middleware"
    # "test: Task 1.4 - Write unit tests for validation"
    # "style: Task 1.5 - Apply code formatting rules"
    
    RECEIVE: Commit confirmation (minimal in batch mode)
  
# Step 6: Report Metrics

  LOG: "Subtask [NUMBER] complete. Tokens saved: [AMOUNT]. Changes committed."
  
END FOR

# After all subtasks complete

UPDATE: tasks.md → Mark parent task complete (✅)
REPORT: "Task [PARENT_NUMBER] fully complete with [TOTAL_TOKENS_SAVED] tokens saved"
</subtask_execution_loop>

<git_integration_protocol>

## Git Auto-Commit Integration

### Session Verification

CHECK: Git session cache exists at .agent-os/cache/git-session.json
IF not exists:
  ERROR: "Git session not initialized. Run execute-tasks first."
  FALLBACK: Continue without auto-commits

### Commit Strategy

DEFAULT: Commit after each subtask (maximum granularity)
ALTERNATIVE: Batch commits every 3 subtasks if >10 subtasks total
OVERRIDE: Single commit per parent task if explicitly configured

### Commit Message Format

PATTERN: "[type]: Task [parent].[subtask] - [description]"

TYPES:

- feat: New functionality implementation
- test: Test-related changes
- fix: Bug fixes or corrections
- style: Code style/formatting changes
- docs: Documentation updates
- refactor: Code refactoring

EXAMPLES:

- "feat: Task 1.1 - Create Express server with routing"
- "test: Task 1.2 - Add unit tests for auth middleware"
- "style: Task 1.3 - Apply ESLint configuration"
</git_integration_protocol>

<context_optimization_details>

## How Context Optimization Works

### For Each Subtask

1. **Parse Requirements**: Extract what context the subtask needs
   - "Follow JavaScript code style" → javascript-style.md
   - "Implement best practices" → best-practices.md
   - "Write unit tests" → testing-guidelines.md

2. **Check Registry**: Before loading anything
   - IF file in registry AND loaded = true: Skip (use cached)
   - IF not in registry OR loaded = false: Load now

3. **Track Savings**: For every cache hit
   - javascript-style.md cached = 1,294 tokens saved
   - best-practices.md cached = 1,195 tokens saved
   - testing-guidelines.md cached = 797 tokens saved

4. **Update Registry**: After any new load
   - Mark file as loaded
   - Record timestamp
   - Increment access count
</context_optimization_details>

<implementation_workflow>

## Implementation Steps per Subtask

1. **Analyze**: What does this subtask need?
2. **Context**: Load via context-fetcher (with registry check)
3. **Code**: Implement the functionality
4. **Test**: Run tests if applicable
5. **Verify**: Check implementation meets requirements
6. **Commit**: Auto-commit changes with descriptive message
7. **Update**: Mark subtask complete in tasks.md
8. **Next**: Move to next subtask or finish
</implementation_workflow>

<performance_tracking>

## Track Optimization Metrics

PER_SUBTASK:

- Context requests made
- Cache hits vs misses
- Tokens saved
- Implementation time
- Git commit success/failure

PER_TASK:

- Total subtasks completed
- Total tokens saved
- Registry efficiency rate
- Number of commits created
- Overall time

CUMULATIVE:

- Running token savings
- Context reuse percentage
- Git operations overhead
- Optimization effectiveness
</performance_tracking>

<error_handling>

## Error Handling

### Context Loading Failures

IF context-fetcher fails:
  FALLBACK: Direct file reading
  LOG: Optimization unavailable for this subtask
  CONTINUE: With standard context

### Git Commit Failures

IF git-workflow fails:
  LOG: "Git commit failed for subtask [NUMBER] - continuing"
  FLAG: Manual git cleanup needed after task
  CONTINUE: Next subtask (don't block on git)

### Registry Issues

IF registry corrupted or missing:
  RECREATE: New registry from current context
  LOG: Registry rebuilt
  CONTINUE: With fresh registry

### Subtask Failures

IF subtask implementation fails:
  DOCUMENT: Issue in tasks.md
  COMMIT: Work in progress with "WIP: Task X.Y - [issue description]"
  ATTEMPT: Alternative approach
  ESCALATE: If still blocked
</error_handling>

<completion_protocol>

## Task Completion

WHEN all subtasks complete:

1. VERIFY: All subtasks marked ✅ in tasks.md
2. UPDATE: Parent task marked ✅ in tasks.md
3. REPORT: Final metrics
   - Subtasks completed: [COUNT]
   - Total tokens saved: [AMOUNT]
   - Cache hit rate: [PERCENTAGE]
   - Git commits created: [COUNT]
4. LOG: Git history for this task

   ```bash
   # Show commits for this task
   git log --oneline -[SUBTASK_COUNT]
   ```

5. RETURN: Control to execute-tasks.md
6. READY: For next parent task
</completion_protocol>

<example_execution>

## Example: Task 1 with 5 Subtasks

Task 1: Setup API Structure
  
Subtask 1.1: Create Express server
  → context-fetcher: Load best-practices.md (NEW - 0 saved)
  → Implement server setup
  → git-workflow: Commit "feat: Task 1.1 - Create Express server"
  → ✅ Complete

Subtask 1.2: Follow JavaScript code style
  → context-fetcher: Load javascript-style.md (NEW - 0 saved)
  → Apply formatting rules
  → git-workflow: Commit "style: Task 1.2 - Follow JavaScript code style"
  → ✅ Complete

Subtask 1.3: Implement error handling
  → context-fetcher: Check best-practices.md (CACHED - 1,195 saved!)
  → Implement error patterns
  → git-workflow: Commit "feat: Task 1.3 - Implement error handling"
  → ✅ Complete

Subtask 1.4: Setup project structure
  → context-fetcher: Check technical-spec.md (NEW - 0 saved)
  → Create directory structure
  → git-workflow: Commit "feat: Task 1.4 - Setup project structure"
  → ✅ Complete

Subtask 1.5: Configure ESLint
  → context-fetcher: Check javascript-style.md (CACHED - 1,294 saved!)
  → Setup linting rules
  → git-workflow: Commit "style: Task 1.5 - Configure ESLint"
  → ✅ Complete

Task 1 Complete:

- 2,489 tokens saved through caching
- 5 atomic commits created
- Perfect git history for code review
</example_execution>

<git_history_example>

## Resulting Git History

```bash
$ git log --oneline -5
a3f2d1c feat: Task 1.5 - Configure ESLint
b4e3c2d feat: Task 1.4 - Setup project structure  
c5d4b3e feat: Task 1.3 - Implement error handling
d6c5a4f style: Task 1.2 - Follow JavaScript code style
e7b6d5g feat: Task 1.1 - Create Express server
```

Each commit contains only the changes for that specific subtask, making code review straightforward and debugging easier.
</git_history_example>

<performance_benefits>

## Performance Benefits

### Without Optimization

- Manual context loading: 5,000+ tokens per task
- Manual git commits: 60+ seconds overhead
- Lost context between subtasks
- Large, mixed commits

### With This System

- Smart context caching: 60-90% token reduction
- Automatic git commits: 1-2 seconds per subtask
- Context preserved across subtasks
- Atomic, reviewable commits
- Total overhead: <30 seconds for 25 subtasks

### Real Metrics

- Context token savings: ~2,500 per task
- Git session caching: 500 tokens saved per subtask
- No redundant branch detection: 200 tokens × N subtasks
- Total savings: ~10,000+ tokens per full spec
</performance_benefits>

<critical_reminders>

## Critical Points

1. **ALWAYS call context-fetcher for EACH subtask** - enables granular caching
2. **Git session MUST exist** - created by execute-tasks parent controller
3. **Commits are automatic** - no manual git operations needed
4. **Registry persists across all tasks** - continuous optimization
5. **Even if context window compacts**, registry tracks what was loaded
6. **Report token savings** for visibility and validation
7. **Update tasks.md after EACH subtask** - maintain progress tracking
8. **Git commits don't block task execution** - failures are logged but execution continues
</critical_reminders>

<integration_notes>

## Integration with Other Agents

### Required Agents

- @agent:context-fetcher - For smart context loading
- @agent:test-runner-chooser - For test execution
- @agent:git-workflow - For auto-commits

### Session Dependencies

- .agent-os/cache/execution-manifest.json - Context optimization manifest
- .agent-os/cache/git-session.json - Git branch and session data
- .agent-os/cache/context-registry.json - Loaded context tracking

### Parent Controller

- execute-tasks.md initializes git session ONCE
- execute-tasks.md creates optimization manifest
- execute-tasks.md handles final git push and PR

### Communication Protocol

Each agent receives structured data and returns minimal response in batch mode to reduce overhead.
</integration_notes>
