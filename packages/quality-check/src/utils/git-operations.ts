/**
 * Git operations utility for fix-first architecture
 * Handles automatic staging of fixed files
 */

import { readFileSync, existsSync, statSync, openSync, closeSync } from 'node:fs'
import { logger } from './logger.js'
import { SecureGitOperations } from './secure-git-operations.js'

export interface GitStageResult {
  success: boolean
  stagedFiles: string[]
  error?: string
}

export interface RepositoryState {
  inRebase: boolean
  hasConflicts: boolean
  isMerging: boolean
}

export interface DetectModifiedFilesResult {
  modifiedFiles: string[]
  errors: string[]
}

export interface EdgeCaseResult {
  readableFiles: string[]
  skippedFiles: string[]
  reasons: Map<string, string>
}

export class GitOperations {
  private fileStates: Map<string, string> = new Map()

  /**
   * Stage files that have been successfully fixed
   */
  async stageFiles(files: string[]): Promise<GitStageResult> {
    if (!files || files.length === 0) {
      return {
        success: true,
        stagedFiles: [],
      }
    }

    try {
      logger.debug('Staging fixed files', { files: files.length })

      // Check for index lock and retry if needed
      let retryCount = 0
      const maxRetries = 3
      const retryDelay = 100

      const stageWithRetry = async (): Promise<GitStageResult> => {
        try {
          // Stage all files at once for efficiency using secure operations
          const result = await SecureGitOperations.addFiles(files)

          if (!result.success) {
            throw new Error(result.stderr || 'Git add failed')
          }

          logger.debug('Git staging completed successfully', {
            stagedCount: files.length,
          })

          return {
            success: true,
            stagedFiles: files,
          }
        } catch (error) {
          const errorMessage = (error as Error).message

          // Handle specific git errors
          if (errorMessage.includes('index.lock') && retryCount < maxRetries) {
            retryCount++
            logger.debug('Index locked, retrying', { attempt: retryCount })
            setTimeout(() => {}, retryDelay) // Simple delay
            return await stageWithRetry()
          }

          if (errorMessage.includes('Permission denied')) {
            return {
              success: false,
              stagedFiles: [],
              error: 'Permission denied - check file permissions and git repository access',
            }
          }

          if (
            errorMessage.includes('pathspec') &&
            errorMessage.includes('did not match any files')
          ) {
            return {
              success: false,
              stagedFiles: [],
              error: 'Some files could not be found - they may have been moved or deleted',
            }
          }

          logger.error('Git staging failed', error as Error, {
            files: files.length,
          })

          return {
            success: false,
            stagedFiles: [],
            error: errorMessage,
          }
        }
      }

      return await stageWithRetry()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      logger.error('Git staging failed completely', error as Error, {
        files: files.length,
      })

      return {
        success: false,
        stagedFiles: [],
        error: errorMessage,
      }
    }
  }

  /**
   * Capture file states for modification detection
   */
  captureFileStates(files: string[]): void {
    logger.debug('Capturing file states', { count: files.length })

    for (const file of files) {
      try {
        if (existsSync(file)) {
          const content = readFileSync(file, 'utf-8')
          this.fileStates.set(file, content)
          logger.debug('Captured state for file', { file })
        } else {
          logger.debug('Skipping non-existent file', { file })
        }
      } catch (error) {
        // Only log in debug mode to reduce noise
        if (process.env['DEBUG'] === 'true') {
          logger.warn('Failed to capture file state', {
            file,
            error: (error as Error).message,
          })
        }
      }
    }
  }

  /**
   * Detect which files have been modified since capture
   */
  detectModifiedFiles(files?: string[]): DetectModifiedFilesResult {
    const filesToCheck = files || Array.from(this.fileStates.keys())
    const modifiedFiles: string[] = []
    const errors: string[] = []

    logger.debug('Detecting modified files', { count: filesToCheck.length })

    for (const file of filesToCheck) {
      try {
        if (!existsSync(file)) {
          // File was deleted, skip it
          logger.debug('File no longer exists', { file })
          continue
        }

        const originalContent = this.fileStates.get(file)
        if (originalContent === undefined) {
          // No baseline captured, skip
          logger.debug('No baseline captured for file', { file })
          continue
        }

        const currentContent = readFileSync(file, 'utf-8')
        if (currentContent !== originalContent) {
          modifiedFiles.push(file)
          logger.debug('Detected modification', { file })
        }
      } catch (error) {
        const errorMsg = `Error checking ${file}: ${(error as Error).message}`
        errors.push(errorMsg)
        // Only log in debug mode to reduce noise
        if (process.env['DEBUG'] === 'true') {
          logger.warn('Failed to check file modification', {
            file,
            error: (error as Error).message,
          })
        }
      }
    }

    logger.debug('File modification detection complete', {
      modifiedCount: modifiedFiles.length,
      errorCount: errors.length,
    })

    return { modifiedFiles, errors }
  }

  /**
   * Clear captured file states
   */
  clearFileStates(): void {
    logger.debug('Clearing file states', { count: this.fileStates.size })
    this.fileStates.clear()
  }

