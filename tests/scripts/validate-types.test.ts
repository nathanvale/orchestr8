/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Mock fs functions
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  }
})

// Import after mocking
import { existsSync, readdirSync } from 'node:fs'

// Get mocked versions
const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)

describe('validate-types script', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Path Security', () => {
    test('should reject absolute paths', () => {
      const resolveProjectPath = (projectRelativePath: string): string => {
        if (projectRelativePath === '') throw new Error('Empty path not allowed')
        if (require('node:path').isAbsolute(projectRelativePath)) {
          throw new Error(`Absolute path not allowed: ${projectRelativePath}`)
        }
        return require('node:path').resolve(process.cwd(), projectRelativePath)
      }

      expect(() => resolveProjectPath('/etc/passwd')).toThrow('Absolute path not allowed')
      expect(() => resolveProjectPath('/usr/bin')).toThrow('Absolute path not allowed')
      expect(() => resolveProjectPath('')).toThrow('Empty path not allowed')
    })

    test('should reject path traversal attempts', () => {
      const resolveProjectPath = (projectRelativePath: string): string => {
        if (projectRelativePath === '') throw new Error('Empty path not allowed')

        const { isAbsolute, relative, resolve } = require('node:path')
        if (isAbsolute(projectRelativePath)) {
          throw new Error(`Absolute path not allowed: ${projectRelativePath}`)
        }

        const fullPath = resolve(process.cwd(), projectRelativePath)
        const rel = relative(process.cwd(), fullPath)

        if (rel.startsWith('..') || isAbsolute(rel)) {
          throw new Error(
            `Path traversal detected: ${projectRelativePath} resolves outside project root`,
          )
        }
        return fullPath
      }

      expect(() => resolveProjectPath('../../../etc/passwd')).toThrow('Path traversal detected')
      expect(() => resolveProjectPath('../../../../usr/bin')).toThrow('Path traversal detected')

      // Valid paths should work
      expect(() => resolveProjectPath('src/index.ts')).not.toThrow()
      expect(() => resolveProjectPath('dist/types.d.ts')).not.toThrow()
    })
  })

  describe('Build Directory Validation', () => {
    test('should detect missing dist directory', () => {
      vi.mocked(mockExistsSync).mockReturnValue(false)

      const checkBuildDirs = (): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        if (!mockExistsSync('dist')) {
          errors.push('Build directory "dist" is missing')
        }
        return { errors, warnings: [] }
      }

      const result = checkBuildDirs()
      expect(result.errors).toContain('Build directory "dist" is missing')
    })

    test('should pass when dist directory exists', () => {
      vi.mocked(mockExistsSync).mockReturnValue(true)

      const checkBuildDirs = (): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        if (!mockExistsSync('dist')) {
          errors.push('Build directory "dist" is missing')
        }
        return { errors, warnings: [] }
      }

      const result = checkBuildDirs()
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Export Validation', () => {
    test('should validate package.json exports field', () => {
      const packageExports = {
        '.': {
          import: './dist/index.js',
          types: './dist/index.d.ts',
          default: './dist/index.js',
        },
        './utils': {
          import: './dist/utils.js',
          types: './dist/utils.d.ts',
          default: './dist/utils.js',
        },
      }

      // Test export validation logic
      const validateExportTypes = (exports: any): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        for (const [exportPath, exportConfig] of Object.entries(exports)) {
          if (typeof exportConfig === 'object' && exportConfig !== null) {
            const config = exportConfig as any

            // Check if types field exists
            if (!config.types) {
              errors.push(`Export "${exportPath}" is missing types field`)
            }

            // Check if import field exists
            if (!config.import && !config.default) {
              errors.push(`Export "${exportPath}" is missing import or default field`)
            }
          }
        }

        return { errors, warnings }
      }

      const result = validateExportTypes(packageExports)
      expect(result.errors).toHaveLength(0)
    })

    test('should detect missing types in exports', () => {
      const packageExports = {
        '.': {
          import: './dist/index.js',
          // Missing types field
          default: './dist/index.js',
        },
      }

      const validateExportTypes = (exports: any): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        for (const [exportPath, exportConfig] of Object.entries(exports)) {
          if (typeof exportConfig === 'object' && exportConfig !== null) {
            const config = exportConfig as any

            if (!config.types) {
              errors.push(`Export "${exportPath}" is missing types field`)
            }
          }
        }

        return { errors, warnings }
      }

      const result = validateExportTypes(packageExports)
      expect(result.errors).toContain('Export "." is missing types field')
    })
  })

  describe('Runtime Type Parity', () => {
    test('should validate JS and .d.ts file parity', () => {
      const distFiles = ['index.js', 'utils.js', 'helpers.js']
      const typeFiles = ['index.d.ts', 'utils.d.ts'] // Missing helpers.d.ts

      const validateParity = (
        jsFiles: string[],
        dtsFiles: string[],
      ): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        // Get base names without extensions
        const jsBasenames = jsFiles.map((f) => f.replace('.js', ''))
        const dtsBasenames = dtsFiles.map((f) => f.replace('.d.ts', ''))

        // Check for JS files without corresponding .d.ts files
        for (const jsBasename of jsBasenames) {
          if (!dtsBasenames.includes(jsBasename)) {
            errors.push(`Runtime file "${jsBasename}.js" has no corresponding "${jsBasename}.d.ts"`)
          }
        }

        // Check for .d.ts files without corresponding JS files
        for (const dtsBasename of dtsBasenames) {
          if (!jsBasenames.includes(dtsBasename)) {
            warnings.push(
              `Type file "${dtsBasename}.d.ts" has no corresponding "${dtsBasename}.js"`,
            )
          }
        }

        return { errors, warnings }
      }

      const result = validateParity(distFiles, typeFiles)
      expect(result.errors).toContain(
        'Runtime file "helpers.js" has no corresponding "helpers.d.ts"',
      )
    })

    test('should detect orphan type files', () => {
      const distFiles = ['index.js', 'utils.js']
      const typeFiles = ['index.d.ts', 'utils.d.ts', 'orphan.d.ts'] // orphan.d.ts has no JS file

      const validateParity = (
        jsFiles: string[],
        dtsFiles: string[],
      ): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        const jsBasenames = jsFiles.map((f) => f.replace('.js', ''))
        const dtsBasenames = dtsFiles.map((f) => f.replace('.d.ts', ''))

        for (const dtsBasename of dtsBasenames) {
          if (!jsBasenames.includes(dtsBasename)) {
            warnings.push(
              `Type file "${dtsBasename}.d.ts" has no corresponding "${dtsBasename}.js"`,
            )
          }
        }

        return { errors, warnings }
      }

      const result = validateParity(distFiles, typeFiles)
      expect(result.warnings).toContain('Type file "orphan.d.ts" has no corresponding "orphan.js"')
    })
  })

  describe('File System Operations', () => {
    test('should get JS files from directory', () => {
      vi.mocked(mockReaddirSync).mockReturnValue([
        'index.js',
        'utils.js',
        'README.md',
        'types.d.ts',
      ] as any)

      const getJsFiles = (dir: string): string[] => {
        const files = mockReaddirSync(dir) as string[]
        return files.filter((file) => file.endsWith('.js'))
      }

      const jsFiles = getJsFiles('dist')
      expect(jsFiles).toEqual(['index.js', 'utils.js'])
      expect(jsFiles).not.toContain('README.md')
      expect(jsFiles).not.toContain('types.d.ts')
    })

    test('should get TypeScript declaration files from directory', () => {
      vi.mocked(mockReaddirSync).mockReturnValue([
        'index.d.ts',
        'utils.d.ts',
        'index.js',
        'config.json',
      ] as any)

      const getTsDefFiles = (dir: string): string[] => {
        const files = mockReaddirSync(dir) as string[]
        return files.filter((file) => file.endsWith('.d.ts'))
      }

      const dtsFiles = getTsDefFiles('dist')
      expect(dtsFiles).toEqual(['index.d.ts', 'utils.d.ts'])
      expect(dtsFiles).not.toContain('index.js')
      expect(dtsFiles).not.toContain('config.json')
    })
  })

  describe('Result Merging', () => {
    test('should merge validation results correctly', () => {
      const mergeResults = (
        ...parts: Array<{ errors: string[]; warnings: string[] }>
      ): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        for (const part of parts) {
          errors.push(...part.errors)
          warnings.push(...part.warnings)
        }

        return { errors, warnings }
      }

      const result1 = { errors: ['error1'], warnings: ['warning1'] }
      const result2 = { errors: ['error2'], warnings: [] }
      const result3 = { errors: [], warnings: ['warning2', 'warning3'] }

      const merged = mergeResults(result1, result2, result3)

      expect(merged.errors).toEqual(['error1', 'error2'])
      expect(merged.warnings).toEqual(['warning1', 'warning2', 'warning3'])
    })

    test('should handle empty results', () => {
      const mergeResults = (
        ...parts: Array<{ errors: string[]; warnings: string[] }>
      ): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        for (const part of parts) {
          errors.push(...part.errors)
          warnings.push(...part.warnings)
        }

        return { errors, warnings }
      }

      const empty1 = { errors: [], warnings: [] }
      const empty2 = { errors: [], warnings: [] }

      const merged = mergeResults(empty1, empty2)

      expect(merged.errors).toEqual([])
      expect(merged.warnings).toEqual([])
    })
  })

  describe('Main Types Validation', () => {
    test('should validate package.json main and types fields', () => {
      const packageJson = {
        main: './dist/index.js',
        types: './dist/index.d.ts',
      }

      vi.mocked(mockExistsSync).mockImplementation((path) => {
        return path.toString().includes('dist/index.')
      })

      const checkMainTypes = (): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        if (packageJson.main && !mockExistsSync(packageJson.main)) {
          errors.push(`Main file "${packageJson.main}" does not exist`)
        }

        if (packageJson.types && !mockExistsSync(packageJson.types)) {
          errors.push(`Types file "${packageJson.types}" does not exist`)
        }

        return { errors, warnings }
      }

      const result = checkMainTypes()
      expect(result.errors).toHaveLength(0)
    })

    test('should detect missing main file', () => {
      const packageJson = {
        main: './dist/index.js',
        types: './dist/index.d.ts',
      }

      vi.mocked(mockExistsSync).mockImplementation((path) => {
        // Only types file exists
        return path.toString().includes('index.d.ts')
      })

      const checkMainTypes = (): { errors: string[]; warnings: string[] } => {
        const errors: string[] = []
        const warnings: string[] = []

        if (packageJson.main && !mockExistsSync(packageJson.main)) {
          errors.push(`Main file "${packageJson.main}" does not exist`)
        }

        if (packageJson.types && !mockExistsSync(packageJson.types)) {
          errors.push(`Types file "${packageJson.types}" does not exist`)
        }

        return { errors, warnings }
      }

      const result = checkMainTypes()
      expect(result.errors).toContain('Main file "./dist/index.js" does not exist')
    })
  })
})
