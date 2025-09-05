import { afterEach, beforeEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export interface TestContext {
  tempDir: string
  originalCwd: string
  cleanup: () => Promise<void>
}

/**
 * Creates an isolated test environment with automatic cleanup
 */
export function createIsolatedTestEnv(): TestContext {
  let tempDir: string
  let originalCwd: string
  const cleanupTasks: Array<() => Promise<void>> = []

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()

    // Save original working directory
    originalCwd = process.cwd()

    // Create unique temp directory
    const tempRoot = path.join(os.tmpdir(), 'quality-check-tests')
    await fs.mkdir(tempRoot, { recursive: true })
    tempDir = await fs.mkdtemp(path.join(tempRoot, 'test-'))

    // Change to temp directory
    process.chdir(tempDir)
  })

  afterEach(async () => {
    // Restore original working directory first
    if (originalCwd) {
      process.chdir(originalCwd)
    }

    // Execute all cleanup tasks
    for (const task of cleanupTasks) {
      try {
        await task()
      } catch {
        // Ignore cleanup errors
      }
    }

    // Remove temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clear cleanup tasks
    cleanupTasks.length = 0
  })

  return {
    get tempDir() {
      return tempDir
    },
    get originalCwd() {
      return originalCwd
    },
    cleanup: async () => {
      cleanupTasks.push(async () => {
        if (tempDir) {
          await fs.rm(tempDir, { recursive: true, force: true })
        }
      })
    },
  }
}

/**
 * Creates a test project structure with standard configuration
 */
export async function createTestProject(
  projectDir: string,
  options: {
    type?: 'javascript' | 'typescript' | 'react'
    packageJson?: Record<string, unknown>
    tsconfig?: Record<string, unknown>
    eslintConfig?: Record<string, unknown>
    prettierConfig?: Record<string, unknown>
  } = {},
): Promise<void> {
  const { type = 'typescript' } = options

  // Create directory structure
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })
  await fs.mkdir(path.join(projectDir, 'dist'), { recursive: true })

  // Create package.json
  const defaultPackageJson = {
    name: 'test-project',
    version: '1.0.0',
    type: 'module',
    ...(type === 'typescript' || type === 'react'
      ? {
          devDependencies: {
            'typescript': '^5.0.0',
            '@types/node': '^20.0.0',
            ...(type === 'react' ? { 'react': '^18.0.0', '@types/react': '^18.0.0' } : {}),
          },
        }
      : {}),
  }

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ ...defaultPackageJson, ...options.packageJson }, null, 2),
  )

  // Create tsconfig.json if TypeScript
  if (type === 'typescript' || type === 'react') {
    const defaultTsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        ...(type === 'react' ? { jsx: 'react-jsx' } : {}),
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    }

    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify({ ...defaultTsConfig, ...options.tsconfig }, null, 2),
    )
  }

  // Create ESLint config if provided
  if (options.eslintConfig) {
    await fs.writeFile(
      path.join(projectDir, '.eslintrc.json'),
      JSON.stringify(options.eslintConfig, null, 2),
    )
  }

  // Create Prettier config if provided
  if (options.prettierConfig) {
    await fs.writeFile(
      path.join(projectDir, '.prettierrc'),
      JSON.stringify(options.prettierConfig, null, 2),
    )
  }
}

/**
 * Waits for a condition to be met with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    message?: string
  } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Timeout waiting for condition: ${message}`)
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
  } = {},
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 100, maxDelay = 5000, backoffFactor = 2 } = options

  let lastError: Error
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        throw lastError
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw lastError!
}

/**
 * Execute a command and capture output with proper error handling
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: {
    timeout?: number
    cwd?: string
    env?: Record<string, string>
  } = {},
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}> {
  const { spawn } = await import('node:child_process')
  const { timeout = 10000, cwd = process.cwd(), env = process.env } = options

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let timedOut = false

    const child = spawn(command, args, {
      cwd,
      env: { ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 1000)
    }, timeout)

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (error) => {
      clearTimeout(timeoutId)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout}ms`))
      } else {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          duration,
        })
      }
    })
  })
}
