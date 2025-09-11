import { load } from 'js-yaml'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// Actual ADHD CI job structure from production workflow
export const ADHD_CI_JOBS = {
  'setup': {
    name: '🔧 Setup & Cache',
    emoji: '🔧',
    timeout: undefined, // No timeout for setup
  },
  'quick-tests': {
    name: '⚡ Quick Tests (1m)',
    emoji: '⚡',
    timeout: 1,
  },
  'focused-tests': {
    name: '🎯 Focused Tests (5m)',
    emoji: '🎯',
    timeout: 5,
  },
  'format': {
    name: '💅 Format (5m)',
    emoji: '💅',
    timeout: 5,
  },
  'lint': {
    name: '🔍 Lint (5m)',
    emoji: '🔍',
    timeout: 5,
  },
  'typecheck': {
    name: '🔧 Types (5m)',
    emoji: '🔧',
    timeout: 5,
  },
  'build': {
    name: '🏗️ Build (5m)',
    emoji: '🏗️',
    timeout: 5,
  },
  'commit-lint': {
    name: '⚧ Commit Lint (5m)',
    emoji: '⚧',
    timeout: 5,
  },
  'ci-status': {
    name: '📊 CI Status',
    emoji: '📊',
    timeout: undefined, // Status aggregator doesn't need timeout
  },
}

export const EXPECTED_JOB_COUNT = 9
export const DEPENDENT_JOBS = [
  'quick-tests',
  'focused-tests',
  'format',
  'lint',
  'typecheck',
  'build',
  'commit-lint',
]

export interface CIJob {
  'name': string
  'runs-on': string
  'timeout-minutes'?: number
  'steps': Array<{
    name?: string
    run?: string
    uses?: string
    with?: any
    id?: string
    if?: string
  }>
  'needs'?: string | string[]
  'if'?: string
  'outputs'?: Record<string, string>
}

export interface CIWorkflow {
  name: string
  on: any
  env?: Record<string, string>
  jobs: Record<string, CIJob>
}

export async function loadWorkflowFromFile(filePath: string): Promise<CIWorkflow> {
  const content = await fs.readFile(filePath, 'utf-8')
  return load(content) as CIWorkflow
}

export async function loadActualADHDWorkflow(): Promise<CIWorkflow> {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'ci.yml')
  return loadWorkflowFromFile(workflowPath)
}

export function validateJobEmoji(job: CIJob, expectedEmoji: string): boolean {
  return job.name.includes(expectedEmoji)
}

export function validateJobTimeout(job: CIJob, expectedTimeout: number | undefined): boolean {
  if (expectedTimeout === undefined) {
    return job['timeout-minutes'] === undefined
  }
  return job['timeout-minutes'] === expectedTimeout
}

export function validateJobDependencies(job: CIJob, expectedDeps?: string[]): boolean {
  if (!expectedDeps || expectedDeps.length === 0) {
    return !job.needs || (Array.isArray(job.needs) && job.needs.length === 0)
  }

  const actualDeps = Array.isArray(job.needs) ? job.needs : job.needs ? [job.needs] : []
  return expectedDeps.every((dep) => actualDeps.includes(dep))
}

export function validateStepCount(job: CIJob, maxSteps: number = 3): boolean {
  // Filter out setup steps (checkout, setup-node, setup-pnpm, cache, install)
  const setupKeywords = ['checkout', 'setup', 'cache', 'install']
  const nonSetupSteps = job.steps.filter((step) => {
    const stepName = (step.name || step.uses || '').toLowerCase()
    return !setupKeywords.some((keyword) => stepName.includes(keyword))
  })

  return nonSetupSteps.length <= maxSteps
}

export function validateWorkflowStructure(workflow: CIWorkflow): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check job count
  const actualJobCount = Object.keys(workflow.jobs).length
  if (actualJobCount !== EXPECTED_JOB_COUNT) {
    errors.push(`Expected ${EXPECTED_JOB_COUNT} jobs, found ${actualJobCount}`)
  }

  // Validate each job
  for (const [jobId, expectedConfig] of Object.entries(ADHD_CI_JOBS)) {
    const job = workflow.jobs[jobId]

    if (!job) {
      errors.push(`Missing job: ${jobId}`)
      continue
    }

    // Check emoji
    if (!validateJobEmoji(job, expectedConfig.emoji)) {
      errors.push(`Job ${jobId} missing emoji ${expectedConfig.emoji}`)
    }

    // Check timeout
    if (!validateJobTimeout(job, expectedConfig.timeout)) {
      errors.push(
        `Job ${jobId} has incorrect timeout. Expected: ${expectedConfig.timeout}, Actual: ${job['timeout-minutes']}`,
      )
    }
  }

  // Validate CI status job dependencies
  const statusJob = workflow.jobs['ci-status']
  if (statusJob) {
    if (!validateJobDependencies(statusJob, DEPENDENT_JOBS)) {
      errors.push('CI status job has incorrect dependencies')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
