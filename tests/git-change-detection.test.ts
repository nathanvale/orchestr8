/**
 * @fileoverview Tests for Git-based change detection and --affected flag functionality
 *
 * This test suite verifies:
 * - Git change detection mechanisms work correctly
 * - --affected flag functionality identifies only modified packages
 * - TURBO_SCM_BASE environment variable affects filtering
 * - Filter patterns work for branch comparisons
 * - Workspace-level filtering targets correct operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execSync } from 'child_process'

// Mock execSync for controlled testing
const mockExecSync = vi.mocked(execSync)

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

interface GitChangeDetectionOptions {
  base?: string
  head?: string
  includeUntracked?: boolean
  filterPatterns?: string[]
}

interface AffectedWorkspace {
  name: string
  path: string
  hasChanges: boolean
  changedFiles: string[]
}

class GitChangeDetector {
  private workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot
  }

  /**
   * Get list of changed files between base and head commits
   */
  getChangedFiles(options: GitChangeDetectionOptions = {}): string[] {
    const { base = 'HEAD^', head = 'HEAD', includeUntracked = false } = options

    try {
      // Get changed files using git diff
      const diffCommand = `git diff --name-only ${base}...${head}`
      const diffResult = mockExecSync(diffCommand, {
        encoding: 'utf8',
        cwd: this.workspaceRoot,
      }) as string

      let changedFiles = diffResult
        .trim()
        .split('\n')
        .filter((file) => file.length > 0)

      // Include untracked files if requested
      if (includeUntracked) {
        const untrackedCommand = 'git ls-files --others --exclude-standard'
        const untrackedResult = mockExecSync(untrackedCommand, {
          encoding: 'utf8',
          cwd: this.workspaceRoot,
        }) as string

        const untrackedFiles = untrackedResult
          .trim()
          .split('\n')
          .filter((file) => file.length > 0)
        changedFiles = [...changedFiles, ...untrackedFiles]
      }

      // Apply filter patterns if provided
      if (options.filterPatterns && options.filterPatterns.length > 0) {
        changedFiles = this.applyFilterPatterns(changedFiles, options.filterPatterns)
      }

      return changedFiles
    } catch (error) {
      console.warn('Git change detection failed:', error)
      return []
    }
  }

  /**
   * Get affected workspaces based on changed files
   */
  getAffectedWorkspaces(options: GitChangeDetectionOptions = {}): AffectedWorkspace[] {
    const changedFiles = this.getChangedFiles(options)
    const workspaces = this.getWorkspaceDefinitions()

    return workspaces.map((workspace) => {
      const workspaceChangedFiles = changedFiles.filter(
        (file) => file.startsWith(workspace.path + '/') || file === workspace.path,
      )

      return {
        ...workspace,
        hasChanges: workspaceChangedFiles.length > 0,
        changedFiles: workspaceChangedFiles,
      }
    })
  }

  /**
   * Check if current repository state supports --affected flag
   */
  supportsAffectedFlag(): boolean {
    try {
      // Check if we're in a git repository
      mockExecSync('git rev-parse --git-dir', {
        cwd: this.workspaceRoot,
        stdio: 'pipe',
      })

      // Check if there are at least 2 commits for comparison
      const commitCount = mockExecSync('git rev-list --count HEAD', {
        encoding: 'utf8',
        cwd: this.workspaceRoot,
      }) as string

      return parseInt(commitCount.trim()) >= 2
    } catch {
      return false
    }
  }

  /**
   * Get base commit for comparison (respects TURBO_SCM_BASE)
   */
  getBaseCommit(): string {
    // Check environment variable first
    const scmBase = process.env['TURBO_SCM_BASE']
    if (scmBase) {
      return scmBase
    }

    try {
      // Try to get merge-base with main/master
      for (const branch of ['main', 'master', 'origin/main', 'origin/master']) {
        try {
          const base = mockExecSync(`git merge-base HEAD ${branch}`, {
            encoding: 'utf8',
            cwd: this.workspaceRoot,
          }) as string
          return base.trim()
        } catch {
          // Continue to next branch
        }
      }

      // Fallback to previous commit
      return 'HEAD^'
    } catch {
      return 'HEAD^'
    }
  }

  private applyFilterPatterns(files: string[], patterns: string[]): string[] {
    return files.filter((file) => {
      return patterns.some((pattern) => {
        // Convert glob pattern to regex
        const regex = new RegExp(
          pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'),
        )
        return regex.test(file)
      })
    })
  }

  private getWorkspaceDefinitions(): Array<{ name: string; path: string }> {
    // Mock workspace definitions - in real implementation would read package.json
    return [
      { name: 'app-web', path: 'apps/web' },
      { name: 'app-vite', path: 'apps/vite' },
      { name: 'pkg-utils', path: 'packages/utils' },
      { name: 'pkg-api', path: 'packages/api' },
      { name: 'pkg-quality-check', path: 'packages/quality-check' },
    ]
  }
}

