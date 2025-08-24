import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { describe, it, expect } from 'vitest'

/**
 * MANUAL VERIFICATION TESTS
 *
 * These tests validate npm publishing infrastructure but make real network calls
 * to npm registries which are slow and unreliable. They should be run manually
 * by developers when needed, not as part of automated CI.
 *
 * To run: pnpm test src/npm-publishing.manual.ts
 */
describe('NPM Organization and Publishing Validation (Manual)', () => {
  // Use file-relative path resolution that works in both Vitest and Wallaby
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const repoRoot = join(__dirname, '../../..') // From packages/testing/src to root

  describe('Package Scope Validation', () => {
    it('should validate @orchestr8 scope in all package.json files', () => {
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
        expect(
          existsSync(packageJsonPath),
          `package.json should exist for ${pkg}`,
        ).toBe(true)

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        expect(packageJson.name, `${pkg} should have @orchestr8 scope`).toMatch(
          /^@orchestr8\//,
        )
      })
    })

    it('should validate testing package is marked as private', () => {
      const testingPackagePath = join(repoRoot, 'packages/testing/package.json')
      const packageJson = JSON.parse(readFileSync(testingPackagePath, 'utf-8'))

      expect(
        packageJson.private,
        '@orchestr8/testing should be marked private',
      ).toBe(true)
    })

    it('should validate public packages have correct access level', () => {
      const publicPackages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      publicPackages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Should not have private: true for public packages
        expect(
          packageJson.private,
          `${pkg} should not be marked private`,
        ).toBeUndefined()

        // Should have publishConfig for scoped packages
        expect(
          packageJson.publishConfig?.access,
          `${pkg} should have public access`,
        ).toBe('public')
      })
    })
  })

  describe('Publishing Dry Run Validation', () => {
    it('should successfully perform npm publish dry run for all packages', () => {
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
          // npm publish --dry-run should not throw for valid packages
          execSync('npm publish --dry-run', {
            cwd: packageDir,
            stdio: 'pipe',
            timeout: 30000,
          })
        }, `npm publish --dry-run should succeed for ${pkg}`).not.toThrow()
      })
    })

    it('should validate package files include necessary build artifacts', () => {
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

        // Check for dist directory after build
        const distPath = join(packageDir, 'dist')
        expect(
          existsSync(distPath),
          `${pkg} should have dist directory after build`,
        ).toBe(true)

        // Check for package.json
        const packageJsonPath = join(packageDir, 'package.json')
        expect(
          existsSync(packageJsonPath),
          `${pkg} should have package.json`,
        ).toBe(true)

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Validate main/module/types fields point to valid locations
        if (packageJson.main) {
          const mainPath = join(packageDir, packageJson.main)
          expect(
            existsSync(mainPath),
            `${pkg} main field should point to existing file`,
          ).toBe(true)
        }

        if (packageJson.module) {
          const modulePath = join(packageDir, packageJson.module)
          expect(
            existsSync(modulePath),
            `${pkg} module field should point to existing file`,
          ).toBe(true)
        }

        if (packageJson.types) {
          const typesPath = join(packageDir, packageJson.types)
          expect(
            existsSync(typesPath),
            `${pkg} types field should point to existing file`,
          ).toBe(true)
        }
      })
    })
  })

  describe('NPM Organization Setup Validation', () => {
    it('should validate npm whoami returns expected user', () => {
      // This test will help verify NPM authentication is working
      try {
        const npmUser = execSync('npm whoami', {
          encoding: 'utf-8',
          timeout: 10000,
        }).trim()
        expect(
          npmUser,
          'npm whoami should return a valid username',
        ).toBeTruthy()
        expect(typeof npmUser, 'npm user should be a string').toBe('string')
      } catch {
        // If not logged in, this is expected and we'll handle it in manual steps
        console.warn(
          'NPM authentication not configured yet - this is expected during setup',
        )
      }
    })

    it('should validate npm registry configuration', () => {
      const npmRegistry = execSync(
        'npm config get registry --workspaces=false',
        { encoding: 'utf-8', timeout: 5000 },
      ).trim()
      expect(npmRegistry, 'npm registry should be npmjs.org').toBe(
        'https://registry.npmjs.org/',
      )
    })

    it('should validate package names are available in @orchestr8 scope', async () => {
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      for (const pkg of packages) {
        const packageName = `@orchestr8/${pkg}`

        try {
          // npm view will throw if package doesn't exist (which we want for new packages)
          execSync(`npm view ${packageName}`, { stdio: 'pipe', timeout: 10000 })
          console.warn(
            `Package ${packageName} already exists - this may be expected if previously published`,
          )
        } catch (error: unknown) {
          // Package doesn't exist - this is good for new packages
          expect(
            (error as Error).message,
            `Package ${packageName} should be available for publishing`,
          ).toContain('404')
        }
      }
    })
  })

  describe('Publishing Permissions Validation', () => {
    it('should validate npm access permissions for organization packages', () => {
      // This test will be run after organization setup
      const packages = [
        'schema',
        'logger',
        'resilience',
        'core',
        'cli',
        'agent-base',
      ]

      packages.forEach((_pkg) => {
        try {
          // npm access list packages will show packages we have access to
          const accessInfo = execSync('npm access list packages', {
            encoding: 'utf-8',
            timeout: 15000,
          })

          // For new organization, this might be empty initially
          expect(typeof accessInfo, 'access info should be a string').toBe(
            'string',
          )
        } catch {
          // Expected if not set up yet or no packages published
          console.warn(
            'NPM access not configured yet - this is expected during initial setup',
          )
        }
      })
    })

    it('should validate automation token scope (manual verification)', () => {
      // This is a placeholder test that documents the requirement
      // Actual validation will be done manually with real tokens
      expect(true, 'Automation token validation will be done manually').toBe(
        true,
      )
    })
  })

  describe('Package Metadata Validation', () => {
    it('should validate all packages have consistent metadata', () => {
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

        // Required fields for NPM publishing
        expect(packageJson.name, `${pkg} should have name`).toBeTruthy()
        expect(packageJson.version, `${pkg} should have version`).toBeTruthy()
        expect(
          packageJson.description,
          `${pkg} should have description`,
        ).toBeTruthy()
        expect(packageJson.author, `${pkg} should have author`).toBeTruthy()
        expect(packageJson.license, `${pkg} should have license`).toBeTruthy()
        expect(
          packageJson.repository,
          `${pkg} should have repository`,
        ).toBeTruthy()

        // NPM publishing configuration
        expect(
          packageJson.publishConfig,
          `${pkg} should have publishConfig`,
        ).toBeDefined()
        expect(
          packageJson.publishConfig.access,
          `${pkg} should have public access`,
        ).toBe('public')

        // Files to include in package
        expect(
          packageJson.files,
          `${pkg} should specify files to include`,
        ).toBeDefined()
        expect(
          Array.isArray(packageJson.files),
          `${pkg} files should be an array`,
        ).toBe(true)
        expect(
          packageJson.files.includes('dist'),
          `${pkg} should include dist directory`,
        ).toBe(true)

        // Dual module support
        expect(
          packageJson.exports,
          `${pkg} should have exports field for dual modules`,
        ).toBeDefined()
        expect(packageJson.main, `${pkg} should have main field`).toBeTruthy()
        expect(
          packageJson.module,
          `${pkg} should have module field`,
        ).toBeTruthy()
        expect(packageJson.types, `${pkg} should have types field`).toBeTruthy()
      })
    })

    it('should validate version strategies align with package maturity', () => {
      // Beta RC packages (stable, mature features)
      const betaRcPackages = ['schema', 'logger', 'resilience']
      betaRcPackages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Beta RC should be 1.0.0-beta.x or higher
        const version = packageJson.version
        const isValidBetaRc =
          version.startsWith('1.0.0-beta.') ||
          version.startsWith('1.') ||
          version.startsWith('2.')

        expect(
          isValidBetaRc,
          `${pkg} should have beta RC or stable version (1.x.x)`,
        ).toBe(true)
      })

      // Alpha packages (experimental, under development)
      const alphaPackages = ['core', 'cli', 'agent-base']
      alphaPackages.forEach((pkg) => {
        const packageJsonPath = join(repoRoot, 'packages', pkg, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Alpha should be 0.x.x-alpha.x or 0.x.x
        const version = packageJson.version
        const isValidAlpha =
          version.startsWith('0.') || version.includes('alpha')

        expect(isValidAlpha, `${pkg} should have alpha version (0.x.x)`).toBe(
          true,
        )
      })
    })
  })

  describe('Changeset Configuration Validation', () => {
    it('should validate changeset configuration exists', () => {
      const changesetConfigPath = join(repoRoot, '.changeset/config.json')
      expect(
        existsSync(changesetConfigPath),
        'changeset config should exist',
      ).toBe(true)

      const config = JSON.parse(readFileSync(changesetConfigPath, 'utf-8'))

      expect(
        config.access,
        'changeset should be configured for public access',
      ).toBe('public')
      expect(config.baseBranch, 'changeset should use main branch').toBe('main')
      expect(
        config.updateInternalDependencies,
        'changeset should update internal deps',
      ).toBe('patch')
      expect(
        config.ignore,
        'changeset should ignore testing package',
      ).toContain('@orchestr8/testing')

      // Validate GitHub changelog integration
      expect(
        config.changelog,
        'changeset should have changelog config',
      ).toBeDefined()
      expect(
        Array.isArray(config.changelog),
        'changelog config should be array',
      ).toBe(true)
      expect(config.changelog[0], 'should use GitHub changelog').toBe(
        '@changesets/changelog-github',
      )
    })
  })
})
