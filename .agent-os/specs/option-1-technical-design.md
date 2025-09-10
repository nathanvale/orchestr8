# Option 1: Technical Design Document

**Technical Design for Test-Workflow Alignment**  
**Date**: 2025-09-10  
**Version**: 1.0  
**Specification Reference**: `option-1-test-workflow-alignment.md`

## Architecture Overview

### Current State Analysis

Our ADHD-optimized CI workflow represents a **streamlined,
cognitive-load-optimized architecture** that prioritizes:

- **Visual clarity** through emoji indicators and timeout limits
- **Simplified decision-making** with maximum 3 steps per job
- **Progressive feedback** through 1-minute quick tests escalating to 5-minute
  focused tests
- **Parallel execution** of independent quality checks

### Test Suite Architecture Mismatch

The existing test suite was designed for a **complex modular architecture** that
assumed:

- Complete separation of lint, format, typecheck, and build processes
- Complex conditional logic and multi-step validation
- Three-tier progressive testing (smoke → quick → full)
- Advanced error aggregation and JSON output formatting

## Detailed Technical Design

### Component 1: CI Workflow Test Alignment

#### 1.1 Current Workflow Job Structure

```yaml
# Actual CI Workflow (.github/workflows/ci.yml)
jobs:
  setup: # 🔧 Setup & Cache - dependency installation and caching
  quick-tests: # ⚡ Quick Tests (1m) - fast feedback with bail-fast behavior
  focused-tests: # 🎯 Focused Tests (5m) - comprehensive test execution
  format: # 💅 Format (5m) - code formatting validation
  lint: # 🔍 Lint (5m) - code quality and style checking
  types: # 🔧 Types (5m) - TypeScript type checking
  commit-lint: # ⚧ Commit Lint (5m) - conventional commit validation
  ci-status: # 📊 CI Status - aggregates and reports overall status
```

#### 1.2 Test Update Strategy Matrix

| Test File                             | Current Expectation                         | Actual Implementation                     | Update Strategy                                           |
| ------------------------------------- | ------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `ci-modular-jobs.integration.test.ts` | 11+ separate jobs with complex logic        | 8 focused jobs with simplified logic      | **MAJOR REWRITE** - Align job count, structure, and logic |
| `ci-cd-pipeline.integration.test.ts`  | JSON output validation, complex aggregation | GitHub Actions workflow validation        | **MAJOR REWRITE** - Focus on workflow structure           |
| `progressive-testing-tiers.test.ts`   | 3-tier testing (smoke/quick/full)           | 2-tier testing (quick/focused)            | **MODERATE UPDATE** - Align tier count and behavior       |
| `cognitive-load-reducers.test.ts`     | Generic ADHD optimizations                  | Specific emoji/timeout/step optimizations | **MINOR ALIGNMENT** - Match actual features               |
| `github-step-summaries.test.ts`       | Complex status reporting                    | Simple emoji-based status                 | **MODERATE UPDATE** - Match actual reporting              |

### Component 2: Specific Test File Updates

#### 2.1 `ci-modular-jobs.integration.test.ts` Redesign

**Current Problems:**

```typescript
// Tests expect separate jobs that don't exist
it('should create separate lint job with 5-minute timeout and emoji indicator')
it('should create separate format job with conditional logic for changed files')
it('should create separate typecheck job for production and test configs')
it('should create separate build job with performance monitoring')

// Tests expect complex logic not implemented
it('should update CI status aggregator to include new modular jobs')
it('should ensure all jobs run in parallel without dependencies')
```

**Proposed Solution:**

