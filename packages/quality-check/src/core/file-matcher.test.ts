import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { FileMatcher } from './file-matcher.js'
import { SecureGitOperations } from '../utils/secure-git-operations.js'

vi.mock('node:fs')
vi.mock('node:path')
vi.mock('../utils/secure-git-operations.js', () => ({
  SecureGitOperations: {
    getStagedFiles: vi.fn(),
    getChangedFiles: vi.fn(),
  },
}))

describe('FileMatcher', () => {
  let fileMatcher: FileMatcher
  const mockCwd = '/test/project'

  beforeEach(() => {
    vi.clearAllMocks()
    fileMatcher = new FileMatcher(mockCwd)

    // Default mock implementations
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readFileSync).mockReturnValue('')
    vi.mocked(fs.readdirSync).mockReturnValue([])
    vi.mocked(path.resolve).mockImplementation((base, file) =>
      file?.startsWith('/') ? file : `${base}/${file}`,
    )
    vi.mocked(path.relative).mockImplementation((from, to) => to.replace(`${from}/`, ''))
    vi.mocked(path.extname).mockImplementation((file) => {
      const match = file.match(/\.[^.]+$/)
      return match ? match[0] : ''
    })
    vi.mocked(path.isAbsolute).mockImplementation((file) => file.startsWith('/'))
    vi.mocked(path.parse).mockImplementation((file) => {
      const parts = file.split('/')
      const base = parts[parts.length - 1] || ''
      const extMatch = base.match(/\.[^.]+$/)
      const ext = extMatch ? extMatch[0] : ''
      const name = ext ? base.replace(ext, '') : base
      return {
        root: '/',
        dir: parts.slice(0, -1).join('/') || '/',
        base,
        ext,
        name,
      }
    })
    vi.mocked(path.dirname).mockImplementation((file) => {
      const parts = file.split('/')
      return parts.slice(0, -1).join('/') || '/'
    })
    vi.mocked(path.join).mockImplementation((...parts) => {
      return parts.filter(Boolean).join('/').replace(/\/+/g, '/')
    })
  })

  describe('isTypeScriptOrJavaScriptFile', () => {
    it('should recognize JavaScript files', async () => {
      const testFiles = ['file.js', 'file.jsx', 'file.mjs', 'file.cjs']

      for (const file of testFiles) {
        vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
          success: true,
          stdout: file,
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })
        const files = await fileMatcher.resolveFiles({ staged: true })
        expect(files).toContain(`${mockCwd}/${file}`)
      }
    })

    it('should recognize TypeScript files', async () => {
      const testFiles = ['file.ts', 'file.tsx']

      for (const file of testFiles) {
        vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
          success: true,
          stdout: file,
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })
        const files = await fileMatcher.resolveFiles({ staged: true })
        expect(files).toContain(`${mockCwd}/${file}`)
      }
    })

    it('should recognize Markdown files', async () => {
      const testFiles = ['README.md', 'docs/guide.md', 'CHANGELOG.md']

      for (const file of testFiles) {
        vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
          success: true,
          stdout: file,
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })
        const files = await fileMatcher.resolveFiles({ staged: true })
        expect(files).toContain(`${mockCwd}/${file}`)
      }
    })

    it('should filter out non-supported files', async () => {
      const unsupportedFiles = ['file.txt', 'file.json', 'file.yaml', 'file.css', 'file.html']

      for (const file of unsupportedFiles) {
        vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
          success: true,
          stdout: file,
          stderr: '',
          exitCode: 0,
          timedOut: false,
        })
        const files = await fileMatcher.resolveFiles({ staged: true })
        expect(files).not.toContain(`${mockCwd}/${file}`)
      }
    })
  })

  describe('resolveFiles with staged option', () => {
    it('should return staged JavaScript and TypeScript files', async () => {
      const stagedFiles = `src/index.js
src/utils.ts
src/component.tsx
src/helper.jsx`

      vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
        success: true,
        stdout: stagedFiles,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const files = await fileMatcher.resolveFiles({ staged: true })

      expect(SecureGitOperations.getStagedFiles).toHaveBeenCalledWith({
        cwd: mockCwd,
      })

      expect(files).toHaveLength(4)
      expect(files).toContain(`${mockCwd}/src/index.js`)
      expect(files).toContain(`${mockCwd}/src/utils.ts`)
      expect(files).toContain(`${mockCwd}/src/component.tsx`)
      expect(files).toContain(`${mockCwd}/src/helper.jsx`)
    })

    it('should return staged Markdown files', async () => {
      const stagedFiles = `README.md
docs/guide.md
CHANGELOG.md
.agent-os/specs/spec.md`

      vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
        success: true,
        stdout: stagedFiles,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const files = await fileMatcher.resolveFiles({ staged: true })

      expect(files).toHaveLength(4)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).toContain(`${mockCwd}/docs/guide.md`)
      expect(files).toContain(`${mockCwd}/CHANGELOG.md`)
      expect(files).toContain(`${mockCwd}/.agent-os/specs/spec.md`)
    })

    it('should filter out non-supported file types from staged files', async () => {
      const stagedFiles = `src/index.js
src/styles.css
README.md
package.json
src/component.tsx`

      vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
        success: true,
        stdout: stagedFiles,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const files = await fileMatcher.resolveFiles({ staged: true })

      expect(files).toHaveLength(3)
      expect(files).toContain(`${mockCwd}/src/index.js`)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).toContain(`${mockCwd}/src/component.tsx`)
      expect(files).not.toContain(`${mockCwd}/src/styles.css`)
      expect(files).not.toContain(`${mockCwd}/package.json`)
    })
  })

  describe('resolveFiles with since option', () => {
    it('should return changed files including Markdown since a git ref', async () => {
      const changedFiles = `src/index.ts
README.md
docs/api.md
src/utils.js`

      vi.mocked(SecureGitOperations.getChangedFiles).mockResolvedValue({
        success: true,
        stdout: changedFiles,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const files = await fileMatcher.resolveFiles({ since: 'main' })

      expect(SecureGitOperations.getChangedFiles).toHaveBeenCalledWith('main', {
        cwd: mockCwd,
      })

      expect(files).toHaveLength(4)
      expect(files).toContain(`${mockCwd}/src/index.ts`)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).toContain(`${mockCwd}/docs/api.md`)
      expect(files).toContain(`${mockCwd}/src/utils.js`)
    })
  })

  describe('resolveFiles with files option', () => {
    it('should handle provided file list including Markdown', async () => {
      const providedFiles = ['src/index.ts', 'README.md', 'docs/guide.md', 'test.js']

      const files = await fileMatcher.resolveFiles({ files: providedFiles })

      expect(files).toHaveLength(4)
      expect(files).toContain(`${mockCwd}/src/index.ts`)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).toContain(`${mockCwd}/docs/guide.md`)
      expect(files).toContain(`${mockCwd}/test.js`)
    })

    it('should handle absolute paths for Markdown files', async () => {
      const providedFiles = ['/absolute/path/README.md', 'relative/docs.md']

      const files = await fileMatcher.resolveFiles({ files: providedFiles })

      expect(files).toContain('/absolute/path/README.md')
      expect(files).toContain(`${mockCwd}/relative/docs.md`)
    })
  })

  describe('ignore patterns', () => {
    beforeEach(() => {
      vi.mocked(path.relative).mockImplementation((from, to) => {
        if (to.includes('node_modules')) return 'node_modules/package/file.js'
        if (to.includes('dist')) return 'dist/output.js'
        if (to.includes('build')) return 'build/bundle.js'
        if (to.includes('coverage')) return 'coverage/report.js'
        return to.replace(`${from}/`, '')
      })
    })

    it('should filter out node_modules even for Markdown files', async () => {
      const providedFiles = [
        `${mockCwd}/src/index.ts`,
        `${mockCwd}/node_modules/package/README.md`,
        `${mockCwd}/README.md`,
      ]

      const files = await fileMatcher.resolveFiles({ files: providedFiles })

      expect(files).toHaveLength(2)
      expect(files).toContain(`${mockCwd}/src/index.ts`)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).not.toContain(`${mockCwd}/node_modules/package/README.md`)
    })

    it('should filter out dist/build directories for all file types', async () => {
      const providedFiles = [
        `${mockCwd}/src/index.ts`,
        `${mockCwd}/dist/README.md`,
        `${mockCwd}/build/docs.md`,
        `${mockCwd}/coverage/report.md`,
        `${mockCwd}/README.md`,
      ]

      const files = await fileMatcher.resolveFiles({ files: providedFiles })

      expect(files).toHaveLength(2)
      expect(files).toContain(`${mockCwd}/src/index.ts`)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).not.toContain(`${mockCwd}/dist/README.md`)
      expect(files).not.toContain(`${mockCwd}/build/docs.md`)
      expect(files).not.toContain(`${mockCwd}/coverage/report.md`)
    })

    it('should respect .gitignore patterns for Markdown files', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath === path.join(mockCwd, '.gitignore')
      })

      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === path.join(mockCwd, '.gitignore')) {
          return '*.log\ntmp/\n.cache/'
        }
        return ''
      })

      vi.mocked(path.relative).mockImplementation((from, to) => {
        if (to.includes('tmp/')) return 'tmp/temp.md'
        if (to.includes('.cache/')) return '.cache/cached.md'
        if (to.includes('.log')) return 'debug.log'
        return to.replace(`${from}/`, '')
      })

      const providedFiles = [
        `${mockCwd}/README.md`,
        `${mockCwd}/tmp/temp.md`,
        `${mockCwd}/.cache/cached.md`,
        `${mockCwd}/debug.log`,
      ]

      const files = await fileMatcher.resolveFiles({ files: providedFiles })

      expect(files).toHaveLength(1)
      expect(files).toContain(`${mockCwd}/README.md`)
    })
  })

  describe('mixed file types', () => {
    it('should handle a mix of JS, TS, and MD files', async () => {
      const stagedFiles = `src/index.js
src/types.ts
README.md
docs/api.md
src/component.tsx
CHANGELOG.md
test.jsx`

      vi.mocked(SecureGitOperations.getStagedFiles).mockResolvedValue({
        success: true,
        stdout: stagedFiles,
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })

      const files = await fileMatcher.resolveFiles({ staged: true })

      expect(files).toHaveLength(7)
      expect(files).toContain(`${mockCwd}/src/index.js`)
      expect(files).toContain(`${mockCwd}/src/types.ts`)
      expect(files).toContain(`${mockCwd}/README.md`)
      expect(files).toContain(`${mockCwd}/docs/api.md`)
      expect(files).toContain(`${mockCwd}/src/component.tsx`)
      expect(files).toContain(`${mockCwd}/CHANGELOG.md`)
      expect(files).toContain(`${mockCwd}/test.jsx`)
    })

    it('should handle edge case file names with .md extension', async () => {
      const edgeCaseFiles = [
        'file.test.md',
        'file.spec.md',
        'file.config.md',
        '.hidden.md',
        'UPPERCASE.MD', // Should handle case-insensitive
      ]

      const providedFiles = edgeCaseFiles.map((file) => `${mockCwd}/${file}`)

      const files = await fileMatcher.resolveFiles({ files: providedFiles })

      expect(files).toHaveLength(5)
      edgeCaseFiles.forEach((file) => {
        expect(files).toContain(`${mockCwd}/${file}`)
      })
    })
  })
})
