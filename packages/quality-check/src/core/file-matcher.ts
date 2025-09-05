import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { FileError } from './errors'

/**
 * Options for file matching
 */
export interface FileMatchOptions {
  /** Check staged files */
  staged?: boolean

  /** Check files changed since a git ref */
  since?: string

  /** Files or patterns to check */
  files?: string[]

  /** Working directory */
  cwd?: string
}

/**
 * Handles file resolution and ignore patterns
 */
export class FileMatcher {
  private ignorePatterns: Set<string> = new Set()
  private gitignorePatterns: string[] = []
  private eslintignorePatterns: string[] = []
  private prettierignorePatterns: string[] = []
  private tsconfigExclude: string[] = []

  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Resolve files to check based on options
   */
  async resolveFiles(options: FileMatchOptions): Promise<string[]> {
    // Load ignore patterns
    await this.loadIgnorePatterns()

    let files: string[] = []

    if (options.staged) {
      // Get staged files from git
      files = this.getStagedFiles()
    } else if (options.since) {
      // Get files changed since a git ref
      files = this.getChangedFiles(options.since)
    } else if (options.files && options.files.length > 0) {
      // Use provided files
      files = options.files.map((file) => this.resolveFilePath(file))
    } else {
      // Default to current file or directory
      files = [this.cwd]
    }

    // Filter out ignored files
    return this.filterIgnoredFiles(files)
  }

  /**
   * Load ignore patterns from various sources
   */
  private async loadIgnorePatterns(): Promise<void> {
    // Load .gitignore
    this.gitignorePatterns = await this.loadIgnoreFile('.gitignore')

    // Load .eslintignore
    this.eslintignorePatterns = await this.loadIgnoreFile('.eslintignore')

    // Load .prettierignore
    this.prettierignorePatterns = await this.loadIgnoreFile('.prettierignore')

    // Load tsconfig.json exclude patterns
    await this.loadTsconfigExclude()

    // Combine all patterns
    this.ignorePatterns = new Set([
      ...this.gitignorePatterns,
      ...this.eslintignorePatterns,
      ...this.prettierignorePatterns,
      ...this.tsconfigExclude,
    ])
  }

  /**
   * Load ignore patterns from a file
   */
  private async loadIgnoreFile(filename: string): Promise<string[]> {
    const filePath = path.join(this.cwd, filename)

    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    } catch {
      // If we can't read the ignore file, continue without it
      return []
    }
  }

  /**
   * Load exclude patterns from tsconfig.json
   */
  private async loadTsconfigExclude(): Promise<void> {
    const tsconfigPath = await this.findTsconfig()

    if (!tsconfigPath) {
      return
    }

    try {
      const content = fs.readFileSync(tsconfigPath, 'utf-8')
      const tsconfig = JSON.parse(content)

      if (tsconfig.exclude && Array.isArray(tsconfig.exclude)) {
        this.tsconfigExclude = tsconfig.exclude
      }
    } catch {
      // If we can't parse tsconfig, continue without exclude patterns
      this.tsconfigExclude = []
    }
  }

  /**
   * Find tsconfig.json in current or parent directories
   */
  private async findTsconfig(): Promise<string | undefined> {
    let currentDir = this.cwd
    const root = path.parse(currentDir).root

    while (currentDir !== root) {
      const tsconfigPath = path.join(currentDir, 'tsconfig.json')
      if (fs.existsSync(tsconfigPath)) {
        return tsconfigPath
      }

      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) {
        break
      }
      currentDir = parentDir
    }

    return undefined
  }

  /**
   * Get staged files from git
   */
  private getStagedFiles(): string[] {
    try {
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        cwd: this.cwd,
        encoding: 'utf-8',
      })

      return output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((file) => path.resolve(this.cwd, file))
        .filter((file) => this.isTypeScriptOrJavaScriptFile(file))
    } catch {
      throw new FileError('Failed to get staged files from git')
    }
  }

  /**
   * Get files changed since a git ref
   */
  private getChangedFiles(since: string): string[] {
    try {
      const output = execSync(`git diff ${since}...HEAD --name-only --diff-filter=ACM`, {
        cwd: this.cwd,
        encoding: 'utf-8',
      })

      return output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((file) => path.resolve(this.cwd, file))
        .filter((file) => this.isTypeScriptOrJavaScriptFile(file))
    } catch {
      throw new FileError(`Failed to get files changed since ${since}`)
    }
  }

  /**
   * Resolve a file path to an absolute path
   */
  private resolveFilePath(file: string): string {
    if (path.isAbsolute(file)) {
      return file
    }
    return path.resolve(this.cwd, file)
  }

  /**
   * Check if a file is TypeScript or JavaScript
   */
  private isTypeScriptOrJavaScriptFile(file: string): boolean {
    const ext = path.extname(file).toLowerCase()
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)
  }

  /**
   * Filter out ignored files
   */
  private filterIgnoredFiles(files: string[]): string[] {
    return files.filter((file) => {
      const relativePath = path.relative(this.cwd, file)

      // Check if file matches any ignore pattern
      for (const pattern of this.ignorePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return false
        }
      }

      // Always ignore node_modules
      if (relativePath.includes('node_modules')) {
        return false
      }

      // Always ignore dist/build directories
      if (relativePath.match(/\b(dist|build|out|coverage)\b/)) {
        return false
      }

      return true
    })
  }

  /**
   * Simple pattern matching (supports * and ** wildcards)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}($|/)`)
    return regex.test(filePath)
  }

  /**
   * Get ignore patterns for a specific tool
   */
  getIgnorePatterns(tool: 'eslint' | 'prettier' | 'typescript'): string[] {
    switch (tool) {
      case 'eslint':
        return this.eslintignorePatterns
      case 'prettier':
        return this.prettierignorePatterns
      case 'typescript':
        return this.tsconfigExclude
      default:
        return []
    }
  }
}
