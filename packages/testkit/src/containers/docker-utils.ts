/**
 * Docker utilities for container testing
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'

const execAsync = promisify(exec)

/**
 * Check if Docker is available and running
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    // Check for Docker socket (Linux/Mac)
    try {
      await access('/var/run/docker.sock', constants.R_OK)
    } catch {
      // Check for Docker Desktop on Windows
      if (!process.env.DOCKER_HOST) {
        return false
      }
    }

    // Try to run a simple Docker command
    const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"', {
      timeout: 5000,
    })

    return stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Skip test if Docker is not available
 */
export function skipIfNoDocker(testFn: () => void | Promise<void>) {
  return async () => {
    const dockerAvailable = await isDockerAvailable()
    if (!dockerAvailable) {
      console.log('⚠️ Skipping test: Docker is not available')
      return
    }
    return testFn()
  }
}

// Signal handling for cleanup
const cleanupHandlers = new Set<() => Promise<void>>()

/**
 * Register a cleanup handler that will be called on process exit
 */
export function registerCleanupHandler(handler: () => Promise<void>): () => void {
  cleanupHandlers.add(handler)
  return () => {
    cleanupHandlers.delete(handler)
  }
}

// Handle process termination
let cleanupInProgress = false

async function handleCleanup() {
  if (cleanupInProgress) return
  cleanupInProgress = true

  console.log('🧹 Cleaning up containers...')
  const promises = Array.from(cleanupHandlers).map((handler) =>
    handler().catch((err) => console.error('Cleanup error:', err)),
  )

  await Promise.all(promises)
  cleanupHandlers.clear()
}

// Register signal handlers
if (process.env.NODE_ENV === 'test') {
  process.once('SIGINT', async () => {
    await handleCleanup()
    process.exit(0)
  })

  process.once('SIGTERM', async () => {
    await handleCleanup()
    process.exit(0)
  })

  process.once('beforeExit', async () => {
    await handleCleanup()
  })
}

/**
 * Get test mode from environment
 */
export function isIntegrationTestMode(): boolean {
  return process.env.TEST_MODE === 'integration'
}

/**
 * Skip test if not in integration mode
 */
export function skipIfNotIntegration(testFn: () => void | Promise<void>) {
  return async () => {
    if (!isIntegrationTestMode()) {
      console.log('⚠️ Skipping integration test: TEST_MODE !== "integration"')
      return
    }
    return testFn()
  }
}
