# Spec Tasks

## Tasks

- [x] 1. Audit and Categorize Existing CI Tests
  - [x] 1.1 Write tests for test audit functionality
  - [x] 1.2 Inventory all CI-related test files using grep/find
  - [x] 1.3 Create categorization matrix (MAJOR REWRITE, MODERATE UPDATE, MINOR
        ALIGNMENT, REMOVE)
  - [x] 1.4 Document each test's expected vs actual behavior
  - [x] 1.5 Verify all tests catalogued and categorized

- [ ] 2. Update Critical Workflow Tests
  - [ ] 2.1 Write tests for workflow validation helpers
  - [ ] 2.2 Rewrite ci-modular-jobs.integration.test.ts for 8-job structure
  - [ ] 2.3 Rewrite ci-cd-pipeline.integration.test.ts for GitHub Actions
        validation
  - [ ] 2.4 Update test utilities to load and parse actual workflow YAML
  - [ ] 2.5 Verify all critical workflow tests pass

- [ ] 3. Align Progressive Testing System
  - [ ] 3.1 Write tests for 2-tier testing validation
  - [ ] 3.2 Update progressive-testing-tiers.test.ts from 3-tier to 2-tier
  - [ ] 3.3 Validate test:smoke and test:focused script integration
  - [ ] 3.4 Remove obsolete 3-tier testing expectations
  - [ ] 3.5 Verify progressive testing alignment complete

- [ ] 4. Update ADHD Feature Validation
  - [ ] 4.1 Write tests for emoji and timeout validation
  - [ ] 4.2 Update cognitive-load-reducers.test.ts for specific features
  - [ ] 4.3 Update github-step-summaries.test.ts for emoji status
  - [ ] 4.4 Validate step count limits and visual indicators
  - [ ] 4.5 Verify all ADHD features properly tested

- [ ] 5. Create Regression Prevention Suite
  - [ ] 5.1 Write tests for regression prevention framework
  - [ ] 5.2 Create workflow-regression-prevention.test.ts
  - [ ] 5.3 Implement ADHD feature preservation tests
  - [ ] 5.4 Add performance characteristic validation
  - [ ] 5.5 Document regression test patterns for future updates
  - [ ] 5.6 Verify complete test suite passes in CI environment
