import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

interface TurboConfig {
  $schema?: string
  globalDependencies?: string[]
  globalEnv?: string[]
  tasks: Record<
    string,
    {
      dependsOn?: string[]
      inputs?: string[]
      outputs?: string[] | []
      cache?: boolean
      persistent?: boolean
      env?: string[]
      passThroughEnv?: string[]
    }
  >
}

describe('Turbo Configuration Validation', () => {
  let turboConfig: TurboConfig

  it('should load and parse turbo.json successfully', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    expect(turboConfig).toBeDefined()
    expect(turboConfig.tasks).toBeDefined()
  })

  it('should have type-check task configured', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    expect(turboConfig.tasks['type-check']).toBeDefined()
  })

  it('should not have type-check depending on build tasks', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    const typeCheckTask = turboConfig.tasks['type-check']

    // Type-check should either have no dependencies or no build dependencies
    if (typeCheckTask.dependsOn) {
      expect(typeCheckTask.dependsOn).not.toContain('^build')
      expect(typeCheckTask.dependsOn).not.toContain('build')
    } else {
      // No dependencies is the ideal state - type-check runs independently
      expect(typeCheckTask.dependsOn).toBeUndefined()
    }
  })

  it('should allow type-check to run independently', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    const typeCheckTask = turboConfig.tasks['type-check']

    // Type-check should either have no dependencies or only non-build dependencies
    if (typeCheckTask.dependsOn) {
      const hasBuildDependency = typeCheckTask.dependsOn.some(
        (dep) => dep === 'build' || dep === '^build',
      )
      expect(hasBuildDependency).toBe(false)
    }
  })

  it('should have proper inputs for type-check task', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    const typeCheckTask = turboConfig.tasks['type-check']
    expect(typeCheckTask.inputs).toBeDefined()
    expect(typeCheckTask.inputs).toContain('src/**')
    expect(typeCheckTask.inputs).toContain('tsconfig.json')
  })

  it('should have build task dependencies properly configured', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    const buildTask = turboConfig.tasks.build
    expect(buildTask.dependsOn).toContain('^build')
  })

  it('should enable parallel execution of build and type-check', () => {
    const turboConfigPath = join(process.cwd(), '../../turbo.json')
    const configContent = readFileSync(turboConfigPath, 'utf-8')
    turboConfig = JSON.parse(configContent)

    const typeCheckTask = turboConfig.tasks['type-check']
    const buildTask = turboConfig.tasks.build

    // Verify that type-check and build can run in parallel
    // by ensuring type-check doesn't depend on build
    if (typeCheckTask.dependsOn) {
      expect(typeCheckTask.dependsOn).not.toContain('build')
      expect(typeCheckTask.dependsOn).not.toContain('^build')
    }

    // Build should still have proper dependencies
    expect(buildTask.dependsOn).toContain('^build')
  })
})