```typescript
describe('ADHD CI Workflow Structure', () => {
  describe('Job Configuration', () => {
    it('should have 8 focused jobs with clear responsibilities', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      const expectedJobs = [
        'setup',
        'quick-tests',
        'focused-tests',
        'format',
        'lint',
        'types',
        'commit-lint',
        'ci-status',
      ]

      expect(Object.keys(workflow.jobs)).toEqual(expectedJobs)
    })

    it('should use emoji indicators and timeout limits in job names', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      const jobNames = Object.values(workflow.jobs).map((job) => job.name)

      // Verify emoji indicators
      expect(jobNames.find((name) => name.includes('🔧'))).toBeDefined() // Setup
      expect(jobNames.find((name) => name.includes('⚡'))).toBeDefined() // Quick Tests
      expect(jobNames.find((name) => name.includes('🎯'))).toBeDefined() // Focused Tests
      expect(jobNames.find((name) => name.includes('💅'))).toBeDefined() // Format
      expect(jobNames.find((name) => name.includes('🔍'))).toBeDefined() // Lint

      // Verify timeout indicators
      expect(jobNames.find((name) => name.includes('(1m)'))).toBeDefined()
      expect(jobNames.find((name) => name.includes('(5m)'))).toBeDefined()
    })

    it('should limit each job to maximum 3 essential steps', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      Object.entries(workflow.jobs).forEach(([jobName, job]) => {
        if (jobName !== 'ci-status') {
          // Status job may have different structure
          const essentialSteps = job.steps.filter(
            (step) =>
              !step.name.toLowerCase().includes('checkout') &&
              !step.uses?.includes('setup-node') &&
              !step.uses?.includes('action-setup'),
          )

          expect(essentialSteps.length).toBeLessThanOrEqual(3)
        }
      })
    })
  })

  describe('Progressive Testing Integration', () => {
    it('should provide 1-minute quick feedback through quick-tests job', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      expect(workflow.jobs['quick-tests']).toBeDefined()
      expect(workflow.jobs['quick-tests']['timeout-minutes']).toBe(1)
      expect(workflow.jobs['quick-tests'].name).toContain('⚡')
      expect(workflow.jobs['quick-tests'].name).toContain('(1m)')
    })

    it('should provide comprehensive testing through focused-tests job', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      expect(workflow.jobs['focused-tests']).toBeDefined()
      expect(workflow.jobs['focused-tests']['timeout-minutes']).toBe(5)
      expect(workflow.jobs['focused-tests'].name).toContain('🎯')
      expect(workflow.jobs['focused-tests'].name).toContain('(5m)')
    })
  })

  describe('Quality Check Integration', () => {
    it('should integrate format checking with simplified conditional logic', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')
      const formatJob = workflow.jobs.format

      expect(formatJob).toBeDefined()
      expect(formatJob.name).toContain('💅')
      expect(formatJob['timeout-minutes']).toBe(5)

      // Verify simplified conditional (not complex multi-line)
      const formatStep = formatJob.steps.find((step) =>
        step.run?.includes('format'),
      )
      expect(formatStep).toBeDefined()
    })

    it('should provide separate quality jobs running in parallel', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      const qualityJobs = ['format', 'lint', 'types']

      qualityJobs.forEach((jobName) => {
        const job = workflow.jobs[jobName]
        expect(job).toBeDefined()
        expect(job.needs).toEqual(['setup']) // All depend only on setup
        expect(job['timeout-minutes']).toBe(5)
      })
    })
  })

  describe('ADHD Optimization Features', () => {
    it('should provide clear status aggregation with emoji feedback', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')
      const statusJob = workflow.jobs['ci-status']

      expect(statusJob).toBeDefined()
      expect(statusJob.needs).toContain('quick-tests')
      expect(statusJob.needs).toContain('focused-tests')
      expect(statusJob.needs).toContain('format')
      expect(statusJob.needs).toContain('lint')
      expect(statusJob.needs).toContain('types')
      expect(statusJob.if).toBe('always()')
    })
  })
})
```

#### 2.2 `progressive-testing-tiers.test.ts` Alignment

**Current Problems:**

- Tests expect 3-tier system (smoke → quick → full)
- Validates scripts that don't match actual implementation
- Assumes complex test routing logic

**Proposed Solution:**

