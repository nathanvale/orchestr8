/**
 * Git operations utility for fix-first architecture
 * Handles automatic staging of fixed files
 */

import { execSync } from 'node:child_process'
import { logger } from './logger.js'

export interface GitStageResult {
  success: boolean
  stagedFiles: string[]
  error?: string
}

export class GitOperations {
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

      // Use git add for each file individually to handle failures gracefully
      const stagedFiles: string[] = []
      const failedFiles: string[] = []

      for (const file of files) {
        try {
          execSync(`git add "${file}"`, {
            encoding: 'utf8',
            stdio: 'pipe',
          })
          stagedFiles.push(file)
          logger.debug('Staged file successfully', { file })
        } catch (error) {
          failedFiles.push(file)
          logger.warn('Failed to stage file', {
            file,
            error: (error as Error).message,
          })
        }
      }

      const success = stagedFiles.length > 0
      const result: GitStageResult = {
        success,
        stagedFiles,
      }

      if (failedFiles.length > 0) {
        result.error = `Failed to stage ${failedFiles.length} files: ${failedFiles.join(', ')}`
      }

      logger.debug('Git staging completed', {
        success,
        stagedCount: stagedFiles.length,
        failedCount: failedFiles.length,
      })

      return result
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
   * Detect which files have been modified (for testing purposes)
   */
  async detectModifiedFiles(): Promise<string[]> {
    try {
      const output = execSync('git status --porcelain', {
        encoding: 'utf8',
        stdio: 'pipe',
      })

      const modifiedFiles = output
        .split('\n')
        .filter((line) => line.trim())
        .filter((line) => line.startsWith(' M') || line.startsWith('M '))
        .map((line) => line.substring(3).trim())

      logger.debug('Detected modified files', {
        count: modifiedFiles.length,
        files: modifiedFiles,
      })

      return modifiedFiles
    } catch (error) {
      logger.warn('Failed to detect modified files', {
        error: (error as Error).message,
      })
      return []
    }
  }

  /**
   * Check if we're in a git repository
   */
  isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        stdio: 'pipe',
        encoding: 'utf8',
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the current git status for specific files
   */
  async getFileStatus(
    files: string[],
  ): Promise<Map<string, 'modified' | 'staged' | 'untracked' | 'clean'>> {
    const statusMap = new Map<string, 'modified' | 'staged' | 'untracked' | 'clean'>()

    if (!files.length || !this.isGitRepository()) {
      return statusMap
    }

    try {
      const output = execSync('git status --porcelain', {
        encoding: 'utf8',
        stdio: 'pipe',
      })

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
