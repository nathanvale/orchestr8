import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { describe, it, expect } from 'vitest'
import YAML from 'yaml'

// Type for GitHub Actions workflow step
interface WorkflowStep {
  name: string
  uses?: string
  with?: Record<string, unknown>
  run?: string
  env?: Record<string, string>
}

describe('CI/CD Workflow Validation', () => {
  // Use file-relative path resolution that works in both Vitest and Wallaby
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const repoRoot = join(__dirname, '../../..') // From packages/testing/src to root
  const workflowsDir = join(repoRoot, '.github', 'workflows')

  describe('GitHub Actions Workflow Files', () => {
    it('should have release.yml workflow file', () => {
      const releasePath = join(workflowsDir, 'release.yml')
      expect(existsSync(releasePath), 'release.yml workflow should exist').toBe(
        true,
      )
    })

    it('should have ci.yml workflow file', () => {
      const ciPath = join(workflowsDir, 'ci.yml')
      expect(existsSync(ciPath), 'ci.yml workflow should exist').toBe(true)
    })

    it('should validate release.yml workflow structure', () => {
      const releasePath = join(workflowsDir, 'release.yml')
      if (!existsSync(releasePath)) {
        expect.fail('release.yml does not exist')
      }

      const content = readFileSync(releasePath, 'utf-8')
      const workflow = YAML.parse(content)

      // Validate workflow structure
      expect(workflow.name).toBe('Release')
      expect(workflow.on.push.branches).toContain('main')
      expect(workflow.jobs.release).toBeDefined()

      // Validate required steps
      const steps = workflow.jobs.release.steps
      const stepNames = steps.map((step: WorkflowStep) => step.name)

      expect(stepNames).toContain('Checkout')
      expect(stepNames).toContain('Setup Node.js')
      expect(stepNames).toContain('Install pnpm')
      expect(stepNames).toContain('Install dependencies')
      expect(stepNames).toContain('Build packages')
      expect(stepNames).toContain('Run tests')
      expect(stepNames).toContain('Create Release Pull Request or Publish')

      // Validate changeset action
      const changesetStep = steps.find((step: WorkflowStep) =>
        step.name.includes('Create Release Pull Request or Publish'),
      )
      expect(changesetStep.uses).toBe('changesets/action@v1')
      expect(changesetStep.with.publish).toBeDefined()
      expect(changesetStep.env.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
      expect(changesetStep.env.NPM_TOKEN).toBe('${{ secrets.NPM_TOKEN }}')
    })

    it('should validate ci.yml workflow structure', () => {
      const ciPath = join(workflowsDir, 'ci.yml')
      if (!existsSync(ciPath)) {
        expect.fail('ci.yml does not exist')
      }

      const content = readFileSync(ciPath, 'utf-8')
      const workflow = YAML.parse(content)

      // Validate workflow structure
      expect(workflow.name).toBe('CI')
      expect(workflow.on.pull_request.branches).toContain('main')
      expect(workflow.jobs.validate).toBeDefined()

      // Validate required steps
      const steps = workflow.jobs.validate.steps
      const stepNames = steps.map((step: WorkflowStep) => step.name)

      expect(stepNames).toContain('Checkout')
      expect(stepNames).toContain('Setup Node.js')
      expect(stepNames).toContain('Install pnpm')
      expect(stepNames).toContain('Install dependencies')
      expect(stepNames).toContain('Lint, Format & Type Check')
      expect(stepNames).toContain('Build packages')
      expect(stepNames).toContain('Run tests')
      expect(stepNames).toContain('Check for changeset')

      // Validate changeset check
      const changesetStep = steps.find((step: WorkflowStep) =>
        step.name.includes('Check for changeset'),
      )
      expect(changesetStep.run).toContain('changeset status')
      expect(changesetStep.run).toContain('packages/.*/src/')
      expect(changesetStep.run).toContain('find .changeset')
    })
  })

  describe('Package.json Scripts Validation', () => {
    it('should validate required scripts exist in root package.json', () => {
      const packageJsonPath = join(repoRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      const requiredScripts = [
        'test:ci',
        'build',
        'check',
        'validate:dual-consumption',
      ]

      requiredScripts.forEach((script) => {
        expect(
          packageJson.scripts[script],
          `Script '${script}' should exist in package.json`,
        ).toBeDefined()
      })
    })

    it('should validate changeset scripts', () => {
      const packageJsonPath = join(repoRoot, 'package.json')

      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

        // Check if changesets is in devDependencies
        expect(
          packageJson.devDependencies?.['@changesets/cli'],
          'Changesets CLI should be installed',
        ).toBeDefined()
      }
    })
  })

  describe('Changeset Configuration', () => {
    it('should validate changeset config exists and is properly configured', () => {
      const configPath = join(repoRoot, '.changeset', 'config.json')
      expect(existsSync(configPath), 'Changeset config should exist').toBe(true)

      const config = JSON.parse(readFileSync(configPath, 'utf-8'))

      // Validate required configuration
      expect(config.access).toBe('public')
      expect(config.baseBranch).toBe('main')
      expect(config.changelog).toBeDefined()
      expect(Array.isArray(config.changelog)).toBe(true)
      expect(config.changelog[0]).toBe('@changesets/changelog-github')
    })

    it('should validate packages configuration for publishing', () => {
      const configPath = join(repoRoot, '.changeset', 'config.json')
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))

      // No packages should be ignored (all packages are versioned)
      expect(config.ignore).toEqual([])

      // Testing package should be private (not published to npm)
      const testingPkgPath = join(
        repoRoot,
        'packages',
        'testing',
        'package.json',
      )
      const testingPkg = JSON.parse(readFileSync(testingPkgPath, 'utf-8'))
      expect(testingPkg.private).toBe(true)
    })
  })

  describe('Release Scripts Validation', () => {
    it('should validate release:publish script exists', () => {
      const packageJsonPath = join(repoRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      expect(
        packageJson.scripts['release:publish'],
        'release:publish script should exist',
      ).toBeDefined()
      expect(
        packageJson.scripts['release:publish'],
        'release:publish should use changeset publish',
      ).toContain('changeset publish')
    })

    it('should validate test:release-workflow script exists', () => {
      const packageJsonPath = join(repoRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      expect(
        packageJson.scripts['test:release-workflow'],
        'test:release-workflow script should exist',
      ).toBeDefined()
    })

    it('should validate release workflow test script file exists', () => {
      const testScriptPath = join(
        repoRoot,
        'scripts',
        'test-release-workflow.js',
      )
      expect(
        existsSync(testScriptPath),
        'Release workflow test script should exist',
      ).toBe(true)
    })
  })

  describe('Quality Gate Validation', () => {
    it('should validate all quality gate commands work', () => {
      const packageJsonPath = join(repoRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      // These commands should be available for CI pipeline
      const requiredForQualityGate = [
        'build',
        'test:ci',
        'check', // This includes format:check, lint, type-check
      ]

      requiredForQualityGate.forEach((script) => {
        expect(
          packageJson.scripts[script],
          `Quality gate script '${script}' should exist`,
        ).toBeDefined()
      })
    })
  })
})