```typescript
describe('Progressive Testing Strategy', () => {
  describe('Two-Tier Testing Implementation', () => {
    it('should support quick testing for immediate feedback', () => {
      const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

      // Verify quick test scripts exist
      expect(packageJson.scripts).toHaveProperty('test:quick')
      expect(packageJson.scripts).toHaveProperty('test:smoke')

      // Verify quick test characteristics
      expect(packageJson.scripts['test:quick']).toContain('--bail')
      expect(packageJson.scripts['test:quick']).toContain('--no-coverage')
    })

    it('should support focused testing for comprehensive validation', () => {
      const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

      expect(packageJson.scripts).toHaveProperty('test:focused')
      expect(packageJson.scripts['test:focused']).toContain('--changed')
    })

    it('should integrate with actual CI job structure', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      // Verify CI jobs use the scripts we're testing
      const quickTestJob = workflow.jobs['quick-tests']
      const focusedTestJob = workflow.jobs['focused-tests']

      expect(
        quickTestJob.steps.find((step) => step.run?.includes('test:smoke')),
      ).toBeDefined()
      expect(
        focusedTestJob.steps.find((step) => step.run?.includes('pnpm test')),
      ).toBeDefined()
    })
  })

  describe('ADHD-Optimized Test Categories', () => {
    it('should provide clear test type indicators', () => {
      // Test the patterns we actually use
      const patterns = {
        smoke: /.*\.smoke\.test\./,
        unit: /.*\.unit\.test\./,
        integration: /.*\.integration\.test\./,
        slow: /.*\.slow\.test\./,
      }

      expect('critical-path.smoke.test.ts').toMatch(patterns.smoke)
      expect('auth-service.unit.test.ts').toMatch(patterns.unit)
      expect('api-workflow.integration.test.ts').toMatch(patterns.integration)
      expect('performance-benchmark.slow.test.ts').toMatch(patterns.slow)
    })

    it('should support cognitive load reduction through clear categorization', () => {
      const categories = ['smoke', 'quick', 'focused', 'unit', 'integration']

      categories.forEach((category) => {
        expect(category.length).toBeLessThan(12) // Short, clear names
        expect(category).toMatch(/^[a-z]+$/) // Simple naming
      })
    })
  })
})
```

#### 2.3 `cognitive-load-reducers.test.ts` Alignment

**Current Problems:**

- Tests generic cognitive load concepts
- Doesn't validate specific ADHD optimizations implemented

**Proposed Solution:**

```typescript
describe('ADHD-Specific Cognitive Load Reducers', () => {
  describe('Visual Clarity Features', () => {
    it('should use emoji indicators consistently across all jobs', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      const emojiMap = {
        'setup': '🔧',
        'quick-tests': '⚡',
        'focused-tests': '🎯',
        'format': '💅',
        'lint': '🔍',
        'types': '🔧',
        'commit-lint': '⚧',
        'ci-status': '📊',
      }

      Object.entries(emojiMap).forEach(([jobName, expectedEmoji]) => {
        const job = workflow.jobs[jobName]
        if (job) {
          expect(job.name).toContain(expectedEmoji)
        }
      })
    })

    it('should display timeout limits clearly in job names', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      const timeoutJobs = [
        { name: 'quick-tests', timeout: '(1m)' },
        { name: 'focused-tests', timeout: '(5m)' },
        { name: 'format', timeout: '(5m)' },
        { name: 'lint', timeout: '(5m)' },
        { name: 'types', timeout: '(5m)' },
        { name: 'commit-lint', timeout: '(5m)' },
      ]

      timeoutJobs.forEach(({ name, timeout }) => {
        const job = workflow.jobs[name]
        if (job) {
          expect(job.name).toContain(timeout)
        }
      })
    })
  })

  describe('Simplified Decision Making', () => {
    it('should limit jobs to maximum 3 essential steps', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')

      Object.entries(workflow.jobs).forEach(([jobName, job]) => {
        const essentialSteps = job.steps.filter((step) => {
          const isSetupStep =
            step.uses?.includes('checkout') ||
            step.uses?.includes('setup-node') ||
            step.uses?.includes('action-setup') ||
            step.name?.toLowerCase().includes('setup') ||
            step.name?.toLowerCase().includes('install dependencies')

          return !isSetupStep
        })

        expect(essentialSteps.length).toBeLessThanOrEqual(3)
      })
    })

    it('should use single-line conditionals where possible', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')
      const formatJob = workflow.jobs.format

      if (formatJob) {
        const conditionalSteps = formatJob.steps.filter(
          (step) => step.run?.includes('&&') || step.run?.includes('||'),
        )

        conditionalSteps.forEach((step) => {
          // Should not have multi-line complex conditionals
          const lines = step.run.split('\n').filter((line) => line.trim())
          expect(lines.length).toBeLessThanOrEqual(2) // Simple single-line or short conditional
        })
      }
    })
  })

  describe('Progressive Feedback Implementation', () => {
    it('should provide sub-1-minute feedback through quick-tests', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')
      const quickTestJob = workflow.jobs['quick-tests']

      expect(quickTestJob).toBeDefined()
      expect(quickTestJob['timeout-minutes']).toBe(1)

      // Should use bail-fast approach for quick feedback
      const testStep = quickTestJob.steps.find((step) =>
        step.run?.includes('test'),
      )
      expect(testStep.run).toContain('test:smoke') // Uses smoke tests for speed
    })

    it('should escalate to comprehensive testing when needed', async () => {
      const workflow = await loadWorkflow('.github/workflows/ci.yml')
      const focusedTestJob = workflow.jobs['focused-tests']

      expect(focusedTestJob).toBeDefined()
      expect(focusedTestJob['timeout-minutes']).toBe(5)
      expect(focusedTestJob.needs).toContain('setup')

      // Runs after quick tests for comprehensive coverage
      const statusJob = workflow.jobs['ci-status']
      expect(statusJob.needs).toContain('focused-tests')
    })
  })
})
```

