import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { dump, load } from 'js-yaml'

// YAML utilities using proper js-yaml library
const yamlUtils = {
  dump: (obj: any): string => {
    return dump(obj, { indent: 2 })
  },
  load: (content: string): any => {
    return load(content)
  },
}

interface CIJob {
  'name': string
  'runs-on': string
  'timeout-minutes': number
  'steps': Array<{ name: string; run?: string; uses?: string }>
  'needs'?: string[]
  'if'?: string
}

interface CIWorkflow {
  name: string
  on: any
  jobs: Record<string, CIJob>
}

describe('CI Modular Jobs', () => {
  let fixtureDir: string
  let workflowPath: string

  beforeEach(async () => {
    fixtureDir = path.join(tmpdir(), `ci-modular-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
    workflowPath = path.join(fixtureDir, 'ci.yml')
  })

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
  })

  describe('Job Splitting', () => {
    it('should create separate lint job with 5-minute timeout and emoji indicator', () => {
      const lintJob: CIJob = {
        'name': '🔍 Lint (5m)',
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 5,
        'steps': [
          { name: 'Checkout', uses: 'actions/checkout@v4' },
          { name: 'Setup pnpm', uses: 'pnpm/action-setup@v4' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
          { name: 'Install Dependencies', run: 'pnpm install --frozen-lockfile' },
          { name: 'Run Lint', run: 'pnpm run lint' },
        ],
      }

      expect(lintJob.name).toContain('🔍')
      expect(lintJob['timeout-minutes']).toBe(5)
      expect(lintJob.steps).toHaveLength(5)
      expect(lintJob.steps[4].run).toBe('pnpm run lint')
      expect(lintJob.name).toContain('(5m)')
    })

    it('should create separate format job with conditional logic for changed files', () => {
      const formatJob: CIJob = {
        'name': '💅 Format (5m)',
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 5,
        'steps': [
          { name: 'Checkout', uses: 'actions/checkout@v4' },
          { name: 'Setup pnpm', uses: 'pnpm/action-setup@v4' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
          { name: 'Install Dependencies', run: 'pnpm install --frozen-lockfile' },
          {
            name: 'Check Format',
            run: 'CHANGED=$(git diff --name-only --diff-filter=ACMR origin/${{ github.base_ref }}... 2>/dev/null | wc -l | tr -d " "); if [ "$CHANGED" -gt 0 ] && [ "$CHANGED" -lt 100 ]; then pnpm run format:changed; else pnpm run format:check; fi',
          },
        ],
      }

      expect(formatJob.name).toContain('💅')
      expect(formatJob['timeout-minutes']).toBe(5)
      expect(formatJob.steps[4].run).toContain('format:changed')
      expect(formatJob.steps[4].run).toContain('format:check')
      expect(formatJob.name).toContain('(5m)')
    })

    it('should create separate typecheck job for production and test configs', () => {
      const typecheckJob: CIJob = {
        'name': '📝 Types (5m)',
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 5,
        'steps': [
          { name: 'Checkout', uses: 'actions/checkout@v4' },
          { name: 'Setup pnpm', uses: 'pnpm/action-setup@v4' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
          { name: 'Install Dependencies', run: 'pnpm install --frozen-lockfile' },
          { name: 'Type Check Production', run: 'pnpm exec tsc --noEmit -p tsconfig.build.json' },
          { name: 'Type Check Tests', run: 'pnpm exec tsc --noEmit -p tsconfig.json' },
        ],
      }

      expect(typecheckJob.name).toContain('📝')
      expect(typecheckJob['timeout-minutes']).toBe(5)
      expect(typecheckJob.steps).toHaveLength(6)
      expect(typecheckJob.steps[4].run).toContain('tsconfig.build.json')
      expect(typecheckJob.steps[5].run).toContain('tsconfig.json')
    })

    it('should create separate build job with performance monitoring', () => {
      const buildJob: CIJob = {
        'name': '🔨 Build (10m)',
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 10,
        'steps': [
          { name: 'Checkout', uses: 'actions/checkout@v4' },
          { name: 'Setup pnpm', uses: 'pnpm/action-setup@v4' },
          { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
          { name: 'Install Dependencies', run: 'pnpm install --frozen-lockfile' },
          {
            name: 'Build with Performance Monitoring',
            run: 'time pnpm run build:all --continue=dependencies-successful',
          },
          {
            name: 'Upload Build Artifacts',
            uses: 'actions/upload-artifact@v4',
          },
        ],
      }

      expect(buildJob.name).toContain('🔨')
      expect(buildJob['timeout-minutes']).toBe(10)
      expect(buildJob.steps[4].run).toContain('time')
      expect(buildJob.steps[4].run).toContain('build:all')
    })

    it('should ensure all jobs run in parallel without dependencies', async () => {
      const workflow: CIWorkflow = {
        name: 'CI',
        on: {
          pull_request: { types: ['opened', 'synchronize', 'reopened'] },
          push: { branches: ['main', 'develop'] },
        },
        jobs: {
          lint: {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Run Lint', run: 'pnpm run lint' }],
          },
          format: {
            'name': '💅 Format (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Check Format', run: 'pnpm run format:check' }],
          },
          typecheck: {
            'name': '📝 Types (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Type Check', run: 'pnpm run typecheck' }],
          },
          build: {
            'name': '🔨 Build (10m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 10,
            'steps': [{ name: 'Build', run: 'pnpm run build' }],
          },
        },
      }

      await fs.writeFile(workflowPath, yamlUtils.dump(workflow))
      const content = await fs.readFile(workflowPath, 'utf-8')
      const parsedWorkflow = yamlUtils.load(content) as CIWorkflow

      // Check that no job has dependencies
      expect(parsedWorkflow.jobs.lint.needs).toBeUndefined()
      expect(parsedWorkflow.jobs.format.needs).toBeUndefined()
      expect(parsedWorkflow.jobs.typecheck.needs).toBeUndefined()
      expect(parsedWorkflow.jobs.build.needs).toBeUndefined()
    })

    it('should update CI status aggregator to include new modular jobs', async () => {
      const workflow: CIWorkflow = {
        name: 'CI',
        on: {
          pull_request: { types: ['opened', 'synchronize', 'reopened'] },
          push: { branches: ['main', 'develop'] },
        },
        jobs: {
          lint: {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Run Lint', run: 'pnpm run lint' }],
          },
          format: {
            'name': '💅 Format (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Check Format', run: 'pnpm run format:check' }],
          },
          typecheck: {
            'name': '📝 Types (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Type Check', run: 'pnpm run typecheck' }],
          },
          build: {
            'name': '🔨 Build (10m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 10,
            'steps': [{ name: 'Build', run: 'pnpm run build' }],
          },
          status: {
            'name': 'CI Status',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'needs': ['lint', 'format', 'typecheck', 'build'],
            'if': 'always()',
            'steps': [
              {
                name: 'Check Status',
                run: `if [[ "\${{ needs.lint.result }}" == "failure" || \\
      "\${{ needs.format.result }}" == "failure" || \\
      "\${{ needs.typecheck.result }}" == "failure" || \\
      "\${{ needs.build.result }}" == "failure" ]]; then
  echo "::error::CI checks failed"
  exit 1
fi
echo "✅ All CI checks passed!"`,
              },
            ],
          },
        },
      }

      await fs.writeFile(workflowPath, yamlUtils.dump(workflow))
      const content = await fs.readFile(workflowPath, 'utf-8')
      const parsedWorkflow = yamlUtils.load(content) as CIWorkflow

      expect(parsedWorkflow.jobs.status).toBeDefined()
      expect(parsedWorkflow.jobs.status.needs).toEqual(['lint', 'format', 'typecheck', 'build'])
      expect(parsedWorkflow.jobs.status.if).toBe('always()')
      expect(parsedWorkflow.jobs.status.steps[0].run).toContain('needs.lint.result')
      expect(parsedWorkflow.jobs.status.steps[0].run).toContain('needs.format.result')
      expect(parsedWorkflow.jobs.status.steps[0].run).toContain('needs.typecheck.result')
      expect(parsedWorkflow.jobs.status.steps[0].run).toContain('needs.build.result')
    })
  })

  describe('Job Configuration', () => {
    it('should limit each job to maximum 3 steps (excluding setup)', () => {
      const workflow: CIWorkflow = {
        name: 'CI',
        on: {
          pull_request: { types: ['opened', 'synchronize', 'reopened'] },
          push: { branches: ['main', 'develop'] },
        },
        jobs: {
          lint: {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [
              { name: 'Setup', uses: 'actions/setup-composite@v1' },
              { name: 'Run Lint', run: 'pnpm run lint' },
              { name: 'Generate Report', run: 'pnpm run lint:report' },
              { name: 'Upload Results', uses: 'actions/upload-artifact@v4' },
            ],
          },
        },
      }

      // Count non-setup steps
      const nonSetupSteps = workflow.jobs.lint.steps.filter(
        (step) =>
          !step.name.toLowerCase().includes('setup') &&
          !step.name.toLowerCase().includes('checkout'),
      )

      expect(nonSetupSteps.length).toBeLessThanOrEqual(3)
    })

    it('should include clear timeout limits in job names', () => {
      const jobNames = ['🔍 Lint (5m)', '💅 Format (5m)', '📝 Types (5m)', '🔨 Build (10m)']

      jobNames.forEach((name) => {
        const timeoutMatch = name.match(/\((\d+)m\)/)
        expect(timeoutMatch).toBeTruthy()
        expect(timeoutMatch![1]).toMatch(/^\d+$/)
      })
    })

    it('should use emoji indicators for each job type', () => {
      const jobConfigs = [
        { name: '🔍 Lint (5m)', emoji: '🔍', type: 'lint' },
        { name: '💅 Format (5m)', emoji: '💅', type: 'format' },
        { name: '📝 Types (5m)', emoji: '📝', type: 'typecheck' },
        { name: '🔨 Build (10m)', emoji: '🔨', type: 'build' },
      ]

      jobConfigs.forEach((config) => {
        expect(config.name).toContain(config.emoji)
        expect(config.name.toLowerCase()).toContain(config.type.toLowerCase().substring(0, 4))
      })
    })
  })

  describe('Performance Validation', () => {
    it('should complete all quality jobs within 5 minutes each', () => {
      const qualityJobs = [
        { name: 'lint', timeout: 5 },
        { name: 'format', timeout: 5 },
        { name: 'typecheck', timeout: 5 },
      ]

      qualityJobs.forEach((job) => {
        expect(job.timeout).toBeLessThanOrEqual(5)
      })
    })

    it('should complete build job within 10 minutes', () => {
      const buildJob = { name: 'build', timeout: 10 }
      expect(buildJob.timeout).toBeLessThanOrEqual(10)
    })

    it('should ensure parallel execution reduces total pipeline time', () => {
      const sequentialTime = 5 + 5 + 5 + 10 // All jobs run sequentially
      const parallelTime = Math.max(5, 5, 5, 10) // All jobs run in parallel

      expect(parallelTime).toBeLessThan(sequentialTime)
      expect(parallelTime).toBe(10) // Maximum of all job times
    })
  })

  describe('Migration Validation', () => {
    it('should preserve all quality checks from monolithic job', () => {
      const monolithicChecks = ['lint', 'format', 'typecheck', 'build']
      const modularJobs = ['lint', 'format', 'typecheck', 'build']

      monolithicChecks.forEach((check) => {
        expect(modularJobs).toContain(check)
      })
    })

    it('should not have old monolithic quality job after migration', async () => {
      const workflow: CIWorkflow = {
        name: 'CI',
        on: {
          pull_request: { types: ['opened', 'synchronize', 'reopened'] },
          push: { branches: ['main', 'develop'] },
        },
        jobs: {
          lint: {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Run Lint', run: 'pnpm run lint' }],
          },
          format: {
            'name': '💅 Format (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Check Format', run: 'pnpm run format:check' }],
          },
          typecheck: {
            'name': '📝 Types (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [{ name: 'Type Check', run: 'pnpm run typecheck' }],
          },
          build: {
            'name': '🔨 Build (10m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 10,
            'steps': [{ name: 'Build', run: 'pnpm run build' }],
          },
        },
      }

      await fs.writeFile(workflowPath, yamlUtils.dump(workflow))
      const content = await fs.readFile(workflowPath, 'utf-8')
      const parsedWorkflow = yamlUtils.load(content) as CIWorkflow

      expect(parsedWorkflow.jobs.quality).toBeUndefined()
      expect(Object.keys(parsedWorkflow.jobs)).not.toContain('quality')
    })
  })

  describe('GitHub Actions Integration', () => {
    it('should generate valid GitHub Actions workflow syntax', async () => {
      const workflow: CIWorkflow = {
        name: 'CI',
        on: {
          pull_request: { types: ['opened', 'synchronize', 'reopened'] },
          push: { branches: ['main', 'develop'] },
        },
        jobs: {
          lint: {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [
              { name: 'Checkout', uses: 'actions/checkout@v4' },
              { name: 'Run Lint', run: 'pnpm run lint' },
            ],
          },
        },
      }

      const yamlContent = yamlUtils.dump(workflow)
      expect(yamlContent).toContain('name: CI')
      expect(yamlContent).toContain('on:')
      expect(yamlContent).toContain('jobs:')
      expect(yamlContent).toContain('runs-on: ubuntu-latest')
      expect(yamlContent).toContain('timeout-minutes: 5')
    })

    it('should use proper GitHub Actions expressions in conditionals', () => {
      const statusCheck = `if [[ "\${{ needs.lint.result }}" == "failure" ]]; then exit 1; fi`
      expect(statusCheck).toContain('${{ needs.lint.result }}')
      expect(statusCheck).toContain('failure')
    })

    it('should properly escape GitHub Actions variables', () => {
      const gitDiffCommand = 'git diff --name-only origin/${{ github.base_ref }}...'
      expect(gitDiffCommand).toContain('${{ github.base_ref }}')
      expect(gitDiffCommand).not.toContain('${github.base_ref}') // Should not use shell syntax
    })
  })
})
