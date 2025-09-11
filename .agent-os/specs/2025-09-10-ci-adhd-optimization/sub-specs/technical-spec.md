# Technical Specification

This is the technical specification for the spec detailed in
@.agent-os/specs/2025-09-10-ci-adhd-optimization/spec.md

## Technical Requirements

### 1. Job Architecture Redesign

**Current Problem:** Single `quality` job runs 11 different checks, making
failures hard to diagnose.

**Solution Architecture:**

```yaml
jobs:
  lint:
    name: '🔍 Lint'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    # Only runs ESLint

  format:
    name: '💅 Format'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    # Only runs Prettier

  typecheck:
    name: '📝 Types'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    # Only runs TypeScript compiler

  build:
    name: '🔨 Build'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # Only runs build commands
```

### 2. Progressive Testing Implementation

**Three-Tier Testing Strategy:**

```yaml
test-quick:
  name: '⚡ Quick Tests'
  if: github.event_name == 'pull_request'
  timeout-minutes: 1
  run: pnpm test:quick --bail --no-coverage

test-focused:
  name: '🎯 Focused Tests'
  needs: test-quick
  if: success()
  timeout-minutes: 5
  run: pnpm test --changed HEAD~1

test-full:
  name: '🧪 Full Test Suite'
  needs: test-focused
  if:
    github.ref == 'refs/heads/main' ||
    contains(github.event.pull_request.labels.*.name, 'full-test')
  timeout-minutes: 15
  run: pnpm test:coverage
```

### 3. Visual Feedback Systems

**GitHub Step Summaries:**

```yaml
- name: '📊 Generate Status Report'
  if: always()
  run: |
    cat >> $GITHUB_STEP_SUMMARY << 'EOF'
    ## 🎯 CI Status Report

    | Check | Status | Duration | Details |
    |-------|--------|----------|---------|
    | Lint | ${{ steps.lint.outcome == 'success' && '✅ Pass' || '❌ Fail' }} | ${{ steps.lint.duration }}s | ${{ steps.lint.errors || 'Clean' }} |
    | Format | ${{ steps.format.outcome == 'success' && '✅ Pass' || '❌ Fail' }} | ${{ steps.format.duration }}s | ${{ steps.format.files || 'All formatted' }} |
    | Types | ${{ steps.types.outcome == 'success' && '✅ Pass' || '❌ Fail' }} | ${{ steps.types.duration }}s | ${{ steps.types.errors || 'No errors' }} |
    EOF
```

**PR Comment System:**

```yaml
- name: '💬 Post Fix Instructions'
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const failureMap = {
        lint: 'pnpm lint:fix',
        format: 'pnpm format',
        typecheck: 'pnpm typecheck --verbose',
        test: 'pnpm test:failed'
      };

      const failed = Object.keys(failureMap).filter(job => 
        context.job[job]?.outcome === 'failure'
      );

      const comment = `## 🔧 CI Failures Detected

      **Quick Fix Commands:**
      ${failed.map(job => `- ${job}: \`${failureMap[job]}\``).join('\\n')}

      Run these locally and push to fix.`;

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
      });
```

### 4. Cache Optimization

**Fixed Dependency Caching:**

```yaml
- name: Cache Dependencies
  id: cache-deps
  uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      node_modules
      **/.turbo
      **/.eslintcache
    key:
      deps-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{
      hashFiles('turbo.json') }}
    restore-keys: |
      deps-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
      deps-${{ runner.os }}-

- name: Install Dependencies
  if: steps.cache-deps.outputs.cache-hit != 'true' # CRITICAL: Only install if no cache
  run: pnpm install --frozen-lockfile --prefer-offline
```

### 5. Performance Monitoring

**Real Performance Guards:**

```javascript
// scripts/ci-performance-check.js
const thresholds = {
  lint: 60000, // 1 minute
  format: 30000, // 30 seconds
  typecheck: 90000, // 1.5 minutes
  build: 180000, // 3 minutes
  testQuick: 30000, // 30 seconds
}

const checkPerformance = async (job, duration) => {
  if (duration > thresholds[job]) {
    core.warning(`${job} took ${duration}ms (threshold: ${thresholds[job]}ms)`)

    // Post to metrics endpoint for tracking
    await fetch(process.env.METRICS_URL, {
      method: 'POST',
      body: JSON.stringify({ job, duration, threshold: thresholds[job] }),
    })
  }
}
```

### 6. Script Cleanup

**Remove Misleading Scripts:**

```json
// Remove from package.json:
- "governance": "echo 'boundaries check skipped - single package mode'"
- "lint:deep": "pnpm lint"  // Just use "lint"
- "build:perf:guard": "pnpm build && echo 'Performance check passed'"

// Add honest scripts:
+ "ci:performance": "node scripts/ci-performance-check.js"
+ "test:smoke": "vitest run --bail --no-coverage src/**/*.smoke.test.ts"
+ "fix:all": "pnpm lint:fix && pnpm format && pnpm typecheck"
```

### 7. ADHD-Specific Optimizations

**Cognitive Load Reducers:**

- Maximum 3 steps per job
- Single responsibility per job
- Visual emoji indicators for each job type
- Progress tracking in PR description
- One-click fix commands
- No nested conditionals in bash scripts
- Clear timeout limits visible in job names

**Information Architecture:**

- Failures appear at top of logs
- Summary tables replace verbose output
- Color coding for pass/fail states
- Breadcrumbs showing current position in pipeline
- Estimated time remaining for long-running jobs

## Performance Criteria

- Quick feedback loop: < 1 minute for initial PR feedback
- Full pipeline: < 10 minutes for complete validation
- Cache hit rate: > 80% for unchanged dependencies
- Parallel execution: All independent jobs run simultaneously
- Resource efficiency: < 2000 GitHub Actions minutes per month

## Monitoring & Metrics

- Job duration tracking via GitHub API
- Failure rate by job type
- Cache effectiveness metrics
- Developer satisfaction surveys
- Time-to-fix measurements
- False positive rate tracking
