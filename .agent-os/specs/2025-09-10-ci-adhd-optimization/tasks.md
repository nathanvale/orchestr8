# Spec Tasks

## Tasks

- [x] 1. Split Monolithic Quality Job into Modular Jobs
  - [x] 1.1 Write tests for job splitting functionality
  - [x] 1.2 Create separate lint job with emoji indicator and 5-minute timeout
  - [x] 1.3 Create separate format job with conditional logic for changed files
  - [x] 1.4 Create separate typecheck job for production and test configs
  - [x] 1.5 Create separate build job with performance monitoring
  - [x] 1.6 Remove old monolithic quality job
  - [x] 1.7 Update CI status aggregator to include new jobs
  - [x] 1.8 Verify all new jobs run in parallel and pass tests

- [x] 2. Implement Progressive Testing Strategy
  - [x] 2.1 Write tests for progressive testing tiers
  - [x] 2.2 Create test:smoke script for 30-second quick tests
  - [x] 2.3 Implement test-quick job for PRs with bail-fast behavior
  - [x] 2.4 Implement test-focused job for changed files only
  - [x] 2.5 Configure test-full job with coverage for main branch
  - [x] 2.6 Add job dependencies for progressive test flow
  - [x] 2.7 Add label-based override for full tests on PRs
  - [x] 2.8 Verify progressive testing reduces feedback time to under 1 minute

- [ ] 3. Add Visual Feedback and Status Reporting
  - [ ] 3.1 Write tests for GitHub step summaries generation
  - [ ] 3.2 Create reusable status-reporter action component
  - [ ] 3.3 Implement status table generation with emoji indicators
  - [ ] 3.4 Add PR comment system for failure instructions
  - [ ] 3.5 Create fix command mapping for each job type
  - [ ] 3.6 Implement progress tracking in PR descriptions
  - [ ] 3.7 Add duration and performance metrics to summaries
  - [ ] 3.8 Verify visual feedback appears without clicking into logs

- [ ] 4. Optimize Caching and Performance
  - [ ] 4.1 Write tests for cache effectiveness
  - [ ] 4.2 Fix dependency installation to check cache-hit properly
  - [ ] 4.3 Implement smart cache keys with proper restore fallbacks
  - [ ] 4.4 Add performance monitoring script with thresholds
  - [ ] 4.5 Remove misleading scripts (governance, lint:deep, build:perf:guard)
  - [ ] 4.6 Add honest replacement scripts with real functionality
  - [ ] 4.7 Configure --prefer-offline for faster installs
  - [ ] 4.8 Verify cache hit rate exceeds 80% for unchanged dependencies

- [ ] 5. Implement ADHD-Specific Optimizations
  - [ ] 5.1 Write tests for cognitive load reducers
  - [ ] 5.2 Limit each job to maximum 3 steps
  - [ ] 5.3 Simplify bash conditionals to single-line checks
  - [ ] 5.4 Add clear timeout limits in job names
  - [ ] 5.5 Implement one-click fix commands in PR comments
  - [ ] 5.6 Add breadcrumb navigation for pipeline position
  - [ ] 5.7 Create failure recovery hints with specific commands
  - [ ] 5.8 Verify cognitive load reduction meets 40-50% target
