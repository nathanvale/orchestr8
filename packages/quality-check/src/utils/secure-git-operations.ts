/**
 * Secure Git Operations Utility
 * Provides secure spawn-based git command execution with proper argument separation,
 * path normalization, timeout handling, and protection against command injection.
 */

import { spawn } from 'node:child_process'
import { normalize, isAbsolute, resolve } from 'node:path'
import { logger } from './logger.js'

export interface GitCommandOptions {
  /** Working directory for the git command */
  cwd?: string
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Whether to capture stdout */
  captureOutput?: boolean
  /** Environment variables */
  env?: Record<string, string>
}

export interface GitCommandResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}

/**
 * Secure Git Operations class using spawn instead of exec for security
 */
export class SecureGitOperations {
  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  private static readonly GIT_COMMAND = 'git'

  /**
   * Normalize and validate file paths to prevent path traversal attacks
   */
  private static normalizePath(filePath: string, cwd?: string): string {
    if (!filePath) {
      throw new Error('File path cannot be empty')
    }

    // Remove any null bytes
    const cleanPath = filePath.replace(/\0/g, '')

    // Normalize the path to resolve .. and . components
    const normalizedPath = normalize(cleanPath)

    // If path is absolute, return as is
    if (isAbsolute(normalizedPath)) {
      return normalizedPath
    }

    // If relative, resolve against cwd
    const basePath = cwd || process.cwd()
    return resolve(basePath, normalizedPath)
  }

  /**
   * Normalize and validate multiple file paths
   */
  private static normalizePaths(filePaths: string[], cwd?: string): string[] {
    return filePaths.map((path) => this.normalizePath(path, cwd))
  }

  /**
   * Execute a git command securely using spawn
   */
  private static async executeGitCommand(
    args: string[],
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    const {
      cwd = process.cwd(),
      timeout = this.DEFAULT_TIMEOUT,
      captureOutput = true,
      env = {},
    } = options

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false
      let processExited = false
      let forceKillTimer: NodeJS.Timeout | null = null

      logger.debug('Executing git command', {
        args: args.join(' '),
        cwd,
        timeout,
      })

      const child = spawn(this.GIT_COMMAND, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'],
        shell: false,
        windowsHide: true,
      })

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true
        if (!processExited && child.pid) {
          child.kill('SIGTERM')

          // Force kill after additional 5 seconds
          forceKillTimer = setTimeout(() => {
            if (!processExited && child.pid) {
              try {
                process.kill(child.pid, 'SIGKILL')
              } catch {
                // Process may have already exited
              }
            }
          }, 5000)
        }
      }, timeout)

      if (captureOutput && child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString()
        })
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString()
        })
      }

      child.on('close', (exitCode) => {
        processExited = true
        clearTimeout(timeoutHandle)
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
        }

        const result: GitCommandResult = {
          success: exitCode === 0 && !timedOut,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          timedOut,
        }

        logger.debug('Git command completed', {
          args: args.join(' '),
          exitCode,
          timedOut,
          success: result.success,
        })

        resolve(result)
      })

      child.on('error', (error) => {
        processExited = true
        clearTimeout(timeoutHandle)
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
        }

        logger.error('Git command error', error, { args: args.join(' ') })

        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: null,
          timedOut: false,
        })
      })
    })
  }

  /**
   * Add files to git index securely
   */
  static async addFiles(
    files: string[],
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    if (!files || files.length === 0) {
      return {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      }
    }

    // Normalize and validate file paths
    const normalizedFiles = this.normalizePaths(files, options.cwd)

    // Use -- separator to prevent option injection
    const args = ['add', '--', ...normalizedFiles]

    return this.executeGitCommand(args, options)
  }

  /**
   * Get git status for specific files
   */
  static async getStatus(
    files?: string[],
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    const args = ['status', '--porcelain']

    if (files && files.length > 0) {
      const normalizedFiles = this.normalizePaths(files, options.cwd)
      args.push('--', ...normalizedFiles)
    }

    return this.executeGitCommand(args, options)
  }

  /**
   * Get staged files
   */
  static async getStagedFiles(options: GitCommandOptions = {}): Promise<GitCommandResult> {
    const args = ['diff', '--cached', '--name-only', '--diff-filter=ACM']
    return this.executeGitCommand(args, options)
  }

  /**
   * Get files changed since a git reference
   */
  static async getChangedFiles(
    since: string,
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    if (!since || typeof since !== 'string') {
      throw new Error('Git reference must be a non-empty string')
    }

    // Validate git ref to prevent injection - allow alphanumeric, _, -, ., ~, and ^
    if (!/^[a-zA-Z0-9_.~^-]+$/.test(since)) {
      throw new Error('Invalid git reference format')
    }

    const args = ['diff', `${since}...HEAD`, '--name-only', '--diff-filter=ACM']
    return this.executeGitCommand(args, options)
  }

  /**
   * Get git directory path
   */
  static async getGitDir(options: GitCommandOptions = {}): Promise<GitCommandResult> {
    const args = ['rev-parse', '--git-dir']
    return this.executeGitCommand(args, options)
  }

  /**
   * Check if in a git repository
   */
  static async isGitRepository(options: GitCommandOptions = {}): Promise<boolean> {
    const result = await this.executeGitCommand(['rev-parse', '--git-dir'], {
      ...options,
      captureOutput: false,
    })
    return result.success
  }

  /**
   * Get diff between staged and working tree for specific files
   */
  static async getDiffCached(
    files?: string[],
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    const args = ['diff', '--cached', '--name-only']

    if (files && files.length > 0) {
      const normalizedFiles = this.normalizePaths(files, options.cwd)
      args.push('--', ...normalizedFiles)
    }

    return this.executeGitCommand(args, options)
  }

  /**
   * Get diff between HEAD and working tree for specific files
   */
  static async getDiff(
    files?: string[],
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    const args = ['diff', '--name-only']

    if (files && files.length > 0) {
      const normalizedFiles = this.normalizePaths(files, options.cwd)
      args.push('--', ...normalizedFiles)
    }

    return this.executeGitCommand(args, options)
  }
}
