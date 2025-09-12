# Spec Tasks

These are the tasks to be completed for the spec detailed in
@.agent-os/specs/2025-09-09-fix-first-hooks-architecture/spec.md

> Created: 2025-09-09 Status: Ready for Implementation

## Tasks

### Task 1: Core QualityChecker Architecture Restructure

**Objective:** Restructure QualityChecker from check-then-fix to fix-first
orchestration pattern

**Dependencies:** None (foundational)

- [x] Write comprehensive tests for fix-first QualityChecker behavior
  - [x] Test fix-first execution flow with ESLint and Prettier engines
  - [x] Test auto-staging of successfully fixed files
  - [x] Test error reporting only includes unfixable issues
  - [x] Test performance characteristics (single vs double execution)
  - [x] Test backward compatibility with existing hook interfaces

- [x] Modify QualityChecker.execute() for fix-first mode
  - [x] Add fix mode parameter to engine execution calls
  - [x] Restructure execution order: fixable engines first, then check-only
        engines
  - [x] Update result collection to track fixed vs unfixed issues
  - [x] Maintain existing interface contracts for backward compatibility

- [x] Implement auto-staging logic within QualityChecker
  - [x] Detect which files were modified by fix operations
  - [x] Integrate git add commands for successfully fixed files
  - [x] Handle git staging failures gracefully
  - [x] Ensure staging only occurs after successful fixes

- [x] Update result filtering and reporting logic
  - [x] Filter out successfully fixed issues from final reports
  - [x] Preserve unfixable issues for user attention
  - [x] Maintain existing error format structure
  - [x] Update issue categorization (fixed vs unfixable)

- [x] Verify all QualityChecker tests pass and performance targets met
  - [x] Confirm 50% execution time reduction achieved
  - [x] Validate error reporting noise reduction (99%+ fixed issues filtered)
  - [x] Ensure no regression in existing functionality
  - [x] Verify clean git history with atomic commits

### Task 2: Engine Integration Updates (ESLint/Prettier)

**Objective:** Enable built-in fix capabilities in ESLint and Prettier engines

**Dependencies:** Task 1 (QualityChecker changes)

- [x] Write tests for enhanced engine fix integration
  - [x] Test ESLintEngine.check() with fix:true parameter
  - [x] Test PrettierEngine.check() with fix:true parameter
  - [x] Test engine result handling for fixed vs unfixed issues
  - [x] Test error cases when fixes cannot be applied
  - [x] Test file modification detection and reporting

- [x] Update ESLintEngine to support built-in fix mode
  - [x] Add fix parameter to check() method signature
  - [x] Implement programmatic ESLint fix execution using engine API
  - [x] Track which files were modified during fix operations
  - [x] Return enhanced results indicating fix status per issue
  - [x] Maintain existing check-only behavior when fix=false

- [x] Update PrettierEngine to support built-in fix mode
  - [x] Add fix parameter to check() method signature (uses 'write' param)
  - [x] Implement programmatic Prettier formatting using engine API
  - [x] Track file modifications and format applications
  - [x] Return results indicating formatting fix status
  - [x] Maintain existing check-only behavior when fix=false

- [x] Remove dependency on external execSync calls
  - [x] Eliminate execSync calls from engine implementations
  - [x] Use native engine APIs for all fix operations
  - [x] Update error handling for programmatic API usage
  - [x] Ensure consistent result formats across engines

- [x] Verify all engine integration tests pass
  - [x] Confirm engines work correctly in both fix and check modes
  - [x] Validate file modification tracking accuracy
  - [x] Ensure performance improvements from eliminating execSync
  - [x] Test error handling for various fix scenarios

### Task 3: Fixer Adapter Simplification and Elimination

**Objective:** Remove or simplify the Fixer adapter by leveraging engine
built-in fixes

**Dependencies:** Task 2 (Engine updates)

- [x] Write tests for simplified or eliminated Fixer functionality
  - [x] Test scenarios that previously required Fixer adapter
  - [x] Test direct engine fix capabilities replace Fixer functionality
  - [x] Test backward compatibility where Fixer might still be needed
  - [x] Test error handling without Fixer intermediary layer

