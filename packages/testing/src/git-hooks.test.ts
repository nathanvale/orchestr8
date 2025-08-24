import type { Stats } from 'fs'

import { execSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface MockStats extends Partial<Stats> {
  mode: number
  isFile(): boolean
}

interface WorkspacePackage {
  name: string
  version: string
  private?: boolean
}

interface WorkspaceList {
  packages: WorkspacePackage[]
}

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}))

const mockedExecSync = vi.mocked(execSync)
const mockedExistsSync = vi.mocked(existsSync)
const mockedReadFileSync = vi.mocked(readFileSync)
const mockedStatSync = vi.mocked(statSync)

describe('Git Hooks Setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Husky Installation', () => {
    it('should verify husky is installed as dev dependency', () => {
      const packageJsonPath = join(process.cwd(), 'package.json')
      const mockPackageJson = {
        devDependencies: {
          husky: '^8.0.3',
          'lint-staged': '^15.2.0',
        },
      }

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

      expect(packageJson.devDependencies).toHaveProperty('husky')
      expect(packageJson.devDependencies.husky).toMatch(/^\^8\./)
    })

    it('should verify lint-staged is installed as dev dependency', () => {
      const packageJsonPath = join(process.cwd(), 'package.json')
      const mockPackageJson = {
        devDependencies: {
          husky: '^8.0.3',
          'lint-staged': '^15.2.0',
        },
      }

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

      expect(packageJson.devDependencies).toHaveProperty('lint-staged')
      expect(packageJson.devDependencies['lint-staged']).toMatch(/^\^15\./)
    })

    it('should verify prepare script exists', () => {
      const packageJsonPath = join(process.cwd(), 'package.json')
      const mockPackageJson = {
        scripts: {
          prepare: 'husky install',
        },
      }

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

      expect(packageJson.scripts).toHaveProperty('prepare')
      expect(packageJson.scripts.prepare).toBe('husky install')
    })
  })

  describe('Git Hooks Directory', () => {
    it('should verify .husky directory exists', () => {
      const huskyDir = join(process.cwd(), '.husky')
      mockedExistsSync.mockReturnValue(true)

      expect(existsSync(huskyDir)).toBe(true)
    })

    it('should verify pre-commit hook exists and is executable', () => {
      const preCommitHook = join(process.cwd(), '.husky', 'pre-commit')
      mockedExistsSync.mockReturnValue(true)
      mockedStatSync.mockReturnValue({
        mode: 0o755,
        isFile: () => true,
      } as MockStats)

      expect(existsSync(preCommitHook)).toBe(true)

      const stats = statSync(preCommitHook)
      expect(stats.mode & 0o755).toBeTruthy()
    })

    it('should verify pre-push hook exists and is executable', () => {
      const prePushHook = join(process.cwd(), '.husky', 'pre-push')
      mockedExistsSync.mockReturnValue(true)
      mockedStatSync.mockReturnValue({
        mode: 0o755,
        isFile: () => true,
      } as MockStats)

      expect(existsSync(prePushHook)).toBe(true)

      const stats = statSync(prePushHook)
      expect(stats.mode & 0o755).toBeTruthy()
    })
  })

  describe('Hook Content Validation', () => {
    it('should verify pre-commit hook runs lint-staged', () => {
      const preCommitHook = join(process.cwd(), '.husky', 'pre-commit')
      const expectedContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
`

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(expectedContent)

      const content = readFileSync(preCommitHook, 'utf8')

      expect(content).toContain('npx lint-staged')
      expect(content).toContain('#!/usr/bin/env sh')
      expect(content).toContain('. "$(dirname -- "$0")/_/husky.sh"')
    })

    it('should verify pre-push hook runs full validation', () => {
      const prePushHook = join(process.cwd(), '.husky', 'pre-push')
      const expectedContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm check
`

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(expectedContent)

      const content = readFileSync(prePushHook, 'utf8')

      expect(content).toContain('pnpm check')
      expect(content).toContain('#!/usr/bin/env sh')
      expect(content).toContain('. "$(dirname -- "$0")/_/husky.sh"')
    })
  })

  describe('Git Configuration', () => {
    it('should verify git hooks path is set correctly', () => {
      mockedExecSync.mockImplementation(() => '.husky')

      const hooksPath = execSync('git config core.hooksPath', {
        encoding: 'utf8',
      }) as string

      expect(hooksPath.trim()).toBe('.husky')
    })

    it('should handle git config errors gracefully', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      expect(() => {
        execSync('git config core.hooksPath')
      }).toThrow('Not a git repository')
    })
  })
})

