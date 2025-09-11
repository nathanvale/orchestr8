# API Specification

This is the API specification for the spec detailed in
@.agent-os/specs/2025-09-10-ci-adhd-optimization/spec.md

## GitHub Actions Workflow Specifications

### Workflow Triggers

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      skip_tests:
        description: 'Skip test suites'
        type: boolean
        default: false
      full_test:
        description: 'Run full test suite'
        type: boolean
        default: false
```

### Reusable Workflow Components

#### Status Reporter Action

```yaml
# .github/actions/status-reporter/action.yml
name: 'Status Reporter'
description: 'Generate visual status reports'
inputs:
  job_name:
    description: 'Name of the job'
    required: true
  status:
    description: 'Job status'
    required: true
  duration:
    description: 'Job duration in ms'
    required: false
outputs:
  summary:
    description: 'Formatted summary'
    value: ${{ steps.generate.outputs.summary }}
runs:
  using: 'composite'
  steps:
    - id: generate
      shell: bash
      run: |
        echo "summary=${{ inputs.job_name }}: ${{ inputs.status == 'success' && '✅' || '❌' }}" >> $GITHUB_OUTPUT
```

#### Cache Manager Action

```yaml
# .github/actions/cache-manager/action.yml
name: 'Smart Cache Manager'
description: 'Intelligent dependency caching'
inputs:
  cache_key:
    description: 'Cache key prefix'
    required: true
outputs:
  cache_hit:
    description: 'Whether cache was hit'
    value: ${{ steps.cache.outputs.cache-hit }}
runs:
  using: 'composite'
  steps:
    - uses: actions/cache@v4
      id: cache
      with:
        path: |
          ~/.pnpm-store
          node_modules
          .turbo
        key: ${{ inputs.cache_key }}-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: ${{ inputs.cache_key }}-
```

### Workflow Jobs API

#### GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs

Monitor workflow performance:

```javascript
const getWorkflowMetrics = async (owner, repo, workflowId) => {
  const response = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: workflowId,
    per_page: 100,
  })

  return {
    averageDuration: calculateAverage(response.data.workflow_runs),
    failureRate: calculateFailureRate(response.data.workflow_runs),
    cacheHitRate: await getCacheMetrics(response.data.workflow_runs),
  }
}
```

#### POST /repos/{owner}/{repo}/issues/{issue_number}/comments

Post automated fix instructions:

```javascript
const postFixInstructions = async (context, failures) => {
  const instructions = generateFixCommands(failures)

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: formatInstructionsAsMarkdown(instructions),
  })
}
```

### Environment Variables

```yaml
env:
  # Performance thresholds
  CI_LINT_TIMEOUT: 60000
  CI_FORMAT_TIMEOUT: 30000
  CI_TYPECHECK_TIMEOUT: 90000
  CI_BUILD_TIMEOUT: 180000
  CI_TEST_QUICK_TIMEOUT: 30000

  # Feature flags
  CI_PROGRESSIVE_TESTING: true
  CI_VISUAL_FEEDBACK: true
  CI_AUTO_FIX_HINTS: true

  # Monitoring
  CI_METRICS_ENDPOINT: ${{ secrets.METRICS_URL }}
  CI_METRICS_API_KEY: ${{ secrets.METRICS_API_KEY }}
```

### Matrix Strategy Configurations

```yaml
strategy:
  matrix:
    # Quick checks matrix (parallel)
    quick_check:
      - job: lint
        emoji: 🔍
        timeout: 5
      - job: format
        emoji: 💅
        timeout: 5
      - job: typecheck
        emoji: 📝
        timeout: 5

    # Test matrix (progressive)
    test_tier:
      - level: smoke
        timeout: 1
        command: test:smoke
      - level: focused
        timeout: 5
        command: test --changed
      - level: full
        timeout: 15
        command: test:coverage
```

### Webhook Events

```javascript
// Webhook handler for CI status updates
app.post('/webhooks/ci-status', async (req, res) => {
  const { action, workflow_run } = req.body

  if (action === 'completed') {
    await updatePRDescription(workflow_run)
    await postMetrics(workflow_run)

    if (workflow_run.conclusion === 'failure') {
      await postFixInstructions(workflow_run)
    }
  }

  res.status(200).send('OK')
})
```

### Error Handling

All workflow steps include error handling:

```yaml
- name: Safe Execution
  id: step
  continue-on-error: true
  run: |
    set -euo pipefail
    trap 'echo "::error::Step failed at line $LINENO"' ERR
    # Command here

- name: Handle Failure
  if: steps.step.outcome == 'failure'
  run: |
    echo "::warning::Step failed but continuing"
    echo "failure_reason=${{ steps.step.conclusion }}" >> $GITHUB_ENV
```
