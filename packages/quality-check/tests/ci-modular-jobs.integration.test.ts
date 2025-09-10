import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { dump, load } from 'js-yaml'
import {
  ADHD_CI_JOBS,
  EXPECTED_JOB_COUNT,
  DEPENDENT_JOBS,
  validateWorkflowStructure,
  loadActualADHDWorkflow,
  validateJobEmoji,
  validateJobTimeout,
  validateJobDependencies,
  validateStepCount,
  type CIWorkflow,
} from './workflow-validation-helpers'

describe('ADHD CI Modular Jobs Integration', () => {
  let fixtureDir: string
  let workflowPath: string

  beforeEach(async () => {
    fixtureDir = path.join(tmpdir(), `adhd-ci-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
    workflowPath = path.join(fixtureDir, 'ci.yml')
  })

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
  })

  describe('Actual Production Workflow Validation', () => {
    it('should load and validate the actual ADHD CI workflow', async () => {
      const workflow = await loadActualADHDWorkflow()
      const validation = validateWorkflowStructure(workflow)

      if (!validation.valid) {
        console.error('Workflow validation errors:', validation.errors)
      }

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should have exactly 9 jobs matching ADHD structure', async () => {
      const workflow = await loadActualADHDWorkflow()
      const jobIds = Object.keys(workflow.jobs)

      expect(jobIds).toHaveLength(EXPECTED_JOB_COUNT)
      expect(jobIds).toContain('setup')
      expect(jobIds).toContain('quick-tests')
      expect(jobIds).toContain('focused-tests')
      expect(jobIds).toContain('format')
      expect(jobIds).toContain('lint')
      expect(jobIds).toContain('typecheck')
      expect(jobIds).toContain('build')
      expect(jobIds).toContain('commit-lint')
      expect(jobIds).toContain('ci-status')
    })

    it('should have correct emoji indicators for each job', async () => {
      const workflow = await loadActualADHDWorkflow()

      for (const [jobId, expectedConfig] of Object.entries(ADHD_CI_JOBS)) {
        const job = workflow.jobs[jobId]
        expect(job).toBeDefined()
        expect(validateJobEmoji(job, expectedConfig.emoji)).toBe(true)
      }
    })

    it('should have correct timeout configurations', async () => {
      const workflow = await loadActualADHDWorkflow()

      for (const [jobId, expectedConfig] of Object.entries(ADHD_CI_JOBS)) {
        const job = workflow.jobs[jobId]
        expect(job).toBeDefined()
        expect(validateJobTimeout(job, expectedConfig.timeout)).toBe(true)
      }
    })

    it('should have ci-status depend on all 6 quality jobs', async () => {
      const workflow = await loadActualADHDWorkflow()
      const ciStatusJob = workflow.jobs['ci-status']

      expect(ciStatusJob).toBeDefined()
      expect(validateJobDependencies(ciStatusJob, DEPENDENT_JOBS)).toBe(true)

      const actualDeps = Array.isArray(ciStatusJob.needs) ? ciStatusJob.needs : [ciStatusJob.needs]
      expect(actualDeps).toHaveLength(DEPENDENT_JOBS.length)
      expect(actualDeps).toEqual(expect.arrayContaining(DEPENDENT_JOBS))
    })
  })

  describe('ADHD Job Structure Tests', () => {
    it('should validate setup job has no timeout and correct emoji', () => {
      const setupConfig = ADHD_CI_JOBS.setup
      expect(setupConfig.name).toBe('🔧 Setup & Cache')
      expect(setupConfig.emoji).toBe('🔧')
      expect(setupConfig.timeout).toBeUndefined()
    })

    it('should validate quick-tests job has 1-minute timeout', () => {
      const quickTestsConfig = ADHD_CI_JOBS['quick-tests']
      expect(quickTestsConfig.name).toBe('⚡ Quick Tests (1m)')
      expect(quickTestsConfig.emoji).toBe('⚡')
      expect(quickTestsConfig.timeout).toBe(1)
    })

    it('should validate focused-tests job has 5-minute timeout', () => {
      const focusedTestsConfig = ADHD_CI_JOBS['focused-tests']
      expect(focusedTestsConfig.name).toBe('🎯 Focused Tests (5m)')
      expect(focusedTestsConfig.emoji).toBe('🎯')
      expect(focusedTestsConfig.timeout).toBe(5)
    })

    it('should validate format job configuration', () => {
      const formatConfig = ADHD_CI_JOBS.format
      expect(formatConfig.name).toBe('💅 Format (5m)')
      expect(formatConfig.emoji).toBe('💅')
      expect(formatConfig.timeout).toBe(5)
    })

    it('should validate lint job configuration', () => {
      const lintConfig = ADHD_CI_JOBS.lint
      expect(lintConfig.name).toBe('🔍 Lint (5m)')
      expect(lintConfig.emoji).toBe('🔍')
      expect(lintConfig.timeout).toBe(5)
    })

    it('should validate typecheck job configuration', () => {
      const typecheckConfig = ADHD_CI_JOBS.typecheck
      expect(typecheckConfig.name).toBe('🔧 Types (5m)')
      expect(typecheckConfig.emoji).toBe('🔧')
      expect(typecheckConfig.timeout).toBe(5)
    })

    it('should validate build job configuration', () => {
      const buildConfig = ADHD_CI_JOBS.build
      expect(buildConfig.name).toBe('🏗️ Build (5m)')
      expect(buildConfig.emoji).toBe('🏗️')
      expect(buildConfig.timeout).toBe(5)
    })

    it('should validate commit-lint job configuration', () => {
      const commitLintConfig = ADHD_CI_JOBS['commit-lint']
      expect(commitLintConfig.name).toBe('⚧ Commit Lint (5m)')
      expect(commitLintConfig.emoji).toBe('⚧')
      expect(commitLintConfig.timeout).toBe(5)
    })

    it('should validate ci-status job configuration', () => {
      const ciStatusConfig = ADHD_CI_JOBS['ci-status']
      expect(ciStatusConfig.name).toBe('📊 CI Status')
      expect(ciStatusConfig.emoji).toBe('📊')
      expect(ciStatusConfig.timeout).toBeUndefined()
    })
  })

  describe('Dependency Structure', () => {
    it('should have quality jobs depend on setup but not each other', async () => {
      const workflow = await loadActualADHDWorkflow()

      // Quality jobs should depend on setup
      const qualityJobs = ['quick-tests', 'focused-tests', 'format', 'lint', 'types']
      for (const jobId of qualityJobs) {
        const job = workflow.jobs[jobId]
        expect(job.needs).toBe('setup')
      }

      // Commit-lint should not depend on setup (it runs independently)
      const commitLintJob = workflow.jobs['commit-lint']
      expect(commitLintJob.needs).toBeUndefined()
    })

    it('should have ci-status depend on all quality jobs but not setup', async () => {
      const workflow = await loadActualADHDWorkflow()
      const ciStatusJob = workflow.jobs['ci-status']

      expect(ciStatusJob.needs).toEqual(DEPENDENT_JOBS)
      expect(ciStatusJob.needs).not.toContain('setup')
      expect(ciStatusJob.needs).not.toContain('ci-status')
    })
  })

  describe('Performance Optimization', () => {
    it('should have quick smoke tests complete within 1 minute', async () => {
      const workflow = await loadActualADHDWorkflow()
      const quickTestsJob = workflow.jobs['quick-tests']

      expect(quickTestsJob['timeout-minutes']).toBe(1)
      expect(quickTestsJob.name).toContain('(1m)')
    })

    it('should have all quality jobs complete within 5 minutes', async () => {
      const workflow = await loadActualADHDWorkflow()
      const fiveMinuteJobs = ['focused-tests', 'format', 'lint', 'types', 'commit-lint']

      for (const jobId of fiveMinuteJobs) {
        const job = workflow.jobs[jobId]
        expect(job['timeout-minutes']).toBe(5)
        expect(job.name).toContain('(5m)')
      }
    })

    it('should enable parallel execution for maximum performance', async () => {
      const workflow = await loadActualADHDWorkflow()

      // All quality jobs should run in parallel (all depend only on setup)
      const parallelJobs = ['quick-tests', 'focused-tests', 'format', 'lint', 'types']
      for (const jobId of parallelJobs) {
        const job = workflow.jobs[jobId]
        expect(job.needs).toBe('setup') // Only dependency is setup
      }
    })
  })

  describe('CI Status Aggregation', () => {
    it('should check results from all dependent jobs', async () => {
      const workflow = await loadActualADHDWorkflow()
      const ciStatusJob = workflow.jobs['ci-status']
      const checkStatusStep = ciStatusJob.steps.find((step) => step.name === 'Check Status')

      expect(checkStatusStep).toBeDefined()
      expect(checkStatusStep!.run).toContain('needs.quick-tests.result')
      expect(checkStatusStep!.run).toContain('needs.focused-tests.result')
      expect(checkStatusStep!.run).toContain('needs.format.result')
      expect(checkStatusStep!.run).toContain('needs.lint.result')
      expect(checkStatusStep!.run).toContain('needs.types.result')
      expect(checkStatusStep!.run).toContain('needs.commit-lint.result')
    })

    it('should run always to report final status', async () => {
      const workflow = await loadActualADHDWorkflow()
      const ciStatusJob = workflow.jobs['ci-status']

      expect(ciStatusJob.if).toBe('always()')
    })
  })

  describe('Test Workflow Creation', () => {
    it('should create valid ADHD-style workflow structure', async () => {
      const workflow: CIWorkflow = {
        name: 'ADHD CI',
        on: {
          pull_request: {
            types: ['opened', 'synchronize', 'reopened'],
          },
          push: {
            branches: ['main', 'develop'],
          },
        },
        env: {
          NODE_VERSION: '20.18.1',
          PNPM_VERSION: '9.15.4',
        },
        jobs: {
          'setup': {
            'name': '🔧 Setup & Cache',
            'runs-on': 'ubuntu-latest',
            'steps': [
              { uses: 'actions/checkout@v4' },
              { name: 'Install Dependencies', run: 'pnpm install --frozen-lockfile' },
            ],
          },
          'quick-tests': {
            'name': '⚡ Quick Tests (1m)',
            'runs-on': 'ubuntu-latest',
            'needs': 'setup',
            'timeout-minutes': 1,
            'steps': [{ uses: 'actions/checkout@v4' }, { run: 'pnpm test:smoke' }],
          },
          'ci-status': {
            'name': '📊 CI Status',
            'runs-on': 'ubuntu-latest',
            'needs': ['quick-tests'],
            'if': 'always()',
            'steps': [
              {
                name: 'Check Status',
                run: 'echo "CI Status check"',
              },
            ],
          },
        },
      }

      await fs.writeFile(workflowPath, dump(workflow, { indent: 2 }))
      const content = await fs.readFile(workflowPath, 'utf-8')
      const parsedWorkflow = load(content) as CIWorkflow

      expect(parsedWorkflow.name).toBe('ADHD CI')
      expect(parsedWorkflow.jobs.setup).toBeDefined()
      expect(parsedWorkflow.jobs['quick-tests']).toBeDefined()
      expect(parsedWorkflow.jobs['ci-status']).toBeDefined()
    })

    it('should validate step count limits for focused execution', async () => {
      const workflow = await loadActualADHDWorkflow()

      for (const [jobId, job] of Object.entries(workflow.jobs)) {
        // Skip setup and status jobs from step count validation
        if (jobId === 'setup' || jobId === 'ci-status') {
          continue
        }

        const isValidStepCount = validateStepCount(job, 3)
        expect(isValidStepCount).toBe(true)
      }
    })
  })
})