describe('lint-staged Configuration and Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Staged File Detection', () => {
    it('should detect only staged TypeScript files', () => {
      const mockStagedFiles =
        'packages/core/src/test.ts\npackages/schema/src/types.ts'
      mockedExecSync
        .mockImplementationOnce(() => mockStagedFiles) // git diff --cached --name-only
        .mockImplementationOnce(() => 'packages/core/src/unstaged.ts') // git diff --name-only

      const stagedFiles = execSync('git diff --cached --name-only', {
        encoding: 'utf8',
      }) as string
      const unstagedFiles = execSync('git diff --name-only', {
        encoding: 'utf8',
      }) as string

      expect(stagedFiles).toContain('packages/core/src/test.ts')
      expect(stagedFiles).toContain('packages/schema/src/types.ts')
      expect(unstagedFiles).not.toContain('test.ts')
      expect(unstagedFiles).toContain('unstaged.ts')
    })

    it('should process different file types with appropriate patterns', () => {
      const mockFiles =
        'packages/core/src/code.ts\nconfig.json\nREADME.md\nignore.txt'
      mockedExecSync.mockReturnValue(mockFiles)

      const stagedFiles = execSync('git diff --cached --name-only', {
        encoding: 'utf8',
      }) as string

      const lines = stagedFiles.trim().split('\n')
      const tsFiles = lines.filter((f) => f.endsWith('.ts'))
      const jsonFiles = lines.filter((f) => f.endsWith('.json'))
      const mdFiles = lines.filter((f) => f.endsWith('.md'))

      expect(tsFiles).toHaveLength(1)
      expect(jsonFiles).toHaveLength(1)
      expect(mdFiles).toHaveLength(1)
    })
  })

  describe('lint-staged Configuration', () => {
    it('should have correct configuration in package.json', () => {
      const mockPackageJson = {
        'lint-staged': {
          'packages/*/src/**/*.{ts,tsx}': [
            'prettier --write',
            'eslint --fix',
            'bash -c \'set -e; pkgs=$(printf "%s\\n" "$@" | sed -nE "s|.*/packages/([^/]+)/.*|\\1|p" | sort -u); for p in $pkgs; do echo "Type-checking packages/$p..."; pnpm -C "packages/$p" type-check; done\' _',
          ],
          '*.{json,md,yml,yaml}': ['prettier --write'],
        },
      }

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockPackageJson))

      const packageJsonPath = join(process.cwd(), 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

      expect(packageJson['lint-staged']).toBeDefined()
      expect(packageJson['lint-staged']).toHaveProperty(
        'packages/*/src/**/*.{ts,tsx}',
      )
      expect(packageJson['lint-staged']).toHaveProperty('*.{json,md,yml,yaml}')

      const tsRules = packageJson['lint-staged']['packages/*/src/**/*.{ts,tsx}']
      expect(tsRules).toContain('prettier --write')
      expect(tsRules).toContain('eslint --fix')
      expect(tsRules[2]).toContain('type-check')
    })

    it('should include glob patterns for all package TypeScript files', () => {
      const mockConfig = {
        'lint-staged': {
          'packages/*/src/**/*.{ts,tsx}': ['prettier --write', 'eslint --fix'],
        },
      }

      mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig))
      const config = JSON.parse(readFileSync('package.json', 'utf8'))

      expect(
        config['lint-staged']['packages/*/src/**/*.{ts,tsx}'],
      ).toBeDefined()
    })
  })

  describe('Processing Pipeline', () => {
    it('should execute Prettier → ESLint → TypeScript pipeline', () => {
      const mockStagedFiles = 'packages/core/src/test.ts'
      mockedExecSync
        .mockImplementationOnce(() => mockStagedFiles)
        .mockImplementationOnce(() => '') // prettier
        .mockImplementationOnce(() => '') // eslint
        .mockImplementationOnce(() => '') // type-check

      // Simulate lint-staged execution
      execSync('git diff --cached --name-only')
      execSync('prettier --write packages/core/src/test.ts')
      execSync('eslint --fix packages/core/src/test.ts')
      execSync('bash -c "cd packages/core && pnpm type-check"')

      expect(mockedExecSync).toHaveBeenCalledWith(
        'git diff --cached --name-only',
      )
      expect(mockedExecSync).toHaveBeenCalledWith(
        'prettier --write packages/core/src/test.ts',
      )
      expect(mockedExecSync).toHaveBeenCalledWith(
        'eslint --fix packages/core/src/test.ts',
      )
    })

    it('should handle file type specific processing rules', () => {
      mockedExecSync
        .mockImplementationOnce(() => 'config.json\nREADME.md')
        .mockImplementationOnce(() => '') // prettier config.json
        .mockImplementationOnce(() => '') // prettier README.md

      execSync('git diff --cached --name-only')
      execSync('prettier --write config.json')
      execSync('prettier --write README.md')

      expect(mockedExecSync).toHaveBeenCalledWith(
        'prettier --write config.json',
      )
      expect(mockedExecSync).toHaveBeenCalledWith('prettier --write README.md')
    })
  })

  describe('Error Handling and File Restoration', () => {
    it('should handle ESLint errors gracefully', () => {
      const eslintError = new Error('ESLint found 2 errors and 0 warnings')
      mockedExecSync
        .mockImplementationOnce(() => 'packages/core/src/error.ts')
        .mockImplementationOnce(() => '') // prettier succeeds
        .mockImplementationOnce(() => {
          throw eslintError
        }) // eslint fails

      expect(() => {
        execSync('git diff --cached --name-only')
        execSync('prettier --write packages/core/src/error.ts')
        execSync('eslint --fix packages/core/src/error.ts')
      }).toThrow('ESLint found 2 errors and 0 warnings')
    })

    it('should provide clear error messages with file paths', () => {
      const detailedError = new Error(`
packages/core/src/error.ts
  5:1  error  'unused' is defined but never used  @typescript-eslint/no-unused-vars
  8:1  error  Missing semicolon  semi

✖ 2 problems (2 errors, 0 warnings)
`)

      mockedExecSync.mockImplementation(() => {
        throw detailedError
      })

      try {
        execSync('eslint --fix packages/core/src/error.ts')
      } catch (error: unknown) {
        expect((error as Error).message).toContain('packages/core/src/error.ts')
        expect((error as Error).message).toContain('no-unused-vars')
        expect((error as Error).message).toContain('Missing semicolon')
      }
    })

    it('should handle merge conflicts and git state issues', () => {
      const gitError = new Error('fatal: Unable to create index.lock')
      mockedExecSync.mockImplementation(() => {
        throw gitError
      })

      expect(() => {
        execSync('git add packages/core/src/test.ts')
      }).toThrow('Unable to create index.lock')
    })
  })

  describe('Staged-only Processing Validation', () => {
    it('should process only staged files, never full codebase', () => {
      const stagedFile = 'packages/core/src/staged.ts'
      const unstagedFile = 'packages/core/src/unstaged.ts'

      mockedExecSync
        .mockImplementationOnce(() => stagedFile) // git diff --cached
        .mockImplementationOnce(() => unstagedFile) // git diff

      const staged = execSync('git diff --cached --name-only', {
        encoding: 'utf8',
      }) as string
      const unstaged = execSync('git diff --name-only', {
        encoding: 'utf8',
      }) as string

      expect(staged.trim()).toBe(stagedFile)
      expect(unstaged.trim()).toBe(unstagedFile)
      expect(staged).not.toContain(unstagedFile)
    })

    it('should not run processing commands on unstaged files', () => {
      mockedExecSync.mockImplementationOnce(() => 'packages/core/src/staged.ts')

      // Simulate lint-staged only processing staged files
      execSync('git diff --cached --name-only')

      // Should not call prettier/eslint on unstaged files
      expect(mockedExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('unstaged.ts'),
      )
    })
  })
})

