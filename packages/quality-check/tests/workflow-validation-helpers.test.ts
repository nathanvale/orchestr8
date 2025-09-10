import { describe, it, expect } from 'vitest'
import {
  ADHD_CI_JOBS,
  EXPECTED_JOB_COUNT,
  DEPENDENT_JOBS,
  validateJobEmoji,
  validateJobTimeout,
  validateJobDependencies,
  validateStepCount,
  validateWorkflowStructure,
  type CIJob,
  type CIWorkflow,
} from './workflow-validation-helpers'

describe('Workflow Validation Helpers', () => {
  describe('Constants', () => {
    it('should have EXPECTED_JOB_COUNT match actual ADHD_CI_JOBS count', () => {
      const actualJobCount = Object.keys(ADHD_CI_JOBS).length
      expect(EXPECTED_JOB_COUNT).toBe(actualJobCount)
      expect(EXPECTED_JOB_COUNT).toBe(9)
    })
  })

  describe('ADHD_CI_JOBS constant', () => {
    it('should define all expected ADHD CI jobs', () => {
      const jobIds = Object.keys(ADHD_CI_JOBS)
      expect(jobIds).toHaveLength(EXPECTED_JOB_COUNT)
      expect(jobIds).toEqual([
        'setup',
        'quick-tests',
        'focused-tests',
        'format',
        'lint',
        'typecheck',
        'build',
        'commit-lint',
        'ci-status',
      ])
    })

    it('should have correct emojis for each job', () => {
      expect(ADHD_CI_JOBS.setup.emoji).toBe('🔧')
      expect(ADHD_CI_JOBS['quick-tests'].emoji).toBe('⚡')
      expect(ADHD_CI_JOBS['focused-tests'].emoji).toBe('🎯')
      expect(ADHD_CI_JOBS.format.emoji).toBe('💅')
      expect(ADHD_CI_JOBS.lint.emoji).toBe('🔍')
      expect(ADHD_CI_JOBS.typecheck.emoji).toBe('🔧')
      expect(ADHD_CI_JOBS.build.emoji).toBe('🏗️')
      expect(ADHD_CI_JOBS['commit-lint'].emoji).toBe('⚧')
      expect(ADHD_CI_JOBS['ci-status'].emoji).toBe('📊')
    })

    it('should have correct timeouts', () => {
      expect(ADHD_CI_JOBS.setup.timeout).toBeUndefined()
      expect(ADHD_CI_JOBS['quick-tests'].timeout).toBe(1)
      expect(ADHD_CI_JOBS['focused-tests'].timeout).toBe(5)
      expect(ADHD_CI_JOBS.format.timeout).toBe(5)
      expect(ADHD_CI_JOBS.lint.timeout).toBe(5)
      expect(ADHD_CI_JOBS.typecheck.timeout).toBe(5)
      expect(ADHD_CI_JOBS.build.timeout).toBe(5)
      expect(ADHD_CI_JOBS['commit-lint'].timeout).toBe(5)
      expect(ADHD_CI_JOBS['ci-status'].timeout).toBeUndefined()
    })
  })

  describe('validateJobEmoji', () => {
    it('should validate job contains expected emoji', () => {
      const job: CIJob = {
        'name': '🔍 Lint (5m)',
        'runs-on': 'ubuntu-latest',
        'steps': [],
      }

      expect(validateJobEmoji(job, '🔍')).toBe(true)
      expect(validateJobEmoji(job, '💅')).toBe(false)
    })
  })

  describe('validateJobTimeout', () => {
    it('should validate job timeout matches expected value', () => {
      const jobWith5Min: CIJob = {
        'name': 'Test Job',
        'runs-on': 'ubuntu-latest',
        'timeout-minutes': 5,
        'steps': [],
      }

      const jobNoTimeout: CIJob = {
        'name': 'Test Job',
        'runs-on': 'ubuntu-latest',
        'steps': [],
      }

      expect(validateJobTimeout(jobWith5Min, 5)).toBe(true)
      expect(validateJobTimeout(jobWith5Min, 10)).toBe(false)
      expect(validateJobTimeout(jobNoTimeout, undefined)).toBe(true)
      expect(validateJobTimeout(jobWith5Min, undefined)).toBe(false)
    })
  })

  describe('validateJobDependencies', () => {
    it('should validate job has expected dependencies', () => {
      const jobWithDeps: CIJob = {
        'name': 'Status',
        'runs-on': 'ubuntu-latest',
        'needs': ['lint', 'format', 'types'],
        'steps': [],
      }

      const jobNoDeps: CIJob = {
        'name': 'Lint',
        'runs-on': 'ubuntu-latest',
        'steps': [],
      }

      expect(validateJobDependencies(jobWithDeps, ['lint', 'format'])).toBe(true)
      expect(validateJobDependencies(jobWithDeps, ['lint', 'build'])).toBe(false)
      expect(validateJobDependencies(jobNoDeps, [])).toBe(true)
      expect(validateJobDependencies(jobNoDeps, undefined)).toBe(true)
    })

    it('should handle string and array needs format', () => {
      const jobStringNeeds: CIJob = {
        'name': 'Deploy',
        'runs-on': 'ubuntu-latest',
        'needs': 'build',
        'steps': [],
      }

      expect(validateJobDependencies(jobStringNeeds, ['build'])).toBe(true)
    })
  })

  describe('validateStepCount', () => {
    it('should count only non-setup steps', () => {
      const job: CIJob = {
        'name': 'Test',
        'runs-on': 'ubuntu-latest',
        'steps': [
          { uses: 'actions/checkout@v4' },
          { uses: 'actions/setup-node@v4' },
          { uses: 'pnpm/action-setup@v4' },
          { name: 'Install Dependencies', run: 'pnpm install' },
          { name: 'Run Tests', run: 'pnpm test' },
          { name: 'Generate Report', run: 'pnpm test:report' },
          { name: 'Upload Coverage', run: 'pnpm coverage:upload' },
        ],
      }

      // Only 3 non-setup steps: Run Tests, Generate Report, Upload Coverage
      expect(validateStepCount(job, 3)).toBe(true)
      expect(validateStepCount(job, 2)).toBe(false)
    })
  })

  describe('validateWorkflowStructure', () => {
    it('should validate complete workflow structure', () => {
      const validWorkflow: CIWorkflow = {
        name: 'ADHD CI',
        on: { push: { branches: ['main'] } },
        jobs: {
          'setup': {
            'name': '🔧 Setup & Cache',
            'runs-on': 'ubuntu-latest',
            'steps': [],
          },
          'quick-tests': {
            'name': '⚡ Quick Tests (1m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 1,
            'steps': [],
          },
          'focused-tests': {
            'name': '🎯 Focused Tests (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'format': {
            'name': '💅 Format (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'lint': {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'typecheck': {
            'name': '🔧 Types (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'build': {
            'name': '🏗️ Build (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'commit-lint': {
            'name': '⚧ Commit Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'ci-status': {
            'name': '📊 CI Status',
            'runs-on': 'ubuntu-latest',
            'needs': [
              'quick-tests',
              'focused-tests',
              'format',
              'lint',
              'typecheck',
              'build',
              'commit-lint',
            ],
            'steps': [],
          },
        },
      }

      const result = validateWorkflowStructure(validWorkflow)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing jobs', () => {
      const incompleteWorkflow: CIWorkflow = {
        name: 'CI',
        on: { push: { branches: ['main'] } },
        jobs: {
          lint: {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'steps': [],
          },
        },
      }

      const result = validateWorkflowStructure(incompleteWorkflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain(`Expected ${EXPECTED_JOB_COUNT} jobs, found 1`)
      expect(result.errors.some((e) => e.includes('Missing job: setup'))).toBe(true)
    })

    it('should detect incorrect emojis', () => {
      const wrongEmojiWorkflow: CIWorkflow = {
        name: 'ADHD CI',
        on: { push: { branches: ['main'] } },
        jobs: {
          'setup': {
            'name': '❌ Setup & Cache', // Wrong emoji
            'runs-on': 'ubuntu-latest',
            'steps': [],
          },
          'quick-tests': {
            'name': '⚡ Quick Tests (1m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 1,
            'steps': [],
          },
          'focused-tests': {
            'name': '🎯 Focused Tests (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'format': {
            'name': '💅 Format (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'lint': {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'typecheck': {
            'name': '🔧 Types (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'build': {
            'name': '🏗️ Build (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'commit-lint': {
            'name': '⚧ Commit Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'ci-status': {
            'name': '📊 CI Status',
            'runs-on': 'ubuntu-latest',
            'needs': [
              'quick-tests',
              'focused-tests',
              'format',
              'lint',
              'typecheck',
              'build',
              'commit-lint',
            ],
            'steps': [],
          },
        },
      }

      const result = validateWorkflowStructure(wrongEmojiWorkflow)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('setup missing emoji 🔧'))).toBe(true)
    })

    it('should detect incorrect timeout', () => {
      const wrongTimeoutWorkflow: CIWorkflow = {
        name: 'ADHD CI',
        on: { push: { branches: ['main'] } },
        jobs: {
          'setup': {
            'name': '🔧 Setup & Cache',
            'runs-on': 'ubuntu-latest',
            'steps': [],
          },
          'quick-tests': {
            'name': '⚡ Quick Tests (1m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 10, // Wrong timeout
            'steps': [],
          },
          'focused-tests': {
            'name': '🎯 Focused Tests (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'format': {
            'name': '💅 Format (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'lint': {
            'name': '🔍 Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'typecheck': {
            'name': '🔧 Types (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'build': {
            'name': '🏗️ Build (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'commit-lint': {
            'name': '⚧ Commit Lint (5m)',
            'runs-on': 'ubuntu-latest',
            'timeout-minutes': 5,
            'steps': [],
          },
          'ci-status': {
            'name': '📊 CI Status',
            'runs-on': 'ubuntu-latest',
            'needs': [
              'quick-tests',
              'focused-tests',
              'format',
              'lint',
              'typecheck',
              'build',
              'commit-lint',
            ],
            'steps': [],
          },
        },
      }

      const result = validateWorkflowStructure(wrongTimeoutWorkflow)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('quick-tests has incorrect timeout'))).toBe(true)
    })
  })

  describe('DEPENDENT_JOBS constant', () => {
    it('should list all jobs that CI status depends on', () => {
      expect(DEPENDENT_JOBS).toHaveLength(7)
      expect(DEPENDENT_JOBS).not.toContain('setup')
      expect(DEPENDENT_JOBS).not.toContain('ci-status')
      expect(DEPENDENT_JOBS).toContain('quick-tests')
      expect(DEPENDENT_JOBS).toContain('focused-tests')
      expect(DEPENDENT_JOBS).toContain('format')
      expect(DEPENDENT_JOBS).toContain('lint')
      expect(DEPENDENT_JOBS).toContain('typecheck')
      expect(DEPENDENT_JOBS).toContain('build')
      expect(DEPENDENT_JOBS).toContain('commit-lint')
    })
  })
})