  /**
   * Check if a file has partial staging (some hunks staged, some not)
   */
  async hasPartialStaging(file: string): Promise<boolean> {
    try {
      logger.debug('Checking partial staging', { file })

      // Check if file is in the index (staged)
      const stagedResult = await SecureGitOperations.getDiffCached([file])
      const isStaged = stagedResult.success && stagedResult.stdout.includes(file)

      // Check if file has unstaged changes
      const unstagedResult = await SecureGitOperations.getDiff([file])
      const hasUnstagedChanges = unstagedResult.success && unstagedResult.stdout.includes(file)

      const hasPartial = isStaged && hasUnstagedChanges
      logger.debug('Partial staging check result', {
        file,
        isStaged,
        hasUnstagedChanges,
        hasPartial,
      })

      return hasPartial
    } catch (error) {
      // Only log in debug mode to reduce noise in non-git environments
      if (process.env['DEBUG'] === 'true') {
        logger.warn('Failed to check partial staging', {
          file,
          error: (error as Error).message,
        })
      }
      return false
    }
  }

  /**
   * Get the current repository state (rebase, merge, etc.)
   */
  async getRepositoryState(): Promise<RepositoryState> {
    const state: RepositoryState = {
      inRebase: false,
      hasConflicts: false,
      isMerging: false,
    }

    try {
      logger.debug('Getting repository state')

      // Get git directory path
      const gitDirResult = await SecureGitOperations.getGitDir()
      if (!gitDirResult.success) {
        throw new Error('Failed to get git directory')
      }
      const gitDir = gitDirResult.stdout.trim()

      // Check for rebase state
      state.inRebase = existsSync(`${gitDir}/rebase-merge`) || existsSync(`${gitDir}/rebase-apply`)

      // Check for merge state
      state.isMerging = existsSync(`${gitDir}/MERGE_HEAD`)

      // Check for conflicts in git status
      const statusResult = await SecureGitOperations.getStatus()
      if (statusResult.success) {
        state.hasConflicts =
          statusResult.stdout.includes('UU ') || statusResult.stdout.includes('AA ')
      }

      logger.debug('Repository state determined', {
        inRebase: state.inRebase,
        hasConflicts: state.hasConflicts,
        isMerging: state.isMerging,
      })
      return state
    } catch (error) {
      logger.warn('Failed to determine repository state', {
        error: (error as Error).message,
      })
      return state
    }
  }

  /**
   * Handle edge cases for file processing
   */
  handleEdgeCases(files: string[]): EdgeCaseResult {
    const readableFiles: string[] = []
    const skippedFiles: string[] = []
    const reasons = new Map<string, string>()

    logger.debug('Handling edge cases for files', { count: files.length })

    for (const file of files) {
      try {
        // Check if file exists
        if (!existsSync(file)) {
          skippedFiles.push(file)
          reasons.set(file, 'File does not exist')
          logger.debug('File does not exist', { file })
          continue
        }

        // Check if it's a directory
        const stats = statSync(file)
        if (stats.isDirectory()) {
          skippedFiles.push(file)
          reasons.set(file, 'Path is a directory')
          logger.debug('Path is a directory', { file })
          continue
        }

        // Check if file is readable
        try {
          // Try to open the file to check if it's locked
          const fd = openSync(file, 'r')
          closeSync(fd)
          readableFiles.push(file)
          logger.debug('File is readable', { file })
        } catch {
          skippedFiles.push(file)
          reasons.set(file, 'File is locked or in use')
          logger.debug('File is locked or in use', { file })
        }
      } catch (error) {
        skippedFiles.push(file)
        reasons.set(file, `Error accessing file: ${(error as Error).message}`)
        logger.warn('Error accessing file', {
          file,
          error: (error as Error).message,
        })
      }
    }

    logger.debug('Edge case handling complete', {
      readableCount: readableFiles.length,
      skippedCount: skippedFiles.length,
    })

    return { readableFiles, skippedFiles, reasons }
  }

  /**
   * Check if we're in a git repository
   */
  async isGitRepository(): Promise<boolean> {
    return await SecureGitOperations.isGitRepository()
  }

  /**
   * Get the current git status for specific files
   */
  async getFileStatus(
    files: string[],
  ): Promise<Map<string, 'modified' | 'staged' | 'untracked' | 'clean'>> {
    const statusMap = new Map<string, 'modified' | 'staged' | 'untracked' | 'clean'>()

    if (!files.length || !(await this.isGitRepository())) {
      return statusMap
    }

    try {
      const result = await SecureGitOperations.getStatus()
      if (!result.success) {
        throw new Error(result.stderr || 'Failed to get git status')
      }
      const output = result.stdout

      const statusLines = output.split('\n').filter((line) => line.trim())

      // Initialize all files as clean
      for (const file of files) {
        statusMap.set(file, 'clean')
      }

      // Update status for files that appear in git status
      for (const line of statusLines) {
        if (line.length < 3) continue

        const indexStatus = line[0]
        const workingTreeStatus = line[1]
        const filename = line.substring(3).trim()

        // Check if this is one of our files
        const matchingFile = files.find(
          (file) => file.endsWith(filename) || filename.endsWith(file),
        )
        if (!matchingFile) continue

        if (indexStatus !== ' ' && indexStatus !== '?') {
          statusMap.set(matchingFile, 'staged')
        } else if (workingTreeStatus === 'M') {
          statusMap.set(matchingFile, 'modified')
        } else if (indexStatus === '?' && workingTreeStatus === '?') {
          statusMap.set(matchingFile, 'untracked')
        }
      }

      logger.debug('File status check completed', {
        fileCount: files.length,
        statusCounts: Array.from(statusMap.values()).reduce(
          (acc, status) => {
            acc[status] = (acc[status] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ),
      })

      return statusMap
    } catch (error) {
      logger.warn('Failed to get file status', {
        error: (error as Error).message,
        fileCount: files.length,
      })

      // Return all files as clean on error
      for (const file of files) {
        statusMap.set(file, 'clean')
      }

      return statusMap
    }
  }
}
