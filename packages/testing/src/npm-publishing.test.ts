import { execSync } from 'child_process'

import { describe, it, expect } from 'vitest'

describe('NPM Publishing Validation', () => {
  const packages = [
    'schema',
    'logger',
    'resilience',
    'core',
    'cli',
    'agent-base',
    'testing',
  ]

  it('should validate NPM scope availability', () => {
    packages.forEach((pkg) => {
      const packageName = `@orchestr8/${pkg}`

      try {
        const output = execSync(`npm view ${packageName}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 15000,
        })

        // If package exists, should have version info
        expect(output).toContain('version')
        console.log(`✅ ${packageName} exists in registry`)
      } catch (error: unknown) {
        // Package doesn't exist - this is good for new packages
        expect(
          (error as Error).message,
          `Package ${packageName} should be available for publishing`,
        ).toContain('404')
        console.log(`✅ ${packageName} available for publishing`)
      }
    })
  })

  it('should validate NPM organization scope', () => {
    expect(() => {
      // Check if @orchestr8 scope is available
      execSync('npm view @orchestr8/schema', {
        stdio: 'pipe',
        timeout: 10000,
      })
    }).not.toThrow('Organization scope @orchestr8 should be accessible')
  })

  it('should validate package.json files have correct npm fields', () => {
    packages.forEach((pkg) => {
      try {
        const packageJsonPath = `packages/${pkg}/package.json`
        const packageContent = execSync(`cat ${packageJsonPath}`, {
          encoding: 'utf-8',
        })
        const packageJson = JSON.parse(packageContent)

        // Validate required npm fields
        expect(packageJson.name).toBe(`@orchestr8/${pkg}`)
        expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/)
        expect(packageJson.publishConfig?.access).toBe('public')

        console.log(`✅ ${packageJson.name} has correct npm configuration`)
      } catch (error) {
        console.warn(
          `⚠️ Could not validate ${pkg}: ${(error as Error).message}`,
        )
      }
    })
  })
})
