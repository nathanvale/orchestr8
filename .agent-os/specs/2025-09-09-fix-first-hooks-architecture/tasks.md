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

- [ ] Modify QualityChecker.execute() for fix-first mode
  - [ ] Add fix mode parameter to engine execution calls
  - [ ] Restructure execution order: fixable engines first, then check-only
        engines
  - [ ] Update result collection to track fixed vs unfixed issues
  - [ ] Maintain existing interface contracts for backward compatibility

- [ ] Implement auto-staging logic within QualityChecker
  - [ ] Detect which files were modified by fix operations
  - [ ] Integrate git add commands for successfully fixed files
  - [ ] Handle git staging failures gracefully
  - [ ] Ensure staging only occurs after successful fixes

- [ ] Update result filtering and reporting logic
  - [ ] Filter out successfully fixed issues from final reports
  - [ ] Preserve unfixable issues for user attention
  - [ ] Maintain existing error format structure
  - [ ] Update issue categorization (fixed vs unfixable)

- [ ] Verify all QualityChecker tests pass and performance targets met
  - [ ] Confirm 50% execution time reduction achieved
  - [ ] Validate error reporting noise reduction (99%+ fixed issues filtered)
  - [ ] Ensure no regression in existing functionality
  - [ ] Verify clean git history with atomic commits

### Task 2: Engine Integration Updates (ESLint/Prettier)

**Objective:** Enable built-in fix capabilities in ESLint and Prettier engines

**Dependencies:** Task 1 (QualityChecker changes)

- [ ] Write tests for enhanced engine fix integration
  - [ ] Test ESLintEngine.check() with fix:true parameter
  - [ ] Test PrettierEngine.check() with fix:true parameter
  - [ ] Test engine result handling for fixed vs unfixed issues
  - [ ] Test error cases when fixes cannot be applied
  - [ ] Test file modification detection and reporting

- [ ] Update ESLintEngine to support built-in fix mode
  - [ ] Add fix parameter to check() method signature
  - [ ] Implement programmatic ESLint fix execution using engine API
  - [ ] Track which files were modified during fix operations
  - [ ] Return enhanced results indicating fix status per issue
  - [ ] Maintain existing check-only behavior when fix=false

- [ ] Update PrettierEngine to support built-in fix mode
  - [ ] Add fix parameter to check() method signature
  - [ ] Implement programmatic Prettier formatting using engine API
  - [ ] Track file modifications and format applications
  - [ ] Return results indicating formatting fix status
  - [ ] Maintain existing check-only behavior when fix=false

- [ ] Remove dependency on external execSync calls
  - [ ] Eliminate execSync calls from engine implementations
  - [ ] Use native engine APIs for all fix operations
  - [ ] Update error handling for programmatic API usage
  - [ ] Ensure consistent result formats across engines

- [ ] Verify all engine integration tests pass
  - [ ] Confirm engines work correctly in both fix and check modes
  - [ ] Validate file modification tracking accuracy
  - [ ] Ensure performance improvements from eliminating execSync
  - [ ] Test error handling for various fix scenarios

### Task 3: Fixer Adapter Simplification and Elimination

**Objective:** Remove or simplify the Fixer adapter by leveraging engine
built-in fixes

**Dependencies:** Task 2 (Engine updates)

- [ ] Write tests for simplified or eliminated Fixer functionality
  - [ ] Test scenarios that previously required Fixer adapter
  - [ ] Test direct engine fix capabilities replace Fixer functionality
  - [ ] Test backward compatibility where Fixer might still be needed
  - [ ] Test error handling without Fixer intermediary layer

- [ ] Analyze Fixer adapter usage patterns
  - [ ] Identify all current Fixer adapter usage points
  - [ ] Determine which functionality can be eliminated vs simplified
  - [ ] Map Fixer capabilities to engine built-in equivalents
  - [ ] Document any remaining Fixer use cases

- [ ] Remove or refactor Fixer adapter implementation
  - [ ] Eliminate execSync-based fix operations
  - [ ] Replace Fixer calls with direct engine fix calls
  - [ ] Simplify result format conversion logic
  - [ ] Remove unnecessary abstraction layers