class TurboAffectedFlags {
  private detector: GitChangeDetector

  constructor(detector: GitChangeDetector) {
    this.detector = detector
  }

  /**
   * Generate Turborepo --affected flag command
   */
  generateAffectedCommand(task: string, options: GitChangeDetectionOptions = {}): string {
    if (!this.detector.supportsAffectedFlag()) {
      throw new Error(
        'Repository does not support --affected flag (requires git with multiple commits)',
      )
    }

    const base = options.base || this.detector.getBaseCommit()
    const affectedWorkspaces = this.detector.getAffectedWorkspaces({ ...options, base })

    const changedWorkspaces = affectedWorkspaces.filter((ws) => ws.hasChanges).map((ws) => ws.name)

    if (changedWorkspaces.length === 0) {
      return `turbo run ${task} --filter=no-match-dummy` // No workspaces to run
    }

    const filterFlags = changedWorkspaces.map((ws) => `--filter=${ws}`).join(' ')
    return `turbo run ${task} ${filterFlags}`
  }

  /**
   * Check if workspace filtering should be applied
   */
  shouldUseFiltering(options: { forceAll?: boolean } = {}): boolean {
    if (options.forceAll) return false

    const affectedWorkspaces = this.detector.getAffectedWorkspaces()
    const totalWorkspaces = affectedWorkspaces.length
    const changedWorkspaces = affectedWorkspaces.filter((ws) => ws.hasChanges).length

    // Use filtering if less than 80% of workspaces are affected
    return changedWorkspaces < totalWorkspaces * 0.8
  }
}

