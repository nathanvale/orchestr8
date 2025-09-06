import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { QualityChecker } from '../src/core/quality-checker'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

describe('QualityChecker Integration Tests', () => {
  let fixtureDir: string
  let checker: QualityChecker

  beforeAll(async () => {
    fixtureDir = path.join(tmpdir(), `qc-test-${Date.now()}`)
    await fs.mkdir(fixtureDir, { recursive: true })
    checker = new QualityChecker()
  })

  afterAll(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true })
  })

  describe('TypeScript Path Aliases', () => {
    it('should_detect_missing_path_alias_when_typescript_file_uses_undefined_alias', async () => {
      const tsconfigPath = path.join(fixtureDir, 'tsconfig.json')
      const srcFile = path.join(fixtureDir, 'test.ts')

      await fs.writeFile(
        tsconfigPath,
        JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {
                '@utils/*': ['./utils/*'],
              },
            },
          },
          null,
          2,
        ),
      )

      await fs.writeFile(
        srcFile,
        `
        import { helper } from '@missing/helper';
        import { util } from '@utils/util';
        
        export function test() {
          return helper() + util();
        }
      `,
      )

      const result = await checker.check([srcFile], {
        typescript: true,
        eslint: false,
        prettier: false,
      })

      expect(result.success).toBe(false)
      expect(result.checkers.typescript?.errors).toBeDefined()
      const errors = result.checkers.typescript?.errors || []
      expect(errors.some((e) => e.includes('TS2307') && e.includes('@missing/helper'))).toBe(true)
    })

    it('should_resolve_correctly_when_path_aliases_are_properly_configured', async () => {
      const tsconfigPath = path.join(fixtureDir, 'tsconfig-valid.json')
      const utilDir = path.join(fixtureDir, 'utils')
      const srcFile = path.join(fixtureDir, 'valid.ts')
      const utilFile = path.join(utilDir, 'helper.ts')

      await fs.mkdir(utilDir, { recursive: true })

      await fs.writeFile(
        tsconfigPath,
        JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {
                '@utils/*': ['./utils/*'],
              },
              noEmit: true,
            },
          },
          null,
          2,
        ),
      )

      await fs.writeFile(
        utilFile,
        `
        export function helper() {
          return 'helper';
        }
      `,
      )

      await fs.writeFile(
        srcFile,
        `
        import { helper } from '@utils/helper';
        
        export function test() {
          return helper();
        }
      `,
      )

      const result = await checker.check([srcFile], {
        typescript: true,
        eslint: false,
        prettier: false,
      })

      const errors = result.checkers.typescript?.errors || []
      expect(errors.some((e) => e.includes('TS2307'))).toBe(false)
    })
  })

  describe('ESLint Flat Config', () => {
    it('should_use_flat_config_when_eslint_config_js_exists', async () => {
      const configPath = path.join(fixtureDir, 'eslint.config.js')
      const srcFile = path.join(fixtureDir, 'lint-test.js')

      await fs.writeFile(
        configPath,
        `
        export default [
          {
            rules: {
              'no-unused-vars': 'error',
              'no-console': 'warn'
            }
          }
        ];
      `,
      )

      await fs.writeFile(
        srcFile,
        `
        const unused = 42;
        console.log('test');
        
        function used() {
          return 1;
        }
        
        export { used };
      `,
      )

      const result = await checker.check([srcFile], {
        eslint: true,
        typescript: false,
        prettier: false,
      })

      expect(result.success).toBe(false)
      const errors = result.checkers.eslint?.errors || []
      const warnings = result.checkers.eslint?.warnings || []
      expect(errors.some((e) => e.includes('no-unused-vars'))).toBe(true)
      expect(warnings.some((w) => w.includes('no-console'))).toBe(true)
    })
  })

  describe('Prettier Formatting', () => {
    it('should_detect_formatting_issues_when_prettier_config_exists', async () => {
      const configPath = path.join(fixtureDir, '.prettierrc')
      const srcFile = path.join(fixtureDir, 'format-test.js')

      await fs.writeFile(
        configPath,
        JSON.stringify({
          semi: false,
          singleQuote: true,
          tabWidth: 2,
        }),
      )

      await fs.writeFile(
        srcFile,
        `
        const obj = {
            "key": "value",
              nested: {
                prop: "test"
            }
        };
      `,
      )

      const result = await checker.check([srcFile], {
        prettier: true,
        eslint: false,
        typescript: false,
      })

      expect(result.success).toBe(false)
      const errors = result.checkers.prettier?.errors || []
      expect(errors.some((e) => e.includes('formatting') || e.includes('needs formatting'))).toBe(
        true,
      )
    })

    it('should_autofix_formatting_when_fix_option_enabled', async () => {
      const configPath = path.join(fixtureDir, '.prettierrc-fix')
      const srcFile = path.join(fixtureDir, 'format-fix.js')

      await fs.writeFile(
        configPath,
        JSON.stringify({
          semi: false,
          singleQuote: true,
          tabWidth: 2,
        }),
      )

      const originalContent = `const obj={key:"value",nested:{prop:"test"}};`
      await fs.writeFile(srcFile, originalContent)

      const result = await checker.fix([srcFile], {
        safe: true,
      })

      expect(result.success).toBe(true)
      expect(result.count).toBeGreaterThan(0)

      const fixedContent = await fs.readFile(srcFile, 'utf-8')
      expect(fixedContent).not.toBe(originalContent)
      expect(fixedContent).toContain("'value'")
    })
  })

  describe('Multi-Engine Integration', () => {
    it('should_aggregate_issues_when_multiple_engines_run_together', async () => {
      const tsFile = path.join(fixtureDir, 'multi.ts')
      const tsconfigPath = path.join(fixtureDir, 'tsconfig-multi.json')

      await fs.writeFile(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
          },
        }),
      )

      await fs.writeFile(
        tsFile,
        `
        const unused = 42;
        function test(param: any) {
                console.log(    param    );
        }
        export { test };
      `,
      )

      const result = await checker.check([tsFile], {
        typescript: true,
        eslint: true,
        prettier: true,
      })

      expect(result.success).toBe(false)

      expect(result.checkers.typescript).toBeDefined()
      expect(result.checkers.eslint).toBeDefined()
      expect(result.checkers.prettier).toBeDefined()

      const tsErrors = result.checkers.typescript?.errors || []
      const eslintErrors = result.checkers.eslint?.errors || []
      const prettierErrors = result.checkers.prettier?.errors || []
      expect(tsErrors.some((e) => e.includes('any'))).toBe(true)
      expect(eslintErrors.some((e) => e.includes('unused'))).toBe(true)
      expect(
        prettierErrors.some((e) => e.includes('formatting') || e.includes('needs formatting')),
      ).toBe(true)
    })
  })

  describe('Ignore Patterns', () => {
    it('should_respect_prettierignore_when_checking_files', async () => {
      const ignoreFile = path.join(fixtureDir, '.prettierignore')
      const ignoredFile = path.join(fixtureDir, 'ignored.js')
      const checkedFile = path.join(fixtureDir, 'checked.js')

      await fs.writeFile(ignoreFile, 'ignored.js\n')
      await fs.writeFile(ignoredFile, 'const    bad   =    "formatting";')
      await fs.writeFile(checkedFile, 'const    bad   =    "formatting";')

      const result = await checker.check([ignoredFile, checkedFile], {
        prettier: true,
        eslint: false,
        typescript: false,
      })

      const errors = result.checkers.prettier?.errors || []
      expect(errors.some((e) => e.includes('ignored.js'))).toBe(false)
      expect(errors.some((e) => e.includes('checked.js'))).toBe(true)
    })

    it('should_respect_eslintignore_patterns_in_flat_config', async () => {
      const configPath = path.join(fixtureDir, 'eslint-ignore.config.js')
      const ignoredFile = path.join(fixtureDir, 'build', 'generated.js')
      const checkedFile = path.join(fixtureDir, 'src', 'source.js')

      await fs.mkdir(path.join(fixtureDir, 'build'), { recursive: true })
      await fs.mkdir(path.join(fixtureDir, 'src'), { recursive: true })

      await fs.writeFile(
        configPath,
        `
        export default [
          {
            ignores: ['**/build/**'],
            rules: {
              'no-unused-vars': 'error'
            }
          }
        ];
      `,
      )

      const badCode = 'const unused = 42;'
      await fs.writeFile(ignoredFile, badCode)
      await fs.writeFile(checkedFile, badCode)

      const result = await checker.check([ignoredFile, checkedFile], {
        eslint: true,
        typescript: false,
        prettier: false,
      })

      const errors = result.checkers.eslint?.errors || []
      expect(errors.some((e) => e.includes('generated.js'))).toBe(false)
      expect(errors.some((e) => e.includes('source.js'))).toBe(true)
    })
  })

  describe('Exit Codes', () => {
    it('should_return_exit_code_0_when_no_issues_found', async () => {
      const cleanFile = path.join(fixtureDir, 'clean.js')
      await fs.writeFile(cleanFile, 'export const clean = 42;')

      const result = await checker.check([cleanFile], {
        eslint: true,
        prettier: true,
        typescript: false,
      })

      expect(result.success).toBe(true)
      const eslintErrors = result.checkers.eslint?.errors || []
      const prettierErrors = result.checkers.prettier?.errors || []
      expect(eslintErrors).toHaveLength(0)
      expect(prettierErrors).toHaveLength(0)
    })

    it('should_return_exit_code_1_when_issues_found', async () => {
      const issueFile = path.join(fixtureDir, 'issue.js')
      await fs.writeFile(issueFile, 'const unused = 42;')

      const result = await checker.check([issueFile], {
        eslint: true,
        typescript: false,
        prettier: false,
      })

      expect(result.success).toBe(false)
      const errors = result.checkers.eslint?.errors || []
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('JSON Output Format', () => {
    it('should_provide_structured_json_when_format_json_specified', async () => {
      const testFile = path.join(fixtureDir, 'json-test.ts')
      await fs.writeFile(
        testFile,
        `
        const x: any = 42;
        console.log(x);
      `,
      )

      const result = await checker.check([testFile], {
        typescript: true,
        eslint: false,
        prettier: false,
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('checkers')
      expect(result.checkers).toHaveProperty('typescript')
      const tsChecker = result.checkers.typescript
      expect(tsChecker).toBeDefined()
      if (tsChecker) {
        expect(Array.isArray(tsChecker.errors)).toBe(true)
      }
    })
  })
})
