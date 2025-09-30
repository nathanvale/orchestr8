/**
 * Docker and container runtime detection utilities
 * Provides comprehensive checks for container test availability
 */
import { existsSync } from 'node:fs'

/**
 * Check if testcontainers library is available
 */
export const hasTestcontainers = await (async () => {
  try {
    await import('testcontainers')
    return true
  } catch {
    return false
  }
})()

/**
 * Check if Docker is available by checking environment or common paths
 * This is a synchronous check that doesn't execute commands
 */
export function isDockerAvailable(): boolean {
  // Check if we're in an environment where Docker is explicitly available
  if (process.env.DOCKER_HOST || process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE) {
    return true
  }

  // In CI environments, assume Docker is available if explicitly configured
  if (process.env.CI && (process.env.DOCKER_AVAILABLE === 'true' || process.env.GITHUB_ACTIONS)) {
    return true
  }

  // Check if docker binary exists in common paths (synchronous check)
  const { existsSync } = require('node:fs')
  const dockerPaths = [
    '/usr/bin/docker',
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  ]

  return dockerPaths.some((path) => existsSync(path))
}

/**
 * Check if container runtime is available
 */
export const hasContainerRuntime = isDockerAvailable()

/**
 * Determine if container tests should run
 * Tests run when:
 * 1. Testcontainers library is available, AND
 * 2. Container runtime (Docker/Podman) is available, AND
 * 3. Either explicitly enabled via env var OR NODE_ENV=test
 */
export function shouldRunContainerTests(envVarName: string): boolean {
  const isExplicitlyEnabled = process.env[envVarName] === '1'
  const isTestEnvironment = process.env.NODE_ENV === 'test'

  return hasTestcontainers && hasContainerRuntime && (isExplicitlyEnabled || isTestEnvironment)
}

/**
 * Get a descriptive reason why container tests are being skipped
 */
export function getSkipReason(envVarName: string): string {
  if (!hasTestcontainers) {
    return 'testcontainers library not available'
  }

  if (!hasContainerRuntime) {
    return 'Docker/container runtime not available'
  }

  const isExplicitlyEnabled = process.env[envVarName] === '1'
  const isTestEnvironment = process.env.NODE_ENV === 'test'

  if (!isExplicitlyEnabled && !isTestEnvironment) {
    return `container tests not enabled (set ${envVarName}=1 or NODE_ENV=test)`
  }

  return 'unknown reason'
}
