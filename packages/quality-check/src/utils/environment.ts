/**
 * Environment detection utilities for quality-check
 */

/**
 * Environment types for quality checking
 */
export type EnvironmentType = 'ci' | 'interactive' | 'test'

/**
 * CI environment detection
 */
export interface CIEnvironment {
  name: string
  isCI: boolean
  variables: string[]
}

/**
 * Known CI environments and their detection variables
 */
const CI_ENVIRONMENTS: CIEnvironment[] = [
  {
    name: 'GitHub Actions',
    isCI: true,
    variables: ['GITHUB_ACTIONS', 'CI'],
  },
  {
    name: 'GitLab CI',
    isCI: true,
    variables: ['GITLAB_CI', 'CI'],
  },
  {
    name: 'Travis CI',
    isCI: true,
    variables: ['TRAVIS', 'CI'],
  },
  {
    name: 'CircleCI',
    isCI: true,
    variables: ['CIRCLECI', 'CI'],
  },
  {
    name: 'Azure DevOps',
    isCI: true,
    variables: ['TF_BUILD', 'CI'],
  },
  {
    name: 'Jenkins',
    isCI: true,
    variables: ['JENKINS_URL', 'CI'],
  },
  {
    name: 'Bitbucket Pipelines',
    isCI: true,
    variables: ['BITBUCKET_COMMIT', 'CI'],
  },
  {
    name: 'TeamCity',
    isCI: true,
    variables: ['TEAMCITY_VERSION', 'CI'],
  },
  {
    name: 'Bamboo',
    isCI: true,
    variables: ['bamboo_buildKey', 'CI'],
  },
  {
    name: 'Codeship',
    isCI: true,
    variables: ['CODESHIP', 'CI'],
  },
  {
    name: 'Drone',
    isCI: true,
    variables: ['DRONE', 'CI'],
  },
  {
    name: 'Semaphore',
    isCI: true,
    variables: ['SEMAPHORE', 'CI'],
  },
  {
    name: 'AppVeyor',
    isCI: true,
    variables: ['APPVEYOR', 'CI'],
  },
  {
    name: 'Buildkite',
    isCI: true,
    variables: ['BUILDKITE', 'CI'],
  },
  {
    name: 'Generic CI',
    isCI: true,
    variables: ['CI'],
  },
]

/**
 * Detect the current environment type
 */
export function detectEnvironment(): EnvironmentType {
  // Check for test environment first
  if (isTestEnvironment()) {
    return 'test'
  }

  // Check for CI environment
  if (isCIEnvironment()) {
    return 'ci'
  }

  // Default to interactive
  return 'interactive'
}

/**
 * Check if running in a CI environment
 */
export function isCIEnvironment(): boolean {
  // Check each known CI environment
  for (const env of CI_ENVIRONMENTS) {
    if (env.variables.some((variable) => process.env[variable])) {
      return true
    }
  }

  return false
}

/**
 * Get the detected CI environment details
 */
export function getCIEnvironment(): CIEnvironment | null {
  for (const env of CI_ENVIRONMENTS) {
    if (env.variables.some((variable) => process.env[variable])) {
      return env
    }
  }

  return null
}

/**
 * Check if running in a test environment
 */
export function isTestEnvironment(): boolean {
  return !!(
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST ||
    process.env.JEST_WORKER_ID ||
    process.env.WALLABY_WORKER ||
    process.env.npm_lifecycle_event?.includes('test')
  )
}

/**
 * Check if running in an interactive environment (local development)
 */
export function isInteractiveEnvironment(): boolean {
  const env = detectEnvironment()
  return env === 'interactive'
}

/**
 * Get default fix mode based on environment
 */
export function getDefaultFixMode(): 'safe' | 'full' {
  const env = detectEnvironment()

  switch (env) {
    case 'ci':
      // CI environments should use safe mode by default
      return 'safe'
    case 'test':
      // Test environments should use safe mode to avoid unexpected changes
      return 'safe'
    case 'interactive':
    default:
      // Interactive environments can use full mode
      return 'full'
  }
}

/**
 * Environment context for logging and debugging
 */
export interface EnvironmentContext {
  type: EnvironmentType
  isCI: boolean
  isTest: boolean
  isInteractive: boolean
  ciEnvironment: CIEnvironment | null
  defaultFixMode: 'safe' | 'full'
  variables: Record<string, string | undefined>
}

/**
 * Get full environment context
 */
export function getEnvironmentContext(): EnvironmentContext {
  const type = detectEnvironment()
  const isCI = isCIEnvironment()
  const isTest = isTestEnvironment()
  const isInteractive = isInteractiveEnvironment()
  const ciEnvironment = getCIEnvironment()
  const defaultFixMode = getDefaultFixMode()

  // Capture relevant environment variables for debugging
  const variables: Record<string, string | undefined> = {}
  const relevantVars = [
    'NODE_ENV',
    'CI',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'TRAVIS',
    'CIRCLECI',
    'TF_BUILD',
    'JENKINS_URL',
    'BITBUCKET_COMMIT',
    'TEAMCITY_VERSION',
    'VITEST',
    'JEST_WORKER_ID',
    'WALLABY_WORKER',
    'npm_lifecycle_event',
  ]

  for (const varName of relevantVars) {
    variables[varName] = process.env[varName]
  }

  return {
    type,
    isCI,
    isTest,
    isInteractive,
    ciEnvironment,
    defaultFixMode,
    variables,
  }
}