describe('GitChangeDetector', () => {
  let detector: GitChangeDetector
  const testWorkspaceRoot = '/test/workspace'

  beforeEach(() => {
    vi.clearAllMocks()
    detector = new GitChangeDetector(testWorkspaceRoot)
  })

  describe('getChangedFiles', () => {
    it('should return list of changed files between commits', () => {
      const mockFiles = 'packages/utils/src/index.ts\napps/web/src/components/Button.tsx\n'
      mockExecSync.mockReturnValue(mockFiles)

      const result = detector.getChangedFiles({ base: 'main', head: 'feature-branch' })

      expect(mockExecSync).toHaveBeenCalledWith('git diff --name-only main...feature-branch', {
        encoding: 'utf8',
        cwd: testWorkspaceRoot,
      })
      expect(result).toEqual(['packages/utils/src/index.ts', 'apps/web/src/components/Button.tsx'])
    })

    it('should include untracked files when requested', () => {
      const mockDiffFiles = 'packages/utils/src/index.ts\n'
      const mockUntrackedFiles = 'packages/api/src/new-file.ts\n'

      mockExecSync.mockReturnValueOnce(mockDiffFiles).mockReturnValueOnce(mockUntrackedFiles)

      const result = detector.getChangedFiles({ includeUntracked: true })

      expect(mockExecSync).toHaveBeenCalledWith('git ls-files --others --exclude-standard', {
        encoding: 'utf8',
        cwd: testWorkspaceRoot,
      })
      expect(result).toContain('packages/utils/src/index.ts')
      expect(result).toContain('packages/api/src/new-file.ts')
    })

    it('should apply filter patterns correctly', () => {
      const mockFiles = 'packages/utils/src/index.ts\napps/web/public/image.png\nREADME.md\n'
      mockExecSync.mockReturnValue(mockFiles)

      const result = detector.getChangedFiles({
        filterPatterns: ['packages/**/*.ts', 'apps/**/*.tsx'],
      })

      expect(result).toEqual(['packages/utils/src/index.ts'])
    })

    it('should handle git command failures gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Git command failed')
      })

      const result = detector.getChangedFiles()

      expect(result).toEqual([])
    })
  })

  describe('getAffectedWorkspaces', () => {
    it('should identify affected workspaces based on file changes', () => {
      const mockFiles =
        'packages/utils/src/index.ts\napps/web/src/App.tsx\ntooling/build/config.ts\n'
      mockExecSync.mockReturnValue(mockFiles)

      const result = detector.getAffectedWorkspaces()

      const affectedWorkspaces = result.filter((ws) => ws.hasChanges)
      expect(affectedWorkspaces).toHaveLength(2)
      expect(affectedWorkspaces.map((ws) => ws.name)).toContain('pkg-utils')
      expect(affectedWorkspaces.map((ws) => ws.name)).toContain('app-web')
    })

    it('should track specific changed files per workspace', () => {
      const mockFiles = 'packages/utils/src/index.ts\npackages/utils/package.json\n'
      mockExecSync.mockReturnValue(mockFiles)

      const result = detector.getAffectedWorkspaces()
      const utilsWorkspace = result.find((ws) => ws.name === 'pkg-utils')

      expect(utilsWorkspace?.changedFiles).toEqual([
        'packages/utils/src/index.ts',
        'packages/utils/package.json',
      ])
    })
  })

  describe('supportsAffectedFlag', () => {
    it('should return true when git repo has multiple commits', () => {
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse succeeds
        .mockReturnValueOnce('5\n') // 5 commits

      const result = detector.supportsAffectedFlag()

      expect(result).toBe(true)
    })

    it('should return false when not in git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      const result = detector.supportsAffectedFlag()

      expect(result).toBe(false)
    })

    it('should return false when repository has less than 2 commits', () => {
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse succeeds
        .mockReturnValueOnce('1\n') // only 1 commit

      const result = detector.supportsAffectedFlag()

      expect(result).toBe(false)
    })
  })

  describe('getBaseCommit', () => {
    it('should use TURBO_SCM_BASE environment variable when set', () => {
      process.env['TURBO_SCM_BASE'] = 'custom-base-commit'

      const result = detector.getBaseCommit()

      expect(result).toBe('custom-base-commit')

      delete process.env['TURBO_SCM_BASE']
    })

    it('should find merge-base with main branch', () => {
      mockExecSync.mockReturnValue('abc123def456\n')

      const result = detector.getBaseCommit()

      expect(mockExecSync).toHaveBeenCalledWith('git merge-base HEAD main', {
        encoding: 'utf8',
        cwd: testWorkspaceRoot,
      })
      expect(result).toBe('abc123def456')
    })

    it('should fallback to HEAD^ when merge-base fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No merge base found')
      })

      const result = detector.getBaseCommit()

      expect(result).toBe('HEAD^')
    })
  })
})

describe('TurboAffectedFlags', () => {
  let detector: GitChangeDetector
  let affectedFlags: TurboAffectedFlags

  beforeEach(() => {
    vi.clearAllMocks()
    detector = new GitChangeDetector('/test/workspace')
    affectedFlags = new TurboAffectedFlags(detector)
  })

  describe('generateAffectedCommand', () => {
    it('should generate correct turbo command for affected workspaces', () => {
      // Mock git operations
      mockExecSync
        .mockReturnValueOnce('') // supportsAffectedFlag - git rev-parse
        .mockReturnValueOnce('3\n') // supportsAffectedFlag - commit count
        .mockReturnValueOnce('abc123\n') // getBaseCommit
        .mockReturnValueOnce('packages/utils/src/index.ts\napps/web/src/App.tsx\n') // getChangedFiles

      const result = affectedFlags.generateAffectedCommand('format')

      expect(result).toBe('turbo run format --filter=pkg-utils --filter=app-web')
    })

    it('should return no-match command when no workspaces affected', () => {
      mockExecSync
        .mockReturnValueOnce('') // supportsAffectedFlag - git rev-parse
        .mockReturnValueOnce('3\n') // supportsAffectedFlag - commit count
        .mockReturnValueOnce('abc123\n') // getBaseCommit
        .mockReturnValueOnce('') // getChangedFiles - no changes

      const result = affectedFlags.generateAffectedCommand('lint')

      expect(result).toBe('turbo run lint --filter=no-match-dummy')
    })

    it('should throw error when repository does not support affected flag', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      expect(() => {
        affectedFlags.generateAffectedCommand('test')
      }).toThrow('Repository does not support --affected flag')
    })

    it('should use custom base commit when provided', () => {
      mockExecSync
        .mockReturnValueOnce('') // supportsAffectedFlag - git rev-parse
        .mockReturnValueOnce('3\n') // supportsAffectedFlag - commit count
        .mockReturnValueOnce('packages/api/src/index.ts\n') // getChangedFiles

      const result = affectedFlags.generateAffectedCommand('build', {
        base: 'custom-base',
      })

      expect(mockExecSync).toHaveBeenCalledWith('git diff --name-only custom-base...HEAD', {
        encoding: 'utf8',
        cwd: '/test/workspace',
      })
      expect(result).toBe('turbo run build --filter=pkg-api')
    })
  })

  describe('shouldUseFiltering', () => {
    it('should recommend filtering when less than 80% of workspaces affected', () => {
      // Mock only 1 out of 5 workspaces affected (20%)
      mockExecSync.mockReturnValue('packages/utils/src/index.ts\n')

      const result = affectedFlags.shouldUseFiltering()

      expect(result).toBe(true)
    })

    it('should not recommend filtering when most workspaces affected', () => {
      // Mock 4 out of 5 workspaces affected (80%)
      const mockFiles = [
        'packages/utils/src/index.ts',
        'packages/api/src/index.ts',
        'apps/web/src/App.tsx',
        'apps/vite/src/main.ts',
      ].join('\n')
      mockExecSync.mockReturnValue(mockFiles)

      const result = affectedFlags.shouldUseFiltering()

      expect(result).toBe(false)
    })

    it('should not use filtering when forceAll option is true', () => {
      mockExecSync.mockReturnValue('packages/utils/src/index.ts\n')

      const result = affectedFlags.shouldUseFiltering({ forceAll: true })

      expect(result).toBe(false)
    })
  })
})