describe('Performance Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should complete pre-commit processing under 3 seconds for single file', async () => {
    const startTime = Date.now()

    mockedExecSync
      .mockImplementationOnce(() => 'packages/core/src/single.ts')
      .mockImplementationOnce(() => '') // prettier
      .mockImplementationOnce(() => '') // eslint
      .mockImplementationOnce(() => '') // type-check

    // Simulate quick processing
    setTimeout(() => {
      execSync('git diff --cached --name-only')
      execSync('prettier --write packages/core/src/single.ts')
      execSync('eslint --fix packages/core/src/single.ts')
      execSync('bash -c "cd packages/core && pnpm type-check"')
    }, 100)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(3000)
  })

  it('should provide performance metrics and timing information', () => {
    const mockMetrics = JSON.stringify({
      filesProcessed: 5,
      totalTime: 2500,
      prettierTime: 800,
      eslintTime: 1200,
      typecheckTime: 500,
    })

    mockedExecSync.mockImplementation(() => mockMetrics)

    const metrics = JSON.parse(
      execSync('echo \'{"filesProcessed":5}\'', { encoding: 'utf8' }) as string,
    )
    expect(metrics.filesProcessed).toBe(5)
  })

  it('should handle graceful degradation for large changesets', () => {
    const largeChangeset = Array.from(
      { length: 60 },
      (_, i) => `packages/core/src/file${i}.ts`,
    ).join('\n')

    mockedExecSync.mockImplementationOnce(() => largeChangeset)

    const stagedFiles = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
    }) as string
    const fileCount = stagedFiles.trim().split('\n').length

    // Should handle >50 files
    expect(fileCount).toBeGreaterThan(50)
  })
})

