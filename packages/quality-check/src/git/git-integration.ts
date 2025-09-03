/**
 * Git integration for quality check package
 * Provides gitignore pattern matching and repository awareness
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'

import type { Logger } from '@orchestr8/logger'
import ignore, { type Ignore } from 'ignore'
import { simpleGit, type SimpleGit } from 'simple-git'

export interface GitInfo {
  isGitRepository: boolean
  gitRoot?: string
  hasGitignore: boolean
  gitignorePatterns?: string[]
}

export interface GitIntegrationOptions {
  respectGitignore?: boolean
  preCommitMode?: boolean
  workingDir?: string
}

export class GitIntegration {
  private git: SimpleGit
  private ignoreInstance?: Ignore
  private gitInfo?: GitInfo
  private initialized = false

  constructor(
    private readonly workingDir: string = process.cwd(),
    private readonly logger: Logger,
  ) {
    this.git = simpleGit(this.workingDir)
  }

  /**
   * Initialize git integration by discovering repository info and loading gitignore
   */
  async initialize(): Promise<GitInfo> {
    if (this.initialized && this.gitInfo) {
      return this.gitInfo
    }

    const startTime = performance.now()
    this.logger.debug('Initializing git integration', { workingDir: this.workingDir })

    try {
      const isRepo = await this.git.checkIsRepo()

      if (!isRepo) {
        this.gitInfo = {
          isGitRepository: false,
          hasGitignore: false,
        }
        this.logger.debug('Not a git repository')
        this.initialized = true
        return this.gitInfo
      }

      const gitRoot = await this.git.revparse(['--show-toplevel'])
      const gitignorePath = path.join(gitRoot, '.gitignore')

      let hasGitignore = false
      let gitignorePatterns: string[] = []

      try {
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8')
        hasGitignore = true
        gitignorePatterns = this.parseGitignoreContent(gitignoreContent)

        // Initialize ignore instance with patterns
        this.ignoreInstance = ignore().add(gitignorePatterns)

        this.logger.debug('Loaded gitignore patterns', {
          patternCount: gitignorePatterns.length,
        })
      } catch {
        // .gitignore doesn't exist or can't be read
        this.logger.debug('No .gitignore file found or unable to read it')
      }

      this.gitInfo = {
        isGitRepository: true,
        gitRoot,
        hasGitignore,
        gitignorePatterns,
      }

      const duration = Math.round(performance.now() - startTime)
      this.logger.debug('Git integration initialized', {
        duration,
        isRepo: true,
        hasGitignore,
        gitRoot,
      })

      this.initialized = true
      return this.gitInfo
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error('Failed to initialize git integration', {
        error: errorMessage,
        workingDir: this.workingDir,
      })

      // Fallback to non-git mode
      this.gitInfo = {
        isGitRepository: false,
        hasGitignore: false,
      }

      this.initialized = true
      return this.gitInfo
    }
  }

  /**
   * Check if a file should be ignored according to .gitignore patterns
   */
  async shouldIgnoreFile(filePath: string, options: GitIntegrationOptions = {}): Promise<boolean> {
    if (!options.respectGitignore) {
      return false
    }

    const gitInfo = await this.initialize()

    if (!gitInfo.isGitRepository || !gitInfo.hasGitignore || !this.ignoreInstance) {
      return false
    }

    // Convert to relative path from git root
    const gitRoot = gitInfo.gitRoot!
    const relativePath = path.relative(gitRoot, path.resolve(filePath))

    // Don't ignore if path goes outside git root
    if (relativePath.startsWith('..')) {
      return false
    }

    const ignored = this.ignoreInstance.ignores(relativePath)

    if (ignored) {
      this.logger.debug('File ignored by .gitignore', {
        filePath: relativePath,
        absolutePath: filePath,
      })
    }

    return ignored
  }

  /**
   * Get list of staged files for pre-commit mode
   */
  async getStagedFiles(): Promise<string[]> {
    const gitInfo = await this.initialize()

    if (!gitInfo.isGitRepository) {
      this.logger.warn('Cannot get staged files - not in a git repository')
      return []
    }

    try {
      const status = await this.git.status()
      const stagedFiles: string[] = []

      // Add all types of staged files
      stagedFiles.push(...status.staged)

      // Include modified files that are staged
      for (const file of status.files) {
        if (file.index !== ' ' && file.index !== '?') {
          // File is staged (index is not empty space or untracked)
          stagedFiles.push(file.path)
        }
      }

      // Convert to absolute paths
      const gitRoot = gitInfo.gitRoot!
      const absolutePaths = [...new Set(stagedFiles)].map((file) => path.resolve(gitRoot, file))

      this.logger.debug('Found staged files', {
        count: absolutePaths.length,
        files: absolutePaths.map((f) => path.relative(process.cwd(), f)),
      })

      return absolutePaths
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error('Failed to get staged files', { error: errorMessage })
      return []
    }
  }

  /**
   * Filter files based on git integration options
   */
  async filterFiles(files: string[], options: GitIntegrationOptions = {}): Promise<string[]> {
    if (options.preCommitMode) {
      // In pre-commit mode, only check staged files
      const stagedFiles = await this.getStagedFiles()
      const stagedSet = new Set(stagedFiles)
      files = files.filter((file) => stagedSet.has(path.resolve(file)))

      this.logger.debug('Pre-commit mode: filtered to staged files', {
        originalCount: files.length,
        stagedCount: stagedFiles.length,
      })
    }

    if (options.respectGitignore) {
      // Filter out gitignored files
      const filteredFiles: string[] = []

      for (const file of files) {
        const shouldIgnore = await this.shouldIgnoreFile(file, options)
        if (!shouldIgnore) {
          filteredFiles.push(file)
        }
      }

      if (filteredFiles.length !== files.length) {
        this.logger.debug('Filtered files by .gitignore', {
          originalCount: files.length,
          filteredCount: filteredFiles.length,
          ignoredCount: files.length - filteredFiles.length,
        })
      }

      return filteredFiles
    }

    return files
  }

  /**
   * Get current git information
   */
  async getGitInfo(): Promise<GitInfo> {
    return this.initialize()
  }

  /**
   * Parse gitignore content into individual patterns
   */
  private parseGitignoreContent(content: string): string[] {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        // Remove empty lines and comments
        return line.length > 0 && !line.startsWith('#')
      })
  }

  /**
   * Check if current directory or any parent is a git repository
   */
  static async isInGitRepository(workingDir: string = process.cwd()): Promise<boolean> {
    try {
      const git = simpleGit(workingDir)
      return await git.checkIsRepo()
    } catch {
      return false
    }
  }

  /**
   * Find git root directory from current working directory
   */
  static async findGitRoot(workingDir: string = process.cwd()): Promise<string | null> {
    try {
      const git = simpleGit(workingDir)
      const isRepo = await git.checkIsRepo()

      if (!isRepo) {
        return null
      }

      return await git.revparse(['--show-toplevel'])
    } catch {
      return null
    }
  }
}