- [x] Analyze Fixer adapter usage patterns
  - [x] Identify all current Fixer adapter usage points (git-hook.ts, claude.ts)
  - [x] Determine which functionality can be eliminated vs simplified (all eliminated)
  - [x] Map Fixer capabilities to engine built-in equivalents (fixFirst mode)
  - [x] Document any remaining Fixer use cases (none)

- [x] Remove or refactor Fixer adapter implementation
  - [x] Eliminate execSync-based fix operations
  - [x] Replace Fixer calls with direct engine fix calls (via fixFirst)
  - [x] Simplify result format conversion logic
  - [x] Remove unnecessary abstraction layers (deleted fixer.ts)

- [x] Update all Fixer adapter consumers
  - [x] Replace Fixer calls with direct engine interactions (using fixFirst in QualityChecker)
  - [x] Update result handling to work with engine responses
  - [x] Maintain existing external interfaces where required
  - [x] Remove unused Fixer imports and references

- [x] Verify Fixer simplification maintains functionality
  - [x] Confirm all previous Fixer capabilities still work (via fixFirst mode)
  - [x] Validate no regression in fix quality or coverage
  - [x] Ensure simplified implementation maintains performance gains
  - [x] Test edge cases that previously relied on Fixer

### Task 4: Git Integration and Auto-staging Implementation

**Objective:** Implement automatic staging of fixed files to create atomic
commits

**Dependencies:** Task 1 (QualityChecker changes)

- [x] Write tests for git auto-staging functionality
  - [x] Test automatic staging of files after successful fixes
  - [x] Test staging failure handling and recovery
  - [x] Test atomic commit behavior with fixes included
  - [x] Test git history cleanliness (no separate style commits)
  - [x] Test staging behavior with various git repository states

- [x] Implement git file modification detection
  - [x] Track which files are modified during fix operations
  - [x] Compare file states before and after fixes
  - [x] Handle file modification edge cases (permissions, locks)
  - [x] Optimize detection to avoid unnecessary git operations

- [x] Implement automatic git add functionality
  - [x] Execute git add for successfully fixed files
  - [x] Handle git staging errors gracefully
  - [x] Provide meaningful error messages for staging failures
  - [x] Ensure staging operations don't interfere with user workflow

- [x] Integrate auto-staging with hook execution flow
  - [x] Call auto-staging after successful fix operations
  - [x] Coordinate staging timing with quality check completion
  - [x] Handle staging in pre-commit vs post-fix contexts
  - [x] Ensure staging works with various git hook scenarios

- [x] Verify git integration produces clean commit history
  - [x] Confirm fixes are included in feature commits atomically
  - [x] Validate elimination of separate "style:" commits
  - [x] Test various git workflow scenarios (rebase, merge, etc.)
  - [x] Ensure staging doesn't interfere with user git operations

### Task 5: Error Reporting Optimization and Performance Validation

**Objective:** Optimize error reporting to surface only unfixable issues and
validate performance targets

**Dependencies:** Tasks 1-4 (All previous tasks)

- [x] Write comprehensive tests for optimized error reporting
  - [x] Test error reporting filters out fixed issues correctly
  - [x] Test unfixable issues are properly surfaced to users
  - [x] Test Claude Code feedback contains minimal formatting noise
  - [x] Test error categorization (fixable vs unfixable)
  - [x] Test performance benchmarks against current implementation

- [x] Implement error reporting noise reduction
  - [x] Filter successfully fixed issues from user reports (done in Task 1)
  - [x] Categorize and prioritize remaining unfixable issues
  - [x] Optimize report format for Claude Code consumption
  - [x] Maintain detailed logging for debugging purposes

- [x] Validate 50% performance improvement target
  - [x] Benchmark current vs new implementation execution times
  - [x] Measure memory usage improvements from eliminating double execution
  - [x] Profile critical path operations for additional optimizations
  - [x] Document performance gains across different project sizes

- [x] Implement comprehensive system integration tests
  - [x] Test complete fix-first flow end-to-end
  - [x] Test integration between all modified components
  - [x] Test various file types and quality issue scenarios
  - [x] Test error recovery and fallback behaviors
  - [x] Test system behavior under load and edge conditions

- [x] Verify all performance and quality targets achieved
  - [x] Confirm 50% execution time reduction achieved
  - [x] Validate 99%+ reduction in Claude Code formatting noise
  - [x] Ensure clean git history with atomic commits
  - [x] Test complete system meets all spec requirements
  - [x] Validate no regressions in existing functionality
