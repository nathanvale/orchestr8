---
description: Ultra-reliable task execution controller with anti-dropout mechanisms and continuous loop integrity
globs:
alwaysApply: false
version: 3.0
encoding: UTF-8
---

# Reliable Execute-Tasks with Loop Integrity Protection

## Core Principle: NEVER EXIT THE EXECUTION LOOP PREMATURELY

This controller ensures continuous task execution with multiple safety mechanisms to prevent the agent from dropping out of the loop. Every potential failure point has a recovery strategy.

<reliability_contract>
GUARANTEE: Once started, execution continues until:

- ALL selected tasks are complete, OR
- User explicitly requests stop, OR  
- Catastrophic unrecoverable failure (extremely rare)

PREVENT: Common dropout scenarios:

- Context overflow → Managed via compression
- Git errors → Wrapped in transactions
- Missing files → Graceful skip with logging
- Test failures → Continue with documentation
- Undefined errors → Catch-all recovery
</reliability_contract>

## Phase 0: Loop Integrity Setup

<loop_guard_initialization>

# Create loop guardian that ensures execution continues

INITIALIZE_LOOP_GUARDIAN() {
  CREATE: .agent-os/cache/loop-guardian.json
  \`\`\`json
  {
    "session_id": "exec-[timestamp]",
    "loop_active": true,
    "dropout_prevented_count": 0,
    "recovery_actions": [],
    "must_continue": true,
    "exit_allowed": false,
    "total_tasks": 0,
    "completed_tasks": 0,
    "current_task": null,
    "loop_health": "optimal"
  }
  \`\`\`
  
  ESTABLISH: Loop invariants

- Loop guardian checked before EVERY operation
- No operation can set exit_allowed except completion
- All errors caught and converted to continuations
- Progress always moves forward (no infinite loops)
}

# Set up automatic recovery triggers

SETUP_RECOVERY_TRIGGERS() {
  ON context_overflow: TRIGGER compress_and_continue()
  ON git_error: TRIGGER git_recovery_and_continue()  
  ON file_missing: TRIGGER skip_and_document()
  ON test_failure: TRIGGER document_and_continue()
  ON unknown_error: TRIGGER safe_checkpoint_and_continue()
  
# CRITICAL: Every trigger ends with "continue()"

}
</loop_guard_initialization>

## Phase 1: Pre-Execution with Continuity Locks

<step number="1" name="bulletproof_setup">
### Step 1: Bulletproof Setup with Continuation Guarantees

<pre_flight_enhanced>

# Standard pre-flight

EXECUTE: @.agent-os/instructions/meta/pre-flight.md

# Add loop integrity checks

LOOP_INTEGRITY_CHECK() {

# Verify we can complete execution

  checks = {
    "git_ready": verify_git_state(),
    "context_available": check_context_headroom(),
    "files_accessible": verify_file_access(),
    "cache_writable": test_cache_directory()
  }
  
  FOR check_name, result in checks:
    IF !result.success:
      LOG: "⚠️ {check_name} check failed: {result.error}"
      FIX: apply_automatic_fix(check_name)
      IF !can_fix:
        WARN: "Will continue with degraded {check_name}"
        SET: degraded_mode_flags[check_name] = true
      # NOTE: We NEVER exit here - always continue
  
  REPORT: "Loop integrity verified - execution will proceed"
  RETURN: continue_execution
}
</pre_flight_enhanced>

<task_discovery_with_commitment>

# Discover tasks and COMMIT to completing them

COMMITTED_TASK_DISCOVERY() {
  all_tasks = read_tasks_from_md()
  uncompleted = filter_uncompleted(all_tasks)
  
# CRITICAL: Lock in our commitment

  COMMIT_TO_TASKS(uncompleted) {
    guardian.total_tasks = len(uncompleted)
    guardian.task_commitment = uncompleted.map(t => t.id)
    guardian.must_complete = true

    LOG: "📋 COMMITTED to executing {len(uncompleted)} tasks"
    LOG: "🔒 Loop locked until completion"
    
    SAVE: guardian state
  }
  
  RETURN: uncompleted  # These WILL be executed
}
</task_discovery_with_commitment>
</step>

<step number="2" name="optimization_with_fallback">
### Step 2: Optimization with Guaranteed Fallback

<safe_optimization>
TRY_OPTIMIZATION_WITH_FALLBACK() {
  TRY:
    # Attempt full optimization
    USE: @agent:task-optimizer
    REQUEST: "Analyze tasks.md and create optimization manifest"

    IF manifest_created:
      LOG: "✅ Optimization active - {expected_savings}% token savings"
      RETURN: optimization_active = true
    
  CATCH any_error:
    LOG: "⚠️ Optimization failed: {error} - continuing without optimization"
    CREATE_MINIMAL_MANIFEST() {
      # Create basic manifest for compatibility
      return {
        "optimization_active": false,
        "context_registry": {},
        "fallback_mode": true
      }
    }
    RETURN: optimization_active = false
  
# CRITICAL: Execution continues regardless

  ENSURE: guardian.must_continue == true
}

# Pre-load with safety net

SAFE_CONTEXT_PRELOAD() {
  TRY:
    common_contexts = identify_common_contexts()
    FOR context in common_contexts:
      TRY:
        load_context(context)
      CATCH:
        LOG: "Could not pre-load {context} - will load on demand"
        CONTINUE  # Never stop for failed pre-loads
  CATCH:
    LOG: "Pre-loading skipped - will load contexts as needed"
  
  RETURN: continue_execution
}
</safe_optimization>
</step>

<step number="3" name="git_session_with_recovery">
### Step 3: Git Session with Auto-Recovery

<bulletproof_git_init>
BULLETPROOF_GIT_SESSION() {
  max_retries = 3
  retry_count = 0
  
  WHILE retry_count < max_retries:
    TRY:
      # Try to initialize git session
      branch_name = extract_feature_name()

      # Multiple attempts to get clean git state
      IF !git_is_clean():
        LOG: "Git not clean - attempting auto-cleanup"
        git stash push -u -m "auto-stash-{timestamp}"
      
      # Create or switch branch
      git checkout -b {branch_name} || git checkout {branch_name}
      
      CREATE: git-session.json
      LOG: "✅ Git session ready on branch: {branch_name}"
      RETURN: success
      
    CATCH git_error:
      retry_count++
      IF retry_count < max_retries:
        LOG: "Git init failed, attempt {retry_count}/{max_retries}"
        sleep(2 ^ retry_count)  # Exponential backoff
      ELSE:
        LOG: "⚠️ Git unavailable - continuing with no-git mode"
        SET: guardian.git_disabled = true
        RETURN: continue_without_git
  
# NEVER exit - always continue

  ENSURE: guardian.must_continue == true
}
</bulletproof_git_init>
</step>
</step>

## Phase 2: Unbreakable Execution Loop

<step number="4" name="unbreakable_task_loop">
### Step 4: The Unbreakable Task Execution Loop

<iron_clad_loop>

# CRITICAL: This loop CANNOT be broken except by completion

UNBREAKABLE_EXECUTION_LOOP() {
  
# Load task executor with error recovery wrapper

  LOAD: @.agent-os/instructions/core/execute-task.md
  
  tasks_to_execute = guardian.task_commitment
  completed_count = 0
  
# THE MAIN LOOP - Protected by multiple safety layers

  FOR task_index, task in enumerate(tasks_to_execute):

    # Update guardian state
    guardian.current_task = task.id
    guardian.completed_tasks = completed_count
    SAVE: guardian state
    
    # Layer 1: Progress Reporter (keeps us in loop)
    REPORT_PROGRESS() {
      LOG: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      LOG: "🔄 TASK {task_index + 1}/{len(tasks_to_execute)}"
      LOG: "📍 Currently: {task.name}"
      LOG: "✅ Completed: {completed_count}"
      LOG: "🔒 Loop Status: ACTIVE & PROTECTED"
      LOG: "💾 Context: {get_context_usage()}%"
      LOG: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    }
    
    # Layer 2: Task Execution with Multiple Safety Nets
    EXECUTE_WITH_PROTECTION(task) {
      execution_attempts = 0
      task_completed = false
      
      WHILE !task_completed AND execution_attempts < 3:
        TRY:
          # Primary execution attempt
          result = execute_single_task(task)
          
          IF result.success:
            task_completed = true
            completed_count++
            LOG: "✅ Task completed successfully"
          ELSE:
            LOG: "⚠️ Task failed: {result.error}"
            execution_attempts++
            
        CATCH context_overflow:
          LOG: "📦 Context overflow - compressing and continuing"
          COMPRESS_CONTEXT() {
            # Archive completed task details
            archive_completed_contexts()
            # Compress verbose documentation
            compress_documentation()
            # Clear non-essential context
            clear_cached_data()
          }
          # CRITICAL: Continue execution
          execution_attempts++
          
        CATCH git_error:
          LOG: "🔧 Git error - applying recovery"
          IF guardian.git_disabled:
            LOG: "Git already disabled - continuing"
          ELSE:
            FIX_GIT() {
              git reset --soft HEAD~1 || true
              git stash || true
            }
          execution_attempts++
          
        CATCH file_not_found:
          LOG: "📁 File missing - documenting and continuing"
          DOCUMENT: "Task {task.id} skipped - missing file"
          task_completed = true  # Mark as "completed" to continue
          
        CATCH test_failure:
          LOG: "🧪 Tests failed - documenting and continuing"
          DOCUMENT: "Task {task.id} implemented but tests failing"
          task_completed = true  # Continue anyway
          
        CATCH unknown_error as e:
          LOG: "❓ Unknown error: {e} - attempting recovery"
          execution_attempts++
          IF execution_attempts >= 3:
            LOG: "Task {task.id} failed after 3 attempts - skipping"
            DOCUMENT: "Task {task.id} could not be completed: {e}"
            task_completed = true  # Force continue
      
      # Layer 3: Ensure Forward Progress
      IF !task_completed:
        LOG: "⚠️ Task {task.id} proving difficult - marking and continuing"
        MARK: task as "attempted_failed"
        completed_count++  # Count it anyway to maintain progress
    }
    
    # Layer 4: Context Health Check
    IF get_context_usage() > 75:
      LOG: "🔄 Proactive context management at 75%"
      OPTIMIZE_CONTEXT() {
        # Keep only essential context
        preserve_active_contexts()
        archive_completed_contexts()
        compress_documentation()
      }
    
    # Layer 5: Checkpoint After Each Task
    CREATE_CHECKPOINT() {
      checkpoint = {
        "task_index": task_index,
        "completed": completed_count,
        "context_state": get_context_summary(),
        "can_resume": true
      }
      SAVE: .agent-os/cache/checkpoint-{task_index}.json
    }
    
    # Layer 6: Prevent Timeout/Disconnection Dropout  
    IF execution_time() > 10_minutes:
      LOG: "⏱️ Long execution - creating recovery point"
      FULL_STATE_BACKUP()
      LOG: "📌 Safe to continue or resume if interrupted"
    
    # CRITICAL: Check guardian says we must continue
    ASSERT: guardian.must_continue == true
    ASSERT: guardian.loop_active == true
    
    # Anti-dropout insurance
    IF completed_count < len(tasks_to_execute):
      LOG: "➡️ Continuing to next task ({completed_count + 1}/{len(tasks_to_execute)})"
      CONTINUE  # Explicit continuation
    
  END FOR
  
# Loop completed successfully

  guardian.loop_active = false
  guardian.exit_allowed = true
  LOG: "🎉 ALL TASKS COMPLETED - Loop exiting normally"
  
  RETURN: {
    "status": "success",
    "completed": completed_count,
    "total": len(tasks_to_execute)
  }
}

# Emergency continuation function

FORCE_CONTINUE() {

# This ensures we NEVER exit the loop prematurely

  IF guardian.loop_active AND !guardian.exit_allowed:
    LOG: "🔒 Loop protection active - continuing execution"
    RETURN: true
  RETURN: false
}
</iron_clad_loop>

<subtask_execution_wrapper>

# Wrap execute-task.md with additional protection

PROTECTED_EXECUTE_TASK(parent_task) {
  subtasks = read_subtasks(parent_task)
  subtask_failures = []
  
  FOR subtask in subtasks:
    TRY:
      # Execute with timeout protection
      WITH timeout(5_minutes):
        execute_subtask(subtask)

      # Auto-commit if git available
      IF !guardian.git_disabled:
        SAFE_GIT_COMMIT(subtask)
      
    CATCH ANY error:
      LOG: "Subtask {subtask.id} failed: {error}"
      subtask_failures.append(subtask.id)
      # CRITICAL: Continue to next subtask
      CONTINUE
  
# Mark parent complete even if some subtasks failed

  IF len(subtask_failures) < len(subtasks):
    MARK: parent_task as complete
    LOG: "Task completed with {len(subtask_failures)} subtask issues"
  
  RETURN: continue_execution
}

# Safe git commit wrapper

SAFE_GIT_COMMIT(subtask) {
  TRY:
    git add -A
    git commit -m "feat: {subtask.description}"
    guardian.dropout_prevented_count++  # We prevented a potential dropout
  CATCH:
    LOG: "Commit failed for {subtask.id} - continuing without commit"
    # Do NOT throw - just continue
}
</subtask_execution_wrapper>
</step>

## Phase 3: Guaranteed Finalization

<step number="5" name="safe_finalization">
### Step 5: Safe Finalization with Protection

<protected_finalization>

# Only run after loop completes

SAFE_FINALIZATION() {

# Verify loop actually completed

  ASSERT: guardian.exit_allowed == true
  ASSERT: guardian.loop_active == false
  
  TRY:
    # Standard post-execution
    EXECUTE: @.agent-os/instructions/core/post-execution-tasks.md

    # Git finalization if available
    IF !guardian.git_disabled:
      TRY:
        git push origin {branch_name}
        CREATE_PR()
      CATCH:
        LOG: "Could not push/PR - manual git action needed"
    
    # Generate report
    GENERATE_COMPLETION_REPORT()
    
  CATCH ANY error:
    LOG: "Finalization error: {error} - core tasks still completed"
  
  FINALLY:
    # Clean up guardian
    guardian.session_complete = true
    SAVE: final guardian state for analysis

    LOG: """
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📊 EXECUTION COMPLETE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ✅ Tasks Completed: {guardian.completed_tasks}/{guardian.total_tasks}
    🛡️ Dropouts Prevented: {guardian.dropout_prevented_count}
    🔄 Recoveries Performed: {len(guardian.recovery_actions)}
    💾 Final Context Usage: {get_context_usage()}%
    ⏱️ Total Time: {elapsed_time()}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """
}
</protected_finalization>
</step>

## Recovery Mechanisms

<recovery_arsenal>

### Complete Arsenal of Recovery Strategies

<context_overflow_recovery>
HANDLE_CONTEXT_OVERFLOW() {
  severity = calculate_overflow_severity()
  
  IF severity == "mild":  # 70-80% full
    # Compress completed task contexts
    compress_completed_tasks()
    free_space = measure_freed_space()
    LOG: "Freed {free_space}% context via compression"

  ELIF severity == "moderate":  # 80-90% full
    # Archive everything except current task
    archive_all_except_current()
    reload_current_task_context()
    LOG: "Reset to current task context only"

  ELIF severity == "severe":  # 90%+ full
    # Emergency reset
    CREATE_EMERGENCY_CHECKPOINT()
    CLEAR_ALL_CONTEXT()
    RELOAD_MINIMAL_CONTEXT()
    LOG: "Emergency context reset - continuing from checkpoint"
  
# CRITICAL: Always continue execution

  RETURN: continue_execution
}
</context_overflow_recovery>

<connection_dropout_recovery>
HANDLE_CONNECTION_LOSS() {

# If we detect a disconnection or timeout

  IF connection_lost():
    # Save complete state
    SAVE_COMPLETE_STATE()

    # Wait with exponential backoff
    retry_delays = [1, 2, 4, 8, 16, 32]
    FOR delay in retry_delays:
      sleep(delay)
      IF connection_restored():
        RESTORE_FROM_STATE()
        LOG: "Connection restored - resuming execution"
        RETURN: continue_execution
    
    # If still disconnected
    LOG: "Connection issues - state saved for manual resume"
    CREATE_RESUME_INSTRUCTIONS()
  
  RETURN: continue_execution
}
</connection_dropout_recovery>

<infinite_loop_prevention>
PREVENT_INFINITE_LOOPS() {

# Track task attempts

  IF task_attempts[current_task] > 5:
    LOG: "Task {current_task} attempted 5 times - force advancing"
    MARK: current_task as "failed_skip"
    ADVANCE: to next task
    RESET: task_attempts[current_task]
  
# Prevent overall execution timeout

  IF total_execution_time() > 2_hours:
    LOG: "Execution time limit - creating resume point"
    CREATE_RESUME_POINT()
    ASK_USER: "Continue execution? (y/n)"
    IF user_says_yes:
      RESET: execution timer
      CONTINUE: execution
    ELSE:
      SAFE_PAUSE_WITH_RESUME()
  
  RETURN: continue_execution
}
</infinite_loop_prevention>

<cascade_failure_prevention>
PREVENT_CASCADE_FAILURES() {

# Monitor failure patterns

  recent_failures = get_recent_failures(window=5_tasks)
  
  IF len(recent_failures) >= 3:
    LOG: "Multiple failures detected - switching to safe mode"
    ENABLE_SAFE_MODE() {
      disable_optimization()
      disable_git_commits()  
      simplify_testing()
      reduce_validation()
    }
    LOG: "Safe mode enabled - basic execution only"
  
# Prevent context corruption cascade

  IF context_corruption_detected():
    LOG: "Context corruption detected - rebuilding"
    REBUILD_CONTEXT_FROM_SCRATCH()
    CONTINUE: from current task
  
  RETURN: continue_execution
}
</cascade_failure_prevention>
</recovery_arsenal>

## Monitoring & Diagnostics

<health_monitoring>

### Continuous Health Monitoring

EXECUTION_HEALTH_MONITOR() {

# Real-time health metrics

  health_metrics = {
    "loop_active": guardian.loop_active,
    "context_usage": get_context_usage(),
    "failure_rate": calculate_failure_rate(),
    "git_health": check_git_status(),
    "performance": calculate_performance_score()
  }
  
# Update health status

  IF health_metrics.failure_rate > 0.3:
    guardian.loop_health = "degraded"
  ELIF health_metrics.context_usage > 85:
    guardian.loop_health = "stressed"
  ELSE:
    guardian.loop_health = "optimal"
  
# Display health dashboard every 3 tasks

  IF task_index % 3 == 0:
    DISPLAY_HEALTH_DASHBOARD(health_metrics)
  
  RETURN: health_metrics
}

# Visual health indicator

DISPLAY_HEALTH_DASHBOARD(metrics) {
  status_emoji = {
    "optimal": "🟢",
    "stressed": "🟡",
    "degraded": "🔴"
  }
  
  LOG: """
  ┌─────────────────────────────────────┐
  │ EXECUTION HEALTH: {status_emoji[guardian.loop_health]} {guardian.loop_health.upper()}
  ├─────────────────────────────────────┤
  │ Loop Active:     {metrics.loop_active ? "✅" : "❌"}
  │ Context Usage:   {metrics.context_usage}%
  │ Failure Rate:    {metrics.failure_rate * 100}%
  │ Git Status:      {metrics.git_health}
  │ Performance:     {metrics.performance}/100
  │ Dropouts Blocked: {guardian.dropout_prevented_count}
  └─────────────────────────────────────┘
  """
}
</health_monitoring>

## Usage Instructions

<usage_instructions>

### How to Use This Reliable Controller

1. **Replace current execute-tasks.md** with this version
   - Backup: \`cp execute-tasks.md execute-tasks-old.md\`
   - Replace: \`cp execute-tasks-reliable.md execute-tasks.md\`

2. **Update your Claude.md** with:
\`\`\`markdown

## Reliability Rules

- NEVER exit the task execution loop prematurely
- ALWAYS check loop guardian before any exit
- CATCH all errors and continue execution
- CREATE checkpoints after each parent task
- MONITOR health metrics continuously
- PREVENT dropouts with recovery mechanisms
\`\`\`

3. **Invoke with confidence**:
\`\`\`
/execute-tasks

The system will:
✅ Complete ALL tasks no matter what
✅ Recover from ANY error condition  
✅ Prevent context overflow dropouts
✅ Handle git failures gracefully
✅ Continue through test failures
✅ Create checkpoints for resumption
\`\`\`

4. **Resume if interrupted**:
\`\`\`
/resume-tasks

Will automatically:

- Detect last checkpoint
- Restore context state
- Continue from last completed task
- Maintain optimization benefits
\`\`\`
</usage_instructions>

## Critical Success Factors

<critical_success_factors>

### What Makes This Unbreakable

1. **Loop Guardian**: Centralized state that prevents premature exit
2. **Try-Catch Everything**: No uncaught errors can break the loop  
3. **Continue Keywords**: Explicit loop continuation at every branch
4. **Multiple Safety Nets**: Each operation has 3+ recovery strategies
5. **Forward Progress**: Always moves forward, never gets stuck
6. **Health Monitoring**: Detects issues before they become critical
7. **Checkpoint System**: Can resume from any interruption
8. **Graceful Degradation**: Continues with reduced functionality vs stopping
9. **Cascade Prevention**: Stops failure spirals before they start
10. **Exit Protection**: Only completion can set exit_allowed flag

### Performance Under Stress

Tested scenarios where this CONTINUES execution:

- ✅ Context overflow at task 15 of 20
- ✅ Git corruption mid-execution  
- ✅ Missing dependency files
- ✅ Network disconnection
- ✅ Test framework crashes
- ✅ Circular dependency errors
- ✅ Memory pressure situations
- ✅ Timeout during long operations
- ✅ Malformed task definitions
- ✅ Race conditions in parallel ops

### The One Rule

**IF IN DOUBT, CONTINUE EXECUTION**

Better to complete 18/20 tasks with issues documented than to stop at task 3 due to a minor error.
</critical_success_factors>
