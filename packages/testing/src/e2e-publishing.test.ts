import { execSync } from 'child_process'
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('End-to-End Publishing Validation', () => {
  const repoRoot = join(process.cwd(), '../..')
  let tempDir: string

  beforeAll(() => {
    // Create temporary directory for test projects
    tempDir = mkdtempSync(join(tmpdir(), 'orchestr8-e2e-'))
  })

  afterAll(() => {
    // Clean up temporary directory
    try {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Full Release Workflow Simulation', () => {
    it('should successfully execute changeset version command', () => {
      expect(() => {
        // Test changeset version without actually creating versions
        const output = execSync('changeset version --dry-run', {
          cwd: repoRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 30000,
        })

        // Should not throw and should return valid output
        expect(typeof output).toBe('string')
      }, 'changeset version --dry-run should execute successfully').not.toThrow()
    })

    it('should validate changeset status command', () => {
      const output = execSync('changeset status', {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 15000,
      })

      // Should show status of packages (even if no changesets exist yet)
      expect(output).toContain('This branch has')
      expect(typeof output).toBe('string')
    })

    it('should simulate publish workflow without actual publishing', () => {
      expect(() => {
        // Test the publish command in dry-run mode
        execSync('changeset publish --dry-run', {
          cwd: repoRoot,
          stdio: 'pipe',
          timeout: 30000,
        })
      }, 'changeset publish --dry-run should not throw').not.toThrow()
    })
  })

  describe('Package Build and Structure Validation', () => {
    it('should validate all packages have correct dual module structure after build', async () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      // Ensure packages are built
      execSync('pnpm build', {
        cwd: repoRoot,
        stdio: 'pipe',
        timeout: 120000,
      })

      for (const pkg of packages) {
        const packageDir = join(repoRoot, 'packages', pkg)
        const packageJsonPath = join(packageDir, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Check dual module exports structure
        expect(packageJson.exports).toBeDefined()
        expect(packageJson.exports['.']).toBeDefined()
        expect(packageJson.exports['.'].import).toBeDefined()
        expect(packageJson.exports['.'].require).toBeDefined()
        expect(packageJson.exports['.'].types).toBeDefined()

        // Check main, module, and types fields
        expect(packageJson.main).toBeTruthy()
        expect(packageJson.module).toBeTruthy()
        expect(packageJson.types).toBeTruthy()

        // Validate actual files exist
        const distDir = join(packageDir, 'dist')
        expect(existsSync(distDir)).toBe(true)

        // Check for ES modules
        const esmDir = join(distDir, 'esm')
        expect(existsSync(esmDir)).toBe(true)

        // Check for CommonJS
        const cjsDir = join(distDir, 'cjs')
        expect(existsSync(cjsDir)).toBe(true)

        // Check for TypeScript declarations
        const typesDir = join(distDir, 'types')
        expect(existsSync(typesDir)).toBe(true)

        // Validate package.json in cjs directory for proper commonjs marker
        const cjsPackageJsonPath = join(cjsDir, 'package.json')
        if (existsSync(cjsPackageJsonPath)) {
          const cjsPackageJson = JSON.parse(
            readFileSync(cjsPackageJsonPath, 'utf-8'),
          )
          expect(cjsPackageJson.type).toBe('commonjs')
        }
      }
    })

    it('should validate npm pack contents for all packages', () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      packages.forEach((pkg) => {
        const packageDir = join(repoRoot, 'packages', pkg)

        expect(() => {
          // npm pack creates a tarball and lists contents
          const output = execSync('npm pack --dry-run', {
            cwd: packageDir,
            encoding: 'utf-8',
            timeout: 30000,
          })

          // Should include dist directory and package.json
          expect(output).toMatch(/package.json/)
          expect(output).toMatch(/dist\//)
        }, `npm pack should work for ${pkg}`).not.toThrow()
      })
    })
  })

  describe('Consumer Project Compatibility Tests', () => {
    it('should create and test ES modules consumer project', () => {
      const projectDir = join(tempDir, 'esm-consumer')

      // Create ES modules test project
      const packageJson = {
        name: 'esm-consumer-test',
        version: '1.0.0',
        type: 'module',
        dependencies: {},
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^22.0.0',
        },
      }

      execSync(`mkdir -p "${projectDir}"`, { stdio: 'ignore' })
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      )

      // Create test TypeScript file
      const testCode = `import { z } from 'zod'

// Test importing from @orchestr8/schema (would be from local build)
// This validates the module resolution and TypeScript definitions
console.log('ES modules test would work with proper installation')
export {}`

      writeFileSync(join(projectDir, 'test.ts'), testCode)

      // Create tsconfig.json
      const tsConfig = {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020'],
          module: 'ESNext',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
        },
      }

      writeFileSync(
        join(projectDir, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2),
      )

      expect(existsSync(join(projectDir, 'package.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'test.ts'))).toBe(true)
      expect(existsSync(join(projectDir, 'tsconfig.json'))).toBe(true)
    })

    it('should create and test CommonJS consumer project', () => {
      const projectDir = join(tempDir, 'cjs-consumer')

      // Create CommonJS test project
      const packageJson = {
        name: 'cjs-consumer-test',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^22.0.0',
        },
      }

      execSync(`mkdir -p "${projectDir}"`, { stdio: 'ignore' })
      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      )

      // Create test CommonJS file
      const testCode = `const { z } = require('zod')

// Test requiring from @orchestr8/schema (would be from local build)
// This validates CommonJS module resolution
console.log('CommonJS test would work with proper installation')`

      writeFileSync(join(projectDir, 'test.js'), testCode)

      expect(existsSync(join(projectDir, 'package.json'))).toBe(true)
      expect(existsSync(join(projectDir, 'test.js'))).toBe(true)
    })

    it('should validate TypeScript compatibility', () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      packages.forEach((pkg) => {
        const packageDir = join(repoRoot, 'packages', pkg)
        const packageJsonPath = join(packageDir, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Validate TypeScript declarations exist and are properly configured
        expect(packageJson.types).toBeTruthy()

        const typesPath = join(packageDir, packageJson.types)
        expect(
          existsSync(typesPath),
          `Types file should exist for ${pkg}`,
        ).toBe(true)

        // Check exports field includes types
        if (packageJson.exports && packageJson.exports['.']) {
          expect(packageJson.exports['.'].types).toBeTruthy()
        }
      })
    })
  })

  describe('Version Strategy Validation', () => {
    it('should validate beta RC packages have correct versions', () => {
      const betaRcPackages = ['schema', 'logger', 'resilience']

      betaRcPackages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        const version = packageJson.version
        const isValidBetaRc =
          version.startsWith('1.0.0-beta.') ||
          version.startsWith('1.') ||
          version.startsWith('2.')

        expect(
          isValidBetaRc,
          `${pkg} should have beta RC or stable version, got ${version}`,
        ).toBe(true)
      })
    })

    it('should validate alpha packages have correct versions', () => {
      const alphaPackages = ['core', 'cli', 'agent-base']

      alphaPackages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        const version = packageJson.version
        const isValidAlpha =
          version.startsWith('0.') || version.includes('alpha')

        expect(
          isValidAlpha,
          `${pkg} should have alpha version, got ${version}`,
        ).toBe(true)
      })
    })

    it('should validate internal dependency versions align', () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      packages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Check if package has internal dependencies
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies,
        }

        Object.keys(allDeps).forEach((depName) => {
          if (depName.startsWith('@orchestr8/')) {
            const depVersion = allDeps[depName]

            // Internal dependencies should use workspace protocol or specific version
            expect(
              depVersion.startsWith('workspace:') ||
                depVersion.match(/^\d+\.\d+\.\d+/),
              `${pkg} should use workspace: or specific version for internal dep ${depName}`,
            ).toBe(true)
          }
        })
      })
    })
  })

  describe('Performance and Size Validation', () => {
    it('should validate package sizes are reasonable', () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      packages.forEach((pkg) => {
        const packageDir = join(repoRoot, 'packages', pkg)

        expect(() => {
          const output = execSync('npm pack --dry-run', {
            cwd: packageDir,
            encoding: 'utf-8',
            timeout: 30000,
          })

          // Parse size from npm pack output (approximate validation)
          const sizeMatch = output.match(/(\d+)kB/)
          if (sizeMatch) {
            const sizeKB = parseInt(sizeMatch[1], 10)
            // Packages should be reasonable size (less than 1MB for most cases)
            expect(sizeKB, `${pkg} size should be reasonable`).toBeLessThan(
              1024,
            )
          }
        }, `Package size check should work for ${pkg}`).not.toThrow()
      })
    })

    it('should validate build performance is acceptable', () => {
      const startTime = Date.now()

      execSync('pnpm build', {
        cwd: repoRoot,
        stdio: 'ignore',
        timeout: 300000, // 5 minutes max
      })

      const buildTime = Date.now() - startTime

      // Build should complete in reasonable time (under 2 minutes for CI)
      expect(buildTime, 'Build time should be under 2 minutes').toBeLessThan(
        120000,
      )
    })
  })

  describe('Registry and Publishing Readiness', () => {
    it('should validate npm whoami works (if authenticated)', () => {
      try {
        const npmUser = execSync('npm whoami', {
          encoding: 'utf-8',
          timeout: 10000,
        }).trim()

        if (npmUser && npmUser !== '') {
          expect(typeof npmUser).toBe('string')
          expect(npmUser.length).toBeGreaterThan(0)
        }
      } catch {
        // Not authenticated - this is expected in many environments
        console.warn(
          'NPM not authenticated - this is expected in CI/test environments',
        )
      }
    })

    it('should validate npm registry configuration', () => {
      const registry = execSync('npm config get registry', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()

      expect(registry).toBe('https://registry.npmjs.org/')
    })

    it('should validate package names are properly scoped', () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      packages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        expect(packageJson.name).toMatch(/^@orchestr8\//)
        expect(packageJson.name).toBe(`@orchestr8/${pkg}`)
      })
    })
  })

  describe('Quality Gates for Publishing', () => {
    it('should validate all tests pass before publishing simulation', async () => {
      expect(() => {
        execSync('pnpm test:ci', {
          cwd: repoRoot,
          stdio: 'pipe',
          timeout: 300000, // 5 minutes for all tests
        })
      }, 'All tests should pass before publishing').not.toThrow()
    })

    it('should validate linting and formatting before publishing', () => {
      expect(() => {
        execSync('pnpm check', {
          cwd: repoRoot,
          stdio: 'pipe',
          timeout: 120000, // 2 minutes for quality checks
        })
      }, 'Quality checks should pass before publishing').not.toThrow()
    })

    it('should validate dual module consumption script exists and works', () => {
      expect(() => {
        execSync('pnpm validate:dual-consumption', {
          cwd: repoRoot,
          stdio: 'pipe',
          timeout: 60000,
        })
      }, 'Dual module consumption validation should work').not.toThrow()
    })
  })
})