- [ ] Update all Fixer adapter consumers
  - [ ] Replace Fixer calls with direct engine interactions
  - [ ] Update result handling to work with engine responses
  - [ ] Maintain existing external interfaces where required
  - [ ] Remove unused Fixer imports and references

- [ ] Verify Fixer simplification maintains functionality
  - [ ] Confirm all previous Fixer capabilities still work
  - [ ] Validate no regression in fix quality or coverage
  - [ ] Ensure simplified implementation maintains performance gains
  - [ ] Test edge cases that previously relied on Fixer

### Task 4: Git Integration and Auto-staging Implementation

**Objective:** Implement automatic staging of fixed files to create atomic
commits

**Dependencies:** Task 1 (QualityChecker changes)

- [ ] Write tests for git auto-staging functionality
  - [ ] Test automatic staging of files after successful fixes
  - [ ] Test staging failure handling and recovery
  - [ ] Test atomic commit behavior with fixes included
  - [ ] Test git history cleanliness (no separate style commits)
  - [ ] Test staging behavior with various git repository states

- [ ] Implement git file modification detection
  - [ ] Track which files are modified during fix operations
  - [ ] Compare file states before and after fixes
  - [ ] Handle file modification edge cases (permissions, locks)
  - [ ] Optimize detection to avoid unnecessary git operations

- [ ] Implement automatic git add functionality
  - [ ] Execute git add for successfully fixed files
  - [ ] Handle git staging errors gracefully
  - [ ] Provide meaningful error messages for staging failures
  - [ ] Ensure staging operations don't interfere with user workflow

- [ ] Integrate auto-staging with hook execution flow
  - [ ] Call auto-staging after successful fix operations
  - [ ] Coordinate staging timing with quality check completion
  - [ ] Handle staging in pre-commit vs post-fix contexts
  - [ ] Ensure staging works with various git hook scenarios

- [ ] Verify git integration produces clean commit history
  - [ ] Confirm fixes are included in feature commits atomically
  - [ ] Validate elimination of separate "style:" commits
  - [ ] Test various git workflow scenarios (rebase, merge, etc.)
  - [ ] Ensure staging doesn't interfere with user git operations

### Task 5: Error Reporting Optimization and Performance Validation

**Objective:** Optimize error reporting to surface only unfixable issues and
validate performance targets

**Dependencies:** Tasks 1-4 (All previous tasks)

- [ ] Write comprehensive tests for optimized error reporting
  - [ ] Test error reporting filters out fixed issues correctly
  - [ ] Test unfixable issues are properly surfaced to users
  - [ ] Test Claude Code feedback contains minimal formatting noise
  - [ ] Test error categorization (fixable vs unfixable)
  - [ ] Test performance benchmarks against current implementation

- [ ] Implement error reporting noise reduction
  - [ ] Filter successfully fixed issues from user reports
  - [ ] Categorize and prioritize remaining unfixable issues
  - [ ] Optimize report format for Claude Code consumption
  - [ ] Maintain detailed logging for debugging purposes

- [ ] Validate 50% performance improvement target
  - [ ] Benchmark current vs new implementation execution times
  - [ ] Measure memory usage improvements from eliminating double execution
  - [ ] Profile critical path operations for additional optimizations
  - [ ] Document performance gains across different project sizes

- [ ] Implement comprehensive system integration tests
  - [ ] Test complete fix-first flow end-to-end
  - [ ] Test integration between all modified components
  - [ ] Test various file types and quality issue scenarios
  - [ ] Test error recovery and fallback behaviors
  - [ ] Test system behavior under load and edge conditions

- [ ] Verify all performance and quality targets achieved
  - [ ] Confirm 50% execution time reduction achieved
  - [ ] Validate 99%+ reduction in Claude Code formatting noise
  - [ ] Ensure clean git history with atomic commits
  - [ ] Test complete system meets all spec requirements
  - [ ] Validate no regressions in existing functionality