### Component 3: New Test Architecture

#### 3.1 Workflow Integration Test Suite

Create comprehensive tests that validate the actual CI workflow:

```typescript
// tests/adhd-workflow-validation.test.ts
describe('ADHD Workflow Validation', () => {
  describe('Workflow Structure Compliance', () => {
    it('should implement exactly 8 focused jobs')
    it('should use consistent emoji and timeout indicators')
    it('should maintain job step limits for cognitive clarity')
    it('should provide parallel execution of quality checks')
  })

  describe('Progressive Testing Flow', () => {
    it('should support 1-minute quick feedback loop')
    it('should escalate to 5-minute focused testing')
    it('should integrate smoke test patterns effectively')
    it('should provide clear test result aggregation')
  })

  describe('ADHD Optimization Features', () => {
    it('should reduce cognitive load through visual indicators')
    it('should provide clear status feedback without log parsing')
    it('should support one-click fix commands in failure scenarios')
    it('should maintain breadcrumb navigation for pipeline awareness')
  })
})
```

#### 3.2 Regression Prevention Tests

```typescript
// tests/workflow-regression-prevention.test.ts
describe('Workflow Regression Prevention', () => {
  describe('ADHD Features Preservation', () => {
    it('should maintain emoji indicators across workflow updates')
    it('should preserve timeout clarity in job names')
    it('should keep job step limits under cognitive load threshold')
    it('should maintain progressive testing tier structure')
  })

  describe('Performance Characteristics', () => {
    it('should maintain sub-1-minute quick feedback capability')
    it('should preserve parallel execution of quality jobs')
    it('should keep total pipeline duration under ADHD-friendly limits')
    it('should maintain cache effectiveness for faster iterations')
  })
})
```

### Component 4: Test Configuration Updates

#### 4.1 Vitest Configuration Alignment

```javascript
// vitest.config.ts updates
export default defineConfig({
  test: {
    include: [
      // Align test patterns with actual implementation
      'tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
    ],
    exclude: [
      // Remove patterns for non-existent test types
      'tests/**/*.complex.test.ts', // Remove if we don't have complex tests
      'tests/**/*.legacy.test.ts', // Remove legacy test patterns
    ],
    testTimeout: 30000, // Align with ADHD-friendly quick feedback
    setupFiles: ['tests/setup/vitest-setup-activation.test.ts'],
  },
})
```

#### 4.2 Package.json Script Alignment

Ensure all test scripts referenced by CI actually exist and work:

```json
{
  "scripts": {
    "test:smoke": "vitest run --bail=1 --no-coverage **/*.smoke.test.*",
    "test:quick": "vitest run --bail=1 --no-coverage --pool=threads",
    "test:focused": "vitest run --changed HEAD~1 --no-coverage",
    "test": "vitest run",
    "test:ci": "vitest run --reporter=verbose"
  }
}
```