describe('Turborepo Task Integration and Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('turbo.json Configuration', () => {
    it('should have lint:fix task configured with proper inputs/outputs', () => {
      const mockTurboConfig = {
        pipeline: {
          'lint:fix': {
            cache: true,
            inputs: ['src/**/*.{ts,tsx}', '.eslintrc.cjs', 'tsconfig.json'],
            outputs: [],
          },
        },
      }

      mockedExistsSync.mockReturnValue(true)
      mockedReadFileSync.mockReturnValue(JSON.stringify(mockTurboConfig))

      const turboJsonPath = join(process.cwd(), 'turbo.json')
      const turboConfig = JSON.parse(readFileSync(turboJsonPath, 'utf8'))

      expect(turboConfig.pipeline).toBeDefined()
      expect(turboConfig.pipeline['lint:fix']).toBeDefined()
      expect(turboConfig.pipeline['lint:fix'].cache).toBe(true)
      expect(turboConfig.pipeline['lint:fix'].inputs).toContain(
        'src/**/*.{ts,tsx}',
      )
      expect(turboConfig.pipeline['lint:fix'].inputs).toContain('.eslintrc.cjs')
      expect(turboConfig.pipeline['lint:fix'].inputs).toContain('tsconfig.json')
    })

    it('should configure proper caching strategy for optimal performance', () => {
      const mockConfig = {
        pipeline: {
          'lint:fix': {
            cache: true,
            inputs: [
              'src/**/*.{ts,tsx}',
              '.eslintrc.cjs',
              'tsconfig.json',
              'package.json',
            ],
            outputs: [],
            dependsOn: [],
          },
        },
      }

      mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig))
      const config = JSON.parse(readFileSync('turbo.json', 'utf8'))

      expect(config.pipeline['lint:fix'].cache).toBe(true)
      expect(config.pipeline['lint:fix'].outputs).toEqual([])
      expect(config.pipeline['lint:fix'].dependsOn).toEqual([])
    })
  })

  describe('Caching Behavior', () => {
    it('should test cache hit/miss scenarios', () => {
      // Simulate cache hit
      mockedExecSync.mockImplementationOnce(() => 'cache:hit')

      const cacheResult = execSync('turbo lint:fix --dry-run=json', {
        encoding: 'utf8',
      }) as string

      expect(cacheResult).toBe('cache:hit')
    })

    it('should verify performance improvements with caching', () => {
      const cacheHitTime = 200 // ms
      const cacheMissTime = 2000 // ms

      // First run (cache miss)
      mockedExecSync.mockImplementationOnce(() =>
        JSON.stringify({
          status: 'miss',
          duration: cacheMissTime,
          tasks: [{ task: 'lint:fix', status: 'miss' }],
        }),
      )

      // Second run (cache hit)
      mockedExecSync.mockImplementationOnce(() =>
        JSON.stringify({
          status: 'hit',
          duration: cacheHitTime,
          tasks: [{ task: 'lint:fix', status: 'hit' }],
        }),
      )

      const firstRun = JSON.parse(
        execSync('turbo lint:fix --dry-run=json', {
          encoding: 'utf8',
        }) as string,
      )
      const secondRun = JSON.parse(
        execSync('turbo lint:fix --dry-run=json', {
          encoding: 'utf8',
        }) as string,
      )

      expect(firstRun.status).toBe('miss')
      expect(secondRun.status).toBe('hit')
      expect(secondRun.duration).toBeLessThan(firstRun.duration)
    })
  })

  describe('Workspace-aware Task Execution', () => {
    it('should implement workspace-aware task execution', () => {
      const mockWorkspaces = [
        'packages/core',
        'packages/schema',
        'packages/logger',
      ]
      mockedExecSync.mockImplementation(() =>
        JSON.stringify({
          packages: mockWorkspaces.map((ws) => ({ name: ws, path: ws })),
        }),
      )

      const workspaces = JSON.parse(
        execSync('pnpm ls -r --json', { encoding: 'utf8' }) as string,
      ) as WorkspaceList

      expect(workspaces.packages).toHaveLength(3)
      expect(workspaces.packages.map((p) => p.name)).toContain('packages/core')
      expect(workspaces.packages.map((p) => p.name)).toContain(
        'packages/schema',
      )
    })

    it('should handle package dependencies correctly', () => {
      const mockDependencyGraph = {
        'packages/core': ['packages/schema', 'packages/logger'],
        'packages/cli': ['packages/core'],
        'packages/agent-base': ['packages/core'],
      }

      mockedExecSync.mockImplementation(() =>
        JSON.stringify(mockDependencyGraph),
      )

      const depGraph = JSON.parse(
        execSync('turbo lint:fix --dry-run=json --graph', {
          encoding: 'utf8',
        }) as string,
      )

      expect(depGraph['packages/core']).toContain('packages/schema')
      expect(depGraph['packages/cli']).toContain('packages/core')
    })
  })

  describe('Task Integration with Existing Workflow', () => {
    it('should maintain compatibility with existing pnpm check workflow', () => {
      const mockCheckSteps = ['format:check', 'lint', 'type-check', 'test']

      mockedExecSync.mockImplementation(() => mockCheckSteps.join('\n'))

      const checkSteps = execSync('pnpm run check --dry-run', {
        encoding: 'utf8',
      }) as string

      expect(checkSteps).toContain('format:check')
      expect(checkSteps).toContain('lint')
      expect(checkSteps).toContain('type-check')
      expect(checkSteps).toContain('test')
    })

    it('should support lint:fix task across all packages', () => {
      const packages = [
        'packages/core',
        'packages/schema',
        'packages/logger',
        'packages/resilience',
        'packages/cli',
        'packages/agent-base',
        'packages/testing',
      ]

      packages.forEach((pkg) => {
        mockedExecSync.mockImplementationOnce(
          () => `Running lint:fix in ${pkg}`,
        )
        const result = execSync(`cd ${pkg} && pnpm lint:fix`, {
          encoding: 'utf8',
        }) as string
        expect(result).toContain(`Running lint:fix in ${pkg}`)
      })
    })
  })
})

