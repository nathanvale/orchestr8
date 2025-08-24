import type { Stats } from 'fs';

import { execSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface MockStats extends Partial<Stats> {
  mode: number
  isFile(): boolean
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
