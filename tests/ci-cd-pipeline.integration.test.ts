import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import {
  loadActualADHDWorkflow,
  validateWorkflowStructure,
  ADHD_CI_JOBS,
  DEPENDENT_JOBS,
  type CIWorkflow,
} from './workflow-validation-helpers.js'

describe('GitHub Actions ADHD CI Workflow Validation', () => {
  let workflow: CIWorkflow

  beforeEach(async () => {
    workflow = await loadActualADHDWorkflow()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('GitHub Actions Workflow Syntax', () => {
    it('should_have_valid_yaml_syntax', async () => {
      // If we can load it with js-yaml, it has valid YAML syntax
      expect(workflow).toBeDefined()
      expect(typeof workflow).toBe('object')
    })

    it('should_have_required_root_properties', () => {
      expect(workflow.name).toBe('ADHD CI')
      expect(workflow.on).toBeDefined()
      expect(workflow.jobs).toBeDefined()
      expect(typeof workflow.jobs).toBe('object')
    })

    it('should_have_valid_environment_variables', () => {
      expect(workflow.env).toBeDefined()
      expect(workflow.env?.['NODE_VERSION']).toMatch(/^\d+\.\d+\.\d+$/)
      expect(workflow.env?.['PNPM_VERSION']).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('Workflow Structure Validation', () => {
    it('should_validate_complete_9_job_structure', () => {
      const validation = validateWorkflowStructure(workflow)

      if (!validation.valid) {
        console.error('Workflow validation errors:', validation.errors)
      }

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should_have_exactly_9_jobs_matching_adhd_structure', () => {
      const jobIds = Object.keys(workflow.jobs)
      const expectedJobs = Object.keys(ADHD_CI_JOBS)

      expect(jobIds).toHaveLength(9)
      expect(jobIds.sort()).toEqual(expectedJobs.sort())
    })

    it('should_have_all_jobs_with_required_github_actions_properties', () => {
      Object.entries(workflow.jobs).forEach(([_jobId, job]) => {
        expect(job.name).toBeDefined()
        expect(job['runs-on']).toBe('ubuntu-latest')
        expect(job.steps).toBeDefined()
        expect(Array.isArray(job.steps)).toBe(true)
        expect(job.steps.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Job Dependencies Validation', () => {
    it('should_have_setup_job_with_no_dependencies', () => {
      const setupJob = workflow.jobs['setup']
      expect(setupJob).toBeDefined()
      expect(setupJob?.needs).toBeUndefined()
    })

    it('should_have_all_dependent_jobs_requiring_setup', () => {
      DEPENDENT_JOBS.forEach((jobId) => {
        if (jobId === 'commit-lint') {
          // commit-lint doesn't depend on setup, it runs independently
          return
        }

        const job = workflow.jobs[jobId]
        expect(job).toBeDefined()
        expect(job?.needs).toBe('setup')
      })
    })

    it('should_have_ci_status_job_depending_on_all_other_jobs', () => {
      const statusJob = workflow.jobs['ci-status']
      expect(statusJob).toBeDefined()
      expect(statusJob?.needs).toBeDefined()

      const needs = Array.isArray(statusJob?.needs) ? statusJob?.needs : [statusJob?.needs]
      expect(needs.sort()).toEqual(DEPENDENT_JOBS.sort())
    })

    it('should_have_ci_status_job_with_always_condition', () => {
      const statusJob = workflow.jobs['ci-status']
      expect(statusJob?.if).toBe('always()')
    })
  })

  describe('Conditional Logic Validation', () => {
    it('should_have_commit_lint_only_run_on_pull_requests', () => {
      const commitLintJob = workflow.jobs['commit-lint']
      expect(commitLintJob).toBeDefined()
      expect(commitLintJob?.if).toBe("github.event_name == 'pull_request'")
    })

    it('should_have_setup_job_cache_conditional_install', () => {
      const setupJob = workflow.jobs['setup']
      const installStep = setupJob?.steps.find((step) => step.name === 'Install Dependencies')

      expect(installStep).toBeDefined()
      expect(installStep?.if).toBe("steps.cache.outputs.cache-hit != 'true'")
    })
  })

  describe('Environment Variables Validation', () => {
    it('should_use_node_version_environment_variable', () => {
      Object.values(workflow.jobs).forEach((job) => {
        const setupNodeStep = job.steps.find((step) => step.uses?.startsWith('actions/setup-node@'))

        if (setupNodeStep) {
          expect(setupNodeStep.with?.['node-version']).toBe('${{ env.NODE_VERSION }}')
        }
      })
    })

    it('should_use_pnpm_version_environment_variable', () => {
      Object.values(workflow.jobs).forEach((job) => {
        const setupPnpmStep = job.steps.find((step) => step.uses?.startsWith('pnpm/action-setup@'))

        if (setupPnpmStep) {
          expect(setupPnpmStep.with?.version).toBe('${{ env.PNPM_VERSION }}')
        }
      })
    })
  })

  describe('Job Outputs Validation', () => {
    it('should_have_setup_job_produce_cache_hit_output', () => {
      const setupJob = workflow.jobs['setup']
      expect(setupJob?.outputs).toBeDefined()
      expect(setupJob?.outputs?.['cache-hit']).toBe('${{ steps.cache.outputs.cache-hit }}')
    })

    it('should_have_cache_step_with_correct_id', () => {
      const setupJob = workflow.jobs['setup']
      const cacheStep = setupJob?.steps.find((step) => step.name === 'Cache Dependencies')

      expect(cacheStep).toBeDefined()
      expect(cacheStep?.id).toBe('cache')
      expect(cacheStep?.uses).toMatch(/^actions\/cache@/)
    })
  })

  describe('GitHub Actions Expressions Validation', () => {
    it('should_use_valid_github_context_expressions', () => {
      // Test expressions in ci-status job
      const statusJob = workflow.jobs['ci-status']
      const checkStep = statusJob?.steps.find(
        (step) => step.name === 'Generate Enhanced Status Report',
      )

      expect(checkStep?.run).toContain('${{ needs.quick-tests.result }}')
      expect(checkStep?.run).toContain('${{ needs.focused-tests.result }}')
      expect(checkStep?.run).toContain('${{ needs.format.result }}')
      expect(checkStep?.run).toContain('${{ needs.lint.result }}')
      expect(checkStep?.run).toContain('${{ needs.typecheck.result }}')
      expect(checkStep?.run).toContain('${{ needs.build.result }}')
      expect(checkStep?.run).toContain('${{ needs.commit-lint.result }}')
    })

    it('should_use_valid_environment_expressions', () => {
      const expressions = ['${{ env.NODE_VERSION }}', '${{ env.PNPM_VERSION }}']

      // Check that these expressions are used throughout the workflow
      const workflowString = JSON.stringify(workflow)
      expressions.forEach((expr) => {
        expect(workflowString).toContain(expr)
      })
    })

    it('should_use_valid_cache_key_expressions', () => {
      const setupJob = workflow.jobs['setup']
      const cacheStep = setupJob?.steps.find((step) => step.name === 'Cache Dependencies')

      expect(cacheStep?.with?.key).toContain('${{ runner.os }}')
      expect(cacheStep?.with?.key).toContain("${{ hashFiles('**/pnpm-lock.yaml') }}")
      expect(cacheStep?.with?.key).toContain("${{ hashFiles('turbo.json*', 'tsconfig*.json') }}")
    })
  })

  describe('Workflow Triggers Validation', () => {
    it('should_trigger_on_pull_request_events', () => {
      expect(workflow.on.pull_request).toBeDefined()
      expect(workflow.on.pull_request.types).toEqual(['opened', 'synchronize', 'reopened'])
    })

    it('should_trigger_on_push_to_main_and_develop', () => {
      expect(workflow.on.push).toBeDefined()
      expect(workflow.on.push.branches).toEqual(['main', 'develop'])
    })

    it('should_support_manual_workflow_dispatch', () => {
      expect(workflow.on.workflow_dispatch).toBeDefined()
    })
  })

  describe('Job Timeout Configuration', () => {
    it('should_have_appropriate_timeout_minutes_for_each_job', () => {
      const expectedTimeouts: Record<string, number | undefined> = {
        'setup': undefined,
        'quick-tests': 1,
        'focused-tests': 5,
        'format': 5,
        'lint': 5,
        'typecheck': 5,
        'build': 5,
        'commit-lint': 5,
        'ci-status': undefined,
      }

      Object.entries(expectedTimeouts).forEach(([jobId, expectedTimeout]) => {
        const job = workflow.jobs[jobId]
        expect(job?.['timeout-minutes']).toBe(expectedTimeout)
      })
    })
  })

  describe('Step Configuration Validation', () => {
    it('should_use_consistent_action_versions', () => {
      const actionVersions: Record<string, Set<string>> = {}

      Object.values(workflow.jobs).forEach((job) => {
        job.steps.forEach((step) => {
          if (step.uses) {
            const [action, version] = step.uses.split('@')
            if (action && version) {
              if (!actionVersions[action]) {
                actionVersions[action] = new Set()
              }
              actionVersions[action].add(version)
            }
          }
        })
      })

      // Each action should use consistent versions
      Object.entries(actionVersions).forEach(([_action, versions]) => {
        expect(versions.size).toBe(1) // Only one version per action
      })
    })

    it('should_have_commit_lint_job_with_fetch_depth_zero', () => {
      const commitLintJob = workflow.jobs['commit-lint']
      const checkoutStep = commitLintJob?.steps.find((step) =>
        step.uses?.startsWith('actions/checkout@'),
      )

      expect(checkoutStep?.with?.['fetch-depth']).toBe(0)
    })
  })
})