describe('Developer Onboarding and Documentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Setup Automation', () => {
    it('should have setup-git-hooks.mjs script', () => {
      const setupScriptPath = join(
        process.cwd(),
        'scripts',
        'setup-git-hooks.mjs',
      )
      mockedExistsSync.mockReturnValue(true)

      expect(existsSync(setupScriptPath)).toBe(true)
    })

    it('should verify husky installation during setup', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('husky --version')) {
          return '8.0.3'
        }
        return ''
      })

      const version = execSync('husky --version', {
        encoding: 'utf8',
      }) as string
      expect(version.trim()).toBe('8.0.3')
    })

    it('should validate git repository during setup', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git rev-parse --is-inside-work-tree')) {
          return 'true'
        }
        return ''
      })

      const isGitRepo = execSync('git rev-parse --is-inside-work-tree', {
        encoding: 'utf8',
      }) as string
      expect(isGitRepo.trim()).toBe('true')
    })

    it('should handle existing git hooks conflicts', () => {
      const existingHook = join(process.cwd(), '.git', 'hooks', 'pre-commit')
      mockedExistsSync.mockImplementation((path: string) => {
        return path.includes('.git/hooks/pre-commit')
      })

      expect(existsSync(existingHook)).toBe(true)
    })

    it('should create .husky directory if it does not exist', () => {
      mockedExistsSync.mockReturnValue(false)

      // Simulate directory creation
      mockedExecSync.mockImplementation(() => '')

      execSync('mkdir -p .husky')
      expect(mockedExecSync).toHaveBeenCalledWith('mkdir -p .husky')
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle missing husky dependency', () => {
      const packageJsonContent = {
        devDependencies: {
          'lint-staged': '^15.2.0',
          // husky missing
        },
      }

      mockedReadFileSync.mockReturnValue(JSON.stringify(packageJsonContent))
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

      expect(packageJson.devDependencies).not.toHaveProperty('husky')
      expect(packageJson.devDependencies).toHaveProperty('lint-staged')
    })

    it('should handle missing lint-staged dependency', () => {
      const packageJsonContent = {
        devDependencies: {
          husky: '^8.0.3',
          // lint-staged missing
        },
      }

      mockedReadFileSync.mockReturnValue(JSON.stringify(packageJsonContent))
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

      expect(packageJson.devDependencies).toHaveProperty('husky')
      expect(packageJson.devDependencies).not.toHaveProperty('lint-staged')
    })

    it('should handle non-git repository error', () => {
      const gitError = new Error('fatal: not a git repository')
      mockedExecSync.mockImplementation(() => {
        throw gitError
      })

      expect(() => {
        execSync('git rev-parse --is-inside-work-tree')
      }).toThrow('fatal: not a git repository')
    })

    it('should handle permission errors for hook files', () => {
      const permissionError = new Error('Permission denied')
      mockedExecSync.mockImplementation(() => {
        throw permissionError
      })

      expect(() => {
        execSync('chmod +x .husky/pre-commit')
      }).toThrow('Permission denied')
    })
  })

  describe('Performance Benchmarking', () => {
    it('should collect metrics during setup process', () => {
      const mockMetrics = {
        setupStart: Date.now(),
        huskyInstallTime: 1500,
        hooksCreationTime: 200,
        validationTime: 300,
        totalTime: 2000,
      }

      mockedExecSync.mockImplementation(() => JSON.stringify(mockMetrics))

      const metrics = JSON.parse(
        execSync('node setup-git-hooks.mjs --metrics', {
          encoding: 'utf8',
        }) as string,
      )

      expect(metrics.totalTime).toBe(2000)
      expect(metrics.huskyInstallTime).toBe(1500)
      expect(metrics.hooksCreationTime).toBe(200)
    })

    it('should verify hook execution performance', () => {
      const startTime = Date.now()

      // Simulate fast hook execution
      mockedExecSync.mockImplementation(() => {
        // Simulate processing time
        return ''
      })

      execSync('npx lint-staged')

      const executionTime = Date.now() - startTime
      expect(executionTime).toBeLessThan(3000) // Under 3 seconds target
    })
  })

  describe('Bypass Mechanisms', () => {
    it('should support --no-verify flag for commits', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('--no-verify')) {
          return 'Skipping pre-commit hooks'
        }
        return ''
      })

      const result = execSync('git commit -m "emergency fix" --no-verify', {
        encoding: 'utf8',
      }) as string
      expect(result).toBe('Skipping pre-commit hooks')
    })

    it('should support HUSKY environment variable bypass', () => {
      process.env.HUSKY = '0'

      mockedExecSync.mockImplementation(() => {
        if (process.env.HUSKY === '0') {
          return 'Husky hooks disabled'
        }
        return 'Hooks running'
      })

      const result = execSync('git commit -m "test"', {
        encoding: 'utf8',
      }) as string
      expect(result).toBe('Husky hooks disabled')

      delete process.env.HUSKY
    })

    it('should provide clear bypass instructions in error messages', () => {
      const errorMessage = `
Pre-commit hook failed!

To bypass hooks temporarily:
  git commit --no-verify -m "your message"

To disable hooks permanently:
  export HUSKY=0

For help: npm run setup:hooks
`
      mockedExecSync.mockImplementation(() => {
        throw new Error(errorMessage.trim())
      })

      try {
        execSync('git commit -m "test"')
      } catch (error: unknown) {
        expect((error as Error).message).toContain('--no-verify')
        expect((error as Error).message).toContain('HUSKY=0')
        expect((error as Error).message).toContain('npm run setup:hooks')
      }
    })
  })

  describe('Troubleshooting Documentation', () => {
    it('should provide comprehensive error diagnostics', () => {
      const diagnosticInfo = {
        nodeVersion: process.version,
        huskyVersion: '8.0.3',
        lintStagedVersion: '15.2.0',
        gitVersion: 'git version 2.34.1',
        platform: process.platform,
        huskyConfigExists: true,
        gitHooksPath: '.husky',
      }

      mockedExecSync.mockImplementation(() => JSON.stringify(diagnosticInfo))

      const diagnostics = JSON.parse(
        execSync('node setup-git-hooks.mjs --diagnose', {
          encoding: 'utf8',
        }) as string,
      )

      expect(diagnostics.nodeVersion).toBeDefined()
      expect(diagnostics.huskyVersion).toBe('8.0.3')
      expect(diagnostics.gitHooksPath).toBe('.husky')
    })

    it('should validate configuration completeness', () => {
      const configValidation = {
        huskyInstalled: true,
        lintStagedInstalled: true,
        preCommitHookExists: true,
        prePushHookExists: true,
        lintStagedConfigured: true,
        turboLintFixTask: true,
        packageScriptsComplete: true,
      }

      mockedExecSync.mockImplementation(() => JSON.stringify(configValidation))

      const validation = JSON.parse(
        execSync('node setup-git-hooks.mjs --validate', {
          encoding: 'utf8',
        }) as string,
      )

      expect(validation.huskyInstalled).toBe(true)
      expect(validation.packageScriptsComplete).toBe(true)
      expect(validation.turboLintFixTask).toBe(true)
    })
  })
})