describe('Integration: Git Change Detection with Turborepo', () => {
  let detector: GitChangeDetector
  let affectedFlags: TurboAffectedFlags

  beforeEach(() => {
    vi.clearAllMocks()
    detector = new GitChangeDetector()
    affectedFlags = new TurboAffectedFlags(detector)
  })

  it('should handle complete workflow: detect changes → filter workspaces → generate command', () => {
    // Set up environment
    process.env['TURBO_SCM_BASE'] = 'origin/main'

    // Mock git operations
    mockExecSync
      .mockReturnValueOnce('') // supportsAffectedFlag check
      .mockReturnValueOnce('10\n') // commit count
      .mockReturnValueOnce('packages/utils/src/math.ts\npackages/utils/package.json\n') // changed files

    // Execute workflow
    const changedFiles = detector.getChangedFiles()
    const affectedWorkspaces = detector.getAffectedWorkspaces()
    const shouldFilter = affectedFlags.shouldUseFiltering()
    const command = affectedFlags.generateAffectedCommand('format')

    // Verify results
    expect(changedFiles).toEqual(['packages/utils/src/math.ts', 'packages/utils/package.json'])

    const changedWorkspaces = affectedWorkspaces.filter((ws) => ws.hasChanges)
    expect(changedWorkspaces).toHaveLength(1)
    expect(changedWorkspaces[0]?.name).toBe('pkg-utils')

    expect(shouldFilter).toBe(true) // Only 1 out of 5 workspaces affected
    expect(command).toBe('turbo run format --filter=pkg-utils')

    // Clean up
    delete process.env['TURBO_SCM_BASE']
  })

  it('should handle edge case: new repository with single commit', () => {
    mockExecSync
      .mockReturnValueOnce('') // git rev-parse succeeds
      .mockReturnValueOnce('1\n') // only 1 commit

    expect(() => {
      affectedFlags.generateAffectedCommand('test')
    }).toThrow('Repository does not support --affected flag')
  })

  it('should handle filter patterns for specific file types', () => {
    const mockFiles = [
      'packages/utils/src/index.ts',
      'packages/utils/README.md',
      'apps/web/src/App.tsx',
      'apps/web/public/favicon.ico',
      'docs/api.md',
    ].join('\n')

    mockExecSync.mockReturnValue(mockFiles)

    // Test TypeScript files only
    const tsFiles = detector.getChangedFiles({
      filterPatterns: ['**/*.ts', '**/*.tsx'],
    })

    expect(tsFiles).toEqual(['packages/utils/src/index.ts', 'apps/web/src/App.tsx'])

    // Test documentation files only
    const docFiles = detector.getChangedFiles({
      filterPatterns: ['**/*.md'],
    })

    expect(docFiles).toEqual(['packages/utils/README.md', 'docs/api.md'])
  })
})
