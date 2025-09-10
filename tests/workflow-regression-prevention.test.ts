/**
 * Workflow Regression Prevention Tests
 *
 * Comprehensive test suite to prevent regressions in ADHD CI workflow features:
 * 1. ADHD feature preservation tests
 * 2. Performance characteristic validation
 * 3. Workflow structure integrity checks
 * 4. Visual indicator consistency validation
 * 5. Timeout and resource limit enforcement
 * 6. CI pipeline behavior verification
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

// Simple YAML parser optimized for CI workflow validation
function parseWorkflowYaml(yamlContent: string): any {
  const lines = yamlContent.split('\n')
  const result: any = {
    jobs: {},
    env: {},
    on: {},
    permissions: {},
    concurrency: {},
    name: '',
  }

  let currentJob = ''
  let currentSection = ''
  let inSteps = false
  let currentStepIndex = -1

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.length - line.trimStart().length

    // Parse root level properties
    if (indent === 0 && trimmed.includes(':')) {
      const key = trimmed.split(':')[0]!
      const value = trimmed.split(':')[1]?.trim()

      if (key === 'name' && value) {
        result.name = value.replace(/['"]/g, '')
      } else if (['on', 'env', 'permissions', 'concurrency', 'jobs'].includes(key)) {
        currentSection = key
        if (key !== 'jobs') result[key] = {}
      }
    }

    // Parse environment variables
    if (currentSection === 'env' && indent === 2 && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':')
      const value = valueParts.join(':').trim()
      if (key && value) {
        result.env[key.trim()] = value.replace(/['"]/g, '')
      }
    }

    // Parse jobs
    if (
      currentSection === 'jobs' &&
      indent === 2 &&
      trimmed.includes(':') &&
      !trimmed.startsWith('-')
    ) {
      const jobName = trimmed.split(':')[0]?.trim()
      if (jobName && jobName.match(/^[a-z][a-z0-9-]*$/)) {
        currentJob = jobName
        result.jobs[jobName] = {
          'name': '',
          'timeout-minutes': 0,
          'runs-on': '',
          'needs': [],
          'if': '',
          'steps': [],
          'outputs': {},
        }
        inSteps = false
        currentStepIndex = -1
      }
    }

    // Parse job properties
    if (currentJob && indent === 4 && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':')
      const value = valueParts.join(':').trim()

      switch (key?.trim()) {
        case 'name':
          result.jobs[currentJob].name = value.replace(/['"]/g, '')
          break
        case 'timeout-minutes':
          result.jobs[currentJob]['timeout-minutes'] = parseInt(value) || 0
          break
        case 'runs-on':
          result.jobs[currentJob]['runs-on'] = value.replace(/['"]/g, '')
          break
        case 'if':
          result.jobs[currentJob].if = value.replace(/['"]/g, '')
          break
        case 'needs':
          // Handle both array and single value needs
          if (value.startsWith('[')) {
            result.jobs[currentJob].needs = value
              .replace(/[[\]]/g, '')
              .split(',')
              .map((s) => s.trim().replace(/['"]/g, ''))
              .filter(Boolean)
          } else {
            result.jobs[currentJob].needs = [value.replace(/['"]/g, '')]
          }
          break
        case 'steps':
          inSteps = true
          break
      }
    }

    // Parse steps
    if (currentJob && inSteps && indent >= 6) {
      if (
        trimmed.startsWith('- ') &&
        (trimmed.includes('name:') || trimmed.includes('uses:') || trimmed.includes('run:'))
      ) {
        currentStepIndex++
        result.jobs[currentJob].steps[currentStepIndex] = {
          name: '',
          uses: '',
          run: '',
          if: '',
        }

        // Parse inline step properties
        const stepContent = trimmed.substring(2).trim()
        if (stepContent.includes(':')) {
          const [stepKey, ...stepValueParts] = stepContent.split(':')
          const stepValue = stepValueParts.join(':').trim()

          if (stepKey && stepValue) {
            result.jobs[currentJob].steps[currentStepIndex][stepKey.trim()] = stepValue.replace(
              /['"]/g,
              '',
            )
          }
        }
      } else if (currentStepIndex >= 0 && indent === 8 && trimmed.includes(':')) {
        // Parse step properties on separate lines
        const [stepKey, ...stepValueParts] = trimmed.split(':')
        const stepValue = stepValueParts.join(':').trim()

        if (stepKey && stepValue && result.jobs[currentJob].steps[currentStepIndex]) {
          result.jobs[currentJob].steps[currentStepIndex][stepKey.trim()] = stepValue.replace(
            /['"]/g,
            '',
          )
        }
      }
    }
  }

  return result
}

// Helper to validate ADHD feature preservation
function validateADHDFeatures(workflow: any): {
  hasEmojiIndicators: boolean
  hasTimeoutLimits: boolean
  hasStepLimits: boolean
  hasStatusJob: boolean
  hasFixCommands: boolean
  hasBreadcrumbs: boolean
} {
  const validation = {
    hasEmojiIndicators: false,
    hasTimeoutLimits: false,
    hasStepLimits: false,
    hasStatusJob: false,
    hasFixCommands: false,
    hasBreadcrumbs: false,
  }

  // Check emoji indicators
  validation.hasEmojiIndicators = Object.values(workflow.jobs).some((job: any) =>
    /(?:🔧|🔍|💅|🏗️|⚡|🎯|⚧|📊)/u.test(job.name),
  )

  // Check timeout limits in names
  validation.hasTimeoutLimits = Object.values(workflow.jobs).some((job: any) =>
    /\(\d+m\)/.test(job.name),
  )

  // Check step limits (3 or fewer non-setup steps)
  validation.hasStepLimits = Object.values(workflow.jobs).every((job: any) => {
    const nonSetupSteps = job.steps.filter((step: any) => {
      const isSetupStep =
        (step.uses &&
          (step.uses.includes('actions/checkout') ||
            step.uses.includes('actions/setup-node') ||
            step.uses.includes('pnpm/action-setup') ||
            step.uses.includes('actions/cache'))) ||
        (step.run &&
          (step.run.includes('pnpm install') ||
            step.run.includes('npm install') ||
            step.run.includes('yarn install'))) ||
        (step.name &&
          (step.name.includes('Checkout') ||
            step.name.includes('Setup') ||
            step.name.includes('Cache') ||
            step.name.includes('Install')))
      return !isSetupStep
    })
    return nonSetupSteps.length <= 3
  })

  // Check status job exists
  validation.hasStatusJob = !!workflow.jobs['ci-status']

  // Check fix commands in workflow content (requires raw content check)
  validation.hasFixCommands = true // Will be validated separately with raw content

  // Check breadcrumbs in workflow content (requires raw content check)
  validation.hasBreadcrumbs = true // Will be validated separately with raw content

  return validation
}

// Helper to validate performance characteristics
function validatePerformanceCharacteristics(workflow: any): {
  quickFeedbackPresent: boolean
  timeoutLimitsAppropriate: boolean
  parallelJobsConfigured: boolean
  resourceEfficient: boolean
} {
  const validation = {
    quickFeedbackPresent: false,
    timeoutLimitsAppropriate: false,
    parallelJobsConfigured: false,
    resourceEfficient: false,
  }

  // Check quick feedback (1 minute timeout exists)
  validation.quickFeedbackPresent = Object.values(workflow.jobs).some(
    (job: any) => job['timeout-minutes'] === 1,
  )

  // Check timeout limits are appropriate (not too high) for jobs that have timeouts
  const jobsWithTimeouts = Object.values(workflow.jobs).filter(
    (job: any) => job['timeout-minutes'] && job['timeout-minutes'] > 0,
  )
  validation.timeoutLimitsAppropriate =
    jobsWithTimeouts.every((job: any) => job['timeout-minutes'] <= 10) &&
    jobsWithTimeouts.length > 0

  // Check parallel job configuration (jobs have proper needs dependencies)
  const jobsWithNeeds = Object.values(workflow.jobs).filter(
    (job: any) => job.needs && job.needs.length > 0,
  )
  validation.parallelJobsConfigured = jobsWithNeeds.length > 0

  // Check resource efficiency (reasonable number of jobs)
  validation.resourceEfficient = Object.keys(workflow.jobs).length <= 10

  return validation
}

describe('Workflow Regression Prevention', () => {
  const workflowPath = './.github/workflows/ci.yml'
  const workflowExists = existsSync(workflowPath)
  const workflowContent = workflowExists ? readFileSync(workflowPath, 'utf-8') : ''
  const workflow = parseWorkflowYaml(workflowContent)

  describe('1. ADHD Feature Preservation', () => {
    it('should preserve all critical ADHD optimization features', () => {
      expect(workflowExists, 'CI workflow file must exist').toBe(true)

      const adhdFeatures = validateADHDFeatures(workflow)

      // All ADHD features must be preserved
      expect(adhdFeatures.hasEmojiIndicators, 'Emoji indicators must be present in job names').toBe(
        true,
      )
      expect(adhdFeatures.hasTimeoutLimits, 'Timeout limits must be displayed in job names').toBe(
        true,
      )
      expect(adhdFeatures.hasStepLimits, 'Jobs must respect 3-step limit for non-setup steps').toBe(
        true,
      )
      expect(adhdFeatures.hasStatusJob, 'CI status aggregation job must exist').toBe(true)
    })

    it('should maintain visual consistency across all jobs', () => {
      const expectedEmojis = ['🔧', '🔍', '💅', '🏗️', '⚡', '🎯', '⚧', '📊']

      let emojiCount = 0
      expectedEmojis.forEach((emoji) => {
        if (workflowContent.includes(emoji)) {
          emojiCount++
        }
      })

      // At least 5 different emojis should be used for visual distinction
      expect(emojiCount).toBeGreaterThanOrEqual(5)
    })

    it('should preserve timeout limit display in job names', () => {
      const jobsWithTimeouts = Object.values(workflow.jobs).filter(
        (job: any) => /\(\d+m\)/.test(job.name) && job['timeout-minutes'] > 0,
      )

      // All timeout jobs should display their limits
      expect(jobsWithTimeouts.length).toBeGreaterThanOrEqual(4)
    })

    it('should maintain fix command infrastructure', () => {
      // Check for fix command patterns in the workflow content
      const fixCommandPatterns = [
        'pnpm lint:fix',
        'pnpm format',
        'pnpm typecheck',
        'Fix Commands',
        'include-fix-commands',
      ]

      const hasFixCommands = fixCommandPatterns.some((pattern) => workflowContent.includes(pattern))

      expect(hasFixCommands, 'Fix command infrastructure must be maintained').toBe(true)
    })

    it('should preserve breadcrumb navigation and progress tracking', () => {
      const breadcrumbPatterns = ['Step', 'Pipeline', 'Navigation', 'Progress', 'Status Check']

      const hasBreadcrumbs = breadcrumbPatterns.some((pattern) => workflowContent.includes(pattern))

      expect(hasBreadcrumbs, 'Breadcrumb navigation must be preserved').toBe(true)
    })
  })

  describe('2. Performance Characteristic Validation', () => {
    it('should maintain optimal performance characteristics', () => {
      const perfMetrics = validatePerformanceCharacteristics(workflow)

      expect(
        perfMetrics.quickFeedbackPresent,
        'Quick feedback (1-minute timeout) must be available',
      ).toBe(true)
      expect(
        perfMetrics.timeoutLimitsAppropriate,
        'All timeout limits must be reasonable (≤10 minutes)',
      ).toBe(true)
      expect(
        perfMetrics.parallelJobsConfigured,
        'Jobs must be configured for parallel execution',
      ).toBe(true)
      expect(
        perfMetrics.resourceEfficient,
        'Total job count must be resource-efficient (≤10 jobs)',
      ).toBe(true)
    })

    it('should ensure quick test execution for rapid feedback', () => {
      const quickTestJob = workflow.jobs['quick-tests']
      expect(quickTestJob, 'Quick tests job must exist').toBeTruthy()
      expect(quickTestJob['timeout-minutes'], 'Quick tests must have 1-minute timeout').toBe(1)
      expect(quickTestJob.name, 'Quick tests job name must indicate timeout').toMatch(/\(1m\)/)
    })

    it('should validate job dependency chain efficiency', () => {
      const setupJob = workflow.jobs['setup']
      const dependentJobs = Object.values(workflow.jobs).filter(
        (job: any) => job.needs && job.needs.includes('setup'),
      )

      expect(setupJob, 'Setup job must exist for dependency chain').toBeTruthy()
      expect(dependentJobs.length).toBeGreaterThanOrEqual(4) // At least 4 jobs should depend on setup
    })

    it('should prevent resource waste in CI configuration', () => {
      // Check that all jobs have reasonable resource allocation
      Object.entries(workflow.jobs).forEach(([_jobName, job]: [string, any]) => {
        expect(job['runs-on']).toBeTruthy() // All jobs should specify runner

        // Only check timeout for jobs that should have timeouts (not setup or status jobs)
        if (job['timeout-minutes'] && job['timeout-minutes'] > 0) {
          expect(job['timeout-minutes']).toBeLessThanOrEqual(10) // No job should exceed 10 minutes
        }
      })
    })
  })

  describe('3. Workflow Structure Integrity', () => {
    it('should maintain required job structure and dependencies', () => {
      const requiredJobs = [
        'setup',
        'quick-tests',
        'focused-tests',
        'format',
        'lint',
        'typecheck',
        'build',
        'ci-status',
      ]

      requiredJobs.forEach((jobName) => {
        expect(workflow.jobs[jobName], `Required job '${jobName}' must exist`).toBeTruthy()
      })
    })

    it('should preserve status job aggregation functionality', () => {
      const statusJob = workflow.jobs['ci-status']
      expect(statusJob, 'CI status job must exist').toBeTruthy()
      expect(statusJob.if, 'Status job must run always()').toBe('always()')
      expect(statusJob.needs, 'Status job must depend on other jobs').toBeTruthy()
      expect(statusJob.needs.length).toBeGreaterThanOrEqual(6) // Should depend on main jobs
    })

    it('should maintain workflow trigger configuration', () => {
      expect(workflow.name, 'Workflow must have a descriptive name').toBeTruthy()
      expect(workflowContent.includes('pull_request'), 'Must trigger on pull requests').toBe(true)
      expect(workflowContent.includes('push'), 'Must trigger on push to main branches').toBe(true)
    })

    it('should preserve environment variable configuration', () => {
      expect(workflow.env, 'Environment variables must be configured').toBeTruthy()
      expect(workflow.env['NODE_VERSION'], 'Node version must be specified').toBeTruthy()
      expect(workflow.env['PNPM_VERSION'], 'PNPM version must be specified').toBeTruthy()
    })
  })

  describe('4. Regression Test Patterns Documentation', () => {
    it('should validate emoji consistency pattern', () => {
      const emojiJobs = {
        'setup': '🔧',
        'quick-tests': '⚡',
        'focused-tests': '🎯',
        'format': '💅',
        'lint': '🔍',
        'typecheck': '🔧',
        'build': '🏗️',
        'commit-lint': '⚧',
        'ci-status': '📊',
      }

      Object.entries(emojiJobs).forEach(([jobKey, expectedEmoji]) => {
        if (workflow.jobs[jobKey]) {
          expect(
            workflow.jobs[jobKey].name,
            `Job '${jobKey}' must contain emoji '${expectedEmoji}'`,
          ).toContain(expectedEmoji)
        }
      })
    })

    it('should validate timeout pattern consistency', () => {
      const timeoutJobs = [
        'quick-tests', // 1m
        'focused-tests', // 5m
        'format', // 5m
        'lint', // 5m
        'typecheck', // 5m
        'build', // 5m
        'commit-lint', // 5m
      ]

      timeoutJobs.forEach((jobKey) => {
        if (workflow.jobs[jobKey]) {
          const job = workflow.jobs[jobKey]
          const nameMatch = job.name.match(/\((\d+)m\)/)
          const displayedTimeout = nameMatch ? parseInt(nameMatch[1]) : 0
          const actualTimeout = job['timeout-minutes']

          expect(displayedTimeout).toBeGreaterThan(0)
          expect(Math.abs(displayedTimeout - actualTimeout)).toBeLessThanOrEqual(1) // Allow 1 minute variance
        }
      })
    })

    it('should validate step naming and organization patterns', () => {
      Object.entries(workflow.jobs).forEach(([_jobName, job]: [string, any]) => {
        const steps = job.steps || []

        // Each job should have reasonable number of steps
        expect(steps.length).toBeGreaterThan(0)
        expect(steps.length).toBeLessThanOrEqual(8) // Reasonable upper limit

        // Setup steps should come first
        const setupStepIndices = steps
          .map((step: any, index: number) => {
            const isSetup =
              (step.uses &&
                (step.uses.includes('actions/checkout') ||
                  step.uses.includes('actions/setup-node') ||
                  step.uses.includes('pnpm/action-setup') ||
                  step.uses.includes('actions/cache'))) ||
              (step.run && step.run.includes('install')) ||
              (step.name &&
                (step.name.includes('Setup') ||
                  step.name.includes('Install') ||
                  step.name.includes('Cache')))
            return isSetup ? index : -1
          })
          .filter((index: number) => index >= 0)

        // Setup steps should generally be at the beginning
        if (setupStepIndices.length > 0) {
          const firstSetupIndex = Math.min(...setupStepIndices)
          expect(firstSetupIndex).toBeLessThanOrEqual(3) // Setup steps should be early
        }
      })
    })
  })

  describe('5. Future-Proofing Validation', () => {
    it('should ensure workflow can accommodate new ADHD features', () => {
      // Workflow should have extensible structure
      expect(Object.keys(workflow.jobs).length).toBeGreaterThanOrEqual(6)
      expect(Object.keys(workflow.jobs).length).toBeLessThanOrEqual(12) // Room for growth

      // Status job should be flexible for new reporting
      const statusJob = workflow.jobs['ci-status']
      if (statusJob && statusJob.steps) {
        const statusSteps = statusJob.steps
        expect(statusSteps.length).toBeGreaterThanOrEqual(1)
        expect(statusSteps.length).toBeLessThanOrEqual(5) // Reasonable complexity
      }
    })

    it('should validate that CI changes preserve ADHD optimizations', () => {
      // This test serves as a canary for future changes
      const criticalFeatureCount = {
        emojiJobs: Object.values(workflow.jobs).filter((job: any) =>
          /(?:🔧|🔍|💅|🏗️|⚡|🎯|⚧|📊)/u.test(job.name),
        ).length,
        timedJobs: Object.values(workflow.jobs).filter((job: any) => job['timeout-minutes'] > 0)
          .length,
        dependentJobs: Object.values(workflow.jobs).filter(
          (job: any) => job.needs && job.needs.length > 0,
        ).length,
      }

      // These counts should be maintained or improved
      expect(criticalFeatureCount.emojiJobs).toBeGreaterThanOrEqual(6)
      expect(criticalFeatureCount.timedJobs).toBeGreaterThanOrEqual(6)
      expect(criticalFeatureCount.dependentJobs).toBeGreaterThanOrEqual(5)
    })

    it('should ensure workflow maintainability standards', () => {
      // Workflow should not be overly complex
      const totalSteps = Object.values(workflow.jobs).reduce(
        (sum, job: any) => sum + (job.steps ? job.steps.length : 0),
        0,
      )

      expect(totalSteps).toBeGreaterThanOrEqual(20) // Sufficient functionality
      expect(totalSteps).toBeLessThanOrEqual(60) // Not overly complex

      // Jobs should have clear, descriptive names
      Object.values(workflow.jobs).forEach((job: any) => {
        expect(job.name.length).toBeGreaterThanOrEqual(10) // Descriptive
        expect(job.name.length).toBeLessThanOrEqual(50) // Not verbose
      })
    })
  })
})