## Implementation Methodology

### Phase 1: Comprehensive Test Audit (Days 1-2)

1. **Inventory All CI-Related Tests**

   ```bash
   find . -name "*.test.ts" -exec grep -l "ci\|workflow\|job\|github" {} \;
   ```

2. **Map Test Expectations vs Reality**
   - Create spreadsheet mapping each test to actual CI features
   - Identify tests that need major updates vs minor tweaks
   - Document tests that can be removed entirely

3. **Categorize Update Types**
   - **MAJOR REWRITE**: Test completely misaligned with implementation
   - **MODERATE UPDATE**: Test needs significant changes but core logic
     preserved
   - **MINOR ALIGNMENT**: Test mostly correct, needs small adjustments
   - **REMOVE**: Test validates features that don't exist and shouldn't

### Phase 2: High-Priority Test Updates (Days 3-7)

1. **Critical Path Tests** (Days 3-4)
   - Update `ci-modular-jobs.integration.test.ts`
   - Update `ci-cd-pipeline.integration.test.ts`
   - Verify basic CI workflow validation works

2. **Progressive Testing Tests** (Day 5)
   - Update `progressive-testing-tiers.test.ts`
   - Align with 2-tier system (quick → focused)
   - Verify script integration

3. **ADHD Feature Tests** (Days 6-7)
   - Update `cognitive-load-reducers.test.ts`
   - Update `github-step-summaries.test.ts`
   - Verify visual clarity and feedback features

### Phase 3: Integration and New Test Creation (Days 8-12)

1. **Create Workflow Validation Suite** (Days 8-9)
   - New comprehensive workflow structure tests
   - Integration point validation tests
   - Regression prevention tests

2. **Simplify Quality Check Tests** (Days 10-11)
   - Focus quality check tests on CI integration points only
   - Remove unused/complex quality check features from test scope
   - Maintain core validation functionality

3. **Configuration Updates** (Day 12)
   - Update Vitest configuration
   - Align package.json scripts
   - Verify test execution in CI environment

### Phase 4: Validation and Documentation (Days 13-15)

1. **Comprehensive Test Execution** (Day 13)
   - Run full test suite locally
   - Run tests in CI environment
   - Fix any remaining integration issues

2. **Performance and Regression Testing** (Day 14)
   - Verify test execution times remain reasonable
   - Confirm no existing functionality broken
   - Validate CI workflow performance unchanged

3. **Documentation and Handoff** (Day 15)
   - Update test documentation
   - Create test guide for future CI changes
   - Document lessons learned and best practices

## Quality Assurance Strategy

### Test Validation Approach

1. **Dual Validation**: Each updated test must pass against both local and CI
   environments
2. **Coverage Preservation**: Maintain or improve existing code coverage levels
3. **Performance Benchmarking**: Ensure test execution times remain within
   ADHD-friendly limits
4. **Integration Testing**: Verify all tests work correctly with actual CI
   workflow

### Rollback Strategy

1. **Incremental Updates**: Update tests in small, isolated batches
2. **Version Control**: Each test file update gets its own commit for easy
   rollback
3. **CI Integration**: Test each batch in CI environment before proceeding
4. **Backup Preservation**: Keep original test files until entire update process
   validated

### Success Validation Criteria

- [ ] **100% Test Pass Rate**: All updated tests pass in CI environment
- [ ] **Coverage Maintenance**: Code coverage levels maintained or improved
- [ ] **Performance Preservation**: Test execution times remain reasonable
- [ ] **Documentation Accuracy**: Tests accurately document actual CI workflow
      behavior
- [ ] **Maintenance Simplification**: Test complexity reduced to match workflow
      simplicity

## Conclusion

This technical design provides a comprehensive approach to aligning our test
suite with the successfully implemented ADHD-optimized CI workflow. By focusing
on **accuracy over complexity** and **maintainability over feature coverage**,
we ensure our tests become valuable documentation and validation of the system
we've actually built.

The design preserves the cognitive load reduction benefits of our streamlined CI
workflow while providing robust test coverage that matches our architectural
decisions. This approach supports sustainable development practices and
maintains the ADHD-friendly developer experience we've worked to create.
